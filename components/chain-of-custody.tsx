// Chain of custody (ROADMAP: "who ran what, when, and what did the report
// say at the time" — a credibility feature for a tool whose output supports
// legal process). Read-only rendering of the append-only, hash-chained
// AuditEvent log for this case — see lib/audit.ts for what the hash chain
// does and doesn't guarantee.
import { History, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTION_LABEL: Record<string, string> = {
  LOGIN: "Signed in",
  LOGIN_FAILED: "Failed sign-in attempt",
  TRACE: "Ran trace",
  VIEW_CASE: "Viewed case",
  DOWNLOAD_REPORT: "Downloaded PDF report",
  ROUTE_SAHYOG: "Routed disclosure request",
  VASP_RESPONSE: "Recorded VASP response",
  DRAFT_NARRATIVE: "Drafted case narrative",
  WATCH_ADD: "Added address watch",
  WATCH_CHECK: "Checked address watch",
  SANCTIONS_SYNC: "Synced OFAC sanctions list",
};

interface Event {
  id: number;
  action: string;
  userId: string | null;
  createdAt: Date | string;
}

export function ChainOfCustody({ events, tamperedAtId }: { events: Event[]; tamperedAtId: number | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-muted-foreground" aria-hidden="true" />
          Chain of custody
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          {tamperedAtId === null ? (
            <>
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="text-muted-foreground">Audit log hash chain intact.</span>
            </>
          ) : (
            <>
              <ShieldAlert className="size-3.5 text-destructive" aria-hidden="true" />
              <span className="text-destructive">
                Audit log hash chain broken at event #{tamperedAtId} — the log below this point may have been
                altered.
              </span>
            </>
          )}
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recorded events for this case yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{e.id}</span>
                <span className="font-medium text-foreground">{ACTION_LABEL[e.action] ?? e.action}</span>
                <span>{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
