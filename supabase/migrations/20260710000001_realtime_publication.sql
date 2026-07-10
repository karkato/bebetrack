-- Enable Supabase Realtime for event tables
-- Idempotent: checks pg_publication_tables before each ADD TABLE
do $$
declare
  t text;
begin
  foreach t in array array['feedings', 'diapers', 'stock_movements', 'reminders'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Ensure authenticated role has SELECT on Realtime tables
-- (required for Supabase Realtime postgres_changes to apply RLS)
grant select on public.feedings to authenticated;
grant select on public.diapers to authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.reminders to authenticated;
