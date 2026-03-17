import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { CreateGeminiConversationBody, SendGeminiMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/gemini/conversations", async (_req, res) => {
  try {
    const conversations = await db.select().from(conversationsTable).orderBy(conversationsTable.createdAt);
    res.json(conversations.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/gemini/conversations", async (req, res) => {
  try {
    const body = CreateGeminiConversationBody.parse(req.body);
    const [conversation] = await db.insert(conversationsTable).values({ title: body.title }).returning();
    res.status(201).json({ ...conversation, createdAt: conversation.createdAt.toISOString() });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get("/gemini/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conversation) return res.status(404).json({ error: "Bulunamadı" });

    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
    res.json({
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      messages: messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
    });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.delete("/gemini/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) return res.status(404).json({ error: "Bulunamadı" });
    await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
    res.json(messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = SendGeminiMessageBody.parse(req.body);

    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conversation) return res.status(404).json({ error: "Bulunamadı" });

    await db.insert(messagesTable).values({ conversationId: id, role: "user", content: body.content });

    const allMessages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: allMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user" as "model" | "user",
        parts: [{ text: m.content }],
      })),
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
});

export default router;
