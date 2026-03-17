import { pgTable, serial, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const invitationsTable = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  role: text("role", { enum: ["superadmin", "cx_manager", "cx_user"] })
    .notNull()
    .default("cx_user"),
  invitedBy: varchar("invited_by").references(() => usersTable.id),
  accepted: boolean("accepted").notNull().default(false),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Invitation = typeof invitationsTable.$inferSelect;
export type InsertInvitation = typeof invitationsTable.$inferInsert;
