create type public.user_role as enum ('rider', 'dispatcher', 'admin');
create type public.trip_type as enum ('one_way', 'round_trip');
create type public.trip_status as enum ('requested', 'scheduled', 'driver_assigned', 'completed', 'cancelled');
create type public.sos_status as enum ('active', 'acknowledged', 'resolved');

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Chicago',
  emergency_phone text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id),
  role public.user_role not null default 'rider',
  full_name text not null,
  phone text,
  mobility_needs text,
  created_at timestamptz not null default now()
);

create table public.trip_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id),
  agency_id uuid not null references public.agencies(id),
  trip_type public.trip_type not null,
  pickup_address text not null,
  destination_address text not null,
  travel_date date not null,
  pickup_time time not null,
  return_pickup_time time,
  mobility_needs text,
  status public.trip_status not null default 'requested',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint round_trip_requires_return check (
    trip_type = 'one_way' or return_pickup_time is not null
  )
);

create table public.trip_request_history (
  id bigint generated always as identity primary key,
  trip_request_id uuid not null references public.trip_requests(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  previous_data jsonb,
  new_data jsonb not null,
  created_at timestamptz not null default now()
);

create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id),
  agency_id uuid not null references public.agencies(id),
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  status public.sos_status not null default 'active',
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index trip_requests_agency_status_idx on public.trip_requests (agency_id, status, travel_date);
create index sos_events_agency_status_idx on public.sos_events (agency_id, status, created_at desc);

alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.trip_requests enable row level security;
alter table public.trip_request_history enable row level security;
alter table public.sos_events enable row level security;

create policy "riders read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "riders manage own trips" on public.trip_requests
  for all using (rider_id = auth.uid()) with check (rider_id = auth.uid());
create policy "agency staff read assigned trips" on public.trip_requests
  for select using (
    agency_id in (
      select agency_id from public.profiles
      where id = auth.uid() and role in ('dispatcher', 'admin')
    )
  );
create policy "agency staff update assigned trips" on public.trip_requests
  for update using (
    agency_id in (
      select agency_id from public.profiles
      where id = auth.uid() and role in ('dispatcher', 'admin')
    )
  );
create policy "riders create and read own sos" on public.sos_events
  for all using (rider_id = auth.uid()) with check (rider_id = auth.uid());
create policy "agency staff manage sos" on public.sos_events
  for all using (
    agency_id in (
      select agency_id from public.profiles
      where id = auth.uid() and role in ('dispatcher', 'admin')
    )
  );

alter publication supabase_realtime add table public.trip_requests;
alter publication supabase_realtime add table public.sos_events;
