"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TYPE_LABEL, type LeaveType } from "@/lib/format";
import { submitRequestFor } from "@/app/actions/admin";

const TYPES: LeaveType[] = ["sick", "annual", "unpaid"];

export type EmployeeOption = { id: string; full_name: string; department: string };

// Форма адміністратора «Внести заявку за співробітника» (spec §4 А8). Без передперегляду днів:
// правила й повідомлення — з бази (submit_request_for).
export function RequestForForm({ employees, today }: { employees: EmployeeOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<LeaveType>("sick");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isSick = type === "sick";
  const ready = Boolean(employeeId && start && end && end >= start);

  function reset() {
    setEmployeeId("");
    setStart("");
    setEnd("");
    setComment("");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitRequestFor({ employeeId, type, start, end, comment });
      if (result.error) return setError(result.error);
      const name = employees.find((e) => e.id === employeeId)?.full_name ?? "";
      reset();
      setSuccess(isSick ? `Лікарняний зареєстровано: ${name}.` : `Заявку додано в чергу погодження: ${name}.`);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="self-start" onClick={() => { setSuccess(null); setOpen(true); }}>
          Внести заявку за співробітника
        </Button>
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Заявка за співробітника</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="for-employee">Співробітник</Label>
            <select
              id="for-employee"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="">Оберіть співробітника</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} · {e.department}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Тип відсутності">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => { setType(t); setError(null); }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  type === t ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="for-start">З</Label>
              <Input id="for-start" type="date" required min={isSick ? undefined : today} value={start}
                onChange={(e) => { setStart(e.target.value); if (!end || e.target.value > end) setEnd(e.target.value); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="for-end">По</Label>
              <Input id="for-end" type="date" required min={start || (isSick ? undefined : today)} value={end}
                onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {isSick
              ? "Лікарняний одразу «Зареєстровано»; документ співробітник прикріпить сам."
              : "Заявка потрапить у чергу «На погодження»; діють ті самі правила балансу."}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="for-comment">Коментар (необов’язково)</Label>
            <Textarea id="for-comment" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={() => { reset(); setOpen(false); }}>
              Скасувати
            </Button>
            <Button type="submit" size="lg" disabled={pending || !ready}>
              {pending ? "Вносимо…" : isSick ? "Зареєструвати лікарняний" : "Надіслати заявку"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
