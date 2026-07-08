-- households
create table households (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table households enable row level security;

create policy "household members can select their household"
  on households for select
  using (is_household_member(id));

create policy "household members can update their household"
  on households for update
  using (is_household_member(id));

-- household_members
create table household_members (
  household_id  uuid not null references households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          member_role not null default 'parent',
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index on household_members (user_id);

alter table household_members enable row level security;

create policy "members can view their household members"
  on household_members for select
  using (is_household_member(household_id));

create policy "members can insert themselves into a household"
  on household_members for insert
  with check (user_id = auth.uid());

-- babies
create table babies (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  birth_date    date not null,
  created_at    timestamptz not null default now()
);

create index on babies (household_id);

alter table babies enable row level security;

create policy "household members can select babies"
  on babies for select
  using (is_household_member(household_id));

create policy "household members can insert babies"
  on babies for insert
  with check (is_household_member(household_id));

create policy "household members can update babies"
  on babies for update
  using (is_household_member(household_id));
