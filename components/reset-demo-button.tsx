"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resetDemo } from "@/app/actions/demo";

export function ResetDemoButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Повернути всі заявки й баланси до початкового стану? Зміни всіх користувачів буде втрачено.")) return;
          setMessage(null);
          startTransition(async () => {
            const { error } = await resetDemo();
            setMessage(error ?? "Демо-дані скинуто до початкових.");
          });
        }}
      >
        {pending ? "Скидаємо…" : "Скинути демо-дані"}
      </Button>
      {message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
