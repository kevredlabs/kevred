import { useAuth } from "../auth";
import "../dashboard.css";

export default function DashboardPage() {
  const { user, logout } = useAuth();

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
          <p className="page-sub">Add your first provider to start dispatching RPC calls.</p>

          <section className="section">
            <div className="section-head">
              <h2>Your RPC endpoint</h2>
            </div>
            <div className="endpoint-card">
              <div className="endpoint-url">
                <span className="url">https://rpc.kevred.com/</span>
                <span className="token">k_3f8a9b2c1d4e6f7a</span>
              </div>
              <div className="endpoint-actions">
                <button className="icon-btn">Copy</button>
              </div>
            </div>
            <p className="section-hint">Your endpoint is ready, but it won't dispatch anything until you add at least one provider below.</p>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Your providers</h2>
            </div>
            <div className="empty-state">
              <div className="empty-icon">⊕</div>
              <h3>No providers yet</h3>
              <p>Add at least one to start dispatching calls. You can paste an API key from Helius, QuickNode, Triton, or any Solana RPC provider.</p>
              <button className="btn btn-primary">+ Add your first provider</button>
            </div>
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
