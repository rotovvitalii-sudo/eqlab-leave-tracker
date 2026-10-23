"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Хто може вирішувати, перевіряє база (decide_request); тут лише виклик.
export async function decideRequest(id: string, approve: boolean, comment: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_request", { p_id: id, p_approve: approve, p_comment: comment });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { error: null };
}
