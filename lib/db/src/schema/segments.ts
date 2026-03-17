import { pgTable, serial, text, integer, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const segmentsTable = pgTable("segments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  customerCount: integer("customer_count").notNull().default(0),
  avgNps: real("avg_nps"),
  criteria: text("criteria").notNull(),
  sourceTags: text("source_tags").array(),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSegmentSchema = createInsertSchema(segmentsTable).omit({ id: true, createdAt: true });
export type InsertSegment = z.infer<typeof insertSegmentSchema>;
export type Segment = typeof segmentsTable.$inferSelect;
