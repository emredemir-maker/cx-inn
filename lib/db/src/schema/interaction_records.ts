import { pgTable, serial, text, integer, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const interactionRecordsTable = pgTable("interaction_records", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  type: text("type", { enum: ["ticket", "chat", "call"] }).notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["open", "resolved", "escalated", "closed"] }).notNull().default("open"),
  channel: text("channel").notNull().default("email"),
  agentName: text("agent_name"),
  durationSeconds: integer("duration_seconds"),
  resolution: text("resolution"),
  tags: text("tags").array(),
  analysisRequested: boolean("analysis_requested").notNull().default(false),
  // Relevance classification
  isCustomerRequest: boolean("is_customer_request"),
  relevanceReason: text("relevance_reason"),
  excludedFromAnalysis: boolean("excluded_from_analysis").notNull().default(false),
  exclusionReason: text("exclusion_reason"),
  interactedAt: timestamp("interacted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertInteractionRecordSchema = createInsertSchema(interactionRecordsTable).omit({ id: true, createdAt: true });
export type InsertInteractionRecord = z.infer<typeof insertInteractionRecordSchema>;
export type InteractionRecord = typeof interactionRecordsTable.$inferSelect;
