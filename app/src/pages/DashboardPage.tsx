import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { fetchProviders, putProviders, type Provider } from "../api";
import "../dashboard.css";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  const endpointUrl = user?.customerId && user?.rpcDomain
    ? `https://${user.customerId}.${user.rpcDomain}`
    : "";

  useEffect(() => {
    fetchProviders()
      .then((r) => setProviders(r.providers))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function persist(next: Provider[]) {
    const previous = providers;
    setProviders(next);
    setSaving(true);
    setError(null);
    try {
      const r = await putProviders(next);
      setProviders(r.providers);
    } catch (e) {
      setProviders(previous);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    if (!draftLabel.trim() || !draftUrl.trim()) return;
    persist([...providers, { label: draftLabel.trim(), url: draftUrl.trim() }]);
    setDraftLabel("");
    setDraftUrl("");
    setAdding(false);
  }

  function handleRemove(idx: number) {
    persist(providers.filter((_, i) => i !== idx));
  }

  function handleMove(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= providers.length) return;
    const next = [...providers];
    [next[idx], next[target]] = [next[target], next[idx]];
    persist(next);
  }

  return (
    <>
      <nav>
        <div className="nav-inner">
          <div className="nav-logo">
            <img src="/logo_kevred_pixel.svg" className="nav-logo-mark" alt="kevred" />
            kevred
          </div>
          <div className="user-menu">
            <span>{user?.email}</span>
            <button className="icon-btn" onClick={logout}>Log out</button>
          </div>
        </div>
      </nav>

      <div className="page">
        <div className="container">
          <h1>Welcome to kevred</h1>
          <p className="page-sub">
            {providers.length === 0
              ? "Add your first provider to start dispatching RPC calls."
              : "Your endpoint dispatches RPC calls through the providers below, in priority order."}
          </p>

          <section className="section">
            <div className="section-head">
              <h2>Your RPC endpoint</h2>
            </div>
            <div className="endpoint-card">
              <div className="endpoint-url">
                <span className="url">{endpointUrl}</span>
              </div>
              <div className="endpoint-actions">
                <button
                  className="icon-btn"
                  onClick={() => endpointUrl && navigator.clipboard.writeText(endpointUrl)}
                  disabled={!endpointUrl}
                >
                  Copy
                </button>
              </div>
            </div>
            {providers.length === 0 && (
              <p className="section-hint">
                Your endpoint is ready, but it won't dispatch anything until you add at least one provider below.
              </p>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Your providers</h2>
              {providers.length > 0 && !adding && (
                <button
                  className="btn"
                  onClick={() => setAdding(true)}
                  disabled={saving || providers.length >= 5}
                >
                  + Add provider
                </button>
              )}
            </div>

            {error && <div className="error-banner">{error}</div>}

            {loading ? (
              <p className="section-hint">Loading…</p>
            ) : providers.length === 0 && !adding ? (
              <div className="empty-state">
                <div className="empty-icon">⊕</div>
                <h3>No providers yet</h3>
                <p>Add at least one to start dispatching calls. You can paste an API key from Helius, QuickNode, Triton, or any Solana RPC provider.</p>
                <button className="btn btn-primary" onClick={() => setAdding(true)}>
                  + Add your first provider
                </button>
              </div>
            ) : (
              <ul className="provider-list">
                {providers.map((p, idx) => (
                  <li key={`${p.url}-${idx}`} className="provider-row">
                    <div className="provider-priority">#{idx + 1}</div>
                    <div className="provider-info">
                      <div className="provider-label">{p.label}</div>
                      <div className="provider-url">{p.url}</div>
                    </div>
                    <div className="provider-actions">
                      <button
                        className="icon-btn"
                        onClick={() => handleMove(idx, -1)}
                        disabled={saving || idx === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleMove(idx, 1)}
                        disabled={saving || idx === providers.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleRemove(idx)}
                        disabled={saving}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {adding && (
              <form className="provider-form" onSubmit={(e) => { e.preventDefault(); handleAdd(); }}>
                <input
                  type="text"
                  placeholder="Label (e.g. Helius mainnet)"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  maxLength={100}
                  required
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  maxLength={2048}
                  required
                />
                <div className="provider-form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Saving…" : "Add"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setAdding(false); setDraftLabel(""); setDraftUrl(""); }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Metrics</h2>
            </div>
            <div className="metrics-block">
              <span className="v2-badge">Coming in V2</span>
              <p className="metrics-explain">Once you've added providers, metrics will appear here in V2. Data is already being collected via Cloudflare Analytics Engine — only the visualization is pending.</p>
              <div className="metrics-grid">
                <div className="stat">
                  <div className="stat-label">Requests · 24h</div>
                  <div className="stat-value">—</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Error rate</div>
                  <div className="stat-value">—</div>
                </div>
                <div className="stat">
                  <div className="stat-label">p50 latency</div>
                  <div className="stat-value">—</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
