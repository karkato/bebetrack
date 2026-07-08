-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Enums
create type feeding_type as enum ('breast_left', 'breast_right', 'bottle');
create type diaper_kind as enum ('wet', 'dirty', 'mixed');
create type member_role as enum ('parent');
create type stock_movement_reason as enum ('manual', 'diaper_auto', 'restock');

-- RLS helper: avoids infinite recursion when policies query household_members
-- SECURITY DEFINER bypasses RLS on the internal query
-- search_path is pinned to '' to prevent table shadowing attacks
-- plpgsql (not sql): body compiled at call time, not at creation — allows forward reference to household_members
create or replace function is_household_member(hid uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
  );
end;
$$;

-- RLS helper: avoids repeating the baby→household join in every event table policy
-- plpgsql: same forward-reference rationale as is_household_member
create or replace function is_baby_household_member(bid uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.babies b
    where b.id = bid
      and public.is_household_member(b.household_id)
  );
end;
$$;
