"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Підказки для першого входу (spec §4 В2). «Вже бачив» — лише зручність одного браузера,
// тому localStorage, а не база; будь-яка помилка сховища = просто показуємо підказки.
export type TipsSet = "employee" | "manager" | "admin";

const TIPS: Record<TipsSet, string[]> = {
  employee: [
    "Угорі — баланс щорічної відпустки: скільки накопичено, використано й доступно зараз.",
    "«Нова заявка»: оберіть тип і дати — кількість днів і колег, які тоді відсутні, видно ще до відправлення.",
    "Заявку можна скасувати, доки вона не почалася. Лікарняний оформлюється й на минулі дати, документ — за бажанням.",
    "Унизу — хто з колег відсутній найближчі 30 днів. «Скинути демо-дані» в підвалі повертає все до початкового стану.",
  ],
  manager: [
    "«На погодження» — заявки ваших прямих підлеглих. Перед рішенням видно залишок днів і хто з відділу вже відсутній.",
    "Відхилити можна лише з коментарем — співробітник побачить його біля заявки.",
    "Нижче — баланси й усі заявки команди. Власні відпустки — у розділі «Мої відпустки».",
  ],
  admin: [
    "«Заявки» — усі заявки компанії з фільтрами за відділом, типом, статусом і датами.",
    "«Баланси» й «Хто відсутній» — картина по всіх 50 співробітниках.",
    "«Експорт» — CSV за місяць для бухгалтерії; відкривається в Excel з кирилицею.",
  ],
};

const SHOW_EVENT = "eqlab:show-tips";
const storageKey = (set: TipsSet) => `eqlab-tips-${set}-v1`;

function readSeen(set: TipsSet) {
  try {
    return localStorage.getItem(storageKey(set)) === "seen";
  } catch {
    return false;
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

export function OnboardingTips({ set }: { set: TipsSet }) {
  // На сервері вважаємо «вже бачив»: підказки з'являються лише в браузері, без розбіжності розмітки.
  const seen = useSyncExternalStore(subscribe, () => readSeen(set), () => true);
  // Рішення в цій вкладці: «Зрозуміло» ховає навіть без доступу до сховища, «Підказки» в підвалі показують знову.
  const [override, setOverride] = useState<"show" | "hide" | null>(null);

  useEffect(() => {
    const show = () => setOverride("show");
    window.addEventListener(SHOW_EVENT, show);
    return () => window.removeEventListener(SHOW_EVENT, show);
  }, []);

  const visible = override === "show" || (override === null && !seen);
  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey(set), "seen");
    } catch {}
    setOverride("hide");
  }

  return (
    <Card className="ring-primary/25">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-primary text-primary-foreground">
            <Lightbulb className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">/ Підказки</p>
            <p className="font-semibold">Що тут можна зробити</p>
          </div>
        </div>
        <ol className="flex flex-col gap-2 text-sm">
          {TIPS[set].map((tip, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span className="pt-0.5">{tip}</span>
            </li>
          ))}
        </ol>
        <Button className="self-start" onClick={dismiss}>Зрозуміло</Button>
      </CardContent>
    </Card>
  );
}

// Посилання в підвалі: показує підказки поточної сторінки знову.
export function ShowTipsButton() {
  return (
    <button
      type="button"
      className="underline-offset-4 hover:text-foreground hover:underline"
      onClick={() => window.dispatchEvent(new Event(SHOW_EVENT))}
    >
      Підказки
    </button>
  );
}
