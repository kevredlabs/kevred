import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, X, Plus, Eye, EyeOff } from "lucide-react";
import { fetchProviders, putProviders, type Provider } from "../api";

const MASK = "•••••••••••••••••••••••";

export default function RpcEndpointsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  function toggleReveal(idx: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

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
    <div className="container">
      <h1>RPC Endpoints</h1>
      <p className="page-sub">
        {providers.length === 0
          ? "Add your first provider to start dispatching RPC calls."
          : "Providers are tried in the order below. Drag the arrows to reorder."}
      </p>

      <section className="section">
        <div className="section-head">
          <h2>Your providers</h2>
          {providers.length > 0 && !adding && (
            <button
              className="btn"
              onClick={() => setAdding(true)}
              disabled={saving || providers.length >= 5}
            >
              <Plus size={14} strokeWidth={2} />
              Add provider
            </button>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <p className="section-hint">Loading…</p>
        ) : providers.length === 0 && !adding ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Plus size={24} strokeWidth={1.5} />
            </div>
            <h3>No providers yet</h3>
            <p>Add at least one to start dispatching calls. You can paste an API key from Helius, QuickNode, Triton, or any Solana RPC provider.</p>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={14} strokeWidth={2} />
              Add your first provider
            </button>
          </div>
        ) : (
          <ul className="provider-list">
            {providers.map((p, idx) => (
              <li key={`${p.url}-${idx}`} className="provider-row">
                <div className="provider-priority">#{idx + 1}</div>
                <div className="provider-info">
                  <div className="provider-label">{p.label}</div>
                  <div className="provider-url">{revealed.has(idx) ? p.url : MASK}</div>
                </div>
                <div className="provider-actions">
                  <button
                    className="icon-btn"
                    onClick={() => toggleReveal(idx)}
                    aria-label={revealed.has(idx) ? "Hide API key" : "Show API key"}
                    title={revealed.has(idx) ? "Hide" : "Show"}
                  >
                    {revealed.has(idx)
                      ? <Eye size={14} strokeWidth={1.75} />
                      : <EyeOff size={14} strokeWidth={1.75} />}
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleMove(idx, -1)}
                    disabled={saving || idx === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleMove(idx, 1)}
                    disabled={saving || idx === providers.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleRemove(idx)}
                    disabled={saving}
                    aria-label="Remove"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <form className="provider-form" onSubmit={(e) => { e.preventDefault(); handleAdd(); }}>
            <label className="field">
              <span className="field-label">Name</span>
              <input
                type="text"
                placeholder="e.g. Helius mainnet"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                maxLength={100}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">Endpoint URL</span>
              <input
                type="url"
                placeholder="https://..."
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                maxLength={2048}
                required
              />
            </label>
            <div className="provider-form-actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => { setAdding(false); setDraftLabel(""); setDraftUrl(""); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Add"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
