"use server";

import { createClient } from "@/lib/supabase/server";

// Посилання на файл живе хвилину; хто може його отримати, вирішує політика Storage
// (власник і адміністратор — spec §5.5).
export async function getDocumentUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("sick-documents").createSignedUrl(path, 60);
  if (error || !data) return { url: null, error: "Документ недоступний" };
  return { url: data.signedUrl, error: null };
}
