-- Allow household members to delete diapers (enables undo after one-tap recording)
create policy "household members can delete diapers"
  on public.diapers for delete
  using (public.is_baby_household_member(baby_id));

-- Allow household members to delete feedings (enables undo in ticket 5)
create policy "household members can delete feedings"
  on public.feedings for delete
  using (public.is_baby_household_member(baby_id));
