import { pgTable, serial, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  userId: text("user_id").notNull(),
  details: text("details").notNull(),
  piiMasked: boolean("pii_masked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
