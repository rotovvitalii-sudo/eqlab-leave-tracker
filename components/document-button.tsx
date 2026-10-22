"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getDocumentUrl } from "@/app/actions/documents";

export function DocumentButton({ path }: { path: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await getDocumentUrl(path);
            if (result.url) window.open(result.url, "_blank", "noopener");
            setError(result.error);
          })
        }
      >
        Переглянути документ
      </Button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </>
  );
}
