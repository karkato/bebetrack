-- =============================================================================
-- BébéTrack — Dev Seed
-- =============================================================================
-- Prerequisites:
--   1. Create two test users in Supabase Auth dashboard (Authentication > Users)
--   2. Copy their UUIDs and replace the placeholders below
--   3. Run this script in Supabase SQL Editor
-- =============================================================================

do $$
declare
  parent_a_id  uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; -- TODO: replace with Parent A UUID
  parent_b_id  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; -- TODO: replace with Parent B UUID
  household_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  baby_id      uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  item_diapers uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  item_milk    uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  item_wipes   uuid := '11111111-1111-1111-1111-111111111111';
  mv_diapers   uuid := '22222222-2222-2222-2222-222222222222';
  mv_milk      uuid := '33333333-3333-3333-3333-333333333333';
  mv_wipes     uuid := '44444444-4444-4444-4444-444444444444';
begin

  -- Household
  insert into households (id, name)
  values (household_id, 'Famille Dupont')
  on conflict (id) do nothing;

  -- Members
  insert into household_members (household_id, user_id, role)
  values
    (household_id, parent_a_id, 'parent'),
    (household_id, parent_b_id, 'parent')
  on conflict do nothing;

  -- Baby
  insert into babies (id, household_id, name, birth_date)
  values (baby_id, household_id, 'Bébé', '2026-06-01')
  on conflict (id) do nothing;

  -- Stock items (quantity starts at 0, movements set the real quantity)
  insert into stock_items (id, household_id, label, quantity, alert_threshold, auto_decrement_on_diaper)
  values
    (item_diapers, household_id, 'Couches',              0, 10, true),
    (item_milk,    household_id, 'Lait (boîtes)',         0,  2, false),
    (item_wipes,   household_id, 'Lingettes (paquets)',   0,  1, false)
  on conflict (id) do nothing;

  -- Initial stock movements (these drive quantity via trigger)
  -- Fixed UUIDs + on conflict ensure re-runs are idempotent and don't corrupt quantities
  insert into stock_movements (id, stock_item_id, delta, reason, created_by)
  values
    (mv_diapers, item_diapers, 40, 'restock', parent_a_id),
    (mv_milk,    item_milk,     3, 'restock', parent_a_id),
    (mv_wipes,   item_wipes,    4, 'restock', parent_a_id)
  on conflict (id) do nothing;

end $$;
