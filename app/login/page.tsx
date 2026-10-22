import { Logo } from "@/components/logo";
import { DemoLoginButtons } from "./demo-login-buttons";

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
      {/* Ледь помітна сітка, як на eql.systems (spec §11). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:60px_60px] [mask-image:linear-gradient(transparent,black_20%,black_80%,transparent)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:py-10">
        <Logo className="text-2xl" />

        <div className="mt-10 max-w-2xl sm:mt-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background px-4 py-2">
            <span className="font-semibold text-primary">/</span>
            <span className="text-sm tracking-wide text-muted-foreground">Демо-доступ без реєстрації</span>
          </p>
          <h1 className="mt-5 text-4xl leading-[1.1] font-bold sm:text-5xl">
            Відпустки та <span className="text-primary">лікарняні</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Баланс днів, заявки й погодження в одному місці. Оберіть роль, щоб подивитися систему її очима.
          </p>
        </div>

        <section className="mt-10 sm:mt-14">
          <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">/ Оберіть роль</h2>
          <DemoLoginButtons />
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Дані вигадані. Їх можна будь-коли скинути до початкових кнопкою «Скинути демо-дані».
        </p>
      </div>
    </main>
  );
}
