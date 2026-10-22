import Link from "next/link";
import { RolePage } from "@/components/role-page";
import { ApprovalQueue } from "@/components/approval-queue";
import { BalancesList, type BalanceRow } from "@/components/balances-list";
import { RequestList, REQUEST_LIST_SELECT, type RequestListRow } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  addDays, formatRange, kyivToday, STATUS_LABEL, TYPE_LABEL,
  type LeaveStatus, type LeaveType,
} from "@/lib/format";

type Search = Record<string, string | string[] | undefined>;

const TABS = [
  { id: "requests", label: "Заявки" },
  { id: "balances", label: "Баланси" },
  { id: "absent", label: "Хто відсутній" },
  { id: "export", label: "Експорт" },
] as const;

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return <RolePage allowed={["admin"]} render={() => <AdminDashboard searchParams={searchParams} />} />;
}

async function AdminDashboard({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "requests";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Адміністрування</h1>
      <ApprovalQueue title="Заявки директорки на погодження" hideWhenEmpty />
      <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5",
              tab === t.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "requests" && <AllRequests params={params} />}
      {tab === "balances" && <AllBalances />}
      {tab === "absent" && <WhoIsAbsent />}
      {tab === "export" && <Export />}
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

async function AllRequests({ params }: { params: Search }) {
  const supabase = await createClient();
  const f = {
    department: one(params.department),
    type: one(params.type),
    status: one(params.status),
    from: one(params.from),
    to: one(params.to),
  };

  let query = supabase.from("leave_requests").select(REQUEST_LIST_SELECT);
  if (f.department) query = query.eq("employee.department_id", Number(f.department));
  if (f.type) query = query.eq("type", f.type);
  if (f.status) query = query.eq("status", f.status);
  if (f.from) query = query.gte("end_date", f.from);
  if (f.to) query = query.lte("start_date", f.to);

  const [{ data: departments }, { data: rows }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    query.order("start_date", { ascending: false }).limit(200),
  ]);

  return (
    <section className="flex flex-col gap-3">
      <Card size="sm">
        <CardContent>
          <form className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:items-end">
            <input type="hidden" name="tab" value="requests" />
            <Field label="Відділ" className="col-span-2 sm:col-span-1">
              <select name="department" defaultValue={f.department} className={selectClass}>
                <option value="">Усі</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Тип">
              <select name="type" defaultValue={f.type} className={selectClass}>
                <option value="">Усі</option>
                {(Object.keys(TYPE_LABEL) as LeaveType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Статус">
              <select name="status" defaultValue={f.status} className={selectClass}>
                <option value="">Усі</option>
                {(Object.keys(STATUS_LABEL) as LeaveStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="З"><Input type="date" name="from" defaultValue={f.from} /></Field>
            <Field label="По"><Input type="date" name="to" defaultValue={f.to} /></Field>
            <div className="col-span-2 flex gap-2 sm:col-span-1">
              <Button type="submit" className="flex-1">Застосувати</Button>
              <Link href="/admin?tab=requests" className="self-center text-sm text-muted-foreground hover:text-foreground">
                Скинути
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">Знайдено: {rows?.length ?? 0}</p>
      <RequestList rows={(rows as unknown as RequestListRow[] | null) ?? []} empty="Нічого не знайдено." />
    </section>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

async function AllBalances() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_balances");
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Щорічна відпустка станом на сьогодні · усі 50 співробітників</p>
      <BalancesList rows={(data as BalanceRow[] | null) ?? []} />
    </section>
  );
}

type AbsenceRow = { employee_id: string; full_name: string; department: string; type: LeaveType; start_date: string; end_date: string };

async function WhoIsAbsent() {
  const supabase = await createClient();
  const today = kyivToday();
  const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay();
  const sunday = addDays(today, (7 - dayOfWeek) % 7);
  const { data } = await supabase.rpc("get_colleague_absences", { p_from: today, p_to: sunday });
  const rows = (data as AbsenceRow[] | null) ?? [];
  const todayRows = rows.filter((r) => r.start_date <= today && r.end_date >= today);
  const weekRows = rows.filter((r) => r.start_date > today);

  return (
    <div className="flex flex-col gap-6">
      <AbsenceSection title={`Сьогодні (${todayRows.length})`} rows={todayRows} />
      <AbsenceSection title={`Пізніше цього тижня (${weekRows.length})`} rows={weekRows} />
    </div>
  );
}

function AbsenceSection({ title, rows }: { title: string; rows: AbsenceRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ніхто не відсутній.</p>
      ) : (
        <Card size="sm">
          <CardContent>
            <ul className="divide-y">
              {rows.map((a) => (
                <li key={`${a.employee_id}-${a.start_date}`} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm">
                  <div>
                    <p className="font-medium">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground">{a.department} · {TYPE_LABEL[a.type]}</p>
                  </div>
                  <p className="text-muted-foreground">{formatRange(a.start_date, a.end_date)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Export() {
  const month = kyivToday().slice(0, 7);
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          CSV для бухгалтерії: погоджені відпустки й зареєстровані лікарняні за місяць. Дні рахуються в межах
          місяця; для щорічної відпустки без державних свят.
        </p>
        <form action="/admin/export" method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="month" className="text-xs text-muted-foreground">Місяць</Label>
            <Input id="month" type="month" name="month" defaultValue={month} required className="w-44" />
          </div>
          <Button type="submit">Завантажити CSV</Button>
        </form>
      </CardContent>
    </Card>
  );
}
