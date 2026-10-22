-- Spec v1.2 §5.1 п. 2: щорічну й «без збереження» можна почати сьогодні (раніше — від завтра).

create or replace function public.submit_request(
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
  -- Одночасні заявки одного співробітника обробляються по черзі, щоб не обійти перевірку балансу.
  perform 1 from public.employees where id = v_me for update;
  if p_start is null or p_end is null then
    raise exception 'Вкажіть дати початку і кінця';
  end if;
  if p_end < p_start then
    raise exception 'Дата кінця не може бути раніше за дату початку';
  end if;
  if extract(year from p_start) <> extract(year from p_end) then
    raise exception 'Дати мають бути в межах одного календарного року';
  end if;
  if p_type <> 'sick' and p_start < private.today() then
    raise exception 'Відпустку можна оформити з сьогоднішньої дати або пізніше';
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
