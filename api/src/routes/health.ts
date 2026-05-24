import { Router } from "express";
import { dbState } from "../db";

const router = Router();

router.get("/health", (_req, res) => {
  const mongo = dbState();
  const ok = mongo === "connected";
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", mongo });
});

export default router;
