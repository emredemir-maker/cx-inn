import { pgTable, serial, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const triggersTable = pgTable("triggers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  event: text("event", {
    enum: ["purchase", "ticket_close", "onboarding_abandon", "payment_confusion", "rage_click", "cancellation_intent", "survey_complete"]
  }).notNull(),
  channel: text("channel", { enum: ["email", "web", "sms", "in-app"] }).notNull(),
  delayMinutes: integer("delay_minutes").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  surveyId: integer("survey_id"),
  firedCount: integer("fired_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertTriggerSchema = createInsertSchema(triggersTable).omit({ id: true, createdAt: true });
export type InsertTrigger = z.infer<typeof insertTriggerSchema>;
export type Trigger = typeof triggersTable.$inferSelect;
