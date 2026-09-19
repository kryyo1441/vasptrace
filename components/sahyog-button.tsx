"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildEmailDraft, type Attribution, type RequestKind } from "@/lib/format";
import type { VaspRecommendation } from "@/lib/tracers/types";
import type { Chain } from "@/lib/generated/prisma/client";
import { Check, Copy, Send, Snowflake } from "lucide-react";

export function SahyogButton({
  caseId,
  vaspName,
  alreadyRouted,
  address,
  chain,
  evidenceTrail,
  valueMoved,
  attribution,
  depositAddress,
  amountsAtStake,
}: {
  caseId: string;
  vaspName: string;
  alreadyRouted: boolean;
  address: string;
  chain: Chain;
  evidenceTrail: string[];
  valueMoved: boolean;
  attribution?: Attribution;
  depositAddress?: VaspRecommendation["depositAddress"];
  amountsAtStake?: string;
}) {
  const [loading, setLoading] = useState<RequestKind | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [routed, setRouted] = useState(alreadyRouted);
  const [copied, setCopied] = useState<RequestKind | null>(null);
  const router = useRouter();

  async function route(kind: RequestKind) {
    setLoading(kind);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/sahyog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Routing failed");
      setPayload(data.payload);
      setRouted(true);
      if (data.warning) setWarning(data.warning); // non-fatal (e.g. n8n unreachable) — routing still succeeded
      // The case page gates the status badge, VASP-response form and custody
      // timeline server-side; refresh re-renders them without losing this
      // component's payload/warning state.
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function copyEmailDraft(kind: RequestKind) {
    const { subject, body } = buildEmailDraft({
      caseId,
      vaspName,
      address,
      chain,
      evidenceTrail,
      valueMoved,
      attribution,
      depositAddress,
      kind,
      amountsAtStake,
    });
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard API can be unavailable (permissions, insecure context) —
      // fail quietly rather than throwing; the button just doesn't confirm.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => route("DISCLOSURE")} disabled={!!loading} variant={routed ? "outline" : "default"}>
          <Send className="size-4" />
          {loading === "DISCLOSURE"
            ? "Routing…"
            : routed
              ? `Re-route to ${vaspName}`
              : `Route ${attribution ? "ownership-confirmation" : "disclosure"} request to ${vaspName}`}
        </Button>
        {/* PS 26182: "disclosure or freezing requests". Time-critical — funds
            credited to an exchange account can be withdrawn within hours. */}
        <Button onClick={() => route("FREEZE")} disabled={!!loading} variant="outline">
          <Snowflake className="size-4" />
          {loading === "FREEZE" ? "Routing…" : `Route freeze request to ${vaspName}`}
        </Button>
        <Button onClick={() => copyEmailDraft("DISCLOSURE")} variant="outline">
          {copied === "DISCLOSURE" ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === "DISCLOSURE" ? "Copied" : "Copy disclosure draft"}
        </Button>
        <Button onClick={() => copyEmailDraft("FREEZE")} variant="outline">
          {copied === "FREEZE" ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === "FREEZE" ? "Copied" : "Copy freeze draft"}
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
