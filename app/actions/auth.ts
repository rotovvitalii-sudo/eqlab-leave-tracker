"use server";

import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/session";

const DEMO_EMAILS: Record<Role, string> = {
  employee: "employee@eqlab.test",
  manager: "manager@eqlab.test",
  admin: "admin@eqlab.test",
};

// Перехід після входу й виходу робить браузер повним перезавантаженням (window.location),
// а не redirect(): інакше Next зберігає приховані сторінки попереднього користувача в DOM.
export type SignInState = { error: string | null; redirectTo?: string };

// Пароль демо-акаунтів живе лише на сервері (DEMO_PASSWORD), у браузер не потрапляє.
export async function signInAsDemo(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const role = formData.get("role") as Role;
  if (!(role in DEMO_EMAILS)) return { error: "Невідома роль" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAILS[role],
    password: process.env.DEMO_PASSWORD ?? "",
  });
  if (error) return { error: "Не вдалося увійти. Спробуйте ще раз за хвилину." };

  return { error: null, redirectTo: ROLE_HOME[role] };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
