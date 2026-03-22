import { pgTable, serial, text, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./auth";

/**
 * Tenant Memberships — maps users to tenants with per-tenant roles.
 *
 * Role mapping from the legacy flat role system:
 *   superadmin  → tenant_admin   (within their default tenant)
 *   cx_manager  → cx_manager
 *   cx_user     → cx_user
 *
 * A user can belong to multiple tenants with different roles.
 * The global users.role column is kept for platform_admin detection.
 */
export type TenantRole = "tenant_admin" | "cx_manager" | "cx_user";

export const tenantMembershipsTable = pgTable(
  "tenant_memberships",
  {
    id: serial("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["tenant_admin", "cx_manager", "cx_user"],
    })
      .notNull()
      .default("cx_user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("tenant_user_unique").on(t.tenantId, t.userId)],
);

export type TenantMembership       = typeof tenantMembershipsTable.$inferSelect;
export type InsertTenantMembership = typeof tenantMembershipsTable.$inferInsert;
