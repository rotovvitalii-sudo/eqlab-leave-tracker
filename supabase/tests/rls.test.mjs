// RLS і seed на PGlite з мінімальною імітацією Supabase (auth.uid, storage). Запуск: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIG = process.argv[2] ?? new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };

// Мінімальна імітація Supabase: ролі, auth.uid(), storage.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert on storage.objects to authenticated;
  insert into auth.users values
    ('a0000000-0000-4000-8000-000000000001', 'employee@eqlab.test'),
    ('a0000000-0000-4000-8000-000000000002', 'manager@eqlab.test'),
    ('a0000000-0000-4000-8000-000000000003', 'admin@eqlab.test'),
    ('a0000000-0000-4000-8000-000000000009', 'stranger@example.com');
`);

for (const f of readdirSync(MIG).sort()) await db.exec(readFileSync(join(MIG, f), 'utf8'));
console.log('Міграції застосовано');

const EMP = 'a0000000-0000-4000-8000-000000000001', MGR = 'a0000000-0000-4000-8000-000000000002',
  ADM = 'a0000000-0000-4000-8000-000000000003', STR = 'a0000000-0000-4000-8000-000000000009';
const id = (n) => `e0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

async function as(uid, sql, params) {
  await db.exec('reset role');
  if (uid === 'anon') await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  else await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
}
const one = async (sql) => (await db.query(sql)).rows;

// Seed
ok((await one('select count(*)::int c from employees'))[0].c === 50, '50 співробітників');
ok((await one('select count(*)::int c from departments'))[0].c === 5, '5 відділів');
ok((await one('select count(*)::int c from leave_requests'))[0].c === 15, '15 заявок');
ok((await one('select count(distinct status)::int c from leave_requests'))[0].c === 5, 'усі 5 статусів');
ok((await one("select count(*)::int c from employees where manager_id is null"))[0].c === 1, 'без менеджера лише директорка');
ok((await one("select count(*)::int c from employees where user_id is not null"))[0].c === 3, '3 демо-акаунти прив\'язано');

// Підрахунок днів і накопичення
ok((await one("select private.count_days('annual','2026-08-23','2026-08-27') c"))[0].c === 4, 'щорічна 23–27.08: 5 днів мінус 24 серпня = 4');
ok((await one("select private.count_days('sick','2026-08-23','2026-08-27') c"))[0].c === 5, 'лікарняний 23–27.08 = 5');
ok((await one("select private.accrued_days('2020-01-01','2026-10-22') c"))[0].c === 20, 'накопичено до жовтня = 20');
ok((await one("select private.accrued_days('2026-03-02','2026-10-22') c"))[0].c === 16, 'прийнятий у березні: 8 місяців × 2 = 16');
ok((await one("select private.accrued_days('2026-11-01','2026-10-22') c"))[0].c === 0, 'ще не прийнятий = 0');

// RLS: заявки
let r = await as(EMP, 'select employee_id from leave_requests');
ok(r.rows && r.rows.length === 4 && r.rows.every((x) => x.employee_id === id(10)), `співробітник бачить лише свої заявки (${r.rows?.length})`);
r = await as(MGR, 'select employee_id from leave_requests');
ok(r.rows && r.rows.length === 9, `менеджер: свої + підлеглих (${r.rows?.length})`);
r = await as(MGR, `select count(*)::int c from leave_requests where employee_id = '${id(28)}'`);
ok(r.rows[0].c === 0, 'менеджер не бачить заявки іншого відділу');
r = await as(ADM, 'select count(*)::int c from leave_requests');
ok(r.rows[0].c === 15, 'адміністратор бачить усі заявки');
r = await as(STR, 'select count(*)::int c from leave_requests');
ok(r.rows[0].c === 0, 'чужий акаунт без прив\'язки бачить 0');
r = await as('anon', 'select * from leave_requests');
ok(!!r.error, `anon не має доступу (${r.error})`);
r = await as('anon', 'select * from employees');
ok(!!r.error, 'anon не читає співробітників');

// Запис напряму заборонено
r = await as(EMP, `insert into leave_requests (employee_id,type,start_date,end_date,days,status) values ('${id(10)}','annual','2026-12-01','2026-12-02',2,'approved')`);
ok(!!r.error, `insert напряму заборонено (${r.error})`);
r = await as(EMP, `update leave_requests set status='approved'`);
ok(!!r.error, 'update напряму заборонено');
r = await as(ADM, `delete from leave_requests where true`);
ok(!!r.error, 'delete напряму заборонено навіть адміну');
r = await as(EMP, `update employees set role='admin'`);
ok(!!r.error, 'співробітник не може зробити себе адміном');

// Баланси
r = await as(EMP, 'select * from get_balances()');
ok(r.rows?.length === 1, 'співробітник бачить лише свій баланс');
console.log('      баланс демо-співробітника:', JSON.stringify(r.rows?.[0]));
r = await as(MGR, 'select count(*)::int c from get_balances()');
ok(r.rows[0].c === 18, `менеджер: свій + 17 підлеглих (${r.rows[0].c})`);
r = await as(ADM, 'select count(*)::int c from get_balances()');
ok(r.rows[0].c === 50, 'адміністратор: усі 50');
r = await as('anon', 'select * from get_balances()');
ok(!!r.error, 'anon не викликає get_balances');

// Відсутності колег
r = await as(EMP, "select * from get_colleague_absences(current_date - 90, current_date + 90)");
const keys = r.rows?.[0] ? Object.keys(r.rows[0]) : [];
ok(r.rows?.length === 9, `колеги: лише approved/registered по всій компанії (${r.rows?.length})`);
ok(!keys.includes('employee_comment') && !keys.includes('decision_comment') && !keys.includes('document_path'), `без коментарів і файлів: ${keys.join(',')}`);
ok(r.rows.some((x) => x.department === 'Продажі'), 'видно інші відділи');

// Storage
await db.exec(`insert into storage.objects (bucket_id, name) values
  ('sick-documents', '${id(10)}/req1/eln.pdf'), ('sick-documents', '${id(38)}/req2/eln.pdf')`);
r = await as(EMP, 'select name from storage.objects');
ok(r.rows?.length === 1 && r.rows[0].name.startsWith(id(10)), 'співробітник бачить лише свій файл');
r = await as(MGR, 'select name from storage.objects');
ok(r.rows?.length === 1 && r.rows[0].name.startsWith(id(10)), 'менеджер бачить файл підлеглого, але не іншого відділу');
r = await as(ADM, 'select count(*)::int c from storage.objects');
ok(r.rows[0].c === 2, 'адміністратор бачить усі файли');
r = await as(EMP, `insert into storage.objects (bucket_id, name) values ('sick-documents', '${id(11)}/x/a.pdf')`);
ok(!!r.error, 'не можна завантажити в чужу папку');
r = await as(EMP, `insert into storage.objects (bucket_id, name) values ('sick-documents', '${id(10)}/x/a.pdf')`);
ok(!r.error, 'можна завантажити у свою папку');

// Скидання
r = await as(STR, 'select reset_demo()');
ok(!!r.error, `чужий акаунт не скидає дані (${r.error})`);
r = await as('anon', 'select reset_demo()');
ok(!!r.error, 'anon не скидає дані');
await db.exec("select set_config('request.jwt.claim.sub', '', false)");
await db.exec('delete from leave_requests where true');
r = await as(EMP, 'select reset_demo()');
ok(!r.error, `демо-співробітник скидає дані ${r.error ?? ''}`);
ok((await one('select count(*)::int c from leave_requests'))[0].c === 15, 'після скидання знову 15 заявок');
ok((await one("select count(*)::int c from employees where user_id is not null"))[0].c === 3, 'після скидання демо-акаунти прив\'язані');

// Дії співробітника (крок 3.3)
const err = (x) => x.error ?? '';
r = await as(EMP, `select * from preview_request('annual', current_date + 14, current_date + 20)`);
ok(r.rows?.[0]?.days === 7 && r.rows[0].colleagues.includes('Максим Гончаренко'), `передперегляд: 7 днів, колега з відділу у відпустці (${JSON.stringify(r.rows?.[0])})`);
r = await as(EMP, `select submit_request('annual', current_date, current_date + 1)`);
ok(err(r).includes('майбутні'), `відпустка з сьогодні — відмова (${err(r)})`);
r = await as(EMP, `select submit_request('annual', current_date + 15, current_date + 16)`);
ok(err(r).includes('уже є заявка'), `перетин із власною заявкою — відмова (${err(r)})`);
r = await as(EMP, `select submit_request('annual', current_date + 3, current_date + 2)`);
ok(err(r).includes('раніше'), 'кінець раніше за початок — відмова');
r = await as(EMP, `select submit_request('annual', current_date + 35, current_date + 59)`);
ok(err(r).includes('Недостатньо днів') || err(r).includes('року'), `понад залишок — відмова (${err(r)})`);
r = await as(EMP, `select submit_request('annual', current_date + 60, current_date + 61, '  ')`);
ok(!r.error, `коротка відпустка в межах залишку — створено ${err(r)}`);
r = await as(EMP, `select status, employee_comment from leave_requests where start_date = current_date + 60`);
ok(r.rows?.[0]?.status === 'pending' && r.rows[0].employee_comment === null, 'нова відпустка: На розгляді, порожній коментар → null');
r = await as(EMP, `select submit_request('sick', current_date - 5, current_date - 4)`);
ok(!r.error, `лікарняний на минулі дати — створено ${err(r)}`);
r = await as(EMP, `select id, status from leave_requests where type = 'sick' and start_date = current_date - 5`);
ok(r.rows?.[0]?.status === 'registered', 'лікарняний одразу Зареєстровано');
const sickId = r.rows?.[0]?.id;
r = await as(EMP, `select attach_sick_document('${sickId}', '${id(10)}/${sickId}/doc.pdf')`);
ok(!r.error, `документ до свого лікарняного прикріплено ${err(r)}`);
r = await as(EMP, `select attach_sick_document('${sickId}', '${id(11)}/${sickId}/doc.pdf')`);
ok(!!r.error, 'шлях у чужій папці — відмова');
r = await as(ADM, `select id from leave_requests where employee_id = '${id(38)}' and type = 'sick'`);
const otherSick = r.rows[0].id;
r = await as(EMP, `select attach_sick_document('${otherSick}', '${id(10)}/${otherSick}/doc.pdf')`);
ok(!!r.error, 'чужий лікарняний — відмова');
r = await as(EMP, `select id from leave_requests where status = 'pending' and start_date = current_date + 14`);
const pendingId = r.rows[0].id;
r = await as(EMP, `select cancel_request('${pendingId}')`);
ok(!r.error, 'скасування своєї заявки на розгляді');
r = await as(EMP, `select status from leave_requests where id = '${pendingId}'`);
ok(r.rows[0].status === 'cancelled', 'статус Скасовано');
r = await as(EMP, `select id from leave_requests where status = 'approved' and start_date < current_date`);
r = await as(EMP, `select cancel_request('${r.rows[0].id}')`);
ok(err(r).includes('не можна скасувати'), 'минулу відпустку скасувати не можна');
r = await as(EMP, `select cancel_request('${otherSick}')`);
ok(!!r.error, 'чужу заявку скасувати не можна');
r = await as('anon', `select submit_request('annual', current_date + 5, current_date + 6)`);
ok(!!r.error, 'anon не подає заявки');

// Погодження й експорт (крок 3.4)
await db.exec("select set_config('request.jwt.claim.sub', '', false); select reset_demo();");
r = await as(MGR, 'select * from get_approval_queue()');
const mq = r.rows ?? [];
ok(mq.length === 3 && mq.every((x) => x.department === 'Розробка'), `черга менеджера: 3 заявки підлеглих (${mq.length})`);
ok(!mq.some((x) => x.employee_id === id(9)), 'власної заявки менеджера в його черзі немає');
const andriy = mq.find((x) => x.employee_id === id(10));
ok(andriy?.colleagues.includes('Максим Гончаренко') && andriy.available_after === 6, `підказки: колега з відділу і залишок після погодження (${JSON.stringify(andriy && { c: andriy.colleagues, a: andriy.available_after })})`);
r = await as(EMP, 'select count(*)::int c from get_approval_queue()');
ok(r.rows[0].c === 0, 'черга співробітника порожня');
r = await as(EMP, `select decide_request('${andriy.id}', true)`);
ok(err(r).includes('не можете'), 'співробітник не погоджує');
r = await as(ADM, `select decide_request('${andriy.id}', true)`);
ok(err(r).includes('не можете'), 'адміністратор не втручається в погодження менеджера');
const unpaid = mq.find((x) => x.type === 'unpaid');
r = await as(MGR, `select decide_request('${unpaid.id}', false, '   ')`);
ok(err(r).includes('причину'), 'відмова без коментаря — помилка');
r = await as(MGR, `select decide_request('${unpaid.id}', false, 'Реліз цього тижня')`);
ok(!r.error, 'відмова з коментарем');
r = await as(EMP, `select count(*)::int c from leave_requests where id = '${unpaid.id}'`);
ok(r.rows[0].c === 0, 'чужу відхилену заявку співробітник не бачить');
r = await as(MGR, `select decide_request('${andriy.id}', true)`);
ok(!r.error, 'погодження менеджером');
r = await as(EMP, `select status, decided_by from leave_requests where id = '${andriy.id}'`);
ok(r.rows[0].status === 'approved' && r.rows[0].decided_by === id(9), 'співробітник бачить Погоджено й хто погодив');
r = await as(MGR, `select decide_request('${andriy.id}', false, 'передумав')`);
ok(err(r).includes('вже розглянуто'), 'повторне рішення — відмова');
r = await as(MGR, `select id from leave_requests where employee_id = '${id(9)}' and status = 'pending'`);
const own = r.rows[0].id;
r = await as(MGR, `select decide_request('${own}', true)`);
ok(err(r).includes('не можете'), 'менеджер не погоджує власну заявку');
await db.exec(`insert into leave_requests (employee_id, type, start_date, end_date, days, status)
  values ('${id(1)}', 'annual', current_date + 70, current_date + 71, 2, 'pending')`);
r = await as(ADM, 'select * from get_approval_queue()');
ok(r.rows?.length === 1 && r.rows[0].employee_id === id(1), 'у черзі адміна — заявка директорки');
r = await as(ADM, `select decide_request('${r.rows[0].id}', true)`);
ok(!r.error, 'адміністратор погоджує заявку директорки');
r = await as(MGR, `select * from export_month(current_date)`);
ok(err(r).includes('лише адміністратору'), 'експорт менеджеру недоступний');
r = await as(ADM, `select * from export_month(current_date)`);
const rows = r.rows ?? [];
ok(rows.length > 0 && rows.every((x) => x.days_in_month > 0), `експорт за поточний місяць: ${rows.length} рядків`);
r = await as(ADM, `select e.days_in_month, private.count_days('annual', current_date - 60, least(current_date - 56, (date_trunc('month', current_date - 60) + interval '1 month - 1 day')::date)) expected
  from export_month(current_date - 60) e where e.full_name = 'Андрій Коваленко' and e.type = 'annual'`);
ok(r.rows?.[0] && r.rows[0].days_in_month === r.rows[0].expected, `дні в межах місяця й без свят (${JSON.stringify(r.rows?.[0])})`);
r = await as(ADM, `select count(*)::int c from export_month(current_date) where full_name = 'Ростислав Пономаренко'`);
ok(r.rows[0].c === 0, 'відхилені в експорт не потрапляють');

// Бізнес-правила §5 (крок 3.5)
const days = async (t, a, b) => (await as(EMP, `select days from preview_request('${t}', '${a}', '${b}')`)).rows?.[0]?.days;
ok(await days('annual', '2026-12-24', '2026-12-26') === 2, 'щорічна 24–26.12.2026: мінус Різдво = 2');
ok(await days('sick', '2026-12-24', '2026-12-26') === 3, 'лікарняний 24–26.12.2026: свята не віднімаються = 3');
ok(await days('unpaid', '2026-12-24', '2026-12-26') === 3, '«без збереження»: свята не віднімаються = 3');
ok(await days('annual', '2027-04-30', '2027-05-03') === 2, 'щорічна 30.04–03.05.2027: мінус 1 травня і Великдень = 2');
r = await as(EMP, `select submit_request('annual', make_date(extract(year from current_date)::int, 12, 28), make_date(extract(year from current_date)::int + 1, 1, 2))`);
ok(err(r).includes('року'), `через межу року — відмова (${err(r)})`);
r = await as(EMP, `select submit_request('annual', '2027-05-01', '2027-05-01')`);
ok(err(r).includes('лише державні свята'), `лише свята — відмова (${err(r)})`);
const usedBefore = (await as(EMP, 'select used from get_balances()')).rows[0].used;
r = await as(EMP, `select id from leave_requests where status = 'approved' and start_date > current_date`);
const futureApproved = r.rows[0].id;
r = await as(EMP, `select cancel_request('${futureApproved}')`);
ok(!r.error, 'погоджену відпустку до початку можна скасувати');
const usedAfter = (await as(EMP, 'select used from get_balances()')).rows[0].used;
ok(usedAfter < usedBefore, `після скасування дні повертаються в баланс (${usedBefore} → ${usedAfter})`);
r = await as(EMP, `select submit_request('annual', current_date + 41, current_date + 42)`);
ok(!r.error, `нова заявка ${err(r)}`);
r = await as(EMP, `select id from leave_requests where start_date = current_date + 41 and status = 'pending'`);
await as(EMP, `select cancel_request('${r.rows[0].id}')`);
r = await as(EMP, `select submit_request('annual', current_date + 41, current_date + 42)`);
ok(!r.error, `скасована заявка не блокує ті самі дати ${err(r)}`);
r = await as(EMP, `update leave_requests set start_date = start_date + 1 where employee_id = '${id(10)}'`);
ok(!!r.error, 'редагувати заявку напряму не можна');

// Скидання демо-даних усіма ролями (крок 3.6)
for (const [who, uid] of [['менеджер', MGR], ['адміністратор', ADM]]) {
  await db.exec(`insert into leave_requests (employee_id, type, start_date, end_date, days, status)
    values ('${id(20)}', 'unpaid', current_date + 90, current_date + 90, 1, 'pending')`);
  r = await as(uid, 'select reset_demo()');
  ok(!r.error, `${who} скидає дані ${err(r)}`);
  ok((await one('select count(*)::int c from leave_requests'))[0].c === 15, `${who}: після скидання рівно 15 початкових заявок`);
}
r = await as(EMP, `select status from leave_requests where start_date = current_date + 14`);
ok(r.rows?.[0]?.status === 'pending', 'після скидання заявка демо-співробітника знову На розгляді');
r = await as(EMP, 'select available from get_balances()');
ok(r.rows?.[0]?.available === 4, `баланс демо-співробітника повернувся до 4 (${r.rows?.[0]?.available})`);

console.log(failed ? `\n${failed} FAIL` : '\nУсі перевірки пройдено');
process.exit(failed ? 1 : 0);
