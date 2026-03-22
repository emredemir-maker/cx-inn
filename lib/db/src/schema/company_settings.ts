import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("CX-Inn"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#6366f1"),
  email: text("email"),
  website: text("website"),
  industry: text("industry"),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 3) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id").references(() => tenantsTable.id),
});

export type CompanySettings = typeof companySettingsTable.$inferSelect;
