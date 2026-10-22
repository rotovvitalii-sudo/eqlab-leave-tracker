"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/format";

export type Preview = { days: number; available: number | null; colleagues: string[] };
type Result<T = null> = { ok: true; data: T; error: null } | { ok: false; data: null; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data, error: null });
const fail = (message: string): Result<never> => ({ ok: false, data: null, error: message });

// Правила перевіряє база (spec §5); тут лише виклик функцій і повідомлення з них.
export async function previewRequest(type: LeaveType, start: string, end: string): Promise<Result<Preview | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_request", { p_type: type, p_start: start, p_end: end });
  if (error) return fail(error.message);
  return ok((data?.[0] as Preview | undefined) ?? null);
}

export async function submitRequest(input: {
  type: LeaveType;
  start: string;
  end: string;
  comment: string;
}): Promise<Result<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_request", {
    p_type: input.type,
    p_start: input.start,
    p_end: input.end,
    p_comment: input.comment,
  });
  if (error) return fail(error.message);
  revalidatePath("/employee");
  return ok(data as string);
}

export async function cancelRequest(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_request", { p_id: id });
  if (error) return fail(error.message);
  revalidatePath("/employee");
  return ok(null);
}

export async function attachDocument(id: string, path: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attach_sick_document", { p_id: id, p_path: path });
  if (error) return fail(error.message);
  revalidatePath("/employee");
  return ok(null);
}
