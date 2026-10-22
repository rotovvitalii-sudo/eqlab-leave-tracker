import { Card, CardContent } from "@/components/ui/card";
import { DocumentButton } from "@/components/document-button";
import { StatusBadge } from "@/components/status-badge";
import { daysLabel, formatRange, TYPE_LABEL, type LeaveStatus, type LeaveType } from "@/lib/format";

export type RequestListRow = {
  id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  status: LeaveStatus;
  employee_comment: string | null;
  decision_comment: string | null;
  document_path: string | null;
  created_by: string | null;
  employee: { full_name: string; departments: { name: string } | null } | null;
};

// Поля для select до Supabase, щоб рядки відповідали RequestListRow.
export const REQUEST_LIST_SELECT =
  "id, type, start_date, end_date, days, status, employee_comment, decision_comment, document_path, created_by, employee:employees!leave_requests_employee_id_fkey!inner(full_name, department_id, departments(name))";

// Заявку вніс адміністратор за співробітника (spec §5.8).
export function EnteredByHr() {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-primary">Внесено HR</span>;
}

export function RequestList({ rows, empty }: { rows: RequestListRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  return (
    <Card size="sm">
      <CardContent>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{r.employee?.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.employee?.departments?.name} · {TYPE_LABEL[r.type]}
                  {r.created_by && <> <EnteredByHr /></>}
                </p>
                <p className="text-muted-foreground">
                  {formatRange(r.start_date, r.end_date)} · {daysLabel(r.days)}
                </p>
                {r.decision_comment && <p className="text-xs">Відповідь: {r.decision_comment}</p>}
                {r.type === "sick" && r.status === "registered" && !r.document_path && (
                  <p className="text-xs font-medium text-amber-700">Документ відсутній</p>
                )}
                {r.document_path && <div className="mt-1"><DocumentButton path={r.document_path} /></div>}
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
