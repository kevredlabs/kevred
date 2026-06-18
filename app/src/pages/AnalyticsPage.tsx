import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  fetchMetricsSummary,
  fetchMetricsProviders,
  fetchMetricsStatusCodes,
  fetchMetricsTimeseries,
  fetchProviders,
  type MetricsSummary,
  type ProviderMetric,
  type Provider,
  type RoutingMode,
  type StatusCodeMetric,
  type TimeseriesPoint,
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

const BUCKET_MS = 5 * 60 * 1000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function fillTimeseriesGaps(points: TimeseriesPoint[]): { t: number; requests: number }[] {
  const byBucket = new Map<number, number>();
  for (const p of points) {
    const ts = new Date(p.t.includes("Z") || p.t.includes("T") ? p.t : p.t.replace(" ", "T") + "Z").getTime();
    byBucket.set(Math.floor(ts / BUCKET_MS) * BUCKET_MS, p.requests);
  }
  const end = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  const start = end - WINDOW_MS;
  const out: { t: number; requests: number }[] = [];
  for (let b = start; b <= end; b += BUCKET_MS) {
    out.push({ t: b, requests: byBucket.get(b) ?? 0 });
  }
  return out;
}

function formatHourTick(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: string): string {
  if (!status || status === "0") return "no response";
  return status;
}

function statusColor(status: string): string {
  const code = Number(status);
  if (!Number.isFinite(code) || code === 0) return "#6b7280";
  if (code >= 200 && code < 300) return "#10b981";
  if (code >= 300 && code < 400) return "#06b6d4";
  if (code >= 400 && code < 500) return "#f59e0b";
  if (code >= 500) return "#ef4444";
  return "#6b7280";
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
  const [statusCodes, setStatusCodes] = useState<StatusCodeMetric[] | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[] | null>(null);
  const [mode, setMode] = useState<RoutingMode | null>(null);
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMetricsSummary(),
      fetchMetricsProviders(),
      fetchMetricsStatusCodes(),
      fetchMetricsTimeseries(),
      fetchProviders(),
    ])
      .then(([s, p, codes, ts, cfg]) => {
        if (cancelled) return;
        setSummary(s);
        setProviders(p);
        setStatusCodes(codes);
        setTimeseries(ts);
        setMode(cfg.mode);
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

  const tsFilled = timeseries ? fillTimeseriesGaps(timeseries) : null;

  const sortedStatusCodes = statusCodes
    ? [...statusCodes].sort((a, b) => b.requests - a.requests)
    : null;
  const statusTotal = sortedStatusCodes?.reduce((s, c) => s + c.requests, 0) ?? 0;

  return (
    <div className="container">
      <h1>Analytics</h1>
      <p className="page-sub">Traffic, errors and latency across your providers — last 24h.</p>

      {error && <p className="page-sub">Could not load metrics: {error}</p>}

      <section className="section">
        <div className="kpi-grid kpi-grid-4">
          <div className="kpi-card">
            <div className="kpi-label">Routing mode</div>
            <div className={`kpi-value mode-value mode-value-${mode ?? "loading"}`}>
              {mode ?? "—"}
            </div>
          </div>
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

      <section className="section">
        <div className="status-chart-card">
          <div className="status-chart-head">Requests over time · 24h</div>
          <div className="status-chart-sub">
            Client-facing requests to the load balancer, in 5-minute buckets.
          </div>
          {tsFilled && tsFilled.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={tsFilled} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#006fff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#006fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  tickFormatter={formatHourTick}
                  stroke="#666"
                  fontSize={11}
                  minTickGap={40}
                />
                <YAxis
                  stroke="#666"
                  fontSize={11}
                  tickFormatter={(v: number) => formatRequests(v)}
                  width={50}
                />
                <Tooltip
                  formatter={(v) => [formatRequests(Number(v)), "Requests"]}
                  labelFormatter={(l) => formatHourTick(Number(l))}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #2a2a2a",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="#006fff"
                  strokeWidth={2}
                  fill="url(#tsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="status-chart-empty">No traffic in the last 24h.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="status-chart-card">
          <div className="status-chart-head">Provider HTTP response codes · 24h</div>
          <div className="status-chart-sub">
            Status codes returned by upstream RPC providers.
          </div>
          {sortedStatusCodes && sortedStatusCodes.length > 0 ? (
            <div className="status-chart-body">
              <div className="status-chart-donut">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sortedStatusCodes}
                      dataKey="requests"
                      nameKey="status"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={1}
                      stroke="none"
                    >
                      {sortedStatusCodes.map((c) => (
                        <Cell key={c.status} fill={statusColor(c.status)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatRequests(Number(v))}
                      labelFormatter={(l) => statusLabel(String(l ?? ""))}
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #2a2a2a",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="status-legend">
                {sortedStatusCodes.map((c) => {
                  const share = statusTotal > 0 ? c.requests / statusTotal : 0;
                  return (
                    <li key={c.status} className="status-legend-row">
                      <span
                        className="status-legend-dot"
                        style={{ background: statusColor(c.status) }}
                      />
                      <span className="status-legend-code">{statusLabel(c.status)}</span>
                      <span className="status-legend-count mono">
                        {formatRequests(c.requests)}
                      </span>
                      <span className="status-legend-share mono">
                        {formatPercent(share)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="status-chart-empty">No traffic in the last 24h.</div>
          )}
        </div>
      </section>
    </div>
  );
}
