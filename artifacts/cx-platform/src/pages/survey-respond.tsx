import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, Loader2, Star, AlertCircle, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SkipRule = {
  condition: "less_than" | "greater_than" | "equals" | "not_equals" | "contains";
  value: string | number;
  goto: number | "end" | "next";
};

type Question = {
  id: number;
  surveyId: number;
  orderIndex: number;
  questionText: string;
  questionType: "nps" | "csat" | "ces" | "text" | "rating" | "multiple_choice" | "boolean";
  options: string[] | null;
  isRequired: boolean;
  skipLogic: SkipRule[] | null;
};

type SurveyInfo = {
  id: number;
  title: string;
  type: "NPS" | "CSAT" | "CES" | "custom";
  emailDesign?: any;
};

type TokenData = {
  alreadyCompleted: boolean;
  survey: SurveyInfo | null;
  testSendId: number;
  email: string;
};

// ─── Skip Logic Evaluator ────────────────────────────────────────────────────

function evaluateSkipLogic(rules: SkipRule[] | null, answer: any): SkipRule["goto"] | null {
  if (!rules || rules.length === 0) return null;
  const numAnswer = typeof answer === "number" ? answer : parseFloat(answer);
  for (const rule of rules) {
    const numVal = typeof rule.value === "number" ? rule.value : parseFloat(String(rule.value));
    let match = false;
    switch (rule.condition) {
      case "less_than":    match = numAnswer < numVal; break;
      case "greater_than": match = numAnswer > numVal; break;
      case "equals":       match = String(answer) === String(rule.value); break;
      case "not_equals":   match = String(answer) !== String(rule.value); break;
      case "contains":     match = String(answer).toLowerCase().includes(String(rule.value).toLowerCase()); break;
    }
    if (match) return rule.goto;
  }
  return null;
}

// ─── Score Pickers ────────────────────────────────────────────────────────────

function NpsPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-center text-slate-400">0 = Kesinlikle önermem · 10 = Kesinlikle öneririm</p>
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const color = n <= 6
            ? "bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30"
            : n <= 8
            ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
            : "bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30";
          const sel = n <= 6
            ? "!bg-red-500 !border-red-400 !text-white scale-110"
            : n <= 8
            ? "!bg-amber-500 !border-amber-400 !text-white scale-110"
            : "!bg-green-500 !border-green-400 !text-white scale-110";
          return (
            <button key={n} type="button" onClick={() => onChange(n)}
              className={cn("h-11 w-11 rounded-xl border-2 font-bold text-base transition-all", color, value === n && sel)}>
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CsatPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-sm text-center text-slate-400">1 yıldız = Çok memnun değilim · 5 yıldız = Çok memnunum</p>
      <div className="flex justify-center gap-3">
        {[1,2,3,4,5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
            className="transition-transform hover:scale-110 active:scale-95">
            <Star className={cn("h-10 w-10 transition-colors",
              (hover ?? value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-slate-600")} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CesPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const labels = ["","Çok Kolay","Kolay","Biraz Kolay","Nötr","Biraz Zor","Zor","Çok Zor"];
  return (
    <div className="space-y-3">
      <p className="text-sm text-center text-slate-400">1 = Çok Kolay · 7 = Çok Zor</p>
      <div className="flex flex-wrap justify-center gap-2">
        {[1,2,3,4,5,6,7].map((n) => {
          const color = n <= 2 ? "bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30"
            : n <= 4 ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
            : "bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30";
          const sel = n <= 2 ? "!bg-green-500 !border-green-400 !text-white scale-110"
            : n <= 4 ? "!bg-amber-500 !border-amber-400 !text-white scale-110"
            : "!bg-red-500 !border-red-400 !text-white scale-110";
          return (
            <button key={n} type="button" onClick={() => onChange(n)}
              className={cn("flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 font-bold text-base transition-all", color, value === n && sel)}>
              <span>{n}</span>
              <span className="text-[10px] font-normal opacity-70">{labels[n]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RatingPicker({ value, onChange, max = 5 }: { value: number | null; onChange: (v: number) => void; max?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
          className={cn("h-10 w-10 rounded-xl border-2 font-bold text-sm transition-all",
            (hover ?? value ?? 0) >= n
              ? "bg-indigo-500 border-indigo-400 text-white scale-110"
              : "bg-slate-800 border-slate-600 text-slate-400 hover:border-indigo-500/50")}>
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── Question Input Renderer ──────────────────────────────────────────────────

function QuestionInput({ question, value, onChange }: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  const type = question.questionType;

  if (type === "nps") return <NpsPicker value={value} onChange={onChange} />;
  if (type === "csat") return <CsatPicker value={value} onChange={onChange} />;
  if (type === "ces")  return <CesPicker value={value} onChange={onChange} />;
  if (type === "rating") return <RatingPicker value={value} onChange={onChange} />;

  if (type === "text") return (
    <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      rows={3} placeholder="Yanıtınızı yazın..."
      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 resize-none" />
  );

  if (type === "boolean") return (
    <div className="flex justify-center gap-4">
      {["Evet", "Hayır"].map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={cn("px-8 py-3 rounded-xl border-2 font-semibold text-sm transition-all",
            value === opt
              ? "bg-indigo-500 border-indigo-400 text-white scale-105"
              : "bg-slate-800 border-slate-600 text-slate-300 hover:border-indigo-500/50")}>
          {opt}
        </button>
      ))}
    </div>
  );

  if (type === "multiple_choice" && question.options) return (
    <div className="space-y-2">
      {question.options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={cn("w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all",
            value === opt
              ? "bg-indigo-500/20 border-indigo-500 text-indigo-200"
              : "bg-slate-800 border-slate-600 text-slate-300 hover:border-indigo-500/40")}>
          {opt}
        </button>
      ))}
    </div>
  );

  return null;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SurveyRespond() {
  const [, params] = useRoute("/survey/:token");
  const token = params?.token;

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Survey flow state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});    // questionId → answer
  const [currentAnswer, setCurrentAnswer] = useState<any>(null);
  const [history, setHistory] = useState<number[]>([]);               // stack of visited orderIndexes
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Fallback score (no questions in DB)
  const [fallbackScore, setFallbackScore] = useState<number | null>(null);
  const [fallbackFeedback, setFallbackFeedback] = useState("");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`/api/survey/token/${token}`).then((r) => r.json()),
    ]).then(([td]) => {
      setTokenData(td);
      if (td.survey) {
        fetch(`/api/surveys/${td.survey.id}/questions`)
          .then((r) => r.json())
          .then((qs: Question[]) => {
            setQuestions(qs);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => { setError("Bağlantı hatası."); setLoading(false); });
  }, [token]);

  // Restore currentAnswer when navigating back
  useEffect(() => {
    if (questions.length === 0) return;
    const q = questions[currentQIndex];
    if (q) setCurrentAnswer(answers[q.id] ?? null);
  }, [currentQIndex, questions]);

  const survey = tokenData?.survey;
  const brandColor = survey?.emailDesign?.brandColor ?? "#6366f1";
  const companyName = survey?.emailDesign?.companyName ?? "CX-Inn";
  const hasQuestions = questions.length > 0;

  // ── Get primary score from answers (first NPS/CSAT/CES question) ───────────
  const getPrimaryScore = (): number => {
    if (!hasQuestions) return fallbackScore ?? 5;
    for (const q of questions) {
      if (["nps","csat","ces","rating"].includes(q.questionType)) {
        const ans = answers[q.id];
        if (ans != null) return Number(ans);
      }
    }
    return 5;
  };

  const getPrimaryFeedback = (): string => {
    if (!hasQuestions) return fallbackFeedback;
    for (const q of questions) {
      if (q.questionType === "text") {
        const ans = answers[q.id];
        if (ans) return String(ans);
      }
    }
    return "";
  };

  // ── Advance to next question (with skip logic) ─────────────────────────────
  const advance = () => {
    if (questions.length === 0) return;
    const q = questions[currentQIndex];
    const ans = currentAnswer;

    // Save answer
    const newAnswers = { ...answers, [q.id]: ans };
    setAnswers(newAnswers);

    // Evaluate skip logic
    const goto = evaluateSkipLogic(q.skipLogic, ans);

    if (goto === "end") {
      submitSurvey(newAnswers);
      return;
    }

    if (typeof goto === "number") {
      // goto is a question ID — find its index
      const targetIdx = questions.findIndex((x) => x.id === goto);
      if (targetIdx !== -1) {
        setHistory((h) => [...h, currentQIndex]);
        setCurrentQIndex(targetIdx);
        setCurrentAnswer(newAnswers[questions[targetIdx].id] ?? null);
        return;
      }
    }

    // Default: next
    const nextIdx = currentQIndex + 1;
    if (nextIdx >= questions.length) {
      submitSurvey(newAnswers);
    } else {
      setHistory((h) => [...h, currentQIndex]);
      setCurrentQIndex(nextIdx);
      setCurrentAnswer(newAnswers[questions[nextIdx].id] ?? null);
    }
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCurrentQIndex(prev);
    setCurrentAnswer(answers[questions[prev].id] ?? null);
  };

  const submitSurvey = async (finalAnswers?: Record<number, any>) => {
    setSubmitting(true);
    const ans = finalAnswers ?? answers;
    const score = getPrimaryScore();
    const feedback = getPrimaryFeedback();
    try {
      const res = await fetch(`/api/survey/token/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, feedback, answers: ans }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (e: any) {
      setError("Yanıt gönderilemedi: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSurvey();
  };

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
    </div>
  );

  if (tokenData?.alreadyCompleted || done) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
        <p className="text-xl font-bold text-white mb-2">Teşekkürler!</p>
        <p className="text-slate-400 text-sm">Yanıtınız alındı. Geri bildiriminiz için teşekkür ederiz.</p>
        <div className="mt-6 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-amber-300 text-xs font-medium">🧪 Bu bir test gönderimiydi — sonuçlar gerçek veriye eklenmedi.</p>
        </div>
      </div>
    </div>
  );

  if (error || !tokenData || !survey) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
        <p className="text-lg font-semibold text-white mb-2">Bağlantı Geçersiz</p>
        <p className="text-slate-400 text-sm">{error ?? "Bu anket bağlantısı bulunamadı veya süresi dolmuş."}</p>
      </div>
    </div>
  );

  const headline = survey.emailDesign?.headline ?? (
    survey.type === "NPS" ? "Bizi arkadaşlarınıza önerir misiniz?" :
    survey.type === "CSAT" ? "Deneyiminizi nasıl değerlendirirsiniz?" :
    "Çözüm ne kadar kolaydı?"
  );
  const subheadline = survey.emailDesign?.subheadline ?? "Geri bildiriminiz bizim için çok değerli.";

  const currentQuestion = hasQuestions ? questions[currentQIndex] : null;
  const isLast = hasQuestions ? currentQIndex === questions.length - 1 : true;
  const canProceed = currentQuestion
    ? (currentAnswer !== null && currentAnswer !== "" && currentAnswer !== undefined)
    : fallbackScore !== null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Test banner */}
        <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
          <span className="text-lg">🧪</span>
          <div>
            <p className="text-amber-300 text-xs font-semibold">Test Gönderimi</p>
            <p className="text-amber-200/60 text-[11px]">Bu yanıt gerçek veriye eklenmeyecek.</p>
          </div>
        </div>

        {/* Survey card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          {/* Brand header */}
          <div style={{ background: brandColor }} className="px-6 py-5">
            <p className="text-white font-bold text-lg">{companyName}</p>
            <p className="text-white/75 text-sm">{survey.title}</p>
          </div>

          {/* Progress bar (only if questions exist) */}
          {hasQuestions && (
            <div className="px-6 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{currentQIndex + 1} / {questions.length}</span>
                {history.length > 0 && (
                  <button onClick={goBack}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    <ArrowLeft className="h-3 w-3" /> Geri
                  </button>
                )}
              </div>
              <ProgressBar current={currentQIndex + 1} total={questions.length} color={brandColor} />
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Header (only on first question or no questions) */}
            {(!hasQuestions || currentQIndex === 0) && (
              <div>
                <h1 className="text-xl font-bold text-white mb-2">{headline}</h1>
                <p className="text-slate-400 text-sm">{subheadline}</p>
              </div>
            )}

            {/* ── QUESTION MODE ─── */}
            {hasQuestions && currentQuestion && (
              <div className="space-y-5">
                {currentQIndex > 0 && (
                  <div>
                    <p className="text-base font-semibold text-white leading-snug">
                      {currentQuestion.questionText}
                      {currentQuestion.isRequired && <span className="text-red-400 ml-1">*</span>}
                    </p>
                  </div>
                )}
                {currentQIndex === 0 && (
                  <p className="text-sm font-medium text-slate-400">
                    {currentQuestion.questionText}
                    {currentQuestion.isRequired && <span className="text-red-400 ml-1">*</span>}
                  </p>
                )}
                <QuestionInput
                  question={currentQuestion}
                  value={currentAnswer}
                  onChange={setCurrentAnswer}
                />
                <button
                  type="button"
                  disabled={!canProceed || submitting}
                  onClick={advance}
                  style={{ background: canProceed ? brandColor : undefined }}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2",
                    canProceed
                      ? "text-white hover:opacity-90 active:scale-[0.98]"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  )}
                >
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</>
                    : isLast
                    ? "Yanıtı Gönder"
                    : <><span>Devam</span><ChevronRight className="h-4 w-4" /></>
                  }
                </button>
              </div>
            )}

            {/* ── FALLBACK MODE (no questions in DB) ─── */}
            {!hasQuestions && (
              <form onSubmit={handleFallbackSubmit} className="space-y-6">
                <div className="py-2">
                  {survey.type === "NPS"    && <NpsPicker value={fallbackScore} onChange={setFallbackScore} />}
                  {survey.type === "CSAT"   && <CsatPicker value={fallbackScore} onChange={setFallbackScore} />}
                  {survey.type === "CES"    && <CesPicker value={fallbackScore} onChange={setFallbackScore} />}
                  {!["NPS","CSAT","CES"].includes(survey.type) && <NpsPicker value={fallbackScore} onChange={setFallbackScore} />}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Yorumunuz <span className="text-slate-500 font-normal">(isteğe bağlı)</span>
                  </label>
                  <textarea value={fallbackFeedback} onChange={(e) => setFallbackFeedback(e.target.value)}
                    rows={3} placeholder="Deneyiminizi paylaşın..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 resize-none" />
                </div>
                <button type="submit" disabled={!canProceed || submitting}
                  style={{ background: canProceed ? brandColor : undefined }}
                  className={cn("w-full py-3.5 rounded-xl font-bold text-base transition-all",
                    canProceed ? "text-white hover:opacity-90 active:scale-[0.98]"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed")}>
                  {submitting
                    ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</span>
                    : "Yanıtı Gönder"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          Powered by CX-Inn · {tokenData.email}
        </p>
      </div>
    </div>
  );
}
