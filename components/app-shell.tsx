import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import type { CurrentEmployee } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/format";

// Шапка з навігацією за роллю: менеджер і адмін теж мають «Мої відпустки».
export async function AppShell({ employee, children }: { employee: CurrentEmployee; children: React.ReactNode }) {
  // Лічильник заявок «На розгляді», які чекають рішення цього користувача.
  let pending = 0;
  if (employee.role !== "employee") {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_approval_queue");
    pending = data?.length ?? 0;
  }

  const links = [
    { href: "/employee", label: "Мої відпустки", count: 0 },
    ...(employee.role === "manager" ? [{ href: "/manager", label: "Моя команда", count: pending }] : []),
    ...(employee.role === "admin" ? [{ href: "/admin", label: "Адміністрування", count: pending }] : []),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        {/* На телефоні: логотип і користувач у першому рядку, навігація — у другому. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" aria-label="EQLab — на головну"><Logo className="text-lg" /></Link>
          <nav className="order-last flex w-full gap-4 text-sm font-medium sm:order-none sm:w-auto">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-primary">
                {link.label}
                {link.count > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {link.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-xs leading-tight">
              <div className="font-medium">{employee.full_name}</div>
              <div className="text-muted-foreground">{ROLE_LABEL[employee.role]}</div>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">Вийти</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
          <span>Демо EQLab: дані вигадані, можна сміливо експериментувати.</span>
          <ResetDemoButton />
        </div>
      </footer>
    </div>
  );
}
