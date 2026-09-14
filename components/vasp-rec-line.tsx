import { sameWalletEvidence, vaspLine } from "@/lib/format";
import type { VaspRecommendation } from "@/lib/tracers/types";

// One recommended-VASP row. A same-wallet (inferred) recommendation carries
// its evidence directly underneath, so the basis is visible wherever the
// exchange is recommended. No hooks: the server case page and the client
// search page both render it.
export function VaspRecLine({ rec, primary = false }: { rec: VaspRecommendation; primary?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className={primary ? "font-medium text-foreground" : "text-muted-foreground"}>{vaspLine(rec)}</p>
      {rec.sameWallet && (
        <p className="font-mono text-xs text-muted-foreground wrap-anywhere">{sameWalletEvidence(rec)}</p>
      )}
    </div>
  );
}
