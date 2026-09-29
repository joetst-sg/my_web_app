-- Scheduled jobs (pg_cron). Re-running this migration replaces the jobs.

do $$
declare j text;
begin
  foreach j in array array['loupe-publish-due', 'loupe-reminders', 'loupe-popularity', 'loupe-cleanup'] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end;
$$;

-- Publish scheduled products and articles.
select cron.schedule('loupe-publish-due', '* * * * *', $$select public.publish_due()$$);

-- Send due reminders (custom dates, launches, sales).
select cron.schedule('loupe-reminders', '* * * * *', $$select public.process_due_reminders()$$);

-- Recompute trending scores.
select cron.schedule('loupe-popularity', '*/10 * * * *', $$select public.refresh_popularity_scores()$$);

-- Remove short-lived data.
select cron.schedule('loupe-cleanup', '17 3 * * *', $$select public.cleanup_old_data()$$);
