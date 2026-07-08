-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Enums
create type feeding_type as enum ('breast_left', 'breast_right', 'bottle');
create type diaper_kind as enum ('wet', 'dirty', 'mixed');
create type member_role as enum ('parent');
create type stock_movement_reason as enum ('manual', 'diaper_auto', 'restock');

-- RLS helper: avoids infinite recursion when policies query household_members
-- SECURITY DEFINER bypasses RLS on the internal query
create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from household_members
    where household_id = hid
      and user_id = auth.uid()
  );
$$;
