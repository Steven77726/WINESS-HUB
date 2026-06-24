alter table public.hub_tasks
  add column if not exists completed_at timestamptz,
  add column if not exists validated_at timestamptz,
  add column if not exists retrieved_at timestamptz,
  add column if not exists delivered_at timestamptz;

update public.hub_tasks
set
  completed_at = coalesce(completed_at, updated_at),
  validated_at = case when status in ('Validée', 'Prête', 'Terminée', 'Terminé', 'Facturé') then coalesce(validated_at, updated_at) else validated_at end,
  retrieved_at = case when status in ('Récupérée', 'Récupéré') then coalesce(retrieved_at, updated_at) else retrieved_at end,
  delivered_at = case when status in ('Livrée', 'Livré') then coalesce(delivered_at, updated_at) else delivered_at end
where status in ('Validée', 'Prête', 'Terminée', 'Terminé', 'Livré', 'Livrée', 'Récupéré', 'Récupérée', 'Facturé');

update public.hub_tasks
set data = jsonb_strip_nulls(
  data || jsonb_build_object(
    'completedAt', completed_at,
    'validatedAt', validated_at,
    'retrievedAt', retrieved_at,
    'deliveredAt', delivered_at
  )
)
where completed_at is not null;
