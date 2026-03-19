import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, interactionsTable, interactionRecordsTable } from "@workspace/db";
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

// Helper: upsert customer by email
async function upsertCustomer(email: string, name?: string, company?: string) {
  const [existing] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.email, email))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(customersTable)
    .values({
      name: name ?? email.split("@")[0],
      email,
      company: company ?? "",
      segment: "Genel",
      sentiment: "neutral",
      churnRisk: "low",
    })
    .returning();
  return created;
}

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

    // ── Interaction / chat / call events → interactionsTable (simple) ─────
    if (type === "interaction.created" || type === "chat.ended" || type === "call.ended") {
      const { customerEmail, customerName, channel, event, sentiment, score } = data;
      if (customerEmail) {
        const customer = await upsertCustomer(customerEmail, customerName, data.customerCompany);
        const [interaction] = await db
          .insert(interactionsTable)
          .values({
            customerId: customer.id,
            channel: channel ?? "other",
            event: event ?? type,
            sentiment: sentiment ?? "neutral",
            score: score !== undefined ? Number(score) : null,
          })
          .returning();
        result = { ...result, customerId: customer.id, interactionId: interaction.id };
      }
    }

    // ── NPS / CSAT submitted → update customer score + log interaction ────
    else if (type === "nps.submitted" || type === "csat.submitted") {
      const { customerEmail, score, channel } = data;
      if (customerEmail && score !== undefined) {
        const numScore = Number(score);
        const sentiment: "positive" | "neutral" | "negative" =
          numScore >= 7 ? "positive" : numScore >= 4 ? "neutral" : "negative";
        const [existing] = await db
          .select()
          .from(customersTable)
          .where(eq(customersTable.email, customerEmail))
          .limit(1);
        if (existing) {
          await db
            .update(customersTable)
            .set({ npsScore: numScore, sentiment })
            .where(eq(customersTable.id, existing.id));
          await db.insert(interactionsTable).values({
            customerId: existing.id,
            channel: channel ?? "web",
            event: type,
            sentiment,
            score: numScore,
          });
          result = { ...result, customerId: existing.id };
        }
      }
    }

    // ── Support ticket events → interactionRecordsTable (rich) ───────────
    else if (type === "support.ticket.created" || type === "support.ticket.resolved") {
      const { customerEmail, customerName, subject, content, channel, agentName } = data;
      if (customerEmail) {
        const customer = await upsertCustomer(customerEmail, customerName, data.customerCompany);
        const status = type === "support.ticket.resolved" ? "resolved" : "open";
        const [record] = await db
          .insert(interactionRecordsTable)
          .values({
            customerId: customer.id,
            type: "ticket",
            subject: subject ?? `${source ?? "Webhook"} ticket`,
            content: content ?? "",
            status,
            channel: channel ?? "email",
            agentName: agentName ?? null,
            resolution: type === "support.ticket.resolved" ? (data.resolution ?? "Çözüldü") : null,
            interactedAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          })
          .returning();
        result = { ...result, customerId: customer.id, recordId: record.id };
      }
    }

    // ── Customer events ────────────────────────────────────────────────────
    else if (type === "customer.created" || type === "customer.updated") {
      const { customerEmail, customerName, company, segment } = data;
      if (customerEmail) {
        const [existing] = await db
          .select()
          .from(customersTable)
          .where(eq(customersTable.email, customerEmail))
          .limit(1);
        if (type === "customer.updated" && existing) {
          await db.update(customersTable).set({
            ...(customerName ? { name: customerName } : {}),
            ...(company ? { company } : {}),
            ...(segment ? { segment } : {}),
          }).where(eq(customersTable.id, existing.id));
          result = { ...result, customerId: existing.id };
        } else if (type === "customer.created" && !existing) {
          const customer = await upsertCustomer(customerEmail, customerName, company);
          result = { ...result, customerId: customer.id };
        }
      }
    }

    res.json(result);
  } catch (err) {
    console.error("[webhook]", err);
    res.status(500).json({ error: "İşlem sırasında bir hata oluştu." });
  }
});

// GET /api/v1/webhook/event-types — list supported event types
router.get("/event-types", (_req, res) => {
  res.json({ eventTypes: SUPPORTED_EVENT_TYPES });
});

export default router;
