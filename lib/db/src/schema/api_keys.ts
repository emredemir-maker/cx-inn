import { pgTable, serial, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;
