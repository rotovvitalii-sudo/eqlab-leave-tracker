"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideRequest } from "@/app/actions/decisions";

export function DecisionForm({ requestId }: { requestId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (approve: boolean) =>
    startTransition(async () => setError((await decideRequest(requestId, approve, comment)).error));

  return (
    <div className="mt-3 flex flex-col gap-2">
      {rejecting && (
        <Textarea
          autoFocus
          maxLength={500}
          placeholder="Причина відмови (обов’язково)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <Button variant="destructive" disabled={pending || !comment.trim()} onClick={() => decide(false)}>
              Відхилити
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => { setRejecting(false); setComment(""); }}>
              Назад
            </Button>
          </>
        ) : (
          <>
            <Button disabled={pending} onClick={() => decide(true)}>Погодити</Button>
            <Button variant="outline" disabled={pending} onClick={() => setRejecting(true)}>Відхилити…</Button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
