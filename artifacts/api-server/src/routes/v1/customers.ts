import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, interactionsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { maskCustomer } from "../../utils/pii-mask";

const router = Router();

// GET /api/v1/customers — list customers (PII masked by default)
router.get("/", async (req, res) => {
  const tenantId = (req as any).tenantId as string | undefined;
  if (!tenantId) {
    return res.status(401).json({ error: "API anahtarı bir tenant ile ilişkilendirilmemiş." });
  }
  const masked = req.query.masked !== "false";
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  try {
    const customers = await db.select().from(customersTable)
      .where(eq(customersTable.tenantId, tenantId))
      .orderBy(desc(customersTable.createdAt))
      .limit(limit).offset(offset);
    const result = masked ? customers.map((c) => maskCustomer(c)) : customers;
    res.json({ total: customers.length, customers: result, masked });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/v1/customers/lookup?email=... — lookup by email (tenant-scoped)
router.get("/lookup", async (req, res) => {
  const tenantId = (req as any).tenantId as string | undefined;
  if (!tenantId) {
    return res.status(401).json({ error: "API anahtarı bir tenant ile ilişkilendirilmemiş." });
  }
  const { email } = req.query as { email: string };
  if (!email) return res.status(400).json({ error: "'email' sorgu parametresi zorunlu." });
  try {
    const [customer] = await db.select().from(customersTable)
      .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.email, email)))
      .limit(1);
    if (!customer) return res.status(404).json({ error: "Müşteri bulunamadı." });
    const interactions = await db.select().from(interactionsTable)
      .where(and(eq(interactionsTable.tenantId, tenantId), eq(interactionsTable.customerId, customer.id)))
      .orderBy(desc(interactionsTable.createdAt))
      .limit(20);
    res.json({ customer: maskCustomer(customer), interactions });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
