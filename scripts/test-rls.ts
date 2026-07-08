/**
 * RLS isolation test — verifies a user cannot read or write data from a household they don't belong to.
 *
 * Prerequisites:
 *   - Two test users created in Supabase Auth dashboard (email+password)
 *   - seed.sql executed (creates 2 households: shared one + isolation test one with only parent A)
 *
 * Strategy:
 *   The seed creates a second household ('__rls_isolation_test__', id: 55555555-...)
 *   where only user A is a member. User B has no access to it → isolation tested on static data.
 *
 * Usage:
 *   npm run test:rls
 *
 * Supabase credentials are read from src/environments/environment.ts.
 * Only test user credentials need to be in .env.test:
 *   USER_A_EMAIL, USER_A_PASSWORD, USER_B_EMAIL, USER_B_PASSWORD
 */

import { createClient } from '@supabase/supabase-js';
import { environment } from '../src/environments/environment.js';

const url  = environment.supabaseUrl;
const anon = environment.supabaseAnonKey;

const ISOLATION_HOUSEHOLD_ID = '55555555-5555-5555-5555-555555555555';

async function run() {
  const clientA = createClient(url, anon);
  const clientB = createClient(url, anon);

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

  const { data: { user: userB } } = await clientB.auth.getUser();
  if (!userB) throw new Error('Could not retrieve user B identity');

  // 1. User A can see the isolation household (they are a member)
  const { data: seenByA } = await clientA
    .from('households')
    .select('id')
    .eq('id', ISOLATION_HOUSEHOLD_ID);
  console.log(`[A] sees isolation household: ${seenByA?.length ?? 0} (expected: 1)`);
  assert((seenByA?.length ?? 0) === 1, 'User A should see the isolation household (they are a member)');

  // 2. User B cannot see the isolation household (not a member)
  const { data: seenByB } = await clientB
    .from('households')
    .select('id')
    .eq('id', ISOLATION_HOUSEHOLD_ID);
  console.log(`[B] sees isolation household: ${seenByB?.length ?? 0} (expected: 0)`);
  assert((seenByB?.length ?? 0) === 0, 'User B must not see a household they are not a member of');

  // 3. User B cannot insert themselves into the isolation household
  const { error: insertMemberErr } = await clientB
    .from('household_members')
    .insert({ household_id: ISOLATION_HOUSEHOLD_ID, user_id: userB.id, role: 'parent' });
  console.log(`[B] insert into isolation household: ${insertMemberErr ? 'blocked ✓' : 'ALLOWED ✗'}`);
  assert(!!insertMemberErr, 'User B must not be able to insert into a foreign household');

  // 4. User A sees exactly 2 households (shared + isolation)
  const { data: householdsA } = await clientA.from('households').select('id');
  console.log(`[A] visible households: ${householdsA?.length ?? 0} (expected: 2)`);
  assert((householdsA?.length ?? 0) === 2, 'User A should see 2 households (shared + isolation)');

  // 5. User B sees exactly 1 household (only the shared one)
  const { data: householdsB } = await clientB.from('households').select('id');
  console.log(`[B] visible households: ${householdsB?.length ?? 0} (expected: 1)`);
  assert((householdsB?.length ?? 0) === 1, 'User B should see only 1 household (the shared one)');

  // 6. User B cannot see stock items from the shared household via isolation household
  const { data: stockSeenByB } = await clientB.from('stock_items').select('id');
  console.log(`[B] visible stock_items: ${stockSeenByB?.length ?? 0} (expected: 3 — from shared household only)`);
  assert((stockSeenByB?.length ?? 0) === 3, 'User B should only see stock items from their own household');

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
