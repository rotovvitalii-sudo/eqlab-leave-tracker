import { createClient } from "@/lib/supabase/server";
import { formatDate, TYPE_LABEL, type LeaveType } from "@/lib/format";

type ExportRow = {
  full_name: string;
  department: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days_in_month: number;
  has_document: boolean;
};

const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;

// Доступ перевіряє export_month у базі (лише адміністратор).
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Невірний місяць", { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_month", { p_month: `${month}-01` });
  if (error) return new Response(error.message, { status: 403 });

  const header = ["ПІБ", "Відділ", "Тип", "Початок", "Кінець", "Днів у місяці", "Документ"];
  const lines = (data as ExportRow[]).map((r) =>
    [
      r.full_name,
      r.department,
      TYPE_LABEL[r.type],
      formatDate(r.start_date),
      formatDate(r.end_date),
      r.days_in_month,
      r.type === "sick" ? (r.has_document ? "є" : "відсутній") : "",
    ].map(cell).join(";"),
  );

  // BOM і «;» — щоб Excel з українською локаллю відкрив кирилицю й колонки без імпорту.
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eqlab-vidsutnosti-${month}.csv"`,
    },
  });
}
