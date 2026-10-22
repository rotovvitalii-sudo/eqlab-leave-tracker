export type LeaveType = "annual" | "unpaid" | "sick";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled" | "registered";

export const TYPE_LABEL: Record<LeaveType, string> = {
  annual: "Щорічна відпустка",
  unpaid: "Без збереження зарплати",
  sick: "Лікарняний",
};

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "На розгляді",
  approved: "Погоджено",
  rejected: "Відхилено",
  cancelled: "Скасовано",
  registered: "Зареєстровано",
};

// Дати з БД приходять як YYYY-MM-DD; без Date, щоб не зсуватися часовим поясом.
export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function formatRange(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export function daysLabel(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дні`;
  return `${n} днів`;
}

export const MONTHS_LOCATIVE = [
  "січні", "лютому", "березні", "квітні", "травні", "червні",
  "липні", "серпні", "вересні", "жовтні", "листопаді", "грудні",
];

export function kyivToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
