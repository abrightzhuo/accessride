alter table public.profiles
  add column if not exists username text,
  add column if not exists date_of_birth date,
  add column if not exists address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists communication_preference text not null default 'text',
  add column if not exists status text not null default 'active';

alter table public.profiles
  add constraint profiles_communication_preference_check
  check (communication_preference in ('voice', 'text', 'relay'));

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'inactive'));

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_agency_role_idx
  on public.profiles (agency_id, role, status);

insert into public.agencies (id, name, timezone, emergency_phone)
values (
  '00000000-0000-4000-8000-000000000001',
  'Chicago Human Services',
  'America/Chicago',
  null
)
on conflict (id) do update
set name = excluded.name,
    timezone = excluded.timezone;

create or replace function public.handle_accessride_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'dispatch@accessride.gov' then
    insert into public.profiles (
      id,
      agency_id,
      role,
      full_name,
      phone,
      status
    )
    values (
      new.id,
      '00000000-0000-4000-8000-000000000001',
      'admin',
      'Chicago Human Services Dispatcher',
      null,
      'active'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists accessride_auth_user_created on auth.users;
create trigger accessride_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_accessride_auth_user();

create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select agency_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_agency_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_agency_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;

create policy "agency staff read agency riders" on public.profiles
  for select using (
    agency_id = public.current_agency_id()
    and public.current_user_role() in ('dispatcher', 'admin')
  );

create policy "agency staff update agency riders" on public.profiles
  for update using (
    role = 'rider'
    and agency_id = public.current_agency_id()
    and public.current_user_role() in ('dispatcher', 'admin')
  )
  with check (
    role = 'rider'
    and agency_id = public.current_agency_id()
    and public.current_user_role() in ('dispatcher', 'admin')
  );

create policy "staff read own agency" on public.agencies
  for select using (
    id = public.current_agency_id()
  );
