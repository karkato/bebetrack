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

-- Ensure authenticated role has SELECT on Realtime tables.
-- Supabase JS v2 propagates the user JWT to Realtime channels automatically
-- (same client instance used for auth via onAuthStateChange).
-- Combined with the existing RLS SELECT policies (is_baby_household_member),
-- this ensures users only receive events for their own household.
grant select on public.feedings to authenticated;
grant select on public.diapers to authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.reminders to authenticated;
