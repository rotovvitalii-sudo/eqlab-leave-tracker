"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { askAssistant } from "@/app/actions/assistant";
import type { Draft } from "@/lib/ai/assistant";
import { daysLabel, formatRange, TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

// ІІ-асистент (spec §4 В3, §5.10). Розмова живе лише в цій вкладці й нікуди не зберігається.
type UiMessage = { role: "user" | "assistant"; text: string; draft?: Draft | null };

const SUGGESTIONS = ["Скільки в мене днів відпустки?", "Підбери тиждень відпустки у грудні", "Хто з колег відсутній наступного тижня?"];

function draftHref(d: Draft) {
  const params = new URLSearchParams({ type: d.type, start: d.start, end: d.end });
  if (d.comment) params.set("comment", d.comment);
  return `/employee?${params}`;
}

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, open]);

  function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    const next: UiMessage[] = [...messages, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setError(null);
    startTransition(async () => {
      const result = await askAssistant(next.map(({ role, text }) => ({ role, text })));
      if (result.error) return setError(result.error);
      setMessages((current) => [...current, { role: "assistant", text: result.reply ?? "", draft: result.draft }]);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <Sparkles className="size-4" />
        Асистент
      </button>
    );
  }

  return (
    <section
      aria-label="Асистент"
      className="fixed inset-x-2 bottom-2 z-40 flex max-h-[80dvh] flex-col overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-foreground/10 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[400px]"
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">/ Асистент</p>
          <p className="text-xs text-muted-foreground">Відпустки, баланс, колеги · ІІ Claude</p>
        </div>
        <button type="button" aria-label="Закрити асистента" onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground">
              Спитайте про свій баланс, відсутніх колег або попросіть підібрати дати — я перевірю їх за правилами й підготую чернетку заявки.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-tile border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
            <p
              className={cn(
                "max-w-[85%] rounded-tile px-3 py-2 whitespace-pre-wrap",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {m.text}
            </p>
            {m.draft && (
              <div className="w-full rounded-tile border border-primary/25 p-3">
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">/ Чернетка заявки</p>
                <p className="mt-1 font-medium">{TYPE_LABEL[m.draft.type]}</p>
                <p className="text-muted-foreground">
                  {formatRange(m.draft.start, m.draft.end)} · {daysLabel(m.draft.days)}
                </p>
                {m.draft.colleagues.length > 0 && (
                  <p className="mt-1 text-xs text-amber-800">З відділу тоді відсутні: {m.draft.colleagues.join(", ")}</p>
                )}
                <Link href={draftHref(m.draft)} onClick={() => setOpen(false)} className={cn(buttonVariants({ size: "sm" }), "mt-2")}>
                  Заповнити форму
                </Link>
              </div>
            )}
          </div>
        ))}

        {pending && <p className="w-fit rounded-tile bg-muted px-3 py-2 text-muted-foreground">Думаю…</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex flex-col gap-1.5 border-t px-3 py-3"
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Напишіть питання…"
            aria-label="Питання асистенту"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          />
          <Button type="submit" size="icon" aria-label="Надіслати" disabled={pending || !input.trim()}>
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Відповіді генерує ІІ — перевіряйте дати у формі перед надсиланням.</p>
      </form>
    </section>
  );
}
