-- Table d'invitations
create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_by   uuid not null,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid
);

-- RLS
alter table public.household_invites enable row level security;

-- SELECT : membres du foyer seulement
create policy "household members can view invites"
  on public.household_invites for select
  using (public.is_household_member(household_id));

-- INSERT : membres du foyer seulement (via RPC, mais protégé aussi côté policy)
create policy "household members can create invites"
  on public.household_invites for insert
  with check (public.is_household_member(household_id) and created_by = auth.uid());

-- RPC 1 : créer un foyer + ajouter le créateur comme membre (atomique)
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name)
  values (household_name)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'parent');

  return new_household_id;
end;
$$;

-- RPC 2 : créer un lien d'invitation pour un foyer
create or replace function public.create_invite(hid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text;
begin
  if not public.is_household_member(hid) then
    raise exception 'not a member of this household';
  end if;

  insert into public.household_invites (household_id, created_by)
  values (hid, auth.uid())
  returning token into new_token;

  return new_token;
end;
$$;

-- RPC 3 : accepter une invitation
create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites;
  member_count integer;
begin
  select * into invite
  from public.household_invites
  where token = invite_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invalid or expired invitation token';
  end if;

  -- Idempotent : déjà membre → retourner le household_id
  if public.is_household_member(invite.household_id) then
    return invite.household_id;
  end if;

  -- Limite 2 parents par foyer
  select count(*) into member_count
  from public.household_members
  where household_id = invite.household_id;

  if member_count >= 2 then
    raise exception 'household already has 2 members';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, auth.uid(), 'parent');

  update public.household_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = invite.id;

  return invite.household_id;
end;
$$;
