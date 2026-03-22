import { pgTable, serial, integer, real, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { surveysTable } from "./surveys";
import { surveyCampaignsTable } from "./survey_campaigns";
import { customersTable } from "./customers";

export const surveyResponsesTable = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveysTable.id),
  campaignId: integer("campaign_id").references(() => surveyCampaignsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  score: real("score").notNull(),
  feedback: text("feedback"),
  sentiment: text("sentiment", { enum: ["positive", "neutral", "negative"] }).notNull().default("neutral"),
  isTest: boolean("is_test").notNull().default(false),
  respondedAt: timestamp("responded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertSurveyResponseSchema = createInsertSchema(surveyResponsesTable).omit({ id: true, createdAt: true });
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;
export type SurveyResponse = typeof surveyResponsesTable.$inferSelect;
