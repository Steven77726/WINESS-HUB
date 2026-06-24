update public.hub_tasks
set
  completed_at = coalesce(completed_at, updated_at),
  validated_at = coalesce(validated_at, updated_at),
  reminder_enabled = false,
  data = jsonb_strip_nulls(
    data || jsonb_build_object(
      'completedAt', coalesce(completed_at, updated_at),
      'validatedAt', coalesce(validated_at, updated_at),
      'reminderEnabled', false
    )
  )
where status in ('Validé', 'Validée');
