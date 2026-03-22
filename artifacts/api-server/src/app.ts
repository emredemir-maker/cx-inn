import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "./middlewares/authMiddleware";
import { tenantContextMiddleware } from "./middleware/tenantContext";
import router from "./routes";
import { pool } from "@workspace/db";

// ── Runtime migrations ─────────────────────────────────────────────────────────
// We use runtime migrations instead of drizzle-kit push so the app is
// self-contained and can bootstrap on a fresh DB without manual steps.
// Each statement is idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).
(async () => {
  const client = await pool.connect();
  try {
    // ── Faz 0: excluded_domains (legacy single-statement migration) ───────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS excluded_domains (
        id         SERIAL PRIMARY KEY,
        domain     TEXT NOT NULL UNIQUE,
        reason     TEXT,
        source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Faz 1: Multi-tenancy foundation ───────────────────────────────────────

    // 1a. tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT NOT NULL,
        slug          TEXT NOT NULL,
        logo_url      TEXT,
        primary_color TEXT DEFAULT '#6366f1',
        industry      TEXT,
        description   TEXT,
        email         TEXT,
        website       TEXT,
        plan          TEXT NOT NULL DEFAULT 'standard'
                      CHECK (plan IN ('standard','professional','enterprise')),
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tenants_slug_unique'
        ) THEN
          ALTER TABLE tenants ADD CONSTRAINT tenants_slug_unique UNIQUE (slug);
        END IF;
      END $$
    `);

    // 1b. Seed default tenant — copy data from company_settings if it exists
    await client.query(`
      INSERT INTO tenants (id, name, slug, logo_url, primary_color, industry, description, email, website, plan)
      SELECT
        '00000000-0000-4000-8000-000000000001'::uuid,
        COALESCE((SELECT company_name FROM company_settings LIMIT 1), 'CX-Inn'),
        'default',
        (SELECT logo_url      FROM company_settings LIMIT 1),
        COALESCE((SELECT primary_color FROM company_settings LIMIT 1), '#6366f1'),
        (SELECT industry     FROM company_settings LIMIT 1),
        (SELECT description  FROM company_settings LIMIT 1),
        (SELECT email        FROM company_settings LIMIT 1),
        (SELECT website      FROM company_settings LIMIT 1),
        'standard'
      ON CONFLICT DO NOTHING
    `);

    // 1c. tenant_memberships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_memberships (
        id         SERIAL PRIMARY KEY,
        tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       TEXT NOT NULL DEFAULT 'cx_user'
                   CHECK (role IN ('tenant_admin','cx_manager','cx_user')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, user_id)
      )
    `);

    // 1d. Add tenant_id column to all 21 data tables (idempotent)
    const tables = [
      "customers", "interactions", "interaction_records",
      "surveys", "survey_campaigns", "survey_responses",
      "survey_questions", "survey_test_sends", "cx_analyses",
      "segments", "triggers", "conversations", "messages",
      "ai_approvals", "prediction_accuracy", "audit_logs",
      "api_keys", "invitations", "role_permissions",
      "tag_synonyms", "excluded_domains",
    ];
    for (const table of tables) {
      await client.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)
      `);
    }

    // 1e. Backfill all existing rows with the default tenant
    const DEFAULT_TENANT = "'00000000-0000-4000-8000-000000000001'";
    for (const table of tables) {
      await client.query(`
        UPDATE ${table}
        SET tenant_id = ${DEFAULT_TENANT}::uuid
        WHERE tenant_id IS NULL
      `);
    }

    // 1f. Seed existing users as members of the default tenant
    await client.query(`
      INSERT INTO tenant_memberships (tenant_id, user_id, role)
      SELECT
        '00000000-0000-4000-8000-000000000001'::uuid,
        id,
        CASE role
          WHEN 'superadmin' THEN 'tenant_admin'
          WHEN 'cx_manager' THEN 'cx_manager'
          ELSE 'cx_user'
        END
      FROM users
      ON CONFLICT DO NOTHING
    `);

    console.log("[startup] ✓ Faz 1 multi-tenancy migration complete");

    // ── Faz 2: token/expiresAt columns removed from invitations (none added) ─
    // Backfill invitations.tenant_id for legacy invitations without one
    await client.query(`
      UPDATE invitations
      SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
      WHERE tenant_id IS NULL
    `);

    console.log("[startup] ✓ Faz 2 migration complete");

    // ── Faz 3: company_settings tenant_id ────────────────────────────────────
    await client.query(`
      ALTER TABLE company_settings
      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)
    `);
    await client.query(`
      UPDATE company_settings
      SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
      WHERE tenant_id IS NULL
    `);

    console.log("[startup] ✓ Faz 3 migration complete");

    // ── Faz 4: Tenant-isolated V1 API ─────────────────────────────────────────
    // The old customers.email UNIQUE constraint prevents two tenants from sharing
    // the same customer email. Replace it with a composite (tenant_id, email) unique
    // index so each tenant has its own isolated customer namespace.
    await client.query(`
      DO $$ BEGIN
        -- Drop the old single-column unique constraint if it still exists
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'customers_email_unique' AND conrelid = 'customers'::regclass
        ) THEN
          ALTER TABLE customers DROP CONSTRAINT customers_email_unique;
        END IF;
      END $$
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_email_unique
      ON customers (tenant_id, email)
    `);

    console.log("[startup] ✓ Faz 4 migration complete");
  } catch (err) {
    console.error("[startup] Migration error:", err);
  } finally {
    client.release();
  }
})();

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

// ── Prevent Firebase Hosting CDN from stripping Set-Cookie headers ────────────
// Firebase Hosting CDN caches responses and strips Set-Cookie unless
// Cache-Control: private is present. Without this, session cookies are never
// delivered to the browser, causing 401 on every authenticated request.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

app.use("/api", browserRateLimit);
app.use(authMiddleware);
// Auto-resolve tenantId for every authenticated request
app.use("/api", tenantContextMiddleware);

app.use("/api", router);

export default app;
