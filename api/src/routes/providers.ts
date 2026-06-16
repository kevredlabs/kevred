import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { User, IProvider, RoutingMode } from "../models/User";
import { putCustomerConfig } from "../lib/cloudflareKv";

const router = Router();

const MAX_PROVIDERS = 5;
const MAX_URL_LENGTH = 2048;
const MAX_LABEL_LENGTH = 100;
const VALID_MODES: RoutingMode[] = ["sequential", "parallel"];

function validateProviders(input: unknown): IProvider[] | string {
  if (!Array.isArray(input)) return "providers must be an array";
  if (input.length > MAX_PROVIDERS) return `max ${MAX_PROVIDERS} providers`;

  const cleaned: IProvider[] = [];
  for (const p of input) {
    if (!p || typeof p !== "object") return "invalid provider entry";
    const { label, url } = p as { label?: unknown; url?: unknown };
    if (typeof label !== "string" || !label.trim()) return "label is required";
    if (label.length > MAX_LABEL_LENGTH) return `label too long (max ${MAX_LABEL_LENGTH})`;
    if (typeof url !== "string" || !url.trim()) return "url is required";
    if (url.length > MAX_URL_LENGTH) return `url too long (max ${MAX_URL_LENGTH})`;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return "url must use https";
    } catch {
      return "invalid url";
    }
    cleaned.push({ label: label.trim(), url: url.trim() });
  }
  return cleaned;
}

router.get("/providers", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ customerId: user.customerId, providers: user.providers, mode: user.mode });
});

router.put("/providers", requireAuth, async (req: AuthRequest, res: Response) => {
  const validated = validateProviders(req.body?.providers);
  if (typeof validated === "string") {
    res.status(400).json({ error: validated });
    return;
  }

  const rawMode = req.body?.mode;
  if (rawMode !== undefined && !VALID_MODES.includes(rawMode)) {
    res.status(400).json({ error: "mode must be 'sequential' or 'parallel'" });
    return;
  }

  const user = await User.findById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  user.providers = validated;
  if (rawMode) user.mode = rawMode;
  await user.save();

  try {
    await putCustomerConfig(user.customerId, validated.map((p) => p.url), user.mode);
  } catch (err) {
    console.error("Cloudflare KV sync failed");
    res.status(502).json({ error: "Failed to sync configuration with proxy" });
    return;
  }

  res.json({ customerId: user.customerId, providers: user.providers, mode: user.mode });
});

export default router;
