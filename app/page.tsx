import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentEmployee, ROLE_HOME } from "@/lib/session";

async function RoleRedirect() {
  const employee = await getCurrentEmployee();
  redirect(ROLE_HOME[employee.role]);
  return null;
}

export default function Home() {
  return (
    <Suspense>
      <RoleRedirect />
    </Suspense>
  );
}
