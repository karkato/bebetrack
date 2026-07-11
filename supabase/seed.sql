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
  parent_a_id  uuid := '1a6ba102-8483-4f27-8f6a-5feb958cd9b9';
  parent_b_id  uuid := 'ac79f8ac-5dc5-45fd-b39e-126f28c2b5f7';
  household_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  baby_id      uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  item_diapers uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  item_milk    uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  item_wipes   uuid := '11111111-1111-1111-1111-111111111111';
  mv_diapers   uuid := '22222222-2222-2222-2222-222222222222';
  mv_milk      uuid := '33333333-3333-3333-3333-333333333333';
  mv_wipes     uuid := '44444444-4444-4444-4444-444444444444';
  -- Second household for RLS isolation testing: only parent A is a member
  isolation_household_id uuid := '55555555-5555-5555-5555-555555555555';
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

  -- ── Timeline seed data (deterministic, last 7 days) ──────────────────────────
  -- Feedings: multiple per day so average interval is calculable
  -- Days are expressed as relative offsets from a fixed anchor: 2026-06-30 UTC
  -- (adjust if you need a different anchor; UUIDs are fixed for idempotency)

  insert into feedings (id, baby_id, type, started_at, ended_at, amount_ml, created_by)
  values
    -- J-6 (2026-06-24): 3 tétées sein gauche (intervalles ~3h)
    ('aa000001-0000-0000-0000-000000000001', baby_id, 'breast_left',  '2026-06-24T06:00:00Z', '2026-06-24T06:20:00Z', null, parent_a_id),
    ('aa000001-0000-0000-0000-000000000002', baby_id, 'breast_right', '2026-06-24T09:00:00Z', '2026-06-24T09:18:00Z', null, parent_a_id),
    ('aa000001-0000-0000-0000-000000000003', baby_id, 'breast_left',  '2026-06-24T12:00:00Z', '2026-06-24T12:22:00Z', null, parent_a_id),

    -- J-5 (2026-06-25): 4 tétées + 1 biberon
    ('aa000002-0000-0000-0000-000000000001', baby_id, 'breast_left',  '2026-06-25T07:00:00Z', '2026-06-25T07:20:00Z', null,  parent_a_id),
    ('aa000002-0000-0000-0000-000000000002', baby_id, 'breast_right', '2026-06-25T10:00:00Z', '2026-06-25T10:15:00Z', null,  parent_b_id),
    ('aa000002-0000-0000-0000-000000000003', baby_id, 'bottle',       '2026-06-25T13:00:00Z', '2026-06-25T13:00:00Z', 90,    parent_b_id),
    ('aa000002-0000-0000-0000-000000000004', baby_id, 'breast_left',  '2026-06-25T16:30:00Z', '2026-06-25T16:48:00Z', null,  parent_a_id),

    -- J-4 (2026-06-26): 1 seule tétée (avgInterval = null pour ce jour)
    ('aa000003-0000-0000-0000-000000000001', baby_id, 'breast_right', '2026-06-26T09:00:00Z', '2026-06-26T09:20:00Z', null,  parent_a_id),

    -- J-3 (2026-06-27): 3 tétées
    ('aa000004-0000-0000-0000-000000000001', baby_id, 'breast_left',  '2026-06-27T06:30:00Z', '2026-06-27T06:50:00Z', null,  parent_a_id),
    ('aa000004-0000-0000-0000-000000000002', baby_id, 'breast_right', '2026-06-27T10:00:00Z', '2026-06-27T10:20:00Z', null,  parent_b_id),
    ('aa000004-0000-0000-0000-000000000003', baby_id, 'bottle',       '2026-06-27T14:00:00Z', '2026-06-27T14:00:00Z', 120,   parent_a_id),

    -- J-2 (2026-06-28): 2 tétées (intervalle = 4h)
    ('aa000005-0000-0000-0000-000000000001', baby_id, 'breast_left',  '2026-06-28T08:00:00Z', '2026-06-28T08:18:00Z', null,  parent_a_id),
    ('aa000005-0000-0000-0000-000000000002', baby_id, 'breast_right', '2026-06-28T12:00:00Z', '2026-06-28T12:15:00Z', null,  parent_b_id),

    -- J-1 (2026-06-29): 3 tétées
    ('aa000006-0000-0000-0000-000000000001', baby_id, 'breast_left',  '2026-06-29T07:00:00Z', '2026-06-29T07:20:00Z', null,  parent_a_id),
    ('aa000006-0000-0000-0000-000000000002', baby_id, 'bottle',       '2026-06-29T11:00:00Z', '2026-06-29T11:00:00Z', 80,    parent_b_id),
    ('aa000006-0000-0000-0000-000000000003', baby_id, 'breast_right', '2026-06-29T15:30:00Z', '2026-06-29T15:48:00Z', null,  parent_a_id),

    -- J (2026-06-30): 2 tétées (pour la vue Journée)
    ('aa000007-0000-0000-0000-000000000001', baby_id, 'breast_left',  '2026-06-30T07:00:00Z', '2026-06-30T07:22:00Z', null,  parent_a_id),
    ('aa000007-0000-0000-0000-000000000002', baby_id, 'breast_right', '2026-06-30T11:00:00Z', '2026-06-30T11:18:00Z', null,  parent_b_id)
  on conflict (id) do nothing;

  insert into diapers (id, baby_id, at, kind, created_by)
  values
    ('bb000001-0000-0000-0000-000000000001', baby_id, '2026-06-24T08:00:00Z', 'wet',   parent_a_id),
    ('bb000001-0000-0000-0000-000000000002', baby_id, '2026-06-24T13:00:00Z', 'dirty', parent_a_id),
    ('bb000002-0000-0000-0000-000000000001', baby_id, '2026-06-25T09:00:00Z', 'wet',   parent_b_id),
    ('bb000002-0000-0000-0000-000000000002', baby_id, '2026-06-25T14:00:00Z', 'mixed', parent_a_id),
    ('bb000003-0000-0000-0000-000000000001', baby_id, '2026-06-26T10:00:00Z', 'wet',   parent_a_id),
    ('bb000004-0000-0000-0000-000000000001', baby_id, '2026-06-27T08:00:00Z', 'dirty', parent_a_id),
    ('bb000004-0000-0000-0000-000000000002', baby_id, '2026-06-27T15:00:00Z', 'wet',   parent_b_id),
    ('bb000005-0000-0000-0000-000000000001', baby_id, '2026-06-28T09:00:00Z', 'wet',   parent_a_id),
    ('bb000006-0000-0000-0000-000000000001', baby_id, '2026-06-29T08:00:00Z', 'mixed', parent_b_id),
    -- J: 2 couches pour la vue Journée
    ('bb000007-0000-0000-0000-000000000001', baby_id, '2026-06-30T08:00:00Z', 'wet',   parent_a_id),
    ('bb000007-0000-0000-0000-000000000002', baby_id, '2026-06-30T12:30:00Z', 'dirty', parent_b_id)
  on conflict (id) do nothing;

  -- RLS isolation household: only parent A is a member — used by test:rls to verify B cannot cross households
  insert into households (id, name)
  values (isolation_household_id, '__rls_isolation_test__')
  on conflict (id) do nothing;

  insert into household_members (household_id, user_id, role)
  values (isolation_household_id, parent_a_id, 'parent')
  on conflict do nothing;

end $$;
