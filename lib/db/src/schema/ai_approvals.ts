import { pgTable, serial, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiApprovalsTable = pgTable("ai_approvals", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id"),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  channel: text("channel").notNull(),
  toneUsed: text("tone_used", { enum: ["formal", "empathetic", "friendly"] }).notNull(),
  originalText: text("original_text").notNull(),
  personalizedText: text("personalized_text").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertAiApprovalSchema = createInsertSchema(aiApprovalsTable).omit({ id: true, createdAt: true });
export type InsertAiApproval = z.infer<typeof insertAiApprovalSchema>;
export type AiApproval = typeof aiApprovalsTable.$inferSelect;
