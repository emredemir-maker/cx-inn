import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, interactionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const SUPPORTED_EVENT_TYPES = [
  "customer.created",
  "customer.updated",
  "interaction.created",
  "survey.completed",
  "nps.submitted",
  "csat.submitted",
  "support.ticket.created",
  "support.ticket.resolved",
  "chat.ended",
  "call.ended",
];

// POST /api/v1/webhook/events — generic webhook receiver
router.post("/events", async (req, res) => {
  const { type, data, source } = req.body as {
    type: string;
    data: Record<string, any>;
    source?: string;
  };

  if (!type || !data) {
    return res.status(400).json({ error: "'type' ve 'data' alanları zorunlu." });
  }

  try {
    let result: Record<string, any> = { received: true, type };

    if (type === "interaction.created" || type === "chat.ended" || type === "call.ended") {
      const { customerEmail, customerName, channel, event, sentiment, score } = data;
      if (customerEmail) {
        const [existing] = await db.select().from(customersTable).where(eq(customersTable.email, customerEmail)).limit(1);
        const customer = existing ?? (await db.insert(customersTable).values({
          name: customerName ?? customerEmail.split("@")[0],
          email: customerEmail,
          company: data.customerCompany ?? "",
          segment: "Genel",
          sentiment: "neutral",
          churnRisk: "low",
        }).returning())[0];

        const [interaction] = await db.insert(interactionsTable).values({
          customerId: customer.id,
          channel: channel ?? "other",
          event: event ?? type,
          sentiment: sentiment ?? "neutral",
          score: score ?? null,
        }).returning();
        result = { ...result, customerId: customer.id, interactionId: interaction.id };
      }
    } else if (type === "nps.submitted" || type === "csat.submitted") {
      const { customerEmail, score, channel } = data;
      if (customerEmail && score !== undefined) {
        const [existing] = await db.select().from(customersTable).where(eq(customersTable.email, customerEmail)).limit(1);
        if (existing) {
          await db.update(customersTable).set({ npsScore: Number(score) }).where(eq(customersTable.id, existing.id));
          await db.insert(interactionsTable).values({
            customerId: existing.id,
            channel: channel ?? "web",
            event: type,
            sentiment: score >= 7 ? "positive" : score >= 4 ? "neutral" : "negative",
            score: Number(score),
          });
          result = { ...result, customerId: existing.id };
        }
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/v1/webhook/event-types — list supported event types
router.get("/event-types", (_req, res) => {
  res.json({ eventTypes: SUPPORTED_EVENT_TYPES });
});

export default router;
