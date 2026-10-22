import { PageHeader, SectionTitle } from "@/components/headings";
import { OnboardingTips } from "@/components/onboarding-tips";
import { RolePage } from "@/components/role-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/server";
import type { CurrentEmployee } from "@/lib/session";
import {
  addDays, daysLabel, formatRange, kyivToday, ROLE_LABEL, TYPE_LABEL,
  type LeaveStatus, type LeaveType,
} from "@/lib/format";
import { RequestForm } from "./request-form";
import { RequestActions } from "./request-actions";

export default function EmployeePage() {
  return (
    <RolePage
      allowed={["employee", "manager", "admin"]}
      render={(employee) => <EmployeeDashboard employee={employee} />}
    />
  );
}

async function EmployeeDashboard({ employee }: { employee: CurrentEmployee }) {
  const today = kyivToday();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={ROLE_LABEL[employee.role]}
        title="Мої відпустки"
        subtitle={`${employee.position} · ${employee.department}`}
      />
      <OnboardingTips set="employee" />
      <Balance employeeId={employee.id} />
      <RequestForm employeeId={employee.id} today={today} />
      <MyRequests employeeId={employee.id} today={today} />
      <ColleagueAbsences employeeId={employee.id} today={today} />
    </div>
  );
}

type BalanceRow = { employee_id: string; accrued: number; used: number; reserved: number; available: number };

async function Balance({ employeeId }: { employeeId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_balances");
  const own = (data as BalanceRow[] | null)?.find((row) => row.employee_id === employeeId);
  if (!own) return null;

  const items = [
    { label: "Накопичено", value: own.accrued },
    { label: "Використано", value: own.used },
    { label: "На розгляді", value: own.reserved },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Щорічна відпустка</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold tracking-tight text-primary">{Math.max(own.available, 0)}</span>
          <span className="text-sm text-muted-foreground">доступно зараз</span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {items.map((item) => (
            <div key={item.label} className="rounded-tile bg-muted px-3 py-2">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="font-medium">{daysLabel(item.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          24 календарні дні на рік: щомісяця додається 2 дні. Залишок на наступний рік не переноситься.
        </p>
      </CardContent>
    </Card>
  );
}

type RequestRow = {
  id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  status: LeaveStatus;
  employee_comment: string | null;
  decision_comment: string | null;
  document_path: string | null;
};

async function MyRequests({ employeeId, today }: { employeeId: string; today: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("id, type, start_date, end_date, days, status, employee_comment, decision_comment, document_path")
    .eq("employee_id", employeeId)
    .order("start_date", { ascending: false });
  const requests = (data as RequestRow[] | null) ?? [];

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Мої заявки</SectionTitle>
      {requests.length === 0 && <p className="text-sm text-muted-foreground">Заявок ще немає.</p>}
      {requests.map((r) => {
        const notStarted = r.start_date > today;
        const canCancel = notStarted && ["pending", "approved", "registered"].includes(r.status);
        const canAttach = r.type === "sick" && r.status === "registered" && !r.document_path;
        return (
          <Card key={r.id} size="sm">
            <CardContent>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{TYPE_LABEL[r.type]}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatRange(r.start_date, r.end_date)} · {daysLabel(r.days)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.employee_comment && <p className="mt-2 text-sm">Коментар: {r.employee_comment}</p>}
              {r.decision_comment && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Відповідь менеджера:</span> {r.decision_comment}
                </p>
              )}
              {r.type === "sick" && r.status === "registered" && !r.document_path && (
                <p className="mt-2 text-xs text-muted-foreground">Документ не додано</p>
              )}
              <RequestActions
                employeeId={employeeId}
                requestId={r.id}
                canCancel={canCancel}
                canAttach={canAttach}
                documentPath={r.document_path}
              />
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

type AbsenceRow = {
  employee_id: string;
  full_name: string;
  department: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
};

async function ColleagueAbsences({ employeeId, today }: { employeeId: string; today: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_colleague_absences", { p_from: today, p_to: addDays(today, 30) });
  const absences = ((data as AbsenceRow[] | null) ?? []).filter((a) => a.employee_id !== employeeId);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <SectionTitle>Відсутні колеги</SectionTitle>
        <p className="text-sm text-muted-foreground">Сьогодні й наступні 30 днів, уся компанія</p>
      </div>
      {absences.length === 0 && <p className="text-sm text-muted-foreground">Ніхто не відсутній.</p>}
      {absences.length > 0 && (
        <Card size="sm">
          <CardContent>
            <ul className="divide-y">
              {absences.map((a) => (
                <li key={`${a.employee_id}-${a.start_date}`} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
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
