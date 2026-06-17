const CF_API_BASE = "https://api.cloudflare.com/client/v4";

type AnalyticsEnv = "dev" | "prod";

interface AnalyticsResponse<T> {
  meta: { name: string; type: string }[];
  data: T[];
  rows: number;
}

function getCfEnv() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const env = (process.env.CF_ANALYTICS_ENV ?? "dev") as AnalyticsEnv;
  if (!accountId || !token) {
    throw new Error("CF_ACCOUNT_ID and CF_API_TOKEN must be set");
  }
  if (env !== "dev" && env !== "prod") {
    throw new Error("CF_ANALYTICS_ENV must be 'dev' or 'prod'");
  }
  return { accountId, token, env };
}

export function getDataset(): string {
  const { env } = getCfEnv();
  return `rpc_requests_${env}`;
}

export async function querySql<T>(sql: string): Promise<T[]> {
  const { accountId, token } = getCfEnv();
  const url = `${CF_API_BASE}/accounts/${accountId}/analytics_engine/sql`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Analytics Engine query failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as AnalyticsResponse<T>;
  return json.data;
}
