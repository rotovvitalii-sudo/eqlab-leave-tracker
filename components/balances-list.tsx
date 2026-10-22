import { Card, CardContent } from "@/components/ui/card";

export type BalanceRow = {
  employee_id: string;
  full_name: string;
  department: string;
  accrued: number;
  used: number;
  reserved: number;
  available: number;
};

// Таблиця на десктопі, картки-рядки на телефоні.
export function BalancesList({ rows }: { rows: BalanceRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Немає даних.</p>;

  return (
    <Card size="sm">
      <CardContent>
        <div className="hidden grid-cols-[2fr_repeat(4,1fr)] gap-2 border-b pb-2 text-xs text-muted-foreground sm:grid">
          <span>Співробітник</span>
          <span className="text-right">Накопичено</span>
          <span className="text-right">Використано</span>
          <span className="text-right">На розгляді</span>
          <span className="text-right">Доступно</span>
        </div>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.employee_id} className="grid grid-cols-4 gap-x-2 gap-y-1 py-2 text-sm sm:grid-cols-[2fr_repeat(4,1fr)] sm:items-center">
              <div className="col-span-4 sm:col-span-1">
                <p className="font-medium">{r.full_name}</p>
                <p className="text-xs text-muted-foreground">{r.department}</p>
              </div>
              <Cell label="Накопичено" value={r.accrued} />
              <Cell label="Використано" value={r.used} />
              <Cell label="На розгляді" value={r.reserved} />
              <Cell label="Доступно" value={Math.max(r.available, 0)} strong />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="sm:text-right">
      <span className="block text-[11px] text-muted-foreground sm:hidden">{label}</span>
      <span className={strong ? "font-semibold" : undefined}>{value}</span>
    </div>
  );
}
