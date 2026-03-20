import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";

const app: Express = express();

const IS_PROD = process.env.NODE_ENV === "production";

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow configured origin or localhost in dev; V1 API calls from external systems
// use API keys so CORS is only relevant for browser-based requests
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(",").map((o) => o.trim())
  : null;

if (IS_PROD && !allowedOrigins) {
  console.error("[SECURITY] ALLOWED_ORIGIN env var is not set in production. CORS will block all browser requests.");
}

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    // Non-browser requests (server-to-server, curl, Postman) have no origin
    if (!origin) return callback(null, true);
    // Localhost always allowed in dev
    if (!IS_PROD && (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))) {
      return callback(null, true);
    }
    // Enforce allowlist — in production there is no fallback
    if (allowedOrigins?.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS: Origin not allowed"), false);
  },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Applied to all browser-facing /api/* routes (not /api/v1 which uses API keys)
const browserRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                   // max 300 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek gönderildi. Lütfen 15 dakika sonra tekrar deneyin." },
  skip: (req) => req.path.startsWith("/api/v1/"), // v1 uses API key auth, has own limits
});

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", browserRateLimit);
app.use(authMiddleware);

app.use("/api", router);

export default app;
