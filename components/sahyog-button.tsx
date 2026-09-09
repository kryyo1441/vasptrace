"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";

export function SahyogButton({
  caseId,
  vaspName,
  alreadyRouted,
}: {
  caseId: string;
  vaspName: string;
  alreadyRouted: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [routed, setRouted] = useState(alreadyRouted);

  async function route() {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/sahyog`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Routing failed");
      setPayload(data.payload);
      setRouted(true);
      if (data.warning) setWarning(data.warning); // non-fatal (e.g. n8n unreachable) — routing still succeeded
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={route} disabled={loading} variant={routed ? "outline" : "default"}>
          <Send className="size-4" />
          {loading ? "Routing…" : routed ? `Re-route to ${vaspName}` : `Route disclosure request to ${vaspName}`}
        </Button>
        <Badge
          variant="outline"
          className="whitespace-normal border-amber-700 text-amber-700 dark:border-amber-400 dark:text-amber-400"
        >
          Simulated integration — Sahyog API access not publicly available
        </Badge>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {warning && <p className="text-sm text-muted-foreground">{warning}</p>}
      {payload !== null && (
        <pre className="glass-panel max-h-64 overflow-auto p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
      )}
    </div>
  );
}
