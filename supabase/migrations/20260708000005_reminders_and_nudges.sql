-- reminders
create table reminders (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references households(id) on delete cascade,
  label         text not null,
  due_at        timestamptz not null,
  recurrence    text,
  done_at       timestamptz,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);

create index on reminders (household_id, due_at);

alter table reminders enable row level security;

create policy "household members can select reminders"
  on reminders for select
  using (is_household_member(household_id));

create policy "household members can insert reminders"
  on reminders for insert
  with check (created_by = auth.uid() and is_household_member(household_id));

create policy "household members can update reminders"
  on reminders for update
  using (is_household_member(household_id));

create policy "household members can delete reminders"
  on reminders for delete
  using (is_household_member(household_id));

-- nudges
create table nudges (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references households(id) on delete cascade,
  template_key  text not null,
  payload       jsonb not null default '{}',
  sent_by       uuid not null references auth.users(id),
  sent_at       timestamptz not null default now()
);

create index on nudges (household_id, sent_at desc);

alter table nudges enable row level security;

create policy "household members can select nudges"
  on nudges for select
  using (is_household_member(household_id));

create policy "household members can insert nudges"
  on nudges for insert
  with check (sent_by = auth.uid() and is_household_member(household_id));

-- push_subscriptions
create table push_subscriptions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  endpoint      text not null unique,
  keys          jsonb not null,
  created_at    timestamptz not null default now()
);

create index on push_subscriptions (household_id);
create index on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "users can select their own push subscriptions"
  on push_subscriptions for select
  using (user_id = auth.uid());

create policy "users can insert their own push subscriptions"
  on push_subscriptions for insert
  with check (user_id = auth.uid() and is_household_member(household_id));

create policy "users can delete their own push subscriptions"
  on push_subscriptions for delete
  using (user_id = auth.uid());
