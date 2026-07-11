-- RPC : liste les membres du foyer avec leur email
-- SECURITY DEFINER pour accéder à auth.users (inaccessible en RLS client)
create or replace function public.get_household_members(hid uuid)
returns table(user_id uuid, email text, role text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(hid) then
    raise exception 'not a member of this household';
  end if;

  return query
  select hm.user_id, u.email::text, hm.role::text
  from public.household_members hm
  join auth.users u on u.id = hm.user_id
  where hm.household_id = hid
  order by hm.created_at;
end;
$$;
