import Link from "next/link";
import { PageHeader, SectionTitle } from "@/components/headings";
import { OnboardingTips } from "@/components/onboarding-tips";
import { RolePage } from "@/components/role-page";
import { ApprovalQueue } from "@/components/approval-queue";
import { BalancesList, type BalanceRow } from "@/components/balances-list";
import { RequestList, REQUEST_LIST_SELECT, type RequestListRow } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { RequestForForm, type EmployeeOption } from "./request-for-form";
import { cn } from "@/lib/utils";
import {
  addDays, formatRange, kyivToday, MONTHS_LOCATIVE, STATUS_LABEL, TYPE_LABEL,
  type LeaveStatus, type LeaveType,
} from "@/lib/format";

type Search = Record<string, string | string[] | undefined>;

const TABS = [
  { id: "overview", label: "Огляд" },
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
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "overview";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Адміністратор" title="Адміністрування" subtitle="Уся компанія: огляд, заявки, баланси, відсутності, експорт" />
      <OnboardingTips set="admin" />
      <ApprovalQueue title="Заявки директорки на погодження" hideWhenEmpty />
      {/* На телефоні вкладки — сітка: «Огляд» на весь рядок, решта 2×2, усе видно без прокрутки. */}
      <nav className="grid grid-cols-2 gap-1 rounded-tile bg-muted p-1 text-sm sm:flex">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-center first:col-span-2",
              tab === t.id ? "bg-background font-semibold text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "overview" && <Overview />}
      {tab === "requests" && <AllRequests params={params} />}
      {tab === "balances" && <AllBalances />}
      {tab === "absent" && <WhoIsAbsent />}
      {tab === "export" && <Export />}
    </div>
  );
}

// Дашборд HR (spec §4 А7, §5.9): лише читання через наявні функції бази й RLS.
const SHORT_TYPE: Record<LeaveType, string> = { annual: "щорічна", unpaid: "без збереження", sick: "лікарняні" };
const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

async function Overview() {
  const supabase = await createClient();
  const today = kyivToday();
  const [absent, pending, month, balances] = await Promise.all([
    supabase.rpc("get_colleague_absences", { p_from: today, p_to: today }),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // Ті самі дні, що в CSV для бухгалтерії, тож цифри збігаються з експортом.
    supabase.rpc("export_month", { p_month: `${today.slice(0, 7)}-01` }),
    supabase.rpc("get_balances"),
  ]);

  const absentToday = new Set(((absent.data as AbsenceRow[] | null) ?? []).map((r) => r.employee_id)).size;

  const daysByType: Record<LeaveType, number> = { annual: 0, unpaid: 0, sick: 0 };
  for (const r of (month.data as { type: LeaveType; days_in_month: number }[] | null) ?? []) {
    daysByType[r.type] += r.days_in_month;
  }
  const monthDays = daysByType.annual + daysByType.unpaid + daysByType.sick;

  const departments = new Map<string, { accrued: number; used: number; reserved: number }>();
  for (const b of (balances.data as BalanceRow[] | null) ?? []) {
    const d = departments.get(b.department) ?? { accrued: 0, used: 0, reserved: 0 };
    d.accrued += b.accrued;
    d.used += b.used;
    d.reserved += b.reserved;
    departments.set(b.department, d);
  }
  const company = [...departments.values()].reduce(
    (sum, d) => ({ accrued: sum.accrued + d.accrued, used: sum.used + d.used }),
    { accrued: 0, used: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard href="/admin?tab=absent" label="Відсутні сьогодні" value={absentToday} hint="людей поза роботою" />
        <StatCard href="/admin?tab=requests&status=pending" label="На розгляді" value={pending.count ?? 0} hint="заявок чекають рішення" />
        <StatCard
          href="/admin?tab=export"
          label={`Днів відсутності в ${MONTHS_LOCATIVE[Number(today.slice(5, 7)) - 1]}`}
          value={monthDays}
          hint={(Object.keys(daysByType) as LeaveType[]).map((t) => `${SHORT_TYPE[t]} ${daysByType[t]}`).join(" · ")}
        />
        <StatCard
          href="/admin?tab=balances"
          label="Використано відпустки"
          value={`${percent(company.used, company.accrued)}%`}
          hint={`${company.used} з ${company.accrued} накопичених днів`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <SectionTitle>Використання відпустки за відділами</SectionTitle>
          <p className="text-sm text-muted-foreground">Частка накопиченої на сьогодні щорічної відпустки</p>
        </div>
        <Card size="sm">
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-4">
              {[...departments.entries()].map(([name, d]) => (
                <li key={name} className="flex flex-col gap-1.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">
                      <b className="text-foreground">{percent(d.used, d.accrued)}%</b> · {d.used} з {d.accrued} днів
                      {d.reserved > 0 && ` · ще ${d.reserved} на розгляді`}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="bg-primary" style={{ width: `${percent(d.used, d.accrued)}%` }} />
                    <div className="bg-primary/30" style={{ width: `${percent(d.reserved, d.accrued)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> використано</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary/30" /> на розгляді</span>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ href, label, value, hint }: { href: string; label: string; value: number | string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:ring-primary/40"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold tracking-tight text-primary">{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Link>
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

  const [{ data: departments }, { data: rows }, { data: people }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    query.order("start_date", { ascending: false }).limit(200),
    supabase.from("employees").select("id, full_name, departments(name)").order("full_name"),
  ]);
  const employees: EmployeeOption[] = (people ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    department: (e.departments as unknown as { name: string } | null)?.name ?? "",
  }));

  return (
    <section className="flex flex-col gap-3">
      <RequestForForm employees={employees} today={kyivToday()} />
      <Card size="sm">
        <CardContent>
          {/* Остання колонка за шириною кнопок, щоб «Скинути» не обрізалось. */}
          <form className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto] sm:items-end">
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
      <AbsenceSection title="Сьогодні" rows={todayRows} />
      <AbsenceSection title="Пізніше цього тижня" rows={weekRows} />
    </div>
  );
}

function AbsenceSection({ title, rows }: { title: string; rows: AbsenceRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle count={rows.length}>{title}</SectionTitle>
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
