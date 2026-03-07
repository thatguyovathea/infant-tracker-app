create table if not exists growth_logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  logged_by uuid references auth.users(id),
  measured_at timestamptz not null default now(),
  weight_kg numeric(5,3),
  height_cm numeric(5,1),
  head_cm numeric(5,1),
  notes text,
  created_at timestamptz not null default now()
);

alter table growth_logs enable row level security;

create policy "Family members can manage growth logs"
  on growth_logs for all
  using (is_family_member(family_id))
  with check (is_family_member(family_id));
