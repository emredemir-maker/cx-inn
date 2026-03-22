import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const excludedDomainsTable = pgTable("excluded_domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(), // e.g. "infoset.app", "noreply.com"
  reason: text("reason"),                    // human-readable explanation
  source: text("source", { enum: ["manual", "auto"] }).notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertExcludedDomainSchema = createInsertSchema(excludedDomainsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertExcludedDomain = z.infer<typeof insertExcludedDomainSchema>;
export type ExcludedDomain = typeof excludedDomainsTable.$inferSelect;
