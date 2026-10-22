"use client";

import { useActionState, useState } from "react";
import { ArrowRight, ShieldCheck, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { signInAsDemo, type SignInState } from "@/app/actions/auth";
import type { Role } from "@/lib/session";

// Можливості ролей — коротко за spec §2.
const OPTIONS: { role: Role; title: string; person: string; abilities: string; Icon: LucideIcon }[] = [
  {
    role: "employee",
    title: "Співробітник",
    person: "Андрій Коваленко · Frontend-розробник",
    abilities: "Подає заявки, бачить свій баланс і відсутності колег.",
    Icon: UserRound,
  },
  {
    role: "manager",
    title: "Менеджер",
    person: "Дмитро Кравець · Керівник розробки",
    abilities: "Погоджує заявки команди з підказкою, хто вже відсутній.",
    Icon: UsersRound,
  },
  {
    role: "admin",
    title: "Адміністратор",
    person: "Марія Ткаченко · HR-менеджерка",
    abilities: "Бачить усі заявки й баланси, вивантажує місяць для бухгалтерії.",
    Icon: ShieldCheck,
  },
];

const initialState: SignInState = { error: null };

export function DemoLoginButtons() {
  const [state, formAction, pending] = useActionState(signInAsDemo, initialState);
  const [chosen, setChosen] = useState<Role | null>(null);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {OPTIONS.map(({ role, title, person, abilities, Icon }, index) => (
          <button
            key={role}
            type="submit"
            name="role"
            value={role}
            disabled={pending}
            onClick={() => setChosen(role)}
            className="group relative flex flex-col items-start gap-3 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-70"
          >
            <span aria-hidden className="absolute top-4 right-5 text-3xl font-bold text-foreground/10">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="flex size-11 items-center justify-center rounded-[0.75rem] bg-muted text-primary">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold">{title}</span>
              <span className="block text-sm text-muted-foreground">{person}</span>
            </span>
            <span className="text-sm">{abilities}</span>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-primary">
              {pending && chosen === role ? "Входимо…" : "Увійти"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
