import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { triggersTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTriggerBody, UpdateTriggerParams, UpdateTriggerBody, DeleteTriggerParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/triggers", async (_req, res) => {
  try {
    const triggers = await db.select().from(triggersTable).orderBy(triggersTable.createdAt);
    res.json(triggers.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/triggers", async (req, res) => {
  try {
    const body = CreateTriggerBody.parse(req.body);
    const [trigger] = await db.insert(triggersTable).values({
      name: body.name,
      event: body.event,
      channel: body.channel,
      delayMinutes: body.delayMinutes,
      surveyId: body.surveyId,
    }).returning();

    await db.insert(auditLogsTable).values({
      action: "CREATE",
      entityType: "trigger",
      entityId: trigger.id,
      userId: "system",
      details: `Tetikleyici oluşturuldu: ${body.name}`,
      piiMasked: false,
    });

    res.status(201).json({ ...trigger, createdAt: trigger.createdAt.toISOString() });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.patch("/triggers/:id", async (req, res) => {
  try {
    const { id } = UpdateTriggerParams.parse({ id: Number(req.params.id) });
    const body = UpdateTriggerBody.parse(req.body);
    const [trigger] = await db.update(triggersTable)
      .set(body)
      .where(eq(triggersTable.id, id))
      .returning();

    if (!trigger) return res.status(404).json({ error: "Bulunamadı" });

    res.json({ ...trigger, createdAt: trigger.createdAt.toISOString() });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.delete("/triggers/:id", async (req, res) => {
  try {
    const { id } = DeleteTriggerParams.parse({ id: Number(req.params.id) });
    await db.delete(triggersTable).where(eq(triggersTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
