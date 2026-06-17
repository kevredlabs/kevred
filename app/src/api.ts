export type HealthResponse = {
  status: "ok" | "degraded";
  mongo: "connected" | "disconnected" | "connecting" | "disconnecting";
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body as HealthResponse;
  }
  return res.json();
}

export async function requestMagicLink(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
}

export async function verifyMagicLink(token: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/auth/verify?token=${encodeURIComponent(token)}`,
    { credentials: "include" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Verification failed");
  }
}

export type MeResponse = { userId: string; email: string; customerId: string; rpcDomain: string };

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Unauthorized");
  const body = await res.json() as { user: MeResponse };
  return body.user;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
}

export type Provider = { label: string; url: string };
export type RoutingMode = "sequential" | "parallel";
export type ProvidersResponse = { customerId: string; providers: Provider[]; mode: RoutingMode };

export async function fetchProviders(): Promise<ProvidersResponse> {
  const res = await fetch(`${API_BASE}/providers`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load providers");
  return res.json();
}

export type MetricsSummary = { requests: number; errorRate: number; p50Ms: number };

export async function fetchMetricsSummary(): Promise<MetricsSummary> {
  const res = await fetch(`${API_BASE}/metrics/summary`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load metrics summary");
  return res.json();
}

export type ProviderMetric = {
  host: string;
  requests: number;
  errorRate: number;
  p50: number;
  p90: number;
  p99: number;
};

export async function fetchMetricsProviders(): Promise<ProviderMetric[]> {
  const res = await fetch(`${API_BASE}/metrics/providers`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load provider metrics");
  const body = (await res.json()) as { providers: ProviderMetric[] };
  return body.providers;
}

export async function putProviders(
  providers: Provider[],
  mode?: RoutingMode
): Promise<ProvidersResponse> {
  const res = await fetch(`${API_BASE}/providers`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(mode ? { providers, mode } : { providers }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to save providers");
  }
  return res.json();
}
