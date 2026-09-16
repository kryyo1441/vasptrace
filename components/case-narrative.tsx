"use client";

// LLM-drafted case narrative. Hard constraint (ROADMAP's own words): drafts
// prose from the already-computed structured trace and never touches the
// score, risk level, or recommendation — those stay rule-based and
// auditable. This component only ever displays and requests prose; nothing
// it renders can change what the case's own arithmetic says.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";

export function CaseNarrative({
  caseId,
  hasNarrative,
  initialText,
}: {
  caseId: string;
  hasNarrative: boolean;
  initialText: string | null;
}) {
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function draft() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/narrative`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to draft narrative");
      setText(data.narrative);
      router.refresh(); // shows the new DRAFT_NARRATIVE row in the server-rendered custody timeline
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
          AI-drafted case narrative
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Prose only, drafted by Gemini from this case&apos;s already-computed graph — it never sets the risk level,
          score, or recommendation, and it can be wrong. Review before using it.
        </p>
        <Button onClick={draft} disabled={loading} variant="outline" size="sm" className="w-fit">
          {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {hasNarrative || text ? "Redraft narrative" : "Draft narrative"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {text && <p className="glass-panel whitespace-pre-wrap p-3 text-sm">{text}</p>}
      </CardContent>
    </Card>
  );
}
