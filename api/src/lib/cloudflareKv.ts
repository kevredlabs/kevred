const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function getCfEnv() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !namespaceId || !token) {
    throw new Error("CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID and CF_API_TOKEN must be set");
  }
  return { accountId, namespaceId, token };
}

export async function putCustomerConfig(customerId: string, endpoints: string[]): Promise<void> {
  const { accountId, namespaceId, token } = getCfEnv();
  const key = `config:${customerId}`;
  const url = `${CF_API_BASE}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoints }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudflare KV write failed: ${res.status} ${body}`);
  }
}
