/**
 * RLS isolation test — verifies foyer A cannot read foyer B data.
 *
 * Prerequisites:
 *   - Two test users created in Supabase Auth dashboard
 *   - seed.sql executed (household, baby, stock_items in place)
 *   - A second household manually inserted for user B (or adapt UUIDs below)
 *
 * Usage:
 *   npx tsx scripts/test-rls.ts
 *
 * Set env vars before running:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, USER_A_EMAIL, USER_A_PASSWORD, USER_B_EMAIL, USER_B_PASSWORD
 */

import { createClient } from '@supabase/supabase-js';

const url  = process.env['SUPABASE_URL']!;
const anon = process.env['SUPABASE_ANON_KEY']!;

async function run() {
  const clientA = createClient(url, anon);
  const clientB = createClient(url, anon);

  // Sign in both users
  const { error: errA } = await clientA.auth.signInWithPassword({
    email:    process.env['USER_A_EMAIL']!,
    password: process.env['USER_A_PASSWORD']!,
  });
  if (errA) throw new Error(`Sign-in A failed: ${errA.message}`);

  const { error: errB } = await clientB.auth.signInWithPassword({
    email:    process.env['USER_B_EMAIL']!,
    password: process.env['USER_B_PASSWORD']!,
  });
  if (errB) throw new Error(`Sign-in B failed: ${errB.message}`);

  // User A reads their own household
  const { data: householdsA } = await clientA.from('households').select('id, name');
  console.log(`[A] visible households: ${householdsA?.length ?? 0} (expected: 1)`);
  assert((householdsA?.length ?? 0) === 1, 'User A should see exactly 1 household');

  // User B should see 0 rows from user A's household
  const householdAId = householdsA![0].id;
  const { data: rowsSeenByB } = await clientB
    .from('households')
    .select('id')
    .eq('id', householdAId);
  console.log(`[B] rows from A's household: ${rowsSeenByB?.length ?? 0} (expected: 0)`);
  assert((rowsSeenByB?.length ?? 0) === 0, 'User B must not see household A');

  // User B cannot insert into A's household
  const { error: insertErr } = await clientB
    .from('household_members')
    .insert({ household_id: householdAId, user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role: 'parent' });
  console.log(`[B] insert into A's household: ${insertErr ? 'blocked ✓' : 'ALLOWED ✗'}`);
  assert(!!insertErr, 'User B must not be able to insert into household A');

  // User A reads their babies
  const { data: babiesA } = await clientA.from('babies').select('id');
  console.log(`[A] visible babies: ${babiesA?.length ?? 0} (expected: 1)`);
  assert((babiesA?.length ?? 0) === 1, 'User A should see 1 baby');

  // User B reads babies — should see 0
  const { data: babiesSeenByB } = await clientB.from('babies').select('id');
  console.log(`[B] visible babies: ${babiesSeenByB?.length ?? 0} (expected: 0)`);
  assert((babiesSeenByB?.length ?? 0) === 0, 'User B must not see household A babies');

  console.log('\n✅ All RLS isolation checks passed.');
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\n❌ FAIL: ${message}`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
