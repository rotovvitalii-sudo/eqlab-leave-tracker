"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DocumentButton } from "@/components/document-button";
import { cancelRequest } from "./actions";
import { uploadSickDocument } from "./upload-document";

// Кнопки на картці заявки. Чи можна скасувати, вирішує сервер; тут лише показ.
export function RequestActions({
  employeeId,
  requestId,
  canCancel,
  canAttach,
  documentPath,
}: {
  employeeId: string;
  requestId: string;
  canCancel: boolean;
  canAttach: boolean;
  documentPath: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  if (!canCancel && !canAttach && !documentPath) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {documentPath && (
        <DocumentButton path={documentPath} />
      )}
      {canAttach && (
        <>
          <input ref={fileInput} type="file" hidden accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              startTransition(async () => setError(await uploadSickDocument(employeeId, requestId, file)));
            }} />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => fileInput.current?.click()}>
            Додати документ
          </Button>
        </>
      )}
      {canCancel && (
        <Button variant="destructive" size="sm" disabled={pending}
          onClick={() => {
            if (!confirm("Скасувати цю заявку?")) return;
            startTransition(async () => setError((await cancelRequest(requestId)).error));
          }}>
          Скасувати заявку
        </Button>
      )}
      {pending && <span className="text-xs text-muted-foreground">Зачекайте…</span>}
      {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}
