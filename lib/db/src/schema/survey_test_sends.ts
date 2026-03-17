import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { surveysTable } from "./surveys";

export const surveyTestSendsTable = pgTable("survey_test_sends", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull().references(() => surveysTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ["sent", "viewed", "completed"] }).notNull().default("sent"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  viewedAt: timestamp("viewed_at"),
  completedAt: timestamp("completed_at"),
  score: text("score"),
  feedback: text("feedback"),
});

export const insertSurveyTestSendSchema = createInsertSchema(surveyTestSendsTable).omit({ id: true });
export type InsertSurveyTestSend = z.infer<typeof insertSurveyTestSendSchema>;
export type SurveyTestSend = typeof surveyTestSendsTable.$inferSelect;
