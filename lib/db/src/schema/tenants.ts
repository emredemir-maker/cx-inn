import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Tenants — multi-tenant foundation table.
 * Each row represents one isolated organisation (e.g. Infoset, SiblingCo A).
 * This replaces the singleton company_settings pattern.
 *
 * DEFAULT TENANT (Faz-1):
 *   id   = '00000000-0000-4000-8000-000000000001'
 *   slug = 'infoset'
 */
export const tenantsTable = pgTable("tenants", {
  id:           uuid("id").primaryKey().defaultRandom(),
  name:         text("name").notNull(),
  slug:         text("slug").notNull(),           // subdomain key, e.g. "infoset"
  logoUrl:      text("logo_url"),
  primaryColor: text("primary_color").default("#6366f1"),
  industry:     text("industry"),
  description:  text("description"),
  email:        text("email"),
  website:      text("website"),
  plan: text("plan", {
    enum: ["standard", "professional", "enterprise"],
  }).notNull().default("standard"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant        = typeof tenantsTable.$inferSelect;
export type InsertTenant  = typeof tenantsTable.$inferInsert;
