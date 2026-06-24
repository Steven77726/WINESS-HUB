with normalized as (
  select
    id,
    regexp_replace(
      translate(lower(coalesce(status, data->>'status', '')), 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc'),
      '[^a-z]',
      '',
      'g'
    ) as status_key
  from public.hub_tasks
)
update public.hub_tasks as tasks
set
  completed_at = coalesce(tasks.completed_at, tasks.updated_at),
  validated_at = coalesce(tasks.validated_at, tasks.updated_at),
  reminder_enabled = false,
  data = jsonb_strip_nulls(
    tasks.data || jsonb_build_object(
      'completedAt', coalesce(tasks.completed_at, tasks.updated_at),
      'validatedAt', coalesce(tasks.validated_at, tasks.updated_at),
      'reminderEnabled', false
    )
  )
from normalized
where tasks.id = normalized.id
  and normalized.status_key in ('valide', 'validee', 'validated');
