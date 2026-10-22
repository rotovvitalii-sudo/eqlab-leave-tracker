"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// reset_demo() у базі сама перевіряє, що викликає прив'язаний демо-користувач.
export async function resetDemo() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_demo");
  if (error) return { error: "Не вдалося скинути дані. Спробуйте ще раз." };
  revalidatePath("/", "layout");
  return { error: null };
}
