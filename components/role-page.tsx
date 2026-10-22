import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { requireRole, type CurrentEmployee, type Role } from "@/lib/session";

async function Guarded({
  allowed,
  render,
}: {
  allowed: Role[];
  render: (employee: CurrentEmployee) => React.ReactNode;
}) {
  // Сторінки ролей персональні: рендер лише під час запиту (перевірка сесії й «сьогодні» читають час).
  await connection();
  const employee = await requireRole(allowed);
  return <AppShell employee={employee}>{render(employee)}</AppShell>;
}

// Сторінка ролі: перевірка доступу на сервері + шапка. Cookies читаються всередині Suspense.
export function RolePage(props: {
  allowed: Role[];
  render: (employee: CurrentEmployee) => React.ReactNode;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Завантаження…</p>}>
      <Guarded {...props} />
    </Suspense>
  );
}
