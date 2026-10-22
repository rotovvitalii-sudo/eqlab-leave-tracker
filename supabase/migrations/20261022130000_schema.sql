-- Схема: довідники, заявки, ролі, RLS і Storage (spec §5.6, §6).
-- Запис у таблиці йде лише через функції security definer (наступні міграції),
-- тому для authenticated відкрито тільки select.

create type public.app_role as enum ('employee', 'manager', 'admin');
create type public.leave_type as enum ('annual', 'unpaid', 'sick');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'registered');

create table public.departments (
  id smallint primary key,
  name text not null unique
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text unique,
  full_name text not null,
  position text not null,
  department_id smallint not null references public.departments (id),
  manager_id uuid references public.employees (id),
  role public.app_role not null default 'employee',
  hire_date date not null
);

create index employees_manager_id_idx on public.employees (manager_id);
create index employees_department_id_idx on public.employees (department_id);

create table public.holidays (
  date date primary key,
  name text not null
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  days integer not null check (days >= 0),
  status public.leave_status not null,
  employee_comment text,
  decision_comment text,
  decided_by uuid references public.employees (id) on delete set null,
  decided_at timestamptz,
  document_path text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index leave_requests_employee_id_idx on public.leave_requests (employee_id);
create index leave_requests_dates_idx on public.leave_requests (start_date, end_date);

-- Хелпери для політик. Схема private не відкрита через Data API.
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.employees where user_id = (select auth.uid())
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees
    where user_id = (select auth.uid()) and role = 'admin'
  )
$$;

-- Свої дані, дані прямих підлеглих, або все для адміністратора.
create function private.can_view_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_employee_id = private.current_employee_id()
    or private.is_admin()
    or exists (
      select 1 from public.employees e
      where e.id = p_employee_id and e.manager_id = private.current_employee_id()
    )
$$;

-- Шлях файлу в Storage: {employee_id}/{request_id}/{файл}.
create function private.can_view_document(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.id::text = (storage.foldername(p_name))[1]
      and private.can_view_employee(e.id)
  )
$$;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- RLS
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.holidays enable row level security;
alter table public.leave_requests enable row level security;

create policy "departments_select_authenticated" on public.departments
  for select to authenticated using (true);

create policy "holidays_select_authenticated" on public.holidays
  for select to authenticated using (true);

-- Довідник співробітників бачать усі: потрібен для відсутностей колег.
create policy "employees_select_authenticated" on public.employees
  for select to authenticated using (true);

create policy "leave_requests_select_own_team_or_admin" on public.leave_requests
  for select to authenticated using (private.can_view_employee(employee_id));

revoke all on public.departments, public.employees, public.holidays, public.leave_requests
  from anon, authenticated;
grant select on public.departments, public.employees, public.holidays, public.leave_requests
  to authenticated;

-- Storage для документів до лікарняних (spec §5.5)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sick-documents', 'sick-documents', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "sick_documents_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'sick-documents' and private.can_view_document(name));

create policy "sick_documents_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sick-documents'
    and (storage.foldername(name))[1] = private.current_employee_id()::text
  );
