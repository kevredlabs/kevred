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
