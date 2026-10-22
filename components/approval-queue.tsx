import { Card, CardContent } from "@/components/ui/card";
import { DecisionForm } from "@/components/decision-form";
import { MartialLawNote } from "@/components/martial-law-note";
import { createClient } from "@/lib/supabase/server";
import { daysLabel, formatRange, TYPE_LABEL, type LeaveType } from "@/lib/format";

type QueueRow = {
  id: string;
  full_name: string;
  department: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  employee_comment: string | null;
  available_after: number | null;
  colleagues: string[];
};

// Черга «На розгляді»: менеджеру — заявки прямих підлеглих, адміну — заявки директорки.
export async function ApprovalQueue({ title, hideWhenEmpty = false }: { title: string; hideWhenEmpty?: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_approval_queue");
  const queue = (data as QueueRow[] | null) ?? [];
  if (hideWhenEmpty && queue.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-muted-foreground">({queue.length})</span>
      </h2>
      {queue.length === 0 && <p className="text-sm text-muted-foreground">Нових заявок немає.</p>}
      {queue.map((r) => (
        <Card key={r.id} size="sm">
          <CardContent>
            <p className="font-medium">{r.full_name}</p>
            <p className="text-sm text-muted-foreground">
              {r.department} · {TYPE_LABEL[r.type]}
            </p>
            <p className="mt-1 text-sm">
              {formatRange(r.start_date, r.end_date)} · <b>{daysLabel(r.days)}</b>
              {r.available_after !== null && (
                <span className="text-muted-foreground"> · залишок після погодження: {daysLabel(r.available_after)}</span>
              )}
            </p>
            {r.employee_comment && <p className="mt-1 text-sm">Коментар: {r.employee_comment}</p>}
            {r.colleagues.length > 0 && (
              <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                У ці дати з відділу вже відсутні: {r.colleagues.join(", ")}
              </p>
            )}
            {r.type === "annual" && <div className="mt-2"><MartialLawNote /></div>}
            <DecisionForm requestId={r.id} />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
