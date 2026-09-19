// LLM-drafted case narrative (ROADMAP "smaller items"). Hard constraint from
// the roadmap itself: drafts prose from the already-computed structured
// trace and never touches the score, risk level, or recommendation — those
// stay rule-based and auditable, computed entirely in lib/scoring.ts before
// this route is ever reached. The model only ever writes a caption for facts
// this app already decided.
import { FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessCase, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { edgeCountLabel } from "@/lib/format";
import { TYPOLOGY_LABEL } from "@/lib/typology";
import type { TraceGraph } from "@/lib/tracers/types";

// Tried in order. The free tier returns 503 UNAVAILABLE ("high demand") in
// spikes, and 429 when one model's quota is spent — both are per model, so the
// next one usually answers. Every entry verified 2026-09-18 to accept the exact
// config below (gemini-3.7-flash rejects ThinkingLevel.MINIMAL; 2.5-flash is
// closed to new keys). Any other error (bad request, auth) fails immediately.
const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
const isTransient = (err: unknown) => /"code":\s*(503|429)|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(String((err as Error)?.message));

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || !canAccessCase(user, kase)) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (!kase.traceResult) return NextResponse.json({ error: "No trace data stored for this case" }, { status: 400 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Narrative drafting is not configured (GEMINI_API_KEY unset) — this feature is optional and never blocks the rest of the app." },
      { status: 503 }
    );
  }

  const graph = JSON.parse(kase.traceResult) as TraceGraph;
  const typologyFlags: string[] = kase.typologyFlags ? JSON.parse(kase.typologyFlags) : [];

  // Only the already-computed facts go in — no room for the model to invent
  // a score or a risk level of its own, because none of that is asked for.
  const facts = {
    suspectAddress: kase.address,
    chain: kase.chain,
    riskLevel: kase.riskLevel,
    typologyFlags: typologyFlags.map((f) => TYPOLOGY_LABEL[f as keyof typeof TYPOLOGY_LABEL] ?? f),
    hopSummary: `${graph.maxDepth} hops · ${graph.nodes.length} addresses · ${edgeCountLabel(graph)}`,
    nodes: graph.nodes.map((n) => ({
      depth: n.depth,
      kind: n.kind,
      entityName: n.entityName ?? null,
      confidence: n.confidence,
      stopReason: n.stopReason,
    })),
    recommendation: graph.recommendation
      ? {
          vaspName: graph.recommendation.top.vaspName,
          score: graph.recommendation.top.breakdown.score,
          hopDistance: graph.recommendation.top.breakdown.hopDistance,
          sameWalletInference: !!graph.recommendation.top.sameWallet,
        }
      : null,
  };

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const draft = (model: string) =>
    client.models.generateContent({
      model,
      contents: JSON.stringify(facts),
      config: {
        // Thinking tokens count against maxOutputTokens, so a budget sized for
        // 3-5 sentences alone gets spent thinking and returns a half sentence.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        maxOutputTokens: 4096,
        systemInstruction:
          "You draft a short investigative case narrative (3-5 sentences, plain prose, no headings or bullet points) for an Indian law-enforcement blockchain-tracing tool, from a JSON summary of an already-completed trace. State only what the JSON says — never invent a risk level, score, or VASP recommendation, and never suggest a different one than the JSON already gives. If the JSON shows no recommendation, say so plainly rather than guessing one. Write for an investigator who will review and edit this before it goes in a case file.",
      },
    });

  try {
    let response: Awaited<ReturnType<typeof draft>> | undefined;
    let usedModel = MODELS[0];
    for (const [i, model] of MODELS.entries()) {
      try {
        response = await draft(model);
        usedModel = model;
        break;
      } catch (err) {
        if (!isTransient(err) || i === MODELS.length - 1) throw err;
      }
    }
    const narrative = response!.text?.trim();
    if (!narrative) throw new Error("Model returned no text");
    // A narrative is persisted and quoted in the PDF report, so a response cut
    // off mid-sentence must fail loudly rather than land in a case file.
    if (response!.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS) {
      throw new Error("Model hit the output limit and returned a truncated narrative");
    }

    await prisma.case.update({ where: { id }, data: { narrativeDraft: narrative, narrativeDraftedAt: new Date() } });
    // Which model wrote it goes in the custody log — a fallback draft shouldn't
    // be indistinguishable from a primary-model one.
    await audit(user.id, "DRAFT_NARRATIVE", kase.id, { model: usedModel });

    return NextResponse.json({ narrative });
  } catch (err) {
    return NextResponse.json({ error: `Narrative drafting failed: ${(err as Error).message}` }, { status: 502 });
  }
}
