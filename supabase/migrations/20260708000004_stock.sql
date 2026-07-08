-- stock_items
create table stock_items (
  id                        uuid primary key default uuid_generate_v4(),
  household_id              uuid not null references households(id) on delete cascade,
  label                     text not null,
  quantity                  integer not null default 0,
  alert_threshold           integer not null default 0,
  auto_decrement_on_diaper  boolean not null default false,
  created_at                timestamptz not null default now()
);

create index on stock_items (household_id);

alter table stock_items enable row level security;

create policy "household members can select stock items"
  on stock_items for select
  using (is_household_member(household_id));

create policy "household members can insert stock items"
  on stock_items for insert
  with check (is_household_member(household_id));

create policy "household members can update stock items"
  on stock_items for update
  using (is_household_member(household_id));

create policy "household members can delete stock items"
  on stock_items for delete
  using (is_household_member(household_id));

-- stock_movements
create table stock_movements (
  id            uuid primary key default uuid_generate_v4(),
  stock_item_id uuid not null references stock_items(id) on delete cascade,
  delta         integer not null,
  reason        stock_movement_reason not null default 'manual',
  at            timestamptz not null default now(),
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);

create index on stock_movements (stock_item_id, at desc);

alter table stock_movements enable row level security;

create policy "household members can select stock movements"
  on stock_movements for select
  using (
    exists (
      select 1 from stock_items si
      where si.id = stock_item_id
        and is_household_member(si.household_id)
    )
  );

create policy "household members can insert stock movements"
  on stock_movements for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from stock_items si
      where si.id = stock_item_id
        and is_household_member(si.household_id)
    )
  );

-- Trigger: maintain stock_items.quantity from stock_movements
create or replace function update_stock_quantity()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update stock_items set quantity = quantity + NEW.delta where id = NEW.stock_item_id;
  elsif (TG_OP = 'DELETE') then
    update stock_items set quantity = quantity - OLD.delta where id = OLD.stock_item_id;
  elsif (TG_OP = 'UPDATE') then
    update stock_items set quantity = quantity - OLD.delta + NEW.delta where id = NEW.stock_item_id;
  end if;
  return null;
end;
$$;

create trigger trg_update_stock_quantity
  after insert or update or delete on stock_movements
  for each row execute function update_stock_quantity();
