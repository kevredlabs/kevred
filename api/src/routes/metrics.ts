import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { querySql, getDataset } from "../lib/cloudflareAnalytics";

const router = Router();

const WINDOW = "INTERVAL '24' HOUR";
const CUSTOMER_ID_RE = /^[a-f0-9]+$/;

interface SummaryRow {
  requests: number | null;
  error_rate: number | null;
  p50_ms: number | null;
}

interface ProviderRow {
  host: string;
  requests: number | null;
  error_rate: number | null;
  p50: number | null;
  p90: number | null;
  p99: number | null;
}

async function getCustomerId(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select("customerId");
  if (!user) return null;
  if (!CUSTOMER_ID_RE.test(user.customerId)) return null;
  return user.customerId;
}

router.get("/metrics/summary", requireAuth, async (req: AuthRequest, res: Response) => {
  const customerId = await getCustomerId(req.user!.userId);
  if (!customerId) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const sql = `
    SELECT SUM(_sample_interval) AS requests,
           SUM(IF(blob4 = 'all_failed', _sample_interval, 0)) / SUM(_sample_interval) AS error_rate,
           quantileWeighted(0.5)(double1, _sample_interval) AS p50_ms
    FROM ${getDataset()}
    WHERE blob1 = '${customerId}' AND blob7 = 'summary'
      AND timestamp > NOW() - ${WINDOW}
  `;

  try {
    const rows = await querySql<SummaryRow>(sql);
    const row = rows[0] ?? { requests: 0, error_rate: 0, p50_ms: 0 };
    res.json({
      requests: Number(row.requests ?? 0),
      errorRate: Number(row.error_rate ?? 0),
      p50Ms: Number(row.p50_ms ?? 0),
    });
  } catch (err) {
    console.error("Analytics Engine summary query failed", err);
    res.status(502).json({ error: "Failed to fetch metrics" });
  }
});

router.get("/metrics/providers", requireAuth, async (req: AuthRequest, res: Response) => {
  const customerId = await getCustomerId(req.user!.userId);
  if (!customerId) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const sql = `
    SELECT blob2 AS host,
           SUM(_sample_interval) AS requests,
           SUM(IF(blob4 != 'success', _sample_interval, 0)) / SUM(_sample_interval) AS error_rate,
           quantileWeighted(0.5)(double1, _sample_interval)  AS p50,
           quantileWeighted(0.9)(double1, _sample_interval)  AS p90,
           quantileWeighted(0.99)(double1, _sample_interval) AS p99
    FROM ${getDataset()}
    WHERE blob1 = '${customerId}' AND blob7 = 'attempt'
      AND timestamp > NOW() - ${WINDOW}
    GROUP BY host
  `;

  try {
    const rows = await querySql<ProviderRow>(sql);
    const providers = rows.map((r) => ({
      host: r.host,
      requests: Number(r.requests ?? 0),
      errorRate: Number(r.error_rate ?? 0),
      p50: Number(r.p50 ?? 0),
      p90: Number(r.p90 ?? 0),
      p99: Number(r.p99 ?? 0),
    }));
    res.json({ providers });
  } catch (err) {
    console.error("Analytics Engine providers query failed", err);
    res.status(502).json({ error: "Failed to fetch metrics" });
  }
});

export default router;
