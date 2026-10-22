"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

// Повне перезавантаження після виходу: сторінки попереднього користувача не лишаються в браузері.
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          window.location.replace("/login");
        })
      }
    >
      Вийти
    </Button>
  );
}
