import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoLoginButtons } from "./demo-login-buttons";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">EQLab</p>
          <CardTitle className="text-2xl">Відпустки та лікарняні</CardTitle>
          <CardDescription>
            Демо-доступ без реєстрації. Оберіть роль, щоб подивитися систему її очима.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DemoLoginButtons />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Дані вигадані. Їх можна будь-коли скинути до початкових кнопкою «Скинути демо-дані».
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
