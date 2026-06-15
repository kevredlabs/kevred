import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Shuffle, BarChart3, Copy, Check } from "lucide-react";
import { useAuth } from "../auth";
import { fetchProviders } from "../api";

const QUICK_ACTIONS = [
  { to: "/rpc-endpoints", Icon: Plus, label: "Add provider", hint: "Helius, Triton, custom RPC" },
  { to: "/load-balancer", Icon: Shuffle, label: "Change routing mode", hint: "Sequential or parallel" },
  { to: "/analytics", Icon: BarChart3, label: "View analytics", hint: "Traffic, errors, latency" },
];

export default function HomePage() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProviders()
      .then((r) => setCount(r.providers.length))
      .catch(() => setCount(null));
  }, []);

  const endpointUrl = user?.customerId && user?.rpcDomain
    ? `https://${user.customerId}.${user.rpcDomain}`
    : "";

  async function handleCopy() {
    if (!endpointUrl) return;
    await navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const status = count === null
    ? "Loading…"
    : count === 0
      ? "Idle — add a provider to start dispatching."
      : `Active — ${count} provider${count > 1 ? "s" : ""} configured.`;

  return (
    <div className="container">
      <h1>Welcome, {user?.email}</h1>
      <p className="page-sub">Manage your RPC load balancer from one place.</p>

      <section className="section">
        <div className="section-head">
          <h2>Your endpoint</h2>
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

        <div className="summary-grid summary-grid-2">
          <div className="summary-item">
            <div className="summary-label">Providers</div>
            <div className="summary-value">{count ?? "—"}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Status</div>
            <div className="summary-value">{status}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Quick actions</h2>
        </div>
        <div className="quick-grid">
          {QUICK_ACTIONS.map(({ to, Icon, label, hint }) => (
            <Link key={to} to={to} className="quick-card">
              <div className="quick-icon">
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <div className="quick-body">
                <div className="quick-label">{label}</div>
                <div className="quick-hint">{hint}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
