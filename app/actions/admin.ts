"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/format";

// Заявка адміністратором за співробітника (spec §5.8). Хто має право і всі правила перевіряє база.
export async function submitRequestFor(input: {
  employeeId: string;
  type: LeaveType;
  start: string;
  end: string;
  comment: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_request_for", {
    p_employee_id: input.employeeId,
    p_type: input.type,
    p_start: input.start,
    p_end: input.end,
    p_comment: input.comment,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { error: null };
}
