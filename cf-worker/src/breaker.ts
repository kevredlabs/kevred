// circuit breaker — in-memory, per-isolate, best-effort.
// State lives at module scope: it persists across requests within an isolate,
// is lost on eviction/redeploy, and is not shared across isolates or colos.

const FAILURE_THRESHOLD = 3; // consecutive failures before opening
const COOLDOWN_MS = 30_000; // stays open this long, then half-open

type BreakerState = { failures: number; openUntil: number };
const breakers = new Map<string, BreakerState>();

// OPEN while the cooldown is still running
export function isOpen(host: string): boolean {
  const b = breakers.get(host);
  return !!b && b.openUntil > Date.now();
}

// success closes the breaker and resets the failure count
export function recordSuccess(host: string): void {
  breakers.delete(host);
}

// failure increments; at the threshold the breaker opens for COOLDOWN_MS
export function recordFailure(host: string): void {
  const b = breakers.get(host) ?? { failures: 0, openUntil: 0 };
  const wasOpen = b.openUntil > Date.now();
  b.failures++;
  if (b.failures >= FAILURE_THRESHOLD) {
    b.openUntil = Date.now() + COOLDOWN_MS;
    // log only on the actual transition into OPEN, not on every failure past threshold
    if (!wasOpen) {
      console.log(JSON.stringify({ evt: 'breaker_open', host, failures: b.failures }));
    }
  }
  breakers.set(host, b);
}
