import { pgTable, serial, integer, real, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { cxAnalysesTable } from "./cx_analyses";
import { surveyResponsesTable } from "./survey_responses";

export const predictionAccuracyTable = pgTable("prediction_accuracy", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  analysisId: integer("analysis_id").references(() => cxAnalysesTable.id),
  responseId: integer("response_id").references(() => surveyResponsesTable.id),
  surveyType: text("survey_type").notNull(),
  predictedScore: real("predicted_score").notNull(),
  actualScore: real("actual_score").notNull(),
  deviation: real("deviation").notNull(),
  absDeviation: real("abs_deviation").notNull(),
  overPredicted: boolean("over_predicted").notNull(),
  usedForLearning: boolean("used_for_learning").notNull().default(false),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const insertPredictionAccuracySchema = createInsertSchema(predictionAccuracyTable).omit({ id: true, recordedAt: true });
export type InsertPredictionAccuracy = z.infer<typeof insertPredictionAccuracySchema>;
export type PredictionAccuracy = typeof predictionAccuracyTable.$inferSelect;
