import { pgTable, serial, integer, real, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const cxAnalysesTable = pgTable("cx_analyses", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  predictedNps: real("predicted_nps"),
  predictedCsat: real("predicted_csat"),
  overallSentiment: text("overall_sentiment", { enum: ["positive", "neutral", "negative"] }).notNull().default("neutral"),
  churnRisk: text("churn_risk", { enum: ["low", "medium", "high"] }).notNull().default("low"),
  painPoints: text("pain_points").array(),
  keyTopics: text("key_topics").array(),
  summary: text("summary"),
  recommendations: text("recommendations"),
  interactionIds: integer("interaction_ids").array(),
  model: text("model").notNull().default("gemini"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertCxAnalysisSchema = createInsertSchema(cxAnalysesTable).omit({ id: true, createdAt: true });
export type InsertCxAnalysis = z.infer<typeof insertCxAnalysisSchema>;
export type CxAnalysis = typeof cxAnalysesTable.$inferSelect;
