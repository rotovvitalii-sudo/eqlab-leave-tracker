-- Погодження менеджером і експорт для бухгалтерії (spec §2, §4 М2–М3, А6, §5.3, §5.7).

-- Рішення приймає прямий менеджер; заявку людини без менеджера (директорки) — адміністратор.
create function private.can_decide(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.id = p_employee_id
      and (
        e.manager_id = private.current_employee_id()
        or (e.manager_id is null and private.is_admin())
      )
  )
$$;

revoke execute on function private.can_decide from public;
grant execute on function private.can_decide to authenticated;

-- Черга «На розгляді» з підказками для рішення: залишок після погодження і хто з відділу відсутній.
create function public.get_approval_queue()
returns table (
  id uuid,
  employee_id uuid,
  full_name text,
  department text,
  type public.leave_type,
  start_date date,
  end_date date,
  days integer,
  employee_comment text,
  created_at timestamptz,
  available_after integer,
  colleagues text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, e.id, e.full_name, d.name, r.type, r.start_date, r.end_date, r.days,
    r.employee_comment, r.created_at,
    case when r.type = 'annual' then private.annual_available(e.id, r.start_date) end,
    coalesce((
      select array_agg(distinct c.full_name order by c.full_name)
      from public.leave_requests o
      join public.employees c on c.id = o.employee_id
      where c.department_id = e.department_id
        and c.id <> e.id
        and o.status in ('approved', 'registered')
        and o.start_date <= r.end_date
        and o.end_date >= r.start_date
    ), '{}')
  from public.leave_requests r
  join public.employees e on e.id = r.employee_id
  join public.departments d on d.id = e.department_id
  where r.status = 'pending'
    and private.can_decide(e.id)
  order by r.start_date
$$;

create function public.decide_request(p_id uuid, p_approve boolean, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
  v_comment text := nullif(btrim(left(p_comment, 500)), '');
begin
  select employee_id into v_employee_id
  from public.leave_requests
  where id = p_id and status = 'pending';

  if v_employee_id is null then
    raise exception 'Заявку не знайдено або її вже розглянуто';
  end if;
  if not private.can_decide(v_employee_id) then
    raise exception 'Ви не можете погоджувати цю заявку';
  end if;
  if not p_approve and v_comment is null then
    raise exception 'Вкажіть причину відмови';
  end if;

  update public.leave_requests
  set status = case when p_approve then 'approved' else 'rejected' end::public.leave_status,
      decision_comment = v_comment,
      decided_by = private.current_employee_id(),
      decided_at = now()
  where id = p_id;
end;
$$;

-- CSV за місяць: лише Погоджено і Зареєстровано; дні — у межах місяця (свята мінус для щорічної).
create function public.export_month(p_month date)
returns table (
  full_name text,
  department text,
  type public.leave_type,
  start_date date,
  end_date date,
  days_in_month integer,
  has_document boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
  if not private.is_admin() then
    raise exception 'Експорт доступний лише адміністратору';
  end if;

  return query
  select
    e.full_name, d.name, r.type, r.start_date, r.end_date,
    private.count_days(r.type, greatest(r.start_date, v_from), least(r.end_date, v_to)),
    r.document_path is not null
  from public.leave_requests r
  join public.employees e on e.id = r.employee_id
  join public.departments d on d.id = e.department_id
  where r.status in ('approved', 'registered')
    and r.start_date <= v_to
    and r.end_date >= v_from
  order by d.name, e.full_name, r.start_date;
end;
$$;

revoke execute on function public.get_approval_queue, public.decide_request, public.export_month
  from public, anon;
grant execute on function public.get_approval_queue, public.decide_request, public.export_month
  to authenticated;
