// Auto-generated investigation report (SIH plan item 8). Renders entirely
// from a Case's already-persisted traceResult — no re-trace on download, so
// the report always matches exactly what was shown on screen at trace time.
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import { edgeCountLabel, isContractCall } from "@/lib/format";
import type { Case, RiskLevel } from "@/lib/generated/prisma/client";
import type { TraceGraph } from "@/lib/tracers/types";


// react-pdf renders to a static, always-white page — it can't consume the
// CSS custom properties lib/format.ts's RISK_COLOR uses for the (light/dark
// theme-aware) web UI. Keep this in sync with app/globals.css's :root
// (light-mode) --risk-* values if those ever change.
const RISK_COLOR_PRINT: Record<RiskLevel, string> = {
  LOW: "#166534",
  MEDIUM: "#854d0e",
  HIGH: "#c2410c",
  CRITICAL: "#b91c1c",
};

// Day 4 repaint moved the app's --primary from near-black to blue
// (#2563eb) — the letterhead mark/header rule mirror bg-primary (see the
// Day 3 PROGRESS entry), so they move too. Body text stays near-black:
// legibility for a printed legal document, not brand chrome.
const BRAND = "#2563eb";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottom: `2 solid ${BRAND}`, paddingBottom: 8, marginBottom: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: { width: 22, height: 22, backgroundColor: BRAND, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  markText: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 12 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#555", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, textTransform: "uppercase", borderBottom: "1 solid #ddd", paddingBottom: 3 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 140, color: "#555" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  hop: { marginBottom: 4, paddingLeft: 8, borderLeft: "2 solid #ccc" },
  mono: { fontFamily: "Courier" },
  badge: { fontSize: 8, backgroundColor: "#eee", padding: "2 5", marginRight: 4, borderRadius: 2 },
  riskBadge: { fontSize: 9, fontFamily: "Helvetica-Bold", borderWidth: 1, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, alignSelf: "flex-start" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#888", borderTop: "1 solid #ccc", paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  simulatedNote: { fontSize: 8, color: "#b45309", marginTop: 2, fontStyle: "italic" },
});

function fmtDate(d: Date) {
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function CaseReportDocument({ kase, graph }: { kase: Case; graph: TraceGraph }) {
  const typologyFlags: string[] = kase.typologyFlags ? JSON.parse(kase.typologyFlags) : [];

  return (
    <Document title={`VASPtrace Investigation Report — Case ${kase.id}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <Text style={styles.markText}>V</Text>
            </View>
            <View>
              <Text style={styles.title}>VASPtrace Investigation Report</Text>
              <Text style={styles.subtitle}>Blockchain intelligence — Smart India Hackathon PS 26182 (MHA / I4C)</Text>
            </View>
          </View>
          <View>
            <Text style={styles.subtitle}>Case ID: {kase.id}</Text>
            <Text style={styles.subtitle}>Generated: {fmtDate(new Date())}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Case metadata</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Suspect address</Text>
            <Text style={[styles.value, styles.mono]}>{kase.address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Chain</Text>
            <Text style={styles.value}>{kase.chain}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{kase.status}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Opened</Text>
            <Text style={styles.value}>{fmtDate(kase.createdAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Trace depth</Text>
            <Text style={styles.value}>
              {graph.maxDepth} hops · {graph.nodes.length} addresses · {edgeCountLabel(graph)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk classification</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Risk level</Text>
            <Text
              style={[
                styles.riskBadge,
                { color: RISK_COLOR_PRINT[kase.riskLevel ?? "LOW"], borderColor: RISK_COLOR_PRINT[kase.riskLevel ?? "LOW"] },
              ]}
            >
              {kase.riskLevel ?? "LOW"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Typology flags (heuristic)</Text>
            <Text style={styles.value}>
              {typologyFlags.length > 0
                ? typologyFlags.map((f) => TYPOLOGY_LABEL[f as keyof typeof TYPOLOGY_LABEL] ?? f).join(", ")
                : "None detected"}
            </Text>
          </View>
        </View>

        {graph.recommendation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended VASP for disclosure request</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Recommended</Text>
              <Text style={styles.value}>{graph.recommendation.top.vaspName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Legal-actionability score</Text>
              <Text style={styles.value}>
                {graph.recommendation.top.breakdown.score} ({graph.recommendation.top.breakdown.hopDistance} hop
                {graph.recommendation.top.breakdown.hopDistance === 1 ? "" : "s"},{" "}
                {graph.recommendation.top.breakdown.fiuindRegistered ? "FIU-IND registered" : "not FIU-IND registered"},{" "}
                {graph.recommendation.top.breakdown.hasIndiaNodalOfficer ? "India nodal officer" : "no India nodal officer"},{" "}
                reliability {graph.recommendation.top.breakdown.responseReliabilityScore}/5)
              </Text>
            </View>
            {graph.recommendation.alternatives.map((alt) => (
              <View style={styles.row} key={alt.address}>
                <Text style={styles.label}>Alternative</Text>
                <Text style={styles.value}>
                  {alt.vaspName} — score {alt.breakdown.score} ({alt.breakdown.hopDistance} hop
                  {alt.breakdown.hopDistance === 1 ? "" : "s"})
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hop-by-hop trace narrative</Text>
          {graph.nodes
            .sort((a, b) => a.depth - b.depth)
            .map((n) => (
              <View style={styles.hop} key={n.address}>
                <Text style={styles.mono}>
                  Hop {n.depth}: {n.address}
                </Text>
                <Text style={styles.subtitle}>
                  {n.kind}
                  {n.entityName ? ` — ${n.entityName}` : ""}
                  {n.confidence ? ` — confidence: ${n.confidence}` : ""}
                  {n.stopReason ? ` — stopped: ${n.stopReason.replaceAll("_", " ")}` : ""}
                </Text>
              </View>
            ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evidence trail (transaction hashes)</Text>
          {graph.edges.map((e, i) => (
            <Text key={i} style={[styles.subtitle, styles.mono]}>
              {e.from} {"->"} {e.to} ({e.txCount} tx
              {isContractCall(e) ? ", contract calls — no value moved" : ""}):{" "}
              {e.latestTxHash}
            </Text>
          ))}
        </View>

        {kase.status === "ROUTED" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Disclosure request routing</Text>
            <Text style={styles.value}>Routed to {kase.recommendedVaspId}</Text>
            <Text style={styles.simulatedNote}>
              Simulated integration — Sahyog API access not publicly available. No request was actually transmitted.
            </Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>VASPtrace — generated for investigative use, not a court-admissible certificate</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
