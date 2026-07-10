-- Atomic RPC: insert diaper + stock_movements for auto_decrement items
create or replace function public.record_diaper_with_stock(
  p_baby_id uuid,
  p_kind    diaper_kind
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diaper_id   uuid;
  v_household_id uuid;
begin
  -- Resolve household from baby
  select household_id into v_household_id
  from public.babies where id = p_baby_id;

  -- Insert diaper
  insert into public.diapers (baby_id, kind, created_by)
  values (p_baby_id, p_kind, auth.uid())
  returning id into v_diaper_id;

  -- Decrement stock for all auto_decrement items of this household
  insert into public.stock_movements (stock_item_id, delta, reason, created_by)
  select id, -1, 'diaper_auto', auth.uid()
  from public.stock_items
  where household_id = v_household_id
    and auto_decrement_on_diaper = true;

  return json_build_object('diaper_id', v_diaper_id);
end;
$$;

-- Symmetric undo RPC
-- KNOWN DEBT: movements are matched by time window (±5 s) + reason + created_by rather
-- than a direct FK. Two diapers recorded within 5 s by the same user could lose each
-- other's stock movements. MVP-acceptable; proper fix = add stock_movements.diaper_id FK.
create or replace function public.delete_diaper_with_stock(p_diaper_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  select created_at into v_at from public.diapers where id = p_diaper_id;

  -- Remove diaper_auto movements created at the same time (within 5s window)
  delete from public.stock_movements
  where reason = 'diaper_auto'
    and created_by = auth.uid()
    and created_at between v_at - interval '5 seconds' and v_at + interval '5 seconds';

  -- Delete the diaper
  delete from public.diapers where id = p_diaper_id;
end;
$$;
