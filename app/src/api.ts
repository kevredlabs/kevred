export type HealthResponse = {
  status: "ok" | "degraded";
  mongo: "connected" | "disconnected" | "connecting" | "disconnecting";
};

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body as HealthResponse;
  }
  return res.json();
}
