type Health = "ok" | "warn" | "crit";
type Row = {
  name: string;
  health: Health;
  share: string;
  p50: string;
  p90: string;
  p99: string;
  errors: string;
};

const KPIS = [
  { label: "Requests · 24h", value: "1.42M", delta: "↑ 12.4% vs yesterday", trend: "up" as const },
  { label: "Error rate", value: "0.21%", delta: "↓ 0.08pp", trend: "down" as const },
  { label: "p50 latency", value: "84", unit: "ms", delta: "↓ 6ms", trend: "down" as const },
];

const ROWS: Row[] = [
  { name: "Helius", health: "ok", share: "34.2%", p50: "72 ms", p90: "145 ms", p99: "320 ms", errors: "0.14%" },
  { name: "QuickNode", health: "ok", share: "33.5%", p50: "91 ms", p90: "180 ms", p99: "410 ms", errors: "0.19%" },
  { name: "Triton", health: "warn", share: "22.8%", p50: "118 ms", p90: "240 ms", p99: "580 ms", errors: "1.42%" },
  { name: "Alchemy", health: "crit", share: "9.5%", p50: "— ms", p90: "— ms", p99: "— ms", errors: "17.8%" },
];

export default function AnalyticsPage() {
  return (
    <div className="container">
      <h1>Analytics</h1>
      <p className="page-sub">Traffic, errors and latency across your providers.</p>

      <section className="section">
        <div className="kpi-grid">
          {KPIS.map((k) => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">
                {k.value}{"unit" in k && <span className="kpi-unit"> {k.unit}</span>}
              </div>
              <div className={`kpi-delta kpi-delta-${k.trend}`}>{k.delta}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="table-card">
          <div className="table-row table-head">
            <div className="col-provider">Provider</div>
            <div>Share</div>
            <div>P50</div>
            <div>P90</div>
            <div>P99</div>
            <div>Errors</div>
          </div>
          {ROWS.map((r) => (
            <div key={r.name} className="table-row">
              <div className="col-provider">
                <span className={`dot dot-${r.health}`} />
                {r.name}
              </div>
              <div className="mono">{r.share}</div>
              <div className="mono">{r.p50}</div>
              <div className="mono">{r.p90}</div>
              <div className="mono">{r.p99}</div>
              <div className="mono">{r.errors}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
