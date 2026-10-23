import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "employee" | "admin";

export type CurrentEmployee = {
  id: string;
  full_name: string;
  position: string;
  role: Role;
  department: string;
};

export const ROLE_HOME: Record<Role, string> = {
  employee: "/employee",
  admin: "/admin",
};

// Роль береться з таблиці employees за auth.uid(), а не з клієнта.
export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("employees")
    .select("id, full_name, position, role, departments(name)")
    .eq("user_id", userId)
    .single();
  if (!data) redirect("/login");

  return {
    id: data.id,
    full_name: data.full_name,
    position: data.position,
    role: data.role as Role,
    department: (data.departments as unknown as { name: string } | null)?.name ?? "",
  };
});

// Адміністратор теж співробітник, тож /employee доступна обом ролям.
export async function requireRole(allowed: Role[]) {
  const employee = await getCurrentEmployee();
  if (!allowed.includes(employee.role)) redirect(ROLE_HOME[employee.role]);
  return employee;
}
