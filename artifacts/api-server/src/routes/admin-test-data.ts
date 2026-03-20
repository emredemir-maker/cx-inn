import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  cxAnalysesTable,
  predictionAccuracyTable,
  surveyResponsesTable,
  aiApprovalsTable,
  interactionsTable,
  interactionRecordsTable,
  messages as messagesTable,
  conversations as conversationsTable,
  surveyTestSendsTable,
  surveyCampaignsTable,
  surveysTable,
  segmentsTable,
  customersTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { sql, count, and, like, gte, inArray } from "drizzle-orm";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function sanitizeEmailPattern(raw: string): string {
  // Strip @ prefix if user included it, then remove SQL wildcard chars
  const cleaned = raw.replace(/^@/, "").replace(/[%_]/g, "");
  return cleaned;
}

function dateRangeStart(range: string | undefined): Date | undefined {
  if (!range) return undefined;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
  if (range === "7days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  return undefined; // "all"
}

async function countCustomerIds(emailPattern?: string): Promise<number[]> {
  if (!emailPattern) return [];
  const pattern = `%@${sanitizeEmailPattern(emailPattern)}`;
  const rows = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(like(customersTable.email, pattern));
  return rows.map((r) => r.id);
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
      const customerIds = emailPattern ? await countCustomerIds(emailPattern) : undefined;

      const buildWhere = (createdAtCol: any, customerIdCol?: any) => {
        const conditions = [];
        if (since) conditions.push(gte(createdAtCol, since));
        if (customerIds !== undefined) {
          if (customerIds.length === 0) {
            // no matching customers → force zero count
            conditions.push(sql`false`);
          } else if (customerIdCol) {
            conditions.push(inArray(customerIdCol, customerIds));
          }
        }
        return conditions.length > 0 ? and(...conditions) : undefined;
      };

      const [
        customersCount,
        interactionsCount,
        interactionRecordsCount,
        surveyResponsesCount,
        surveyTestSendsCount,
        cxAnalysesCount,
        predictionAccuracyCount,
        aiApprovalsCount,
        conversationsCount,
        messagesCount,
        surveysCount,
        surveyCampaignsCount,
        segmentsCount,
        auditLogsCount,
      ] = await Promise.all([
        db.select({ c: count() }).from(customersTable).where(buildWhere(customersTable.createdAt)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(interactionsTable).where(buildWhere(interactionsTable.createdAt, interactionsTable.customerId)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(interactionRecordsTable).where(buildWhere(interactionRecordsTable.createdAt, interactionRecordsTable.customerId)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(surveyResponsesTable).where(buildWhere(surveyResponsesTable.createdAt, surveyResponsesTable.customerId)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(surveyTestSendsTable).where(buildWhere(surveyTestSendsTable.sentAt)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(cxAnalysesTable).where(buildWhere(cxAnalysesTable.createdAt, cxAnalysesTable.customerId)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(predictionAccuracyTable).where(buildWhere(predictionAccuracyTable.recordedAt, predictionAccuracyTable.customerId)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(aiApprovalsTable).where(buildWhere(aiApprovalsTable.createdAt)).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(conversationsTable).where(since ? gte(conversationsTable.createdAt, since) : undefined).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(messagesTable).where(since ? gte(messagesTable.createdAt, since) : undefined).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(surveysTable).where(since ? gte(surveysTable.createdAt, since) : undefined).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(surveyCampaignsTable).where(since ? gte(surveyCampaignsTable.createdAt, since) : undefined).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(segmentsTable).where(since ? gte(segmentsTable.createdAt, since) : undefined).then((r) => r[0]?.c ?? 0),
        db.select({ c: count() }).from(auditLogsTable).where(since ? gte(auditLogsTable.createdAt, since) : undefined).then((r) => r[0]?.c ?? 0),
      ]);

      res.json({
        customers: Number(customersCount),
        interactions: Number(interactionsCount) + Number(interactionRecordsCount),
        surveyData: Number(surveyResponsesCount) + Number(surveyTestSendsCount),
        aiData: Number(cxAnalysesCount) + Number(predictionAccuracyCount) + Number(aiApprovalsCount),
        conversations: Number(conversationsCount) + Number(messagesCount),
        surveys: Number(surveysCount) + Number(surveyCampaignsCount) + Number(segmentsCount),
        auditLogs: Number(auditLogsCount),
      });
    } catch (err) {
      res.status(500).json({ error: "Sayım alınamadı", details: String(err) });
    }
  }
);

// ── DELETE /api/admin/test-data ───────────────────────────────────────────────

const VALID_SCOPES = ["all", "customers", "interactions", "surveys", "ai_data", "conversations", "audit_logs"] as const;
type Scope = (typeof VALID_SCOPES)[number];

router.delete(
  "/admin/test-data",
  requireRole("superadmin"),
  async (req: Request, res: Response) => {
    const { scopes, filters } = req.body as {
      scopes: Scope[];
      filters?: { emailPattern?: string; dateRange?: string };
    };

    // Validate
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ error: "'scopes' dizisi zorunlu" });
    }
    const invalidScope = scopes.find((s) => !VALID_SCOPES.includes(s));
    if (invalidScope) {
      return res.status(400).json({ error: `Geçersiz scope: ${invalidScope}` });
    }

    const doAll = scopes.includes("all");
    const since = dateRangeStart(filters?.dateRange);

    // Resolve customer id filter
    let customerIds: number[] | undefined;
    if (filters?.emailPattern) {
      customerIds = await countCustomerIds(filters.emailPattern);
      if (customerIds.length === 0) {
        return res.json({ success: true, deleted: {}, totalDeleted: 0, message: "Eşleşen müşteri bulunamadı — hiçbir şey silinmedi." });
      }
    }

    const buildWhere = (createdAtCol: any, customerIdCol?: any) => {
      const conditions = [];
      if (since) conditions.push(gte(createdAtCol, since));
      if (customerIds !== undefined && customerIdCol) {
        conditions.push(inArray(customerIdCol, customerIds));
      }
      return conditions.length > 0 ? and(...conditions) : undefined;
    };

    const buildWhereNoCustomer = (createdAtCol: any) => {
      if (since) return gte(createdAtCol, since);
      return undefined;
    };

    const deleted: Record<string, number> = {};

    try {
      await db.transaction(async (tx) => {

        const del = async (table: any, where: any, label: string) => {
          const result = await tx.delete(table).where(where).returning({ id: table.id });
          deleted[label] = (deleted[label] ?? 0) + result.length;
        };

        // ── customers scope (includes all customer-linked data) ──────────────
        if (doAll || scopes.includes("customers")) {
          await del(cxAnalysesTable,          buildWhere(cxAnalysesTable.createdAt, cxAnalysesTable.customerId),              "cx_analyses");
          await del(predictionAccuracyTable,  buildWhere(predictionAccuracyTable.recordedAt, predictionAccuracyTable.customerId), "prediction_accuracy");
          await del(surveyResponsesTable,     buildWhere(surveyResponsesTable.createdAt, surveyResponsesTable.customerId),    "survey_responses");
          await del(aiApprovalsTable,         buildWhere(aiApprovalsTable.createdAt),                                          "ai_approvals");
          await del(interactionsTable,        buildWhere(interactionsTable.createdAt, interactionsTable.customerId),           "interactions");
          await del(interactionRecordsTable,  buildWhere(interactionRecordsTable.createdAt, interactionRecordsTable.customerId), "interaction_records");
          await del(customersTable,           buildWhere(customersTable.createdAt),                                            "customers");
        }

        // ── interactions scope only (no customer delete) ─────────────────────
        if (!doAll && !scopes.includes("customers") && scopes.includes("interactions")) {
          await del(interactionsTable,       buildWhere(interactionsTable.createdAt, interactionsTable.customerId),           "interactions");
          await del(interactionRecordsTable, buildWhere(interactionRecordsTable.createdAt, interactionRecordsTable.customerId), "interaction_records");
        }

        // ── ai_data scope ─────────────────────────────────────────────────────
        if (doAll || scopes.includes("ai_data")) {
          if (!deleted["cx_analyses"]) {
            await del(cxAnalysesTable,         buildWhere(cxAnalysesTable.createdAt, cxAnalysesTable.customerId),             "cx_analyses");
          }
          if (!deleted["prediction_accuracy"]) {
            await del(predictionAccuracyTable, buildWhere(predictionAccuracyTable.recordedAt, predictionAccuracyTable.customerId), "prediction_accuracy");
          }
          if (!deleted["ai_approvals"]) {
            await del(aiApprovalsTable,        buildWhere(aiApprovalsTable.createdAt),                                         "ai_approvals");
          }
        }

        // ── surveys scope ─────────────────────────────────────────────────────
        if (doAll || scopes.includes("surveys")) {
          if (!deleted["survey_responses"]) {
            await del(surveyResponsesTable, buildWhereNoCustomer(surveyResponsesTable.createdAt),  "survey_responses");
          }
          await del(surveyTestSendsTable,   buildWhereNoCustomer(surveyTestSendsTable.sentAt),     "survey_test_sends");
          await del(surveyCampaignsTable,   buildWhereNoCustomer(surveyCampaignsTable.createdAt),  "survey_campaigns");
          await del(surveysTable,           buildWhereNoCustomer(surveysTable.createdAt),           "surveys");
          await del(segmentsTable,          buildWhereNoCustomer(segmentsTable.createdAt),          "segments");
        }

        // ── conversations scope ───────────────────────────────────────────────
        if (doAll || scopes.includes("conversations")) {
          await del(messagesTable,      buildWhereNoCustomer(messagesTable.createdAt),      "messages");
          await del(conversationsTable, buildWhereNoCustomer(conversationsTable.createdAt), "conversations");
        }

        // ── audit_logs scope ─────────────────────────────────────────────────
        if (!doAll && scopes.includes("audit_logs")) {
          await del(auditLogsTable, buildWhereNoCustomer(auditLogsTable.createdAt), "audit_logs");
        }
        if (doAll) {
          await del(auditLogsTable, undefined, "audit_logs");
        }
      });

      const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);

      // Audit log (only if we didn't just wipe audit_logs)
      if (!doAll && !scopes.includes("audit_logs")) {
        try {
          await db.insert(auditLogsTable).values({
            action: "test_data_cleanup",
            entityType: "system",
            entityId: null,
            userId: (req.user as any)?.id ?? null,
            details: JSON.stringify({ scopes, filters, deleted, totalDeleted }),
            piiMasked: false,
          });
        } catch {
          // non-fatal
        }
      }

      res.json({ success: true, deleted, totalDeleted });
    } catch (err) {
      res.status(500).json({ error: "Silme işlemi başarısız", details: String(err) });
    }
  }
);

export default router;
