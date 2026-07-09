-- feeding_preference enum for babies
create type feeding_preference as enum ('breast', 'bottle', 'mixed');

alter table public.babies
  add column feeding_preference feeding_preference not null default 'mixed';
