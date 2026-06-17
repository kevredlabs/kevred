import { useEffect, useState } from "react";
import {
  fetchMetricsSummary,
  fetchMetricsProviders,
  fetchProviders,
  type MetricsSummary,
  type ProviderMetric,
  type Provider,
} from "../api";

type Health = "ok" | "warn" | "crit";

function healthFor(errorRate: number): Health {
  if (errorRate >= 0.05) return "crit";
  if (errorRate >= 0.01) return "warn";
  return "ok";
}

function formatRequests(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

function buildLabelMap(providers: Provider[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of providers) {
    try {
      map.set(new URL(p.url).hostname, p.label);
    } catch {
      // ignore invalid URL
    }
  }
  return map;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [providers, setProviders] = useState<ProviderMetric[] | null>(null);
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMetricsSummary(), fetchMetricsProviders(), fetchProviders()])
      .then(([s, p, cfg]) => {
        if (cancelled) return;
        setSummary(s);
        setProviders(p);
        setLabelMap(buildLabelMap(cfg.providers));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalRequests = providers?.reduce((sum, p) => sum + p.requests, 0) ?? 0;

  return (
    <div className="container">
      <h1>Analytics</h1>
      <p className="page-sub">Traffic, errors and latency across your providers — last 24h.</p>

      {error && <p className="page-sub">Could not load metrics: {error}</p>}

      <section className="section">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Requests · 24h</div>
            <div className="kpi-value">
              {summary ? formatRequests(summary.requests) : "—"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Error rate</div>
            <div className="kpi-value">
              {summary ? formatPercent(summary.errorRate) : "—"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">p50 latency</div>
            <div className="kpi-value">
              {summary ? Math.round(summary.p50Ms) : "—"}
              <span className="kpi-unit"> ms</span>
            </div>
          </div>
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
          {providers?.length === 0 && (
            <div className="table-row">
              <div className="col-provider">No traffic in the last 24h.</div>
            </div>
          )}
          {providers?.map((r) => {
            const share = totalRequests > 0 ? r.requests / totalRequests : 0;
            return (
              <div key={r.host} className="table-row">
                <div className="col-provider">
                  <span className={`dot dot-${healthFor(r.errorRate)}`} />
                  {labelMap.get(r.host) ?? r.host ?? "(unknown)"}
                </div>
                <div className="mono">{formatPercent(share)}</div>
                <div className="mono">{formatMs(r.p50)}</div>
                <div className="mono">{formatMs(r.p90)}</div>
                <div className="mono">{formatMs(r.p99)}</div>
                <div className="mono">{formatPercent(r.errorRate)}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
