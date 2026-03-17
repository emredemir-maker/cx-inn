import { pgTable, serial, integer, text, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { surveysTable } from "./surveys";
import { usersTable } from "./auth";

export const surveyCampaignsTable = pgTable("survey_campaigns", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveysTable.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "active", "paused", "completed"] }).notNull().default("draft"),
  channel: text("channel", { enum: ["email", "sms", "in-app", "web"] }).notNull().default("email"),
  targetSegment: text("target_segment"),
  totalTargeted: integer("total_targeted").notNull().default(0),
  totalSent: integer("total_sent").notNull().default(0),
  totalCompleted: integer("total_completed").notNull().default(0),
  scheduledAt: timestamp("scheduled_at"),
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
});

export const insertSurveyCampaignSchema = createInsertSchema(surveyCampaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSurveyCampaign = z.infer<typeof insertSurveyCampaignSchema>;
export type SurveyCampaign = typeof surveyCampaignsTable.$inferSelect;
