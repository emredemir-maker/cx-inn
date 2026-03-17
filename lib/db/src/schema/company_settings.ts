import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
});

export type CompanySettings = typeof companySettingsTable.$inferSelect;
