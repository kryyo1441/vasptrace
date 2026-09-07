// Fire-and-forget notification to the n8n orchestration-visibility layer
// (SIH plan item 6). Per PLAN.md, n8n's job is demo visibility, not being
// the tracing engine — so this must never throw and never block or fail
// the real work it's reporting on. Unset URL just means "n8n isn't wired
// up for this run," not an error.
const TIMEOUT_MS = 2000;

export async function notifyN8n(webhookUrl: string | undefined, payload: unknown): Promise<string | null> {
  if (!webhookUrl) return null;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return `n8n webhook responded ${res.status}`;
    return null;
  } catch (err) {
    return `n8n webhook unreachable (non-fatal): ${(err as Error).message}`;
  }
}
