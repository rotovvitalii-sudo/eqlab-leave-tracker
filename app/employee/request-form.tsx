"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MartialLawNote } from "@/components/martial-law-note";
import { cn } from "@/lib/utils";
import { daysLabel, MONTHS_LOCATIVE, TYPE_LABEL, type LeaveType } from "@/lib/format";
import { previewRequest, submitRequest, type Preview } from "./actions";
import { uploadSickDocument, validateDocument } from "./upload-document";

const TYPES: LeaveType[] = ["annual", "unpaid", "sick"];

// Чернетка від ІІ-асистента: форма відкривається з цими значеннями (spec §5.10).
export type DraftInitial = { type: LeaveType; start: string; end: string; comment: string };

export function RequestForm({ employeeId, today, initial }: { employeeId: string; today: string; initial?: DraftInitial }) {
  const [open, setOpen] = useState(Boolean(initial));
  const [type, setType] = useState<LeaveType>(initial?.type ?? "annual");
  const [start, setStart] = useState(initial?.start ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isSick = type === "sick";
  // Відпустку можна почати сьогодні (spec §5.1 п. 2); лікарняний — і на минулі дати.
  const minDate = isSick ? undefined : today;
  const datesReady = Boolean(start && end && end >= start);

  useEffect(() => {
    if (!datesReady) return;
    let stale = false;
    previewRequest(type, start, end).then((result) => {
      if (!stale) setPreview(result.data);
    });
    return () => {
      stale = true;
    };
  }, [type, start, end, datesReady]);

  function reset() {
    setStart("");
    setEnd("");
    setComment("");
    setFile(null);
    setPreview(null);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (file) {
      const invalid = validateDocument(file);
      if (invalid) return setError(invalid);
    }
    startTransition(async () => {
      const result = await submitRequest({ type, start, end, comment });
      if (!result.ok) return setError(result.error);

      let message = isSick ? "Лікарняний зареєстровано." : "Заявку надіслано менеджеру на погодження.";
      if (isSick && file) {
        const uploadError = await uploadSickDocument(employeeId, result.data, file);
        if (uploadError) message += ` Документ не додано: ${uploadError}. Його можна додати пізніше.`;
      }
      reset();
      setSuccess(message);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full sm:w-auto" onClick={() => { setSuccess(null); setOpen(true); }}>
          Нова заявка
        </Button>
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </div>
    );
  }

  const startMonth = start ? Number(start.slice(5, 7)) - 1 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Нова заявка</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Тип відсутності">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => { setType(t); setPreview(null); setError(null); }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm text-left transition-colors",
                  type === t ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start">З</Label>
              <Input id="start" type="date" required min={minDate} value={start}
                onChange={(e) => { setStart(e.target.value); if (!end || e.target.value > end) setEnd(e.target.value); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end">По</Label>
              <Input id="end" type="date" required min={start || minDate} value={end}
                onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {isSick && <p className="-mt-2 text-xs text-muted-foreground">Лікарняний можна оформити й на минулі дати.</p>}

          {datesReady && preview && (
            <div className="rounded-tile bg-muted px-3 py-2 text-sm">
              <p>
                {isSick ? "Тривалість" : "Буде враховано"}: <b>{daysLabel(preview.days)}</b>
                {preview.available !== null && (
                  <> · доступно в {MONTHS_LOCATIVE[startMonth]}: <b>{daysLabel(Math.max(preview.available, 0))}</b></>
                )}
              </p>
              {type === "annual" && <div className="mt-1"><MartialLawNote /></div>}
            </div>
          )}

          {datesReady && preview && preview.colleagues.length > 0 && (
            <div role="status" className="rounded-tile border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              У ці дати з вашого відділу відсутні: {preview.colleagues.join(", ")}. Заявку все одно можна надіслати.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comment">Коментар (необов’язково)</Label>
            <Textarea id="comment" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

          {isSick && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="document">Документ (необов’язково): PDF, JPG або PNG до 5 МБ</Label>
              <Input id="document" type="file" accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={() => { reset(); setOpen(false); }}>
              Скасувати
            </Button>
            <Button type="submit" size="lg" disabled={pending || !datesReady}>
              {pending ? "Надсилаємо…" : isSick ? "Зареєструвати лікарняний" : "Надіслати заявку"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
