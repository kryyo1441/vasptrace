"use client";

// Live OFAC sync trigger (ROADMAP item 5). SUPERVISOR-only in the API route;
// this component is only rendered for a supervisor by its caller, so there's
// no dead click for an investigator to find.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SanctionsSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/sync-sanctions", { method: "POST" });
      const data = await res.json();
      setResult(
        res.ok
          ? `Synced: ${data.created} new, ${data.updated} updated, ${data.skippedCurated} skipped (already hand-labeled), ${data.total} total on the SDN feed.`
          : data.error
      );
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
        Sync OFAC sanctions list
      </Button>
      {result && <span>{result}</span>}
    </div>
  );
}
