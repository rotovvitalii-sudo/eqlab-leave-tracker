import { RolePage } from "@/components/role-page";
import { ApprovalQueue } from "@/components/approval-queue";
import { BalancesList, type BalanceRow } from "@/components/balances-list";
import { RequestList, REQUEST_LIST_SELECT, type RequestListRow } from "@/components/request-list";
import { createClient } from "@/lib/supabase/server";
import type { CurrentEmployee } from "@/lib/session";

export default function ManagerPage() {
  return <RolePage allowed={["manager"]} render={(employee) => <ManagerDashboard employee={employee} />} />;
}

async function ManagerDashboard({ employee }: { employee: CurrentEmployee }) {
  const supabase = await createClient();
  // RLS віддає менеджеру свої дані й дані прямих підлеглих; себе тут не показуємо.
  const [{ data: balances }, { data: requests }] = await Promise.all([
    supabase.rpc("get_balances"),
    supabase
      .from("leave_requests")
      .select(REQUEST_LIST_SELECT)
      .neq("employee_id", employee.id)
      .order("start_date", { ascending: false })
      .limit(100),
  ]);
  const team = ((balances as BalanceRow[] | null) ?? []).filter((b) => b.employee_id !== employee.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Моя команда</h1>
        <p className="text-sm text-muted-foreground">{employee.department} · {team.length} підлеглих</p>
      </div>
      <ApprovalQueue title="На погодження" />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Баланси щорічної відпустки</h2>
        <BalancesList rows={team} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Заявки та лікарняні команди</h2>
        <RequestList rows={(requests as unknown as RequestListRow[] | null) ?? []} empty="Заявок ще немає." />
      </section>
    </div>
  );
}
