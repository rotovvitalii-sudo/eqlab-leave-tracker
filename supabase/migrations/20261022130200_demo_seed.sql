-- Демо-дані EQLab (spec §7). Seed і кнопка «Скинути демо-дані» — одна функція.
-- Дати заявок рахуються від сьогодні (Europe/Kyiv). Демо-акаунти Auth прив'язуються за email:
--   employee@eqlab.test — Андрій Коваленко, розробник
--   manager@eqlab.test  — Дмитро Кравець, керівник розробки
--   admin@eqlab.test    — Марія Ткаченко, HR-менеджерка
-- ID співробітників фіксовані, щоб шляхи файлів у Storage не змінювались після скидання.

create function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := (now() at time zone 'Europe/Kyiv')::date;
  y integer := extract(year from d)::integer;
begin
  -- Із Data API — лише прив'язані демо-користувачі; у міграції auth.uid() порожній.
  if (select auth.uid()) is not null and private.current_employee_id() is null then
    raise exception 'Скидання демо-даних доступне лише демо-користувачам';
  end if;

  delete from public.leave_requests where true;
  delete from public.employees where true;
  delete from public.holidays where true;
  delete from public.departments where true;

  insert into public.departments (id, name) values
    (1, 'Розробка'),
    (2, 'Продажі'),
    (3, 'Маркетинг'),
    (4, 'Фінанси'),
    (5, 'HR/Операції');

  insert into public.holidays (date, name) values
    ('2026-01-01', 'Новий рік'),
    ('2026-03-08', 'Міжнародний жіночий день'),
    ('2026-04-12', 'Великдень'),
    ('2026-05-01', 'День праці'),
    ('2026-05-08', 'День пам''яті та перемоги над нацизмом'),
    ('2026-05-31', 'Трійця'),
    ('2026-06-28', 'День Конституції України'),
    ('2026-07-15', 'День Української Державності'),
    ('2026-08-24', 'День Незалежності України'),
    ('2026-10-01', 'День захисників і захисниць України'),
    ('2026-12-25', 'Різдво Христове'),
    ('2027-01-01', 'Новий рік'),
    ('2027-03-08', 'Міжнародний жіночий день'),
    ('2027-05-01', 'День праці'),
    ('2027-05-02', 'Великдень'),
    ('2027-05-08', 'День пам''яті та перемоги над нацизмом'),
    ('2027-06-20', 'Трійця'),
    ('2027-06-28', 'День Конституції України'),
    ('2027-07-15', 'День Української Державності'),
    ('2027-08-24', 'День Незалежності України'),
    ('2027-10-01', 'День захисників і захисниць України'),
    ('2027-12-25', 'Різдво Христове');

  -- e0000000-0000-4000-8000-0000000000NN; менеджери йдуть раніше за підлеглих.
  insert into public.employees (id, email, full_name, position, department_id, manager_id, role, hire_date)
  select
    ('e0000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
    v.email,
    v.full_name,
    v.position,
    v.department_id,
    case when v.manager_n is null then null
      else ('e0000000-0000-4000-8000-0000000000' || lpad(v.manager_n::text, 2, '0'))::uuid end,
    v.role::public.app_role,
    v.hire_date
  from (values
    -- HR/Операції
    (1,  null, 'Олена Шевчук',          'Генеральна директорка',      5, null, 'manager',  date '2018-02-01'),
    (2,  null, 'Ірина Бондар',          'Операційна директорка',      5, 1,    'manager',  date '2019-05-13'),
    (3,  'admin@eqlab.test', 'Марія Ткаченко', 'HR-менеджерка',      5, 2,    'admin',    date '2021-09-01'),
    (4,  null, 'Наталія Кравчук',       'Офіс-менеджерка',            5, 2,    'employee', date '2022-03-14'),
    (5,  null, 'Віктор Олійник',        'Системний адміністратор',    5, 2,    'employee', date '2020-11-02'),
    (6,  null, 'Світлана Мельник',      'Рекрутерка',                 5, 2,    'employee', date '2023-01-16'),
    (7,  null, 'Юлія Поліщук',          'Асистентка директорки',      5, 2,    'employee', date '2022-08-08'),
    (8,  null, 'Тарас Савченко',        'Фахівець з охорони праці',   5, 2,    'employee', date '2021-04-19'),
    -- Розробка
    (9,  'manager@eqlab.test', 'Дмитро Кравець', 'Керівник розробки', 1, 1,    'manager',  date '2018-06-04'),
    (10, 'employee@eqlab.test', 'Андрій Коваленко', 'Frontend-розробник', 1, 9, 'employee', date '2022-02-07'),
    (11, null, 'Максим Гончаренко',     'Backend-розробник',          1, 9,    'employee', date '2020-10-12'),
    (12, null, 'Олексій Лисенко',       'Backend-розробник',          1, 9,    'employee', date '2021-07-05'),
    (13, null, 'Анна Руденко',          'QA-інженерка',               1, 9,    'employee', date '2022-05-23'),
    (14, null, 'Богдан Марченко',       'DevOps-інженер',             1, 9,    'employee', date '2019-09-16'),
    (15, null, 'Катерина Павленко',     'Frontend-розробниця',        1, 9,    'employee', date '2023-03-06'),
    (16, null, 'Роман Зінченко',        'Mobile-розробник',           1, 9,    'employee', date '2021-12-01'),
    (17, null, 'Софія Петренко',        'UI/UX-дизайнерка',           1, 9,    'employee', date '2022-10-17'),
    (18, null, 'Ігор Тимошенко',        'Backend-розробник',          1, 9,    'employee', date '2020-04-27'),
    (19, null, 'Владислав Мороз',       'QA-інженер',                 1, 9,    'employee', date '2023-08-14'),
    (20, null, 'Остап Левченко',        'Data-інженер',               1, 9,    'employee', date '2021-02-22'),
    (21, null, 'Христина Вовк',         'Frontend-розробниця',        1, 9,    'employee', date '2024-01-15'),
    (22, null, 'Назар Бойко',           'Backend-розробник',          1, 9,    'employee', date '2023-11-06'),
    (23, null, 'Євгенія Сидоренко',     'QA-інженерка',               1, 9,    'employee', date '2022-06-13'),
    (24, null, 'Артем Захарченко',      'Mobile-розробник',           1, 9,    'employee', make_date(y, 3, 2)),
    (25, null, 'Данило Кузьменко',      'Tech Lead',                  1, 9,    'employee', date '2019-03-11'),
    (26, null, 'Вероніка Гнатюк',       'Product Owner',              1, 9,    'employee', date '2020-08-03'),
    -- Продажі
    (27, null, 'Сергій Ковальчук',      'Керівник продажів',          2, 1,    'manager',  date '2019-01-21'),
    (28, null, 'Оксана Литвиненко',     'Менеджерка з продажів',      2, 27,   'employee', date '2021-05-10'),
    (29, null, 'Петро Демченко',        'Менеджер з продажів',        2, 27,   'employee', date '2022-09-19'),
    (30, null, 'Людмила Карпенко',      'Account-менеджерка',         2, 27,   'employee', date '2020-02-17'),
    (31, null, 'Василь Приходько',      'Менеджер з продажів',        2, 27,   'employee', date '2023-04-03'),
    (32, null, 'Тетяна Назаренко',      'Менеджерка з продажів',      2, 27,   'employee', date '2021-10-25'),
    (33, null, 'Юрій Яковенко',         'Account-менеджер',           2, 27,   'employee', date '2022-01-10'),
    (34, null, 'Ольга Костенко',        'Аналітикиня продажів',       2, 27,   'employee', date '2023-06-26'),
    (35, null, 'Микола Білик',          'Менеджер з продажів',        2, 27,   'employee', date '2024-02-12'),
    (36, null, 'Діана Онищенко',        'Координаторка продажів',     2, 27,   'employee', date '2022-11-14'),
    -- Маркетинг
    (37, null, 'Аліна Романенко',       'Керівниця маркетингу',       3, 1,    'manager',  date '2019-07-08'),
    (38, null, 'Валерія Нестеренко',    'SMM-менеджерка',             3, 37,   'employee', date '2021-03-29'),
    (39, null, 'Степан Головко',        'Контент-маркетолог',         3, 37,   'employee', date '2022-07-18'),
    (40, null, 'Дарина Мазур',          'Дизайнерка',                 3, 37,   'employee', date '2020-12-07'),
    (41, null, 'Іван Юрченко',          'Performance-маркетолог',     3, 37,   'employee', date '2023-02-20'),
    (42, null, 'Марта Ярошенко',        'PR-менеджерка',              3, 37,   'employee', date '2021-08-16'),
    (43, null, 'Кирило Остапенко',      'SEO-фахівець',               3, 37,   'employee', date '2022-04-11'),
    (44, null, 'Злата Федоренко',       'Копірайтерка',               3, 37,   'employee', make_date(y, 6, 1)),
    -- Фінанси
    (45, null, 'Галина Кириленко',      'Фінансова директорка',       4, 1,    'manager',  date '2018-09-03'),
    (46, null, 'Леся Антоненко',        'Головна бухгалтерка',        4, 45,   'employee', date '2019-11-18'),
    (47, null, 'Ростислав Пономаренко', 'Бухгалтер',                  4, 45,   'employee', date '2021-06-07'),
    (48, null, 'Інна Гаврилюк',         'Бухгалтерка',                4, 45,   'employee', date '2022-12-05'),
    (49, null, 'Федір Савчук',          'Фінансовий аналітик',        4, 45,   'employee', date '2020-05-25'),
    (50, null, 'Ніна Сергієнко',        'Економістка',                4, 45,   'employee', date '2023-09-11')
  ) as v (n, email, full_name, position, department_id, manager_n, role, hire_date);

  -- Прив'язка демо-акаунтів Auth за email.
  update public.employees e
  set user_id = u.id
  from auth.users u
  where e.email is not null and lower(u.email) = e.email;

  -- 15 заявок у всіх статусах і типах; зсуви в днях від сьогодні.
  insert into public.leave_requests
    (employee_id, type, start_date, end_date, days, status,
     employee_comment, decision_comment, decided_by, decided_at)
  select
    emp.id,
    v.type::public.leave_type,
    d + v.start_offset,
    d + v.end_offset,
    private.count_days(v.type::public.leave_type, d + v.start_offset, d + v.end_offset),
    v.status::public.leave_status,
    v.employee_comment,
    v.decision_comment,
    case when v.status in ('approved', 'rejected') then
      coalesce(emp.manager_id, (select a.id from public.employees a where a.role = 'admin' limit 1))
    end,
    case when v.status in ('approved', 'rejected') then now() end
  from (values
    -- Демо-співробітник: минула й майбутня відпустки, заявка на розгляді з перетином, лікарняний.
    (10, 'annual', -60, -56, 'approved',   'Літня відпустка', null),
    (10, 'annual',  30,  34, 'approved',   null, null),
    (10, 'annual',  14,  20, 'pending',    'Поїздка до батьків', null),
    (10, 'sick',   -25, -23, 'registered', null, null),
    -- Розробка: перетин із заявкою демо-співробітника і черга менеджера.
    (11, 'annual',  16,  22, 'approved',   null, null),
    (15, 'annual',  40,  44, 'pending',    null, null),
    (16, 'unpaid',   7,   8, 'pending',    'Сімейні обставини', null),
    (13, 'annual',   2,   4, 'approved',   null, null),
    -- Решта компанії: хто відсутній сьогодні, відмова, скасування.
    (28, 'annual',  -2,   5, 'approved',   null, null),
    (38, 'sick',    -1,   3, 'registered', null, null),
    (47, 'annual',  10,  12, 'rejected',   null, 'Закриття кварталу, перенесіть, будь ласка, на тиждень пізніше'),
    (4,  'annual',  20,  21, 'cancelled',  null, null),
    (31, 'unpaid',   1,   1, 'approved',   null, null),
    (49, 'annual', -10,  -6, 'approved',   null, null),
    -- Власна заявка демо-менеджера: її погоджує директорка.
    (9,  'annual',  50,  54, 'pending',    null, null)
  ) as v (n, type, start_offset, end_offset, status, employee_comment, decision_comment)
  join public.employees emp
    on emp.id = ('e0000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid;
end;
$$;

revoke execute on function public.reset_demo from public, anon;
grant execute on function public.reset_demo to authenticated;

select public.reset_demo();
