import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { surveysTable } from "./surveys";

export const surveyQuestionsTable = pgTable("survey_questions", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveysTable.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  questionText: text("question_text").notNull(),
  questionType: text("question_type", {
    enum: ["nps", "csat", "ces", "text", "rating", "multiple_choice", "boolean"],
  }).notNull().default("text"),
  options: jsonb("options").$type<string[]>(),
  isRequired: boolean("is_required").notNull().default(true),
  skipLogic: jsonb("skip_logic").$type<SkipRule[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SkipRule = {
  condition: "less_than" | "greater_than" | "equals" | "not_equals" | "contains";
  value: string | number;
  goto: number | "end" | "next";
};

export const insertSurveyQuestionSchema = createInsertSchema(surveyQuestionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSurveyQuestion = z.infer<typeof insertSurveyQuestionSchema>;
export type SurveyQuestion = typeof surveyQuestionsTable.$inferSelect;
