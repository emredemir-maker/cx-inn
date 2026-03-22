import { pgTable, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    role: text("role", { enum: ["superadmin", "cx_manager", "cx_user"] }).notNull(),
    permissionKey: text("permission_key").notNull(),
    permissionValue: text("permission_value").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
    tenantId: uuid("tenant_id"),
  },
  (t) => [unique("role_perm_unique").on(t.role, t.permissionKey)],
);

export type RolePermission = typeof rolePermissionsTable.$inferSelect;
