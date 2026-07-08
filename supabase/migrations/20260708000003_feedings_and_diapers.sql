-- feedings
create table feedings (
  id          uuid primary key default uuid_generate_v4(),
  baby_id     uuid not null references babies(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  type        feeding_type not null,
  amount_ml   integer check (amount_ml > 0),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create index on feedings (baby_id, started_at desc);

alter table feedings enable row level security;

create policy "household members can select feedings"
  on feedings for select
  using (
    exists (
      select 1 from babies b
      where b.id = baby_id
        and is_household_member(b.household_id)
    )
  );

create policy "household members can insert feedings"
  on feedings for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from babies b
      where b.id = baby_id
        and is_household_member(b.household_id)
    )
  );

create policy "household members can update feedings"
  on feedings for update
  using (
    exists (
      select 1 from babies b
      where b.id = baby_id
        and is_household_member(b.household_id)
    )
  );

-- diapers
create table diapers (
  id          uuid primary key default uuid_generate_v4(),
  baby_id     uuid not null references babies(id) on delete cascade,
  at          timestamptz not null default now(),
  kind        diaper_kind not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create index on diapers (baby_id, at desc);

alter table diapers enable row level security;

create policy "household members can select diapers"
  on diapers for select
  using (
    exists (
      select 1 from babies b
      where b.id = baby_id
        and is_household_member(b.household_id)
    )
  );

create policy "household members can insert diapers"
  on diapers for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from babies b
      where b.id = baby_id
        and is_household_member(b.household_id)
    )
  );
