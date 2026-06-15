import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useAuth } from "../auth";

type Mode = "sequential" | "parallel";

export default function LoadBalancerPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("sequential");
  const [copied, setCopied] = useState(false);

  const endpointUrl = user?.customerId && user?.rpcDomain
    ? `https://${user.customerId}.${user.rpcDomain}`
    : "";

  async function handleCopy() {
    if (!endpointUrl) return;
    await navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
              onChange={() => setMode("sequential")}
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
              onChange={() => setMode("parallel")}
            />
            <div className="mode-title">Parallel</div>
            <div className="mode-desc">
              Fire the request to all providers at once, return the fastest response. Lowest latency.
            </div>
          </label>
        </div>
        <p className="section-hint">UI preview — backend wiring lands in a follow-up.</p>
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
