import type { CustomerConfig, Env } from './types';
import { jsonRpcError, logEvent, proxyRequest } from './proxy';

function extractCustomerId(hostname: string): string | null {
  // expects {customerId}.rpc-mainnet[.dev].kevred.net — returns null for bare domain
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { hostname } = new URL(request.url);
    const customerId = extractCustomerId(hostname);
    if (!customerId) {
      return new Response('Not Found', { status: 404 });
    }

    const raw = await env.CONFIG.get(`config:${customerId}`);
    if (!raw) {
      logEvent({ evt: 'config_error', customerId, reason: 'not_configured', status: 404 });
      return jsonRpcError(null, 'Customer not configured', 404);
    }

    let config: CustomerConfig;
    try {
      config = JSON.parse(raw);
    } catch (err) {
      logEvent({ evt: 'config_error', customerId, reason: 'invalid_json', status: 500, error: err instanceof Error ? err.message : String(err) });
      return jsonRpcError(null, 'Invalid customer config', 500);
    }

    if (!config.endpoints?.length) {
      logEvent({ evt: 'config_error', customerId, reason: 'no_endpoints', status: 503 });
      return jsonRpcError(null, 'No endpoints configured', 503);
    }

    return proxyRequest(request, config, customerId, env);
  },
};
