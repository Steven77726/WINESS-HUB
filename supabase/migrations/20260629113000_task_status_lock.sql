create table if not exists public.hub_status_audit (
  id bigint generated always as identity primary key,
  task_id text not null,
  changed_at timestamptz not null default now(),
  source text not null,
  actor text,
  device_id text,
  previous_status text,
  requested_status text,
  applied_status text,
  outcome text not null
);

create index if not exists hub_status_audit_task_idx
  on public.hub_status_audit (task_id, changed_at desc);

alter table public.hub_status_audit enable row level security;

create or replace function public.hub_normalized_status(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(regexp_replace(
    translate(lower(coalesce(value, '')), 'àáâäçéèêëíîïñóôöúùûü', 'aaaaceeeeiiinooouuuu'),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

create or replace function public.hub_is_final_status(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.hub_normalized_status(value) = any(array[
    'valide', 'validee', 'validated',
    'prete', 'prete avec manquants', 'facture',
    'recupere', 'recuperee', 'recovered',
    'livre', 'livree', 'delivered',
    'termine', 'terminee', 'completed', 'finished',
    'annule', 'annulee', 'cancelled', 'canceled'
  ]);
$$;

-- Repair tasks that were finalized, then regressed by an automatic Stuart refresh.
update public.hub_tasks
set
  status = case
    when public.hub_normalized_status(data->>'stuartStatus') = any(array['finished', 'delivered', 'completed'])
      or delivered_at is not null then 'Terminée'
    when retrieved_at is not null then 'Récupérée'
    else 'Validé'
  end,
  delivered_at = case
    when public.hub_normalized_status(data->>'stuartStatus') = any(array['finished', 'delivered', 'completed'])
      then coalesce(delivered_at, completed_at, updated_at)
    else delivered_at
  end,
  data = jsonb_set(
    jsonb_set(
      data,
      '{status}',
      to_jsonb(case
        when public.hub_normalized_status(data->>'stuartStatus') = any(array['finished', 'delivered', 'completed'])
          or delivered_at is not null then 'Terminée'
        when retrieved_at is not null then 'Récupérée'
        else 'Validé'
      end),
      true
    ),
    '{history}',
    coalesce(data->'history', '[]'::jsonb) || jsonb_build_array(
      'Statut final restauré automatiquement après détection d’une régression de synchronisation.'
    ),
    true
  ),
  updated_by = 'status-repair'
where completed_at is not null
  and not public.hub_is_final_status(coalesce(status, data->>'status'));

create or replace function public.enforce_hub_task_final_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_locked boolean;
  new_final boolean;
  source_name text;
  actor_name text;
  device_name text;
  override_at timestamptz;
  explicit_reopen boolean := false;
  locked_status text;
  requested_status text;
  audit_line text;
begin
  old_locked := public.hub_is_final_status(coalesce(old.status, old.data->>'status'))
    or old.completed_at is not null;
  new_final := public.hub_is_final_status(coalesce(new.status, new.data->>'status'));
  source_name := coalesce(new.data->>'statusChangeSource', new.updated_by, 'unknown');
  actor_name := coalesce(new.data->>'statusChangedBy', new.updated_by, 'unknown');
  device_name := coalesce(new.data->>'statusChangedDevice', 'unknown');

  begin
    override_at := nullif(new.data->>'statusOverrideAt', '')::timestamptz;
  exception when others then
    override_at := null;
  end;

  explicit_reopen := source_name = 'frontend-user'
    and coalesce(new.data->>'statusOverrideBy', '') <> ''
    and override_at is not null
    and override_at > old.updated_at;

  if old_locked and not new_final and not explicit_reopen then
    requested_status := coalesce(new.status, new.data->>'status');
    locked_status := case
      when public.hub_is_final_status(coalesce(old.status, old.data->>'status'))
        then coalesce(old.status, old.data->>'status')
      when old.delivered_at is not null then 'Terminée'
      when old.retrieved_at is not null then 'Récupérée'
      else 'Validé'
    end;
    audit_line := source_name || ' — tentative ' ||
      coalesce(old.status, old.data->>'status', 'inconnu') || ' → ' ||
      coalesce(requested_status, 'inconnu') ||
      ' refusée (statut verrouillé)';

    insert into public.hub_status_audit (
      task_id, source, actor, device_id, previous_status,
      requested_status, applied_status, outcome
    ) values (
      old.id, source_name, actor_name, device_name,
      coalesce(old.status, old.data->>'status'),
      requested_status,
      locked_status, 'refusée (statut verrouillé)'
    );

    new.status := locked_status;
    new.data := jsonb_set(new.data, '{status}', to_jsonb(locked_status), true);
    new.data := jsonb_set(
      new.data,
      '{history}',
      coalesce(new.data->'history', '[]'::jsonb) || jsonb_build_array(audit_line),
      true
    );
    new.data := jsonb_set(
      new.data,
      '{statusAudit}',
      coalesce(new.data->'statusAudit', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at', now(),
        'source', source_name,
        'deviceId', device_name,
        'user', actor_name,
        'previousStatus', coalesce(old.status, old.data->>'status'),
        'nextStatus', requested_status,
        'outcome', 'refusée (statut verrouillé)'
      )),
      true
    );
    new.completed_at := old.completed_at;
    new.validated_at := old.validated_at;
    new.retrieved_at := old.retrieved_at;
    new.delivered_at := old.delivered_at;
    new.reminder_enabled := false;
    new.data := jsonb_set(new.data, '{reminderEnabled}', 'false'::jsonb, true);
    new.updated_by := 'status-lock';
    return new;
  end if;

  if coalesce(old.status, old.data->>'status', '') is distinct from coalesce(new.status, new.data->>'status', '') then
    insert into public.hub_status_audit (
      task_id, source, actor, device_id, previous_status,
      requested_status, applied_status, outcome
    ) values (
      old.id, source_name, actor_name, device_name,
      coalesce(old.status, old.data->>'status'),
      coalesce(new.status, new.data->>'status'),
      coalesce(new.status, new.data->>'status'),
      'acceptée'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists hub_tasks_final_status_lock on public.hub_tasks;
create trigger hub_tasks_final_status_lock
before update on public.hub_tasks
for each row execute function public.enforce_hub_task_final_status();
