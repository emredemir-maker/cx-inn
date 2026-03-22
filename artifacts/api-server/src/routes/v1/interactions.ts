import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, interactionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const VALID_CHANNELS = ["email", "chat", "call", "web", "mobile", "social", "sms", "other"] as const;
const VALID_SENTIMENTS = ["positive", "neutral", "negative"] as const;

function validateInteraction(data: any): { ok: true; value: any } | { ok: false; error: string } {
  if (!data.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
    return { ok: false, error: "Geçerli bir 'customerEmail' gerekli." };
  }
  if (!data.channel || !VALID_CHANNELS.includes(data.channel)) {
    return { ok: false, error: `'channel' şunlardan biri olmalı: ${VALID_CHANNELS.join(", ")}` };
  }
  if (!data.event || typeof data.event !== "string") {
    return { ok: false, error: "'event' alanı zorunlu." };
  }
  const sentiment = VALID_SENTIMENTS.includes(data.sentiment) ? data.sentiment : "neutral";
  const score = data.score !== undefined ? Number(data.score) : undefined;
  return {
    ok: true,
    value: {
      customerEmail: data.customerEmail as string,
      customerName: data.customerName as string | undefined,
      customerCompany: data.customerCompany as string | undefined,
      channel: data.channel as string,
      event: data.event as string,
      sentiment,
      score: score !== undefined && !isNaN(score) ? Math.max(0, Math.min(10, score)) : undefined,
    },
  };
}

async function upsertCustomer(tenantId: string, email: string, name?: string, company?: string) {
  // Look up by (tenant_id, email) so each tenant has isolated customer records
  const [existing] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.email, email)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(customersTable).values({
    name: name ?? email.split("@")[0],
    email,
    company: company ?? "",
    segment: "Genel",
    sentiment: "neutral",
    churnRisk: "low",
    tenantId,
  }).returning();
  return created;
}

async function insertInteraction(tenantId: string, customerId: number, data: ReturnType<typeof validateInteraction> extends { value: infer V } ? V : never) {
  const [interaction] = await db.insert(interactionsTable).values({
    customerId,
    channel: data.channel,
    event: data.event,
    sentiment: data.sentiment ?? "neutral",
    score: data.score ?? null,
    tenantId,
  }).returning();
  return interaction;
}

// POST /api/v1/interactions — single interaction
router.post("/", async (req, res) => {
  const tenantId = (req as any).tenantId as string | undefined;
  if (!tenantId) {
    return res.status(401).json({ error: "API anahtarı bir tenant ile ilişkilendirilmemiş." });
  }
  const validated = validateInteraction(req.body);
  if (!validated.ok) {
    return res.status(400).json({ error: "Geçersiz veri.", details: validated.error });
  }
  try {
    const customer = await upsertCustomer(tenantId, validated.value.customerEmail, validated.value.customerName, validated.value.customerCompany);
    const interaction = await insertInteraction(tenantId, customer.id, validated.value);
    res.status(201).json({ ok: true, customerId: customer.id, interactionId: interaction.id });
  } catch (err) {
    console.error("[v1/interactions POST]", err);
    res.status(500).json({ error: "Kayıt oluşturulurken bir hata oluştu." });
  }
});

// POST /api/v1/interactions/batch — up to 500 interactions
router.post("/batch", async (req, res) => {
  const tenantId = (req as any).tenantId as string | undefined;
  if (!tenantId) {
    return res.status(401).json({ error: "API anahtarı bir tenant ile ilişkilendirilmemiş." });
  }
  const items = req.body?.interactions;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "'interactions' dizisi zorunlu." });
  }
  if (items.length > 500) {
    return res.status(400).json({ error: "Toplu istek maksimum 500 kayıt içerebilir." });
  }

  const results: { index: number; ok: boolean; customerId?: number; interactionId?: number; error?: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const validated = validateInteraction(items[i]);
    if (!validated.ok) {
      results.push({ index: i, ok: false, error: validated.error });
      continue;
    }
    try {
      const customer = await upsertCustomer(tenantId, validated.value.customerEmail, validated.value.customerName, validated.value.customerCompany);
      const interaction = await insertInteraction(tenantId, customer.id, validated.value);
      results.push({ index: i, ok: true, customerId: customer.id, interactionId: interaction.id });
    } catch (err) {
      console.error(`[v1/interactions batch] index ${i}:`, err);
      results.push({ index: i, ok: false, error: "Kayıt oluşturulurken bir hata oluştu." });
    }
  }
  const successCount = results.filter((r) => r.ok).length;
  res.status(207).json({ total: items.length, success: successCount, failed: items.length - successCount, results });
});

export default router;
