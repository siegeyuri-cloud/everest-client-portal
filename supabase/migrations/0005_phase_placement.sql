-- 0005: journey phase placement — 'map' (a dot on the route) or 'beyond'
-- (the "Further Up the Mountain" teaser grid). Safe to run once.
alter table journey_phases
  add column if not exists placement text not null default 'map'
  check (placement in ('map', 'beyond'));

comment on column journey_phases.placement is
  'map = dot on the route; beyond = locked teaser card under Further Up the Mountain';
