import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";

const app: Express = express();

// Allow configured origin or localhost in dev; V1 API calls from external systems
// use API keys so CORS is only relevant for browser-based requests
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(",").map((o) => o.trim())
  : null;

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    // Non-browser requests (server-to-server, curl, Postman) have no origin
    if (!origin) return callback(null, true);
    // Localhost always allowed in dev
    if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
      return callback(null, true);
    }
    // If ALLOWED_ORIGIN is set, enforce allowlist
    if (allowedOrigins && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // If no ALLOWED_ORIGIN configured, allow all (dev mode)
    if (!allowedOrigins) return callback(null, true);
    return callback(new Error("CORS: Origin not allowed"), false);
  },
}));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
