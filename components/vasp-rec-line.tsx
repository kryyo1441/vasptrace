import { lowActionabilityNote, sameWalletEvidence, vaspLine } from "@/lib/format";
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
    </div>
  );
}
