"use client";

// Live OFAC + Israel NBCTF sync trigger (ROADMAP item 5; NBCTF added
// 2026-09-18). SUPERVISOR-only in the API route; this component is only
// rendered for a supervisor by its caller, so there's no dead click for an
// investigator to find.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Feed = { created: number; updated: number; skippedCurated: number; total: number; terror: number } | { error: string };

function describe(name: string, f: Feed) {
  if ("error" in f) return `${name}: ${f.error}`;
  return `${name}: ${f.created} new, ${f.updated} updated, ${f.skippedCurated} skipped (hand-labeled), ${f.terror} terror-financing of ${f.total}`;
}

export function SanctionsSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/sync-sanctions", { method: "POST" });
      const data = await res.json();
      setResult(data.ofac ? `${describe("OFAC", data.ofac)}. ${describe("Israel NBCTF", data.israel)}.` : data.error);
    } catch (err) {
      setResult((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Button size="sm" variant="outline" onClick={sync} disabled={loading}>
        <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        Sync sanctions &amp; terror-financing lists
      </Button>
      {result && <span>{result}</span>}
    </div>
  );
}
