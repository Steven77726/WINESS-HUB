create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'winess-stuart-poll' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'winess-stuart-poll',
  '*/5 * * * *',
  $request$
    select net.http_post(
      url := 'https://xzcshuoelidzdlihnwme.supabase.co/functions/v1/poll-stuart',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_KI7h19VdLtB2YfXBsN4bAw_9KQMxNBs'
      ),
      body := '{}'::jsonb
    );
  $request$
);
