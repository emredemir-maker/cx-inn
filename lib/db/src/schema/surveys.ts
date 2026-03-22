import { pgTable, serial, text, integer, real, timestamp, jsonb, varchar, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export type ApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected";

export const surveysTable = pgTable("surveys", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type", { enum: ["NPS", "CSAT", "CES", "custom"] }).notNull(),
  status: text("status", { enum: ["draft", "active", "paused", "completed"] }).notNull().default("draft"),
  channel: text("channel", { enum: ["email", "web", "sms", "in-app"] }).notNull(),
  triggerEvent: text("trigger_event"),
  responseCount: integer("response_count").notNull().default(0),
  avgScore: real("avg_score"),
  emailDesign: jsonb("email_design"),
  createdBy: varchar("created_by").references(() => usersTable.id),
  approvalStatus: text("approval_status", {
    enum: ["draft", "pending_approval", "approved", "rejected"],
  })
    .notNull()
    .default("draft"),
  approvedBy: varchar("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at"),
  approvalNote: text("approval_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertSurveySchema = createInsertSchema(surveysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type Survey = typeof surveysTable.$inferSelect;
