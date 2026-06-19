import type { CustomerConfig, Env } from './types';
import { isOpen, recordFailure, recordSuccess } from './breaker';

// fall back on transient or provider-specific failures: 5xx, Cloudflare 52x/530,
// 429 (this provider rate-limited), 408, 401/403 (keys differ per endpoint), 404
// (path differs), network errors. A different provider may still answer. Only a
// 2xx/3xx response is treated as a usable answer and passed through.
function isFailureStatus(status: number): boolean {
  return status >= 400;
}

// deterministic client errors: the request bytes are bad, so EVERY provider
// returns the same status. Falling back is pure waste AND would hide the real
// status behind a 503
const HARD_CLIENT_ERRORS = new Set([400, 413, 414, 422, 431]);

function isHardClientError(status: number): boolean {
  return HARD_CLIENT_ERRORS.has(status);
}

const REQUEST_TIMEOUT_MS = 15_000; // generous — Solana getProgramAccounts/getBlock can be slow

// HTTP status returned to the client when every upstream fails. 503 (transient,
// retriable). Single source of truth for both the response and the AE summary row.
const ALL_FAILED_STATUS = 503;

type Meta = {
  customerId: string;
  colo: string | undefined;
  clientTcpRtt: number | undefined;
  analytics: AnalyticsEngineDataset;
  // JSON-RPC request id, echoed back in the all-failed error envelope
  rpcId: unknown;
};

export function logEvent(data: Record<string, unknown>): void {
  console.log(JSON.stringify(data));
}

// Analytics Engine rows. blob7 discriminates the two row types the dashboard reads:
//   'attempt' — one upstream call. outcome success/fallback/error.
//      'skipped_open' (breaker open) and 'cancelled' (slower sibling) are logged
//      but NOT written here: neither is a real upstream outcome.
//   'summary' — one client request. outcome success/all_failed, double1 = totalMs.
function writeAttempt(
  meta: Meta,
  fields: { host: string; outcome: string; mode: string; status?: number; ms?: number },
): void {
  meta.analytics.writeDataPoint({
    blobs: [meta.customerId, fields.host, String(fields.status ?? ''), fields.outcome, fields.mode, meta.colo ?? '', 'attempt'],
    doubles: [fields.ms ?? 0],
    indexes: [meta.customerId],
  });
}

function writeSummary(
  meta: Meta,
  fields: { host: string; outcome: string; mode: string; status?: number; totalMs: number },
): void {
  meta.analytics.writeDataPoint({
    blobs: [meta.customerId, fields.host, String(fields.status ?? ''), fields.outcome, fields.mode, meta.colo ?? '', 'summary'],
    doubles: [fields.totalMs],
    indexes: [meta.customerId],
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// strip the API key from provider URLs before logging — keep host only
function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid_url';
  }
}

// extract the JSON-RPC id from the request body so the error envelope can echo it.
// batch requests (body is an array) have no single id → null.
function parseRpcId(body: ArrayBuffer | undefined): unknown {
  if (!body) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body));
    return Array.isArray(parsed) ? null : parsed?.id ?? null;
  } catch {
    return null;
  }
}

// every worker-generated error response uses this shape: a valid JSON-RPC error
// envelope so clients never choke parsing plain text. The HTTP status still
// carries retry semantics (503 retriable, 404 not) — JSON-RPC says what failed,
// HTTP says how to react. Defaults match the all-failed case (503).
export function jsonRpcError(id: unknown, message: string, httpStatus = ALL_FAILED_STATUS, code = -32603): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: id ?? null }),
    { status: httpStatus, headers: { 'Content-Type': 'application/json' } },
  );
}

async function fetchWithTimeout(
  endpoint: string,
  init: RequestInit,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  externalSignal?.addEventListener('abort', onAbort);
  try {
    return await fetch(endpoint, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

export async function proxyRequest(
  request: Request,
  config: CustomerConfig,
  customerId: string,
  env: Env,
): Promise<Response> {
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const init: RequestInit = { method: request.method, headers: request.headers, body };

  // edge-measured client→Cloudflare TCP RTT and the colo that served the request
  const cf = request.cf as IncomingRequestCfProperties | undefined;
  const meta: Meta = { customerId, colo: cf?.colo, clientTcpRtt: cf?.clientTcpRtt, analytics: env.ANALYTICS, rpcId: parseRpcId(body) };

  return config.mode === 'parallel'
    ? proxyParallel(config.endpoints, init, meta)
    : proxySequential(config.endpoints, init, meta);
}

// sequential mode — try endpoints in priority order, fall back on failure; one upstream request per call
async function proxySequential(endpoints: string[], init: RequestInit, meta: Meta): Promise<Response> {
  const start = Date.now();
  const { customerId, colo, clientTcpRtt } = meta;

  // hosts tried so far, in order — reconstructs the fallback path
  const path: string[] = [];

  // guard: if every provider is open, ignore breakers for this request rather
  // than refuse traffic — a probe may reveal one has recovered
  const force = endpoints.every((e) => isOpen(safeHost(e)));

  for (const endpoint of endpoints) {
    const host = safeHost(endpoint);
    const attemptStart = Date.now();
    path.push(host);

    if (!force && isOpen(host)) {
      logEvent({ evt: 'rpc_attempt', mode: 'sequential', customerId, host, outcome: 'skipped_open', colo, clientTcpRtt });
      continue;
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(endpoint, init);
    } catch (err) {
      recordFailure(host);
      logEvent({ evt: 'rpc_attempt', mode: 'sequential', customerId, host, outcome: 'error', error: errMsg(err), ms: Date.now() - attemptStart, colo, clientTcpRtt });
      writeAttempt(meta, { host, outcome: 'error', mode: 'sequential', ms: Date.now() - attemptStart });
      continue;
    }

    // deterministic client error → don't blame the provider, don't fall back;
    // return the real status so the client sees the actual error, not a 503
    if (isHardClientError(response.status)) {
      recordSuccess(host); // provider is healthy: it correctly rejected the request
      const ms = Date.now() - attemptStart;
      logEvent({ evt: 'rpc_attempt', mode: 'sequential', customerId, host, outcome: 'client_error', status: response.status, ms, colo, clientTcpRtt });
      writeAttempt(meta, { host, outcome: 'client_error', mode: 'sequential', status: response.status, ms });
      const totalMs = Date.now() - start;
      logEvent({ evt: 'rpc_summary', mode: 'sequential', customerId, outcome: 'client_error', host, path, status: response.status, totalMs, colo, clientTcpRtt });
      writeSummary(meta, { host, outcome: 'client_error', mode: 'sequential', status: response.status, totalMs });
      return response;
    }

    const shouldFallback = isFailureStatus(response.status);
    if (shouldFallback) recordFailure(host);
    else recordSuccess(host);

    const outcome = shouldFallback ? 'fallback' : 'success';
    logEvent({ evt: 'rpc_attempt', mode: 'sequential', customerId, host, outcome, status: response.status, ms: Date.now() - attemptStart, colo, clientTcpRtt });
    writeAttempt(meta, { host, outcome, mode: 'sequential', status: response.status, ms: Date.now() - attemptStart });

    if (!shouldFallback) {
      const totalMs = Date.now() - start;
      logEvent({ evt: 'rpc_summary', mode: 'sequential', customerId, outcome: 'success', host, path, status: response.status, totalMs, colo, clientTcpRtt });
      writeSummary(meta, { host, outcome: 'success', mode: 'sequential', status: response.status, totalMs });
      return response;
    }
  }

  const totalMs = Date.now() - start;
  logEvent({ evt: 'rpc_summary', mode: 'sequential', customerId, outcome: 'all_failed', path, totalMs, colo, clientTcpRtt });
  writeSummary(meta, { host: '', outcome: 'all_failed', mode: 'sequential', status: ALL_FAILED_STATUS, totalMs });
  return jsonRpcError(meta.rpcId, 'All upstream providers failed');
}

// parallel mode — fan out to all healthy providers at once, fastest success wins.
// costs N upstream requests per client request; losers are cancelled.
async function proxyParallel(endpoints: string[], init: RequestInit, meta: Meta): Promise<Response> {
  const start = Date.now();
  const { customerId, colo, clientTcpRtt } = meta;

  // race only among healthy providers; if every one is open, include them all
  const allOpen = endpoints.every((e) => isOpen(safeHost(e)));
  const pool = endpoints.filter((e) => allOpen || !isOpen(safeHost(e)));

  // surface the ones we leave out of the race
  if (!allOpen) {
    for (const e of endpoints) {
      const host = safeHost(e);
      if (isOpen(host)) {
        logEvent({ evt: 'rpc_attempt', mode: 'parallel', customerId, host, outcome: 'skipped_open', colo, clientTcpRtt });
      }
    }
  }

  const controller = new AbortController();
  const engaged = pool.map(safeHost);

  const attempts = pool.map(async (endpoint) => {
    const host = safeHost(endpoint);
    const attemptStart = Date.now();

    let response: Response;
    try {
      response = await fetchWithTimeout(endpoint, init, controller.signal);
    } catch (err) {
      // a sibling already won → this was cancelled, not a genuine failure:
      // don't poison the breaker for a provider that was merely slower
      const cancelled = controller.signal.aborted;
      logEvent({ evt: 'rpc_attempt', mode: 'parallel', customerId, host, outcome: cancelled ? 'cancelled' : 'error', ...(cancelled ? {} : { error: errMsg(err) }), ms: Date.now() - attemptStart, colo, clientTcpRtt });
      if (!cancelled) {
        recordFailure(host);
        writeAttempt(meta, { host, outcome: 'error', mode: 'parallel', ms: Date.now() - attemptStart });
      }
      throw err; // reject so Promise.any moves on
    }

    // deterministic client error → fulfill the race with it (every provider will
    // return the same), cancel the rest, pass the real status to the client
    if (isHardClientError(response.status)) {
      recordSuccess(host); // provider is healthy: it correctly rejected the request
      logEvent({ evt: 'rpc_attempt', mode: 'parallel', customerId, host, outcome: 'client_error', status: response.status, ms: Date.now() - attemptStart, colo, clientTcpRtt });
      writeAttempt(meta, { host, outcome: 'client_error', mode: 'parallel', status: response.status, ms: Date.now() - attemptStart });
      return { response, host, clientError: true };
    }

    const bad = isFailureStatus(response.status);
    if (bad) recordFailure(host);
    else recordSuccess(host);

    const outcome = bad ? 'fallback' : 'success';
    logEvent({ evt: 'rpc_attempt', mode: 'parallel', customerId, host, outcome, status: response.status, ms: Date.now() - attemptStart, colo, clientTcpRtt });
    writeAttempt(meta, { host, outcome, mode: 'parallel', status: response.status, ms: Date.now() - attemptStart });

    if (bad) throw new Error(`bad status ${response.status}`); // skip it in Promise.any
    return { response, host, clientError: false };
  });

  try {
    const { response, host, clientError } = await Promise.any(attempts);
    controller.abort(); // cancel the losers
    const totalMs = Date.now() - start;
    const outcome = clientError ? 'client_error' : 'success';
    logEvent({ evt: 'rpc_summary', mode: 'parallel', customerId, outcome, host, engaged, status: response.status, totalMs, colo, clientTcpRtt });
    writeSummary(meta, { host, outcome, mode: 'parallel', status: response.status, totalMs });
    return response;
  } catch {
    const totalMs = Date.now() - start;
    logEvent({ evt: 'rpc_summary', mode: 'parallel', customerId, outcome: 'all_failed', engaged, totalMs, colo, clientTcpRtt });
    writeSummary(meta, { host: '', outcome: 'all_failed', mode: 'parallel', status: ALL_FAILED_STATUS, totalMs });
    return jsonRpcError(meta.rpcId, 'All upstream providers failed');
  }
}
