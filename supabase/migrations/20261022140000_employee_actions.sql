-- Дії співробітника: передперегляд, подача, скасування, документ до лікарняного (spec §4 С3–С6, §5.1, §5.2, §5.5).

create function private.today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Kyiv')::date
$$;

-- Доступно щорічної = накопичено на місяць дати + погоджені й на розгляді за рік.
create function private.annual_available(p_employee_id uuid, p_on date)
returns integer
language sql
stable
set search_path = ''
as $$
  select private.accrued_days(e.hire_date, p_on)
    - coalesce((
        select sum(r.days)::integer from public.leave_requests r
        where r.employee_id = e.id
          and r.type = 'annual'
          and r.status in ('approved', 'pending')
          and extract(year from r.start_date) = extract(year from p_on)
      ), 0)
  from public.employees e
  where e.id = p_employee_id
$$;

revoke execute on function private.today, private.annual_available from public;
grant execute on function private.today, private.annual_available to authenticated;

-- Підказка до форми: скільки днів спишеться, скільки доступно, хто з відділу відсутній.
create function public.preview_request(p_type public.leave_type, p_start date, p_end date)
returns table (days integer, available integer, colleagues text[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.count_days(p_type, p_start, p_end),
    case when p_type = 'annual' then private.annual_available(me.id, p_start) end,
    coalesce((
      select array_agg(distinct e.full_name order by e.full_name)
      from public.leave_requests r
      join public.employees e on e.id = r.employee_id
      where e.department_id = me.department_id
        and e.id <> me.id
        and r.status in ('approved', 'registered')
        and r.start_date <= p_end
        and r.end_date >= p_start
    ), '{}')
  from public.employees me
  where me.id = private.current_employee_id()
    and p_end >= p_start
$$;

create function public.submit_request(
  p_type public.leave_type,
  p_start date,
  p_end date,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_employee_id();
  v_days integer;
  v_available integer;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Користувача не знайдено серед співробітників';
  end if;
  if p_start is null or p_end is null then
    raise exception 'Вкажіть дати початку і кінця';
  end if;
  if p_end < p_start then
    raise exception 'Дата кінця не може бути раніше за дату початку';
  end if;
  if extract(year from p_start) <> extract(year from p_end) then
    raise exception 'Дати мають бути в межах одного календарного року';
  end if;
  if p_type <> 'sick' and p_start <= private.today() then
    raise exception 'Відпустку можна оформити лише на майбутні дати, починаючи із завтра';
  end if;
  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = v_me
      and r.status in ('pending', 'approved', 'registered')
      and r.start_date <= p_end
      and r.end_date >= p_start
  ) then
    raise exception 'На ці дати у вас уже є заявка';
  end if;

  v_days := private.count_days(p_type, p_start, p_end);
  if v_days = 0 then
    raise exception 'У вибраних датах лише державні свята';
  end if;
  if p_type = 'annual' then
    v_available := private.annual_available(v_me, p_start);
    if v_days > v_available then
      raise exception 'Недостатньо днів: доступно %, потрібно %', greatest(v_available, 0), v_days;
    end if;
  end if;

  insert into public.leave_requests (employee_id, type, start_date, end_date, days, status, employee_comment)
  values (
    v_me, p_type, p_start, p_end, v_days,
    case when p_type = 'sick' then 'registered' else 'pending' end::public.leave_status,
    nullif(btrim(left(p_comment, 500)), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Скасувати можна лише свою заявку, яка ще не почалася.
create function public.cancel_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.leave_requests
  set status = 'cancelled'
  where id = p_id
    and employee_id = private.current_employee_id()
    and status in ('pending', 'approved', 'registered')
    and start_date > private.today();

  if not found then
    raise exception 'Цю заявку не можна скасувати: вона вже почалася або має інший статус';
  end if;
end;
$$;

-- Файл уже завантажено в Storage у свою папку {employee_id}/{request_id}/; тут лише прив'язка.
create function public.attach_sick_document(p_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_employee_id();
begin
  update public.leave_requests
  set document_path = p_path
  where id = p_id
    and employee_id = v_me
    and type = 'sick'
    and status = 'registered'
    and p_path like v_me::text || '/' || p_id::text || '/%';

  if not found then
    raise exception 'Не вдалося прикріпити документ до цього лікарняного';
  end if;
end;
$$;

revoke execute on function
  public.preview_request, public.submit_request, public.cancel_request, public.attach_sick_document
  from public, anon;
grant execute on function
  public.preview_request, public.submit_request, public.cancel_request, public.attach_sick_document
  to authenticated;
