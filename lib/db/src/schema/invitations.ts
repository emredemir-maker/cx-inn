import { pgTable, serial, text, varchar, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const invitationsTable = pgTable("invitations", {
  id: serial("id").primaryKey(),
  // email uniqueness is now per (email, tenantId) — see Faz 5 migration in app.ts
  email: varchar("email").notNull(),
  role: text("role", { enum: ["superadmin", "tenant_admin", "cx_manager", "cx_user"] })
    .notNull()
    .default("cx_user"),
  invitedBy: varchar("invited_by").references(() => usersTable.id),
  accepted: boolean("accepted").notNull().default(false),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── multi-tenancy (Faz 1) ─────────────────────────────────────────────────
  tenantId: uuid("tenant_id"),
});

export type Invitation = typeof invitationsTable.$inferSelect;
export type InsertInvitation = typeof invitationsTable.$inferInsert;
