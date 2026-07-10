-- C1: Add DELETE policy on stock_movements so snackbar undo works from the client
-- (without this, PostgREST silently ignores deletes with RLS active and no policy)
create policy "household members can delete their stock movements"
  on stock_movements for delete
  using (
    created_by = auth.uid()
    and exists (
      select 1 from stock_items si
      where si.id = stock_item_id
        and is_household_member(si.household_id)
    )
  );
