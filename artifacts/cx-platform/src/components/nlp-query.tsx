import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, X, Send, Loader2, ChevronRight,
  TrendingDown, AlertTriangle, Users, BarChart2,
  MessageSquare, Lightbulb, FileText, Zap, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  fromCache?: boolean;
}

// ── Example questions ─────────────────────────────────────────────────────────

const EXAMPLES = [
  { icon: TrendingDown,  text: "NPS riski hangi konularda yoğunlaşıyor?" },
  { icon: AlertTriangle, text: "Churn riski yüksek müşteriler kimler ve neden?" },
  { icon: Users,         text: "Segmentlere göre müşteri dağılımı nasıl?" },
  { icon: BarChart2,     text: "Hangi kanal en düşük memnuniyeti üretiyor?" },
  { icon: MessageSquare, text: "Bu ay en fazla hangi konularda şikayet aldık?" },
  { icon: Lightbulb,     text: "Hangi acı noktaları en çok müşteriyi etkiliyor?" },
];

// ── Markdown-lite renderer ────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    const isBullet = /^[-*•▸🔸]/.test(trimmed) || /^\d+\./.test(trimmed);
    const content = isBullet ? trimmed.replace(/^[-*•▸🔸\d.]+\s*/, "") : trimmed;

    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={j}>{part.slice(2, -2)}</strong>
        : part,
    );

    if (!trimmed) return <div key={i} className="h-2" />;

    if (trimmed.startsWith("##")) {
      return (
        <p key={i} className="font-bold text-foreground mt-2">
          {trimmed.replace(/^#+\s*/, "")}
        </p>
      );
    }

    if (isBullet) {
      return (
        <div key={i} className="flex items-start gap-2 py-0.5">
          <span className="text-teal-400 mt-0.5 flex-shrink-0 text-xs">▸</span>
          <span>{parts}</span>
        </div>
      );
    }

    return <p key={i} className="py-0.5">{parts}</p>;
  });
}

// ── PDF export (Blob URL — no document.write) ─────────────────────────────────

function exportToPDF(messages: ChatMessage[]) {
  const rows = messages
    .map((m) => {
      const label = m.role === "user" ? "👤 Soru" : "🤖 CX AI Yanıtı";
      const cls   = m.role === "user" ? "user-msg" : "ai-msg";
      const cache = m.fromCache
        ? "<span class=\"cache-badge\">⚡ Önbellekten</span>"
        : "";
      const body = m.content
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/^[-*•▸🔸]\s+/gm, "• ")
        .replace(/\n/g, "<br/>");
      return `<div class="msg ${cls}"><div class="msg-label">${label}${cache}</div><div class="msg-body">${body}</div></div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="UTF-8"/>
<title>CX AI Raporu – ${new Date().toLocaleDateString("tr-TR")}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;
       max-width:820px;margin:40px auto;padding:0 24px}
  h1{color:#4f46e5;font-size:22px;border-bottom:2px solid #4f46e5;
     padding-bottom:10px;margin-bottom:6px}
  .meta{font-size:11px;color:#64748b;margin-bottom:28px}
  .msg{margin-bottom:18px;page-break-inside:avoid}
  .msg-label{font-size:10px;font-weight:700;text-transform:uppercase;
             letter-spacing:.08em;color:#64748b;margin-bottom:6px}
  .user-msg .msg-body{background:#f1f5f9;border-radius:8px;padding:12px 16px}
  .ai-msg   .msg-body{border-left:3px solid #4f46e5;padding:10px 16px;
                      background:#fafbff;border-radius:0 8px 8px 0}
  .cache-badge{display:inline-block;margin-left:8px;font-size:9px;
               background:#fef3c7;color:#92400e;border-radius:4px;
               padding:1px 6px;font-weight:600}
  @media print{body{margin:20px}}
</style></head>
<body>
<h1>CX AI Sorgu Raporu</h1>
<div class="meta">Oluşturulma: ${new Date().toLocaleString("tr-TR")} | ${messages.length} mesaj</div>
${rows}
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) win.addEventListener("load", () => { win.print(); URL.revokeObjectURL(url); });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NlpQueryPanel() {
  const [open, setOpen]           = useState(false);
  const [question, setQuestion]   = useState("");
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [cacheFlag, setCacheFlag] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [convId, setConvId]       = useState<number | null>(null);
  const [starting, setStarting]   = useState(false);

  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // ── Create conversation ───────────────────────────────────────────────────

  const startConversation = useCallback(async (): Promise<number | null> => {
    setStarting(true);
    try {
      const res = await fetch("/api/nlp/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { conversationId: number } = await res.json();
      setConvId(data.conversationId);
      return data.conversationId;
    } catch {
      setError("Konuşma başlatılamadı. Lütfen tekrar deneyin.");
      return null;
    } finally {
      setStarting(false);
    }
  }, []);

  // ── Send message via SSE ──────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (q?: string) => {
      const text = (q ?? question).trim();
      if (!text || loading || starting) return;

      setQuestion("");
      setError(null);
      setLoading(true);
      setStreaming("");
      setCacheFlag(false);

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "user", content: text },
      ]);

      let activeConvId = convId;
      if (!activeConvId) {
        activeConvId = await startConversation();
        if (!activeConvId) { setLoading(false); return; }
      }

      abortRef.current = new AbortController();

      try {
        const res = await fetch(
          `/api/nlp/conversation/${activeConvId}/message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ question: text }),
            signal: abortRef.current.signal,
          },
        );

        if (!res.ok) throw new Error(await res.text());
        if (!res.body) throw new Error("Yanıt akışı alınamadı.");

        const reader   = res.body.getReader();
        const decoder  = new TextDecoder();
        let   buffer   = "";
        let   full     = "";
        let   isCached = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.content) {
                full += data.content;
                if (data.fromCache) isCached = true;
                setStreaming(full);
              }
              if (data.done) isCached = data.fromCache ?? false;
            } catch (pe) {
              if ((pe as Error).message !== "Unexpected end of JSON input") throw pe;
            }
          }
        }

        setCacheFlag(isCached);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", content: full, fromCache: isCached },
        ]);
        setStreaming("");
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError("Sorgu işlenirken hata oluştu. Lütfen tekrar deneyin.");
        }
      } finally {
        setLoading(false);
      }
    },
    [question, loading, starting, convId, startConversation],
  );

  // ── Clear ─────────────────────────────────────────────────────────────────

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming("");
    setConvId(null);
    setError(null);
    setQuestion("");
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  const hasMessages = messages.length > 0 || !!streaming;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl",
          "bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500 text-white font-semibold text-sm",
          "shadow-[0_8px_32px_rgba(20,184,166,0.35)] hover:shadow-[0_8px_40px_rgba(20,184,166,0.55)]",
          "transition-all duration-200 hover:scale-105 active:scale-95",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <Sparkles className="h-4 w-4" />
        Cx-Ai
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full z-50 flex flex-col w-full max-w-[540px]",
          "bg-[#0f172a] border-l border-border/50 shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 via-teal-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Cx-Ai Asistanı</p>
              <p className="text-[10px] text-muted-foreground">
                {convId
                  ? `Konuşma #${convId} · Bağlamı hatırlıyor`
                  : "Verilerinizi doğal dilde sorgulayın"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {hasMessages && (
              <button
                onClick={() => exportToPDF(messages)}
                title="PDF olarak indir"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-teal-400 hover:bg-teal-500/10 transition-colors"
              >
                <FileText className="h-4 w-4" />
              </button>
            )}
            {hasMessages && (
              <button
                onClick={handleClear}
                title="Konuşmayı temizle"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversation area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Empty state */}
          {!hasMessages && !starting && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Örnek Sorular
              </p>
              <div className="space-y-1.5">
                {EXAMPLES.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => handleSubmit(text)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-foreground/80 hover:text-foreground border border-border/40 hover:border-teal-500/40 hover:bg-teal-500/5 transition-all group"
                  >
                    <Icon className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
                    <span className="flex-1">{text}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center mt-4">
                Kendi sorunuzu da yazabilirsiniz · Bağlam konuşma boyunca korunur
              </p>
            </div>
          )}

          {/* Starting indicator */}
          {starting && (
            <div className="flex items-center gap-2 text-xs text-indigo-300 px-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Veriler yükleniyor, konuşma başlatılıyor…
            </div>
          )}

          {/* Message history */}
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600/80 text-white text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    CX AI
                  </span>
                  {msg.fromCache && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                      <Zap className="h-2.5 w-2.5" />
                      Önbellekten
                    </span>
                  )}
                </div>
                <div className="ml-7 rounded-2xl rounded-tl-sm border border-border/40 bg-white/[0.03] px-4 py-3 text-sm text-foreground/90 leading-relaxed">
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            ),
          )}

          {/* Live streaming message */}
          {streaming && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-1">
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Sparkles className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  CX AI
                </span>
                {cacheFlag && (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    <Zap className="h-2.5 w-2.5" />
                    Önbellekten
                  </span>
                )}
              </div>
              <div className="ml-7 rounded-2xl rounded-tl-sm border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 text-sm text-foreground/90 leading-relaxed">
                {renderMarkdown(streaming)}
                <span className="inline-block w-1.5 h-3.5 bg-indigo-400 rounded-sm ml-0.5 animate-pulse" />
              </div>
            </div>
          )}

          {/* Loading dot (waiting for first chunk) */}
          {loading && !streaming && (
            <div className="flex justify-start ml-7">
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm border border-indigo-500/30 bg-indigo-500/5 flex items-center gap-2.5">
                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                <span className="text-sm text-indigo-300">Analiz ediliyor…</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Quick re-ask chips */}
        {hasMessages && !loading && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
            {EXAMPLES.slice(0, 3).map(({ text }) => (
              <button
                key={text}
                onClick={() => handleSubmit(text)}
                disabled={loading}
                className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-indigo-500/40 transition-colors disabled:opacity-40"
              >
                {text.length > 32 ? text.slice(0, 32) + "…" : text}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="px-4 py-3 border-t border-border/50 flex-shrink-0">
          <div className="flex items-end gap-2 bg-white/[0.04] border border-border/50 rounded-2xl px-4 py-2 focus-within:border-indigo-500/50 transition-colors">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Verileriniz hakkında bir soru sorun..."
              rows={2}
              disabled={loading || starting}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed disabled:opacity-50"
              style={{ maxHeight: 120, minHeight: 44 }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!question.trim() || loading || starting}
              className={cn(
                "flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all",
                question.trim() && !loading && !starting
                  ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:scale-105 active:scale-95"
                  : "bg-white/5 text-muted-foreground/40 cursor-not-allowed",
              )}
            >
              {loading || starting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            Enter · gönder &nbsp;·&nbsp; Shift+Enter · yeni satır &nbsp;·&nbsp; Bağlam konuşma boyunca korunur
          </p>
        </div>
      </div>
    </>
  );
}
