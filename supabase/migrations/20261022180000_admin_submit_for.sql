-- Spec v1.3 §5.8: адміністратор вносить заявку за співробітника.
-- Правила створення заявки винесено в private.create_request, щоб співробітник і адмін
-- проходили ті самі перевірки; created_by зберігає, хто вніс заявку за іншу людину.

alter table public.leave_requests
  add column created_by uuid references public.employees (id) on delete set null;

-- Викликається лише з функцій security definer нижче; напряму через Data API недоступна.
create function private.create_request(
  p_employee_id uuid,
  p_type public.leave_type,
  p_start date,
  p_end date,
  p_comment text,
  p_created_by uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_days integer;
  v_available integer;
  v_id uuid;
begin
  -- Одночасні заявки одного співробітника обробляються по черзі, щоб не обійти перевірку балансу.
  perform 1 from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Співробітника не знайдено';
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
  if p_type <> 'sick' and p_start < private.today() then
    raise exception 'Відпустку можна оформити з сьогоднішньої дати або пізніше';
  end if;
  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = p_employee_id
      and r.status in ('pending', 'approved', 'registered')
      and r.start_date <= p_end
      and r.end_date >= p_start
  ) then
    if p_created_by is null then
      raise exception 'На ці дати у вас уже є заявка';
    end if;
    raise exception 'На ці дати в співробітника вже є заявка';
  end if;

  v_days := private.count_days(p_type, p_start, p_end);
  if v_days = 0 then
    raise exception 'У вибраних датах лише державні свята';
  end if;
  if p_type = 'annual' then
    v_available := private.annual_available(p_employee_id, p_start);
    if v_days > v_available then
      raise exception 'Недостатньо днів: доступно %, потрібно %', greatest(v_available, 0), v_days;
    end if;
  end if;

  insert into public.leave_requests
    (employee_id, type, start_date, end_date, days, status, employee_comment, created_by)
  values (
    p_employee_id, p_type, p_start, p_end, v_days,
    case when p_type = 'sick' then 'registered' else 'pending' end::public.leave_status,
    nullif(btrim(left(p_comment, 500)), ''),
    p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function private.create_request from public, anon, authenticated;

-- Співробітник подає сам за себе: поведінка й повідомлення як раніше.
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
begin
  if v_me is null then
    raise exception 'Користувача не знайдено серед співробітників';
  end if;
  return private.create_request(v_me, p_type, p_start, p_end, p_comment, null);
end;
$$;

-- Адміністратор вносить заявку за будь-якого співробітника (spec §5.8).
create function public.submit_request_for(
  p_employee_id uuid,
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
begin
  if not private.is_admin() then
    raise exception 'Вносити заявки за інших може лише адміністратор';
  end if;
  -- Власну заявку адмін подає як звичайний співробітник, без позначки «Внесено HR».
  return private.create_request(p_employee_id, p_type, p_start, p_end, p_comment, nullif(v_me, p_employee_id));
end;
$$;

revoke execute on function public.submit_request_for from public, anon;
grant execute on function public.submit_request_for to authenticated;
