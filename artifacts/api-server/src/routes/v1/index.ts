import { Router } from "express";
import rateLimit from "express-rate-limit";
import { apiKeyAuth } from "../../middleware/api-key-auth";
import interactionsV1 from "./interactions";
import webhookV1 from "./webhook";
import customersV1 from "./customers";

const router = Router();

// ── Rate limiting for V1 API ────────────────────────────────────────────────
// Key by API key header (always present after apiKeyAuth); avoids IPv6 issues
function apiKeyGenerator(req: import("express").Request): string {
  const key = req.headers["x-api-key"] as string;
  return key ?? "unknown";
}

// Per-API-key limiting: 300 req/min for regular endpoints
const v1RateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: apiKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.headers["x-api-key"], // skip if no API key (auth will reject anyway)
  message: { error: "İstek limiti aşıldı. 1 dakika sonra tekrar deneyin." },
});

// Batch endpoint gets a stricter limit (50 batch calls/min)
const batchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: apiKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.headers["x-api-key"],
  message: { error: "Toplu istek limiti aşıldı. 1 dakika sonra tekrar deneyin." },
});

// All v1 routes require API key authentication + rate limiting
router.use("/v1", apiKeyAuth, v1RateLimit);
router.use("/v1/interactions/batch", batchRateLimit);
router.use("/v1/interactions", interactionsV1);
router.use("/v1/webhook", webhookV1);
router.use("/v1/customers", customersV1);

export default router;
