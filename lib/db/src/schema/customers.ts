import { pgTable, serial, text, real, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // email alone is no longer globally unique — uniqueness is enforced per-tenant
  // by the composite index customers_tenant_email_unique (see Faz 4 migration)
  email: text("email").notNull(),
  company: text("company"),
  segment: text("segment").notNull().default("Genel"),
  npsScore: real("nps_score"),
  sentiment: text("sentiment", { enum: ["positive", "neutral", "negative"] }).notNull().default("neutral"),
  churnRisk: text("churn_risk", { enum: ["low", "medium", "high"] }).notNull().default("low"),
  lastInteraction: timestamp("last_interaction").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isExcluded: boolean("is_excluded").notNull().default(false),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),   // nullable; NOT NULL + backfill done by runtime migration
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
