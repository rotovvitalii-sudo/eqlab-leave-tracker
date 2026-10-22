"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signInAsDemo, type SignInState } from "@/app/actions/auth";
import type { Role } from "@/lib/session";

const OPTIONS: { role: Role; label: string; hint: string }[] = [
  { role: "employee", label: "Увійти як співробітник", hint: "Андрій Коваленко · Frontend-розробник" },
  { role: "manager", label: "Увійти як менеджер", hint: "Дмитро Кравець · Керівник розробки" },
  { role: "admin", label: "Увійти як адміністратор", hint: "Марія Ткаченко · HR-менеджерка" },
];

const initialState: SignInState = { error: null };

export function DemoLoginButtons() {
  const [state, formAction, pending] = useActionState(signInAsDemo, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {OPTIONS.map((option) => (
        <Button
          key={option.role}
          type="submit"
          name="role"
          value={option.role}
          variant={option.role === "employee" ? "default" : "outline"}
          disabled={pending}
          className="h-auto flex-col items-start gap-0.5 px-4 py-3 text-left whitespace-normal"
        >
          <span className="text-base">{option.label}</span>
          <span className="text-xs font-normal opacity-70">{option.hint}</span>
        </Button>
      ))}
      {pending && <p className="text-center text-sm text-muted-foreground">Входимо…</p>}
      {state.error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
