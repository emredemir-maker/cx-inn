import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const tagSynonymsTable = pgTable("tag_synonyms", {
  id: serial("id").primaryKey(),
  canonicalName: text("canonical_name").notNull().unique(),
  synonyms: text("synonyms").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TagSynonym = typeof tagSynonymsTable.$inferSelect;
