"use client";

// The confirmedByVaspResponse feedback loop (day-1 placeholder, finally
// wired up 2026-09-14). Records what a VASP actually said back on a routed
// disclosure request — an investigator-entered fact, not something the app
// infers. Deliberately does not touch VaspRegistry.responseReliabilityScore:
// that's a seeded, hand-verified figure, and one case's outcome shouldn't
// silently drift it. See app/cases/page.tsx for where observed rates show up
// instead — next to the seeded score, never overwriting it.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareReply } from "lucide-react";

const OPTIONS = [
  { value: "CONFIRMED", label: "Confirmed — disclosed" },
  { value: "DENIED", label: "Declined to disclose" },
  { value: "NO_RESPONSE", label: "No response received" },
] as const;

export function VaspResponseForm({
  caseId,
  vaspName,
  current,
}: {
  caseId: string;
  vaspName: string;
  current: string | null;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  async function save(v: string) {
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/vasp-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: v }),
    });
    if (res.ok) setValue(v);
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareReply className="size-4 text-muted-foreground" aria-hidden="true" />
          {vaspName}&apos;s response to this request
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={value === o.value ? "default" : "outline"}
            disabled={saving}
            onClick={() => save(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
