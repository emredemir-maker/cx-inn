import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles, X, Send, Loader2, ChevronRight, Lightbulb,
  BarChart2, Users, AlertTriangle, TrendingDown, MessageSquare,
  Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLE_QUESTIONS = [
  { icon: TrendingDown, text: "NPS riski hangi konularda yoğunlaşıyor?" },
  { icon: AlertTriangle, text: "Churn riski yüksek müşteriler kimler ve neden?" },
  { icon: Users, text: "Genel segmentindeki müşterilerin durumu nedir?" },
  { icon: BarChart2, text: "Hangi kanal en düşük memnuniyeti üretiyor?" },
  { icon: MessageSquare, text: "Bu ay en fazla hangi konularda şikayet aldık?" },
  { icon: Lightbulb, text: "Hangi acı noktaları en çok müşteriyi etkiliyor?" },
];

type QueryResult = {
  question: string;
  answer: string;
  highlights: string[];
  type: "text" | "table" | "list";
  tableData: Record<string, string>[];
  listData: string[];
};

type HistoryItem = QueryResult & { id: number };

export function NlpQueryPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  async function handleSubmit(q?: string) {
    const text = (q ?? question).trim();
    if (!text || loading) return;
    setQuestion("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/nlp/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: QueryResult = await res.json();
      setHistory(prev => [...prev, { ...data, id: Date.now() }]);
    } catch (e) {
      setError("Sorgu işlenirken hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function copyAnswer(item: HistoryItem) {
    navigator.clipboard.writeText(item.answer);
    setCopied(item.id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl",
          "bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm",
          "shadow-[0_8px_32px_rgba(99,102,241,0.45)] hover:shadow-[0_8px_40px_rgba(99,102,241,0.65)]",
          "transition-all duration-200 hover:scale-105 active:scale-95",
          open && "opacity-0 pointer-events-none"
        )}
      >
        <Sparkles className="h-4 w-4" />
        AI Sorgu
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div className={cn(
        "fixed right-0 top-0 h-full z-50 flex flex-col w-full max-w-[520px]",
        "bg-[#0f172a] border-l border-border/50 shadow-2xl",
        "transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">CX AI Asistanı</p>
              <p className="text-[10px] text-muted-foreground">Verilerinizi doğal dilde sorgulayın</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Empty state with examples */}
          {history.length === 0 && !loading && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Örnek Sorular
              </p>
              <div className="space-y-1.5">
                {EXAMPLE_QUESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => handleSubmit(text)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-foreground/80 hover:text-foreground border border-border/40 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group"
                  >
                    <Icon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="flex-1">{text}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {history.map((item) => (
            <div key={item.id} className="space-y-3">
              {/* User question bubble */}
              <div className="flex justify-end">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600/80 text-white text-sm">
                  {item.question}
                </div>
              </div>

              {/* AI answer */}
              <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-white/[0.03] overflow-hidden">

                {/* Summary line */}
                <div className="px-4 pt-4 pb-2.5">
                  <p className="text-sm text-foreground/90 leading-snug font-medium">{item.answer}</p>
                </div>

                {/* Highlights — stat pills */}
                {item.highlights.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {item.highlights.map((h, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200/90 font-medium">
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                {/* List data — main bullet content */}
                {item.listData.length > 0 && (
                  <div className="px-4 pb-3 space-y-1.5 border-t border-border/30 pt-3">
                    {item.listData.map((d, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/80 leading-snug">
                        <span className="text-indigo-400/70 mt-px flex-shrink-0">▸</span>
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Table data */}
                {item.type === "table" && item.tableData.length > 0 && (
                  <div className="px-4 pb-4 overflow-x-auto border-t border-border/30 pt-3">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          {Object.keys(item.tableData[0]).map(col => (
                            <th key={col} className="text-left py-1.5 px-2 border-b border-border/40 text-muted-foreground font-semibold">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {item.tableData.map((row, i) => (
                          <tr key={i} className={cn("border-b border-border/20", i % 2 === 0 && "bg-white/[0.02]")}>
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="py-1.5 px-2 text-foreground/80">{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Copy button */}
                <div className="flex justify-end px-3 pb-2">
                  <button
                    onClick={() => copyAnswer(item)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    {copied === item.id ? (
                      <><Check className="h-3 w-3 text-green-400" /> Kopyalandı</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Kopyala</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Loading state */}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm border border-indigo-500/30 bg-indigo-500/5 flex items-center gap-2.5">
                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                <span className="text-sm text-indigo-300">Veriler analiz ediliyor...</span>
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

        {/* Quick example chips (when has history) */}
        {history.length > 0 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
            {EXAMPLE_QUESTIONS.slice(0, 3).map(({ text }) => (
              <button
                key={text}
                onClick={() => handleSubmit(text)}
                disabled={loading}
                className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-indigo-500/40 transition-colors disabled:opacity-40"
              >
                {text.slice(0, 30)}...
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/50 flex-shrink-0">
          <div className="flex items-end gap-2 bg-white/[0.04] border border-border/50 rounded-2xl px-4 py-2 focus-within:border-indigo-500/50 transition-colors">
            <textarea
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Verileriniz hakkında bir soru sorun..."
              rows={2}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed"
              style={{ maxHeight: 120, minHeight: 44 }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!question.trim() || loading}
              className={cn(
                "flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all",
                question.trim() && !loading
                  ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:scale-105 active:scale-95"
                  : "bg-white/5 text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            Enter ile gönder · Shift+Enter yeni satır
          </p>
        </div>
      </div>
    </>
  );
}
