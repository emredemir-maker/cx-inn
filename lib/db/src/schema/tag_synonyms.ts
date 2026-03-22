import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tagSynonymsTable = pgTable("tag_synonyms", {
  id: serial("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  synonyms: text("synonyms").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export type TagSynonym = typeof tagSynonymsTable.$inferSelect;
