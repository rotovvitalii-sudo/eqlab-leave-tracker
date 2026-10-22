import { createClient } from "@/lib/supabase/client";
import { attachDocument } from "./actions";

const MAX_SIZE = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function validateDocument(file: File): string | null {
  if (!EXTENSIONS[file.type]) return "Підтримуються лише PDF, JPG і PNG";
  if (file.size > MAX_SIZE) return "Файл більший за 5 МБ";
  return null;
}

// Шлях {employee_id}/{request_id}/{час}.{розширення}: латиниця, без імені файлу користувача.
export async function uploadSickDocument(employeeId: string, requestId: string, file: File) {
  const invalid = validateDocument(file);
  if (invalid) return invalid;

  const path = `${employeeId}/${requestId}/${Date.now()}.${EXTENSIONS[file.type]}`;
  const { error } = await createClient().storage.from("sick-documents").upload(path, file);
  if (error) return "Не вдалося завантажити файл";

  const result = await attachDocument(requestId, path);
  return result.error;
}
