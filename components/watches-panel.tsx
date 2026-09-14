"use client";

// ROADMAP item 6 UI. Deliberately plain — an add-form, a list, a manual
// "Check now" per watch. No polling/websocket: the roadmap's own framing is
// that real-time monitoring needs a worker this app doesn't have yet, so
// checks are explicit user actions or an external scheduler hitting
// /api/watches/check-all, never an in-browser timer pretending to be live.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, RefreshCw } from "lucide-react";

interface Alert {
  id: string;
  txHash: string;
  toAddress: string;
  valueBaseUnits: string;
  assetSymbol: string;
  entityName: string | null;
  txTimestamp: number;
}
interface WatchRow {
  id: string;
  address: string;
  chain: string;
  lastCheckedAt: string | null;
  alerts: Alert[];
}

export function WatchesPanel() {
  const [watches, setWatches] = useState<WatchRow[]>([]);
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ETHEREUM");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  function load() {
    fetch("/api/watches")
      .then((res) => (res.ok ? res.json() : []))
      .then(setWatches)
      .catch(() => setWatches([]));
  }
  // Direct fetch-then-setState in the effect body, like components/user-menu.tsx
  // — react-hooks/set-state-in-effect flags an effect that calls out to a
  // separately-defined async function (can't statically verify it won't
  // cascade), even though this is the ordinary "load on mount" case.
  useEffect(() => {
    fetch("/api/watches")
      .then((res) => (res.ok ? res.json() : []))
      .then(setWatches)
      .catch(() => setWatches([]));
  }, []);

  async function addWatch() {
    setError(null);
    const res = await fetch("/api/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address.trim(), chain }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add watch");
      return;
    }
    setAddress("");
    load();
  }

  async function checkNow(id: string) {
    setChecking(id);
    await fetch(`/api/watches/${id}/check`, { method: "POST" }).catch(() => null);
    setChecking(null);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
          Address watchlist
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Alerts when a watched address sends anywhere new — most useful when the destination is a labeled
          exchange deposit address, since that&apos;s actionable while the funds are still there. Checks run on
          demand (click &quot;Check now&quot;) or from an external scheduler; nothing polls automatically.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Address to watch"
            placeholder="Address to watch"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="font-mono"
          />
          <Select value={chain} onValueChange={(v) => v && setChain(v)}>
            <SelectTrigger aria-label="Chain" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ETHEREUM">Ethereum</SelectItem>
              <SelectItem value="POLYGON">Polygon</SelectItem>
              <SelectItem value="ARBITRUM">Arbitrum</SelectItem>
              <SelectItem value="BITCOIN">Bitcoin</SelectItem>
              <SelectItem value="TRON">Tron</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addWatch} disabled={!address}>
            Add watch
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {watches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No watches yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {watches.map((w) => (
              <div key={w.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm break-all">{w.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.chain} · last checked {w.lastCheckedAt ? new Date(w.lastCheckedAt).toLocaleString() : "never"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => checkNow(w.id)} disabled={checking === w.id}>
                    <RefreshCw className={`size-3.5 ${checking === w.id ? "animate-spin" : ""}`} aria-hidden="true" />
                    Check now
                  </Button>
                </div>
                {w.alerts.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {w.alerts.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant={a.entityName ? "default" : "secondary"}>
                          {a.entityName ? `→ ${a.entityName}` : "→ unlabeled address"}
                        </Badge>
                        <span className="font-mono text-muted-foreground">{a.txHash.slice(0, 14)}…</span>
                        <span className="text-muted-foreground">{new Date(a.txTimestamp * 1000).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
