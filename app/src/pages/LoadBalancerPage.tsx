import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useAuth } from "../auth";
import { fetchProviders, putProviders, type Provider, type RoutingMode } from "../api";

export default function LoadBalancerPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<RoutingMode | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const endpointUrl = user?.customerId && user?.rpcDomain
    ? `https://${user.customerId}.${user.rpcDomain}`
    : "";

  useEffect(() => {
    fetchProviders()
      .then((r) => {
        setProviders(r.providers);
        setMode(r.mode);
      })
      .catch((e) => setError(e.message ?? "Failed to load configuration"))
      .finally(() => setLoaded(true));
  }, []);

  async function handleModeChange(next: RoutingMode) {
    if (next === mode || !loaded || saving) return;
    const previous = mode ?? "sequential";
    setMode(next);
    setSaving(true);
    setError(null);
    try {
      const r = await putProviders(providers, next);
      setProviders(r.providers);
      setMode(r.mode);
    } catch (e) {
      setMode(previous);
      setError(e instanceof Error ? e.message : "Failed to save mode");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!endpointUrl) return;
    await navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const disabled = !loaded || saving;

  return (
    <div className="container">
      <h1>Load Balancer</h1>
      <p className="page-sub">Pick how kevred dispatches requests across your providers.</p>

      <section className="section">
        <div className="section-head">
          <h2>Routing mode</h2>
        </div>
        <div className="mode-grid">
          <label className={`mode-card ${mode === "sequential" ? "active" : ""}`}>
            <input
              type="radio"
              name="mode"
              value="sequential"
              checked={mode === "sequential"}
              disabled={disabled}
              onChange={() => handleModeChange("sequential")}
            />
            <div className="mode-title">Sequential</div>
            <div className="mode-desc">
              Try providers in priority order. Fall back to the next one only if the previous fails.
              Lowest cost.
            </div>
          </label>

          <label className={`mode-card ${mode === "parallel" ? "active" : ""}`}>
            <input
              type="radio"
              name="mode"
              value="parallel"
              checked={mode === "parallel"}
              disabled={disabled}
              onChange={() => handleModeChange("parallel")}
            />
            <div className="mode-title">Parallel</div>
            <div className="mode-desc">
              Fire the request to all providers at once, return the fastest response. Lowest latency.
            </div>
          </label>
        </div>
        {error && <p className="section-hint error">{error}</p>}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Your API endpoint</h2>
        </div>
        <div className="endpoint-card">
          <div className="endpoint-url">
            <span className="url">{endpointUrl || "—"}</span>
          </div>
          <div className="endpoint-actions">
            <button
              className="icon-btn"
              onClick={handleCopy}
              disabled={!endpointUrl}
              aria-label={copied ? "Copied" : "Copy endpoint"}
              title={copied ? "Copied" : "Copy"}
            >
              {copied ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
