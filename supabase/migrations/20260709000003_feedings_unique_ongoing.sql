-- Prevent multiple concurrent ongoing feedings per baby
create unique index feedings_one_ongoing_per_baby
  on public.feedings (baby_id)
  where ended_at is null;
