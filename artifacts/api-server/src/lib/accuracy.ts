import { db } from "@workspace/db";
import {
  cxAnalysesTable, predictionAccuracyTable, surveyResponsesTable,
  surveysTable,
} from "@workspace/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

/**
 * After a survey response is saved, find the latest cx_analysis for that
 * customer and record the prediction vs actual deviation.
 */
export async function recordPredictionAccuracy(
  responseId: number,
  customerId: number,
  actualScore: number,
): Promise<void> {
  try {
    // Find which type of survey this is (NPS scale 0-10 or CSAT 1-5)
    const [resp] = await db.select({
      surveyId: surveyResponsesTable.surveyId,
    }).from(surveyResponsesTable).where(eq(surveyResponsesTable.id, responseId));

    if (!resp) return;

    // Determine survey type by score range: <=5 likely CSAT, >5 likely NPS
    // We look at the survey definition
    const [survey] = await db.select({ type: surveysTable.type })
      .from(surveysTable).where(eq(surveysTable.id, resp.surveyId)).limit(1);

    const surveyType = survey?.type?.toUpperCase() === "CSAT" ? "csat" : "nps";

    // Find the most recent cx_analysis for this customer
    const [analysis] = await db.select({
      id: cxAnalysesTable.id,
      predictedNps: cxAnalysesTable.predictedNps,
      predictedCsat: cxAnalysesTable.predictedCsat,
    }).from(cxAnalysesTable)
      .where(eq(cxAnalysesTable.customerId, customerId))
      .orderBy(desc(cxAnalysesTable.createdAt))
      .limit(1);

    if (!analysis) return;

    const predictedScore = surveyType === "nps"
      ? analysis.predictedNps
      : analysis.predictedCsat;

    if (predictedScore == null) return;

    const deviation = actualScore - predictedScore;
    const absDeviation = Math.abs(deviation);
    const overPredicted = predictedScore > actualScore;

    await db.insert(predictionAccuracyTable).values({
      customerId,
      analysisId: analysis.id,
      responseId,
      surveyType,
      predictedScore,
      actualScore,
      deviation,
      absDeviation,
      overPredicted,
      usedForLearning: false,
    });

    console.log(
      `accuracy: recorded ${surveyType} deviation for customer ${customerId}: predicted=${predictedScore.toFixed(1)} actual=${actualScore} deviation=${deviation.toFixed(1)}`
    );
  } catch (err) {
    console.error("accuracy: failed to record prediction accuracy:", err);
  }
}

/**
 * Fetch past prediction corrections not yet used for learning.
 * Returns them as few-shot examples for the Gemini prompt.
 */
export async function getLearningCorrections(customerId: number): Promise<string> {
  try {
    const records = await db.select({
      surveyType: predictionAccuracyTable.surveyType,
      predictedScore: predictionAccuracyTable.predictedScore,
      actualScore: predictionAccuracyTable.actualScore,
      deviation: predictionAccuracyTable.deviation,
    }).from(predictionAccuracyTable)
      .where(eq(predictionAccuracyTable.customerId, customerId))
      .orderBy(desc(predictionAccuracyTable.id))
      .limit(5);

    if (!records.length) return "";

    const lines = records.map((r) => {
      const dir = r.deviation > 0 ? "düşük tahmin edilmiş" : "yüksek tahmin edilmiş";
      return `- ${r.surveyType.toUpperCase()} skoru: Tahmin=${r.predictedScore.toFixed(1)}, Gerçek=${r.actualScore.toFixed(1)} → Sapma: ${Math.abs(r.deviation).toFixed(1)} puan ${dir}`;
    });

    return `\nGEÇMİŞ TAHMİN SAPMALARI (öğrenme verisi, bu müşteri için):\n${lines.join("\n")}\nNot: Geçmiş sapmaları dikkate alarak bu sefer daha isabetli bir tahmin yap.\n`;
  } catch {
    return "";
  }
}

/**
 * Mark prediction accuracy records as used for learning.
 */
export async function markLearningUsed(customerId: number): Promise<void> {
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(
      sql`UPDATE prediction_accuracy SET used_for_learning = true
          WHERE customer_id = ${customerId} AND used_for_learning = false`
    );
  } catch (err) {
    console.error("accuracy: markLearningUsed failed:", err);
  }
}
