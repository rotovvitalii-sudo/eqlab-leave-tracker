-- Підрахунок днів, баланс і відсутності колег (spec §3, §5.2, §5.6).

-- Щорічна: календарні дні мінус державні свята. Інші типи: усі календарні дні.
create function private.count_days(p_type public.leave_type, p_start date, p_end date)
returns integer
language sql
stable
set search_path = ''
as $$
  select (p_end - p_start + 1)
    - case when p_type = 'annual' then
        (select count(*)::integer from public.holidays h where h.date between p_start and p_end)
      else 0 end
$$;

-- 2 дні 1-го числа кожного місяця: з січня або з місяця прийому, якщо прийнято цього року.
create function private.accrued_days(p_hire_date date, p_on date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_hire_date > p_on then 0
    else 2 * (
      extract(month from p_on)::integer
      - case when p_hire_date >= date_trunc('year', p_on)::date
          then extract(month from p_hire_date)::integer
          else 1 end
      + 1)
  end
$$;

revoke execute on function private.count_days, private.accrued_days from public;
grant execute on function private.count_days, private.accrued_days to authenticated;

-- Баланс щорічної відпустки на дату. Рядки — ті співробітники, кого бачить користувач.
create function public.get_balances(p_on date default null)
returns table (
  employee_id uuid,
  full_name text,
  department text,
  accrued integer,
  used integer,
  reserved integer,
  available integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select coalesce(p_on, (now() at time zone 'Europe/Kyiv')::date) as on_date
  ),
  totals as (
    select
      e.id,
      e.full_name,
      d.name as department,
      private.accrued_days(e.hire_date, p.on_date) as accrued,
      coalesce(sum(r.days) filter (where r.status = 'approved'), 0)::integer as used,
      coalesce(sum(r.days) filter (where r.status = 'pending'), 0)::integer as reserved
    from public.employees e
    cross join params p
    join public.departments d on d.id = e.department_id
    left join public.leave_requests r
      on r.employee_id = e.id
      and r.type = 'annual'
      and extract(year from r.start_date) = extract(year from p.on_date)
    where private.can_view_employee(e.id)
    group by e.id, e.full_name, d.name, e.hire_date, p.on_date
  )
  select id, full_name, department, accrued, used, reserved, accrued - used - reserved
  from totals
  order by department, full_name
$$;

-- Відсутності колег по всій компанії: лише дозволені поля й статуси.
create function public.get_colleague_absences(p_from date, p_to date)
returns table (
  employee_id uuid,
  full_name text,
  department_id smallint,
  department text,
  type public.leave_type,
  start_date date,
  end_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.full_name, d.id, d.name, r.type, r.start_date, r.end_date
  from public.leave_requests r
  join public.employees e on e.id = r.employee_id
  join public.departments d on d.id = e.department_id
  where (select auth.uid()) is not null
    and r.status in ('approved', 'registered')
    and r.start_date <= p_to
    and r.end_date >= p_from
  order by r.start_date, e.full_name
$$;

revoke execute on function public.get_balances, public.get_colleague_absences from public, anon;
grant execute on function public.get_balances, public.get_colleague_absences to authenticated;
