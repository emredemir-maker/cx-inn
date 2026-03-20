// v3 — diagnostic ping added 2026-03-20
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// ── diagnostic ────────────────────────────────────────────────────────────────
// No-auth ping to verify this router is mounted correctly on Cloud Run
router.get("/admin/test-data/ping", (_req: Request, res: Response) => {
  res.json({ ok: true, router: "admin-test-data", ts: Date.now() });
});

// ── helpers ──────────────────────────────────────────────────────────────────

function sanitizeEmailPattern(raw: string): string {
  // Remove @ prefix if included, strip SQL wildcard chars to prevent injection
  return raw.replace(/^@/, "").replace(/[%_]/g, "").trim();
}

function dateRangeStart(range: string | undefined): Date | undefined {
  if (!range || range === "all") return undefined;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
  if (range === "7days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  return undefined;
}

/** Extract numeric count from a db.execute result */
function rowCount(result: any): number {
  // Drizzle wraps pg results — rows array or rowCount
  const rows = result?.rows ?? result;
  if (Array.isArray(rows) && rows.length > 0) {
    const val = rows[0]?.count ?? rows[0]?.c;
    return Number(val ?? 0);
  }
  return Number(result?.rowCount ?? 0);
}

/** Extract affected row count from a DELETE result */
function affectedRows(result: any): number {
  return Number(result?.rowCount ?? result?.rows?.length ?? 0);
}

// ── GET /api/admin/test-data/counts ──────────────────────────────────────────

router.get(
  "/admin/test-data/counts",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    try {
      const { emailPattern, dateRange } = req.query as {
        emailPattern?: string;
        dateRange?: string;
      };

      const since = dateRangeStart(dateRange);
      const ep = emailPattern ? sanitizeEmailPattern(emailPattern) : null;
      const emailLike = ep ? `%@${ep}` : null;

      // Build counts using parameterized sql template
      const cnt = async (query: ReturnType<typeof sql>) => {
        const r = await db.execute(query);
        return rowCount(r);
      };

      const [
        customers,
        interactions,
        interactionRecords,
        surveyResponses,
        cxAnalyses,
        predictionAccuracy,
        aiApprovals,
        conversations,
        messages,
        surveys,
        surveyCampaigns,
        segments,
        auditLogs,
      ] = await Promise.all([
        cnt(sql`SELECT COUNT(*) AS count FROM customers
          WHERE (${emailLike}::text IS NULL OR email LIKE ${emailLike})
          AND (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM interactions
          WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
          AND (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM interaction_records
          WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
          AND (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM survey_responses
          WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
          AND (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM cx_analyses
          WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
          AND (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM prediction_accuracy
          WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
          AND (${since}::timestamptz IS NULL OR recorded_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM ai_approvals
          WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM conversations
          WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM messages
          WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM surveys
          WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM survey_campaigns
          WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM segments
          WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`),

        cnt(sql`SELECT COUNT(*) AS count FROM audit_logs
          WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`),
      ]);

      res.json({
        customers,
        interactions: interactions + interactionRecords,
        surveyData: surveyResponses,
        aiData: cxAnalyses + predictionAccuracy + aiApprovals,
        conversations: conversations + messages,
        surveys: surveys + surveyCampaigns + segments,
        auditLogs,
      });
    } catch (err) {
      console.error("[admin-test-data] counts error:", err);
      res.status(500).json({ error: "Sayım alınamadı", details: String(err) });
    }
  }
);

// ── DELETE /api/admin/test-data ───────────────────────────────────────────────

const VALID_SCOPES = [
  "all", "customers", "interactions", "surveys", "ai_data", "conversations", "audit_logs",
] as const;
type Scope = (typeof VALID_SCOPES)[number];

router.delete(
  "/admin/test-data",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { scopes, filters } = req.body as {
      scopes: Scope[];
      filters?: { emailPattern?: string; dateRange?: string };
    };

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ error: "'scopes' dizisi zorunlu" });
    }
    const invalid = scopes.find((s) => !VALID_SCOPES.includes(s));
    if (invalid) {
      return res.status(400).json({ error: `Geçersiz scope: ${invalid}` });
    }

    const doAll = scopes.includes("all");
    const since = dateRangeStart(filters?.dateRange);
    const ep = filters?.emailPattern ? sanitizeEmailPattern(filters.emailPattern) : null;
    const emailLike = ep ? `%@${ep}` : null;

    const deleted: Record<string, number> = {};

    const del = async (query: ReturnType<typeof sql>, label: string) => {
      const r = await db.execute(query);
      deleted[label] = (deleted[label] ?? 0) + affectedRows(r);
    };

    try {
      const run = doAll || scopes.includes("customers");
      const runInteractions = doAll || scopes.includes("interactions");
      const runSurveys = doAll || scopes.includes("surveys");
      const runAi = doAll || scopes.includes("ai_data");
      const runConversations = doAll || scopes.includes("conversations");
      const runAuditLogs = doAll || scopes.includes("audit_logs");

      // Use a single transaction via Drizzle
      await db.transaction(async (tx) => {
        const txDel = async (query: ReturnType<typeof sql>, label: string) => {
          const r = await tx.execute(query);
          deleted[label] = (deleted[label] ?? 0) + affectedRows(r);
        };

        // ── 1. prediction_accuracy FIRST (FK → cx_analyses, survey_responses)
        if (run || runAi || runSurveys) {
          await txDel(
            sql`DELETE FROM prediction_accuracy
                WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
                AND (${since}::timestamptz IS NULL OR recorded_at >= ${since})`,
            "prediction_accuracy"
          );
        }

        // ── 2. cx_analyses (FK → customers)
        if (run || runAi) {
          await txDel(
            sql`DELETE FROM cx_analyses
                WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
                AND (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "cx_analyses"
          );
        }

        // ── 3. ai_approvals
        if (run || runAi) {
          await txDel(
            sql`DELETE FROM ai_approvals
                WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "ai_approvals"
          );
        }

        // ── 4. survey_responses (FK → surveys, campaigns, customers)
        if (run || runSurveys) {
          await txDel(
            sql`DELETE FROM survey_responses
                WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
                AND (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "survey_responses"
          );
        }

        // ── 5. survey_test_sends (FK → surveys with CASCADE)
        if (run || runSurveys) {
          await txDel(
            sql`DELETE FROM survey_test_sends
                WHERE (${since}::timestamptz IS NULL OR sent_at >= ${since})`,
            "survey_test_sends"
          );
        }

        // ── 6. survey_campaigns (FK → surveys)
        if (run || runSurveys) {
          await txDel(
            sql`DELETE FROM survey_campaigns
                WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "survey_campaigns"
          );
        }

        // ── 7. surveys
        if (run || runSurveys) {
          await txDel(
            sql`DELETE FROM surveys
                WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "surveys"
          );
        }

        // ── 8. segments
        if (run || runSurveys) {
          await txDel(
            sql`DELETE FROM segments
                WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "segments"
          );
        }

        // ── 9. interactions (FK → customers)
        if (run || runInteractions) {
          await txDel(
            sql`DELETE FROM interactions
                WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
                AND (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "interactions"
          );
        }

        // ── 10. interaction_records (FK → customers)
        if (run || runInteractions) {
          await txDel(
            sql`DELETE FROM interaction_records
                WHERE (${emailLike}::text IS NULL OR customer_id IN (SELECT id FROM customers WHERE email LIKE ${emailLike}))
                AND (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "interaction_records"
          );
        }

        // ── 11. messages (FK → conversations, CASCADE)
        if (runConversations) {
          await txDel(
            sql`DELETE FROM messages
                WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "messages"
          );
        }

        // ── 12. conversations
        if (runConversations) {
          await txDel(
            sql`DELETE FROM conversations
                WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "conversations"
          );
        }

        // ── 13. customers (last, after all FK children gone)
        if (run) {
          await txDel(
            sql`DELETE FROM customers
                WHERE (${emailLike}::text IS NULL OR email LIKE ${emailLike})
                AND (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "customers"
          );
        }

        // ── 14. audit_logs
        if (runAuditLogs) {
          await txDel(
            sql`DELETE FROM audit_logs
                WHERE (${since}::timestamptz IS NULL OR created_at >= ${since})`,
            "audit_logs"
          );
        }
      });

      const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);

      // Write audit entry (only if audit_logs wasn't wiped)
      if (!runAuditLogs) {
        try {
          const userId = (req.user as any)?.id ?? null;
          const details = JSON.stringify({ scopes, filters, deleted, totalDeleted });
          await db.execute(
            sql`INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, pii_masked)
                VALUES ('test_data_cleanup', 'system', NULL, ${userId}, ${details}, false)`
          );
        } catch {
          // non-fatal — don't fail the request if audit insert fails
        }
      }

      res.json({ success: true, deleted, totalDeleted });
    } catch (err) {
      console.error("[admin-test-data] delete error:", err);
      res.status(500).json({
        error: "Silme işlemi başarısız",
        details: String(err),
      });
    }
  }
);

export default router;
