import { pgTable, serial, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const interactionsTable = pgTable("interactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  channel: text("channel").notNull(),
  event: text("event").notNull(),
  sentiment: text("sentiment", { enum: ["positive", "neutral", "negative"] }).notNull().default("neutral"),
  score: real("score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInteractionSchema = createInsertSchema(interactionsTable).omit({ id: true, createdAt: true });
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = typeof interactionsTable.$inferSelect;
