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

export type MeResponse = { userId: string; email: string };

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Unauthorized");
  const body = await res.json() as { user: MeResponse };
  return body.user;
}
