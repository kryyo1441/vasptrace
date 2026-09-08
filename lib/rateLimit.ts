// Global (per-process) request serialization, keyed by API. bfs.ts used to
// sleep between hops *within one trace*, which does nothing for two
// concurrent traces hitting the same free-tier API at once — confirmed
// live: 6 concurrent Ethereum traces produced real Etherscan "NOTOK" errors.
//
// A first attempt just staggered request *start* times (a min gap between
// each pace() call returning) — still failed live, because Etherscan's
// limit turned out to be concurrent in-flight requests, not requests/sec:
// 6 truly simultaneous raw curl calls with the same API key (no app
// involved) got 3 NOTOKs. Staggering starts by 250ms doesn't help when a
// single request's round trip is itself >250ms — several are still in
// flight at once. withPacing queues the whole call (request start to
// response) so at most one request per key is ever in flight.
// ponytail: in-memory queue, one Node process — fine for a single-instance
// demo deploy; a multi-instance deployment sharing one API key would need a
// shared store (Redis) instead.
const queues = new Map<string, Promise<void>>();

export async function withPacing<T>(key: string, minIntervalMs: number, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  let releaseNext: () => void;
  const mySlot = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  queues.set(key, previous.then(() => mySlot));

  await previous;
  try {
    return await fn();
  } finally {
    setTimeout(() => releaseNext!(), minIntervalMs);
  }
}
