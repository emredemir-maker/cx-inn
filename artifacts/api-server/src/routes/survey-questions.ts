import { Router } from "express";
import { db } from "@workspace/db";
import { surveyQuestionsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

// GET /api/surveys/:surveyId/questions
router.get("/surveys/:surveyId/questions", async (req, res) => {
  try {
    const surveyId = parseInt(req.params.surveyId);
    const questions = await db
      .select()
      .from(surveyQuestionsTable)
      .where(eq(surveyQuestionsTable.surveyId, surveyId))
      .orderBy(asc(surveyQuestionsTable.orderIndex));
    res.json(questions);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/surveys/:surveyId/questions
router.post("/surveys/:surveyId/questions", async (req, res) => {
  try {
    const surveyId = parseInt(req.params.surveyId);
    const { questionText, questionType, options, isRequired, skipLogic, orderIndex } = req.body;

    const [created] = await db
      .insert(surveyQuestionsTable)
      .values({
        surveyId,
        questionText,
        questionType: questionType || "text",
        options: options || null,
        isRequired: isRequired ?? true,
        skipLogic: skipLogic || null,
        orderIndex: orderIndex ?? 0,
      })
      .returning();

    res.json(created);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// PUT /api/surveys/:surveyId/questions/:id
router.put("/surveys/:surveyId/questions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { questionText, questionType, options, isRequired, skipLogic, orderIndex } = req.body;

    const [updated] = await db
      .update(surveyQuestionsTable)
      .set({
        ...(questionText !== undefined && { questionText }),
        ...(questionType !== undefined && { questionType }),
        ...(options !== undefined && { options }),
        ...(isRequired !== undefined && { isRequired }),
        ...(skipLogic !== undefined && { skipLogic }),
        ...(orderIndex !== undefined && { orderIndex }),
      })
      .where(eq(surveyQuestionsTable.id, id))
      .returning();

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// DELETE /api/surveys/:surveyId/questions/:id
router.delete("/surveys/:surveyId/questions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(surveyQuestionsTable).where(eq(surveyQuestionsTable.id, id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// PATCH /api/surveys/:surveyId/questions/reorder  — bulk order update
router.patch("/surveys/:surveyId/questions/reorder", async (req, res) => {
  try {
    const { order } = req.body as { order: { id: number; orderIndex: number }[] };
    await Promise.all(
      order.map(({ id, orderIndex }) =>
        db.update(surveyQuestionsTable).set({ orderIndex }).where(eq(surveyQuestionsTable.id, id))
      )
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
