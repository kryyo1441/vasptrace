import { channelLine, CROSS_BORDER_NOTE, depositAddressNote, lowActionabilityNote, sameWalletEvidence, vaspLine } from "@/lib/format";
import type { IssuerLead, TraceGraph, VaspRecommendation } from "@/lib/tracers/types";

// Exchanges the trace reached that have no VaspRegistry entry — no score, no
// request, but the investigator should know they were reached.
export function UnregisteredExchanges({ graph }: { graph: TraceGraph }) {
  const list = graph.unregisteredExchanges ?? [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        Exchange reached, not in the actionability registry — can&apos;t be scored or routed:
      </p>
      {list.map((x) => (
        <p key={x.address} className="font-mono wrap-anywhere">
          {x.entityName} — hop {x.depth} — {x.address}
        </p>
      ))}
    </div>
  );
}

// One recommended-VASP row. A same-wallet (inferred) recommendation carries
// its evidence directly underneath, so the basis is visible wherever the
// exchange is recommended. No hooks: the server case page and the client
// search page both render it.
// Every stablecoin issuer the trace's edges touched — a separate lever from
// the VASP recommendation above (the issuer can freeze regardless of which
// exchange, if any, the funds reached), so it renders as its own block
// wherever a recommendation or the "no VASP" empty state does.
export function IssuerLeads({ graph }: { graph: TraceGraph }) {
  const leads = graph.issuerLeads ?? [];
  if (leads.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Stablecoin issuer freeze paths (this trace moved these assets):</p>
      {leads.map((l: IssuerLead) => (
        <div key={l.assetSymbol} className="flex flex-col gap-0.5">
          <p>
            <span className="font-medium text-foreground">
              {l.assetSymbol} — {l.issuerName}
            </span>{" "}
            {l.requiresCourtOrder ? "requires a binding court order to freeze." : "can freeze on a law-enforcement request, no court order documented as required."}
          </p>
          <p>{l.freezeProcess}</p>
        </div>
      ))}
    </div>
  );
}

export function VaspRecLine({ rec, primary = false }: { rec: VaspRecommendation; primary?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className={primary ? "font-medium text-foreground" : "text-muted-foreground"}>{vaspLine(rec)}</p>
      {rec.sameWallet && (
        <p className="font-mono text-xs text-muted-foreground wrap-anywhere">{sameWalletEvidence(rec)}</p>
      )}
      {primary && lowActionabilityNote(rec) && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{lowActionabilityNote(rec)}</p>
      )}
      {primary && rec.depositAddress && (
        <p className="text-xs text-foreground wrap-anywhere">
          <span className="font-medium">Deposit address — </span>
          <span className="font-mono">{rec.depositAddress.address}</span>
          <span className="text-muted-foreground"> {depositAddressNote(rec)}</span>
        </p>
      )}
      {primary && rec.channel && (
        <p className="text-xs text-muted-foreground wrap-anywhere">
          <span className="font-medium text-foreground">Channel — </span>
          {channelLine(rec)}
          {rec.channel.leChannelUrl && (
            <>
              {" · "}
              <a href={rec.channel.leChannelUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {new URL(rec.channel.leChannelUrl).hostname}
              </a>
            </>
          )}
          {rec.channel.crossBorder && <span className="block text-amber-700 dark:text-amber-400">{CROSS_BORDER_NOTE}</span>}
        </p>
      )}
    </div>
  );
}

// Terror-financing / sanctions designations the trace reached (2026-09-18).
// These make a case CRITICAL but never produce a recommendation (lib/scoring.ts
// only routes exchanges) — so without this block the page would show the
// severity with no statement of *why* or what to do instead.
export function DesignationAlerts({ graph }: { graph: TraceGraph }) {
  const hits = graph.nodes.filter((n) => n.kind === "TERROR_FINANCING" || n.kind === "SANCTIONED");
  if (hits.length === 0) return null;
  const terror = hits.some((n) => n.kind === "TERROR_FINANCING");
  return (
    <div className="mt-3 flex flex-col gap-1 rounded-xl border border-red-700/40 bg-red-500/10 p-3 text-xs text-red-800 dark:border-red-400/40 dark:text-red-300">
      <p className="font-semibold">
        {terror ? "Terror-financing designation reached" : "Sanctioned entity reached"} — CRITICAL. Not a disclosure
        target: {terror ? "escalate as a terror-financing lead (UAPA)" : "report as a sanctions matter to FIU-IND"}, in
        addition to any exchange request below.
      </p>
      {hits.map((n) => (
        <p key={n.address} className="wrap-anywhere">
          <span className="font-medium">{n.entityName}</span> — hop {n.depth} — <span className="font-mono">{n.address}</span>
          {n.source && <span className="block opacity-80">{n.source}</span>}
        </p>
      ))}
    </div>
  );
}
