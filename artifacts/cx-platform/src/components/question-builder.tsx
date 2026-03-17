import React, { useState, useEffect } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, GitBranch,
  GripVertical, X, Save, AlertCircle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Label, Input, Select } from "@/components/ui-elements";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type SkipRule = {
  condition: "less_than" | "greater_than" | "equals" | "not_equals" | "contains";
  value: string;
  goto: string; // question index (1-based string) or "end" or "next"
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

const QUESTION_TYPES = [
  { value: "nps", label: "NPS (0–10 Puan)" },
  { value: "csat", label: "CSAT (1–5 Yıldız)" },
  { value: "ces", label: "CES (1–7 Efor)" },
  { value: "rating", label: "Puanlama (1–10)" },
  { value: "text", label: "Açık Uçlu Metin" },
  { value: "multiple_choice", label: "Çoktan Seçmeli" },
  { value: "boolean", label: "Evet / Hayır" },
];

const CONDITIONS = [
  { value: "less_than", label: "küçüktür (<)" },
  { value: "greater_than", label: "büyüktür (>)" },
  { value: "equals", label: "eşittir (=)" },
  { value: "not_equals", label: "eşit değildir (≠)" },
  { value: "contains", label: "içerir" },
];

const GOTO_OPTIONS = (questions: Question[], currentIndex: number) => [
  { value: "next", label: "Sıradaki soruya geç" },
  { value: "end", label: "Anketi bitir" },
  ...questions
    .filter((_, i) => i !== currentIndex)
    .map((q, i) => ({
      value: String(q.id),
      label: `Soru ${q.orderIndex + 1}: ${q.questionText.slice(0, 40)}${q.questionText.length > 40 ? "…" : ""}`,
    })),
];

function getTypeBadgeColor(type: string) {
  switch (type) {
    case "nps": return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    case "csat": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "ces": return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    case "rating": return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "text": return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    case "multiple_choice": return "bg-green-500/15 text-green-300 border-green-500/30";
    case "boolean": return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    default: return "bg-muted/30 text-muted-foreground border-border/30";
  }
}

// ─── Skip Logic Editor ────────────────────────────────────────────────────────

function SkipLogicEditor({
  rules,
  questions,
  currentIndex,
  onChange,
}: {
  rules: SkipRule[];
  questions: Question[];
  currentIndex: number;
  onChange: (rules: SkipRule[]) => void;
}) {
  const addRule = () =>
    onChange([...rules, { condition: "less_than", value: "7", goto: "end" }]);

  const removeRule = (i: number) => onChange(rules.filter((_, idx) => idx !== i));

  const updateRule = (i: number, patch: Partial<SkipRule>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const gotoOpts = GOTO_OPTIONS(questions, currentIndex);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-indigo-400" />
          Koşullu Yönlendirme (Skip Logic)
        </p>
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-0.5 rounded-lg hover:bg-indigo-500/10"
        >
          <Plus className="h-3 w-3" /> Kural ekle
        </button>
      </div>

      {rules.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60 italic px-2">
          Kural yok — her yanıt sıradaki soruya devam eder.
        </p>
      )}

      {rules.map((rule, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap bg-white/[0.03] border border-indigo-500/20 rounded-xl p-2.5">
          <span className="text-[11px] text-muted-foreground flex-shrink-0">Eğer yanıt</span>
          <select
            value={rule.condition}
            onChange={(e) => updateRule(i, { condition: e.target.value as any })}
            className="text-[11px] bg-white/5 border border-border/40 rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-indigo-500/60"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={rule.value}
            onChange={(e) => updateRule(i, { value: e.target.value })}
            placeholder="değer"
            className="text-[11px] w-16 bg-white/5 border border-border/40 rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-indigo-500/60"
          />
          <span className="text-[11px] text-muted-foreground flex-shrink-0">ise</span>
          <select
            value={rule.goto}
            onChange={(e) => updateRule(i, { goto: e.target.value })}
            className="text-[11px] flex-1 min-w-[160px] bg-white/5 border border-border/40 rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-indigo-500/60"
          >
            {gotoOpts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => removeRule(i)}
            className="p-1 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  total,
  questions,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: Question;
  index: number;
  total: number;
  questions: Question[];
  onUpdate: (patch: Partial<Question>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localText, setLocalText] = useState(question.questionText);
  const [localType, setLocalType] = useState(question.questionType);
  const [localOptions, setLocalOptions] = useState<string[]>(question.options ?? ["", ""]);
  const [localRequired, setLocalRequired] = useState(question.isRequired);
  const [localRules, setLocalRules] = useState<SkipRule[]>(question.skipLogic ?? []);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  const save = () => {
    onUpdate({
      questionText: localText,
      questionType: localType,
      options: localType === "multiple_choice" ? localOptions.filter(Boolean) : null,
      isRequired: localRequired,
      skipLogic: localRules.length > 0 ? localRules : null,
    });
    setDirty(false);
  };

  const typeLabel = QUESTION_TYPES.find((t) => t.value === localType)?.label ?? localType;

  return (
    <div className={cn(
      "border rounded-2xl transition-all duration-200",
      expanded ? "border-indigo-500/40 bg-indigo-500/[0.04]" : "border-border/50 bg-white/[0.02]"
    )}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Order badge */}
        <span className="flex-shrink-0 h-7 w-7 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {question.questionText || <span className="text-muted-foreground italic">Soru metni girilmedi</span>}
          </p>
        </div>

        <span className={cn("hidden sm:inline-flex px-2 py-0.5 rounded-lg border text-[10px] font-semibold flex-shrink-0", getTypeBadgeColor(question.questionType))}>
          {typeLabel}
        </span>

        {(question.skipLogic?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg flex-shrink-0">
            <GitBranch className="h-2.5 w-2.5" />
            {question.skipLogic!.length} kural
          </span>
        )}

        {/* Move buttons */}
        <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <ChevronDown className={cn("h-4 w-4 text-muted-foreground/50 transition-transform flex-shrink-0", expanded && "rotate-180")} />
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Soru Metni</Label>
              <textarea
                value={localText}
                onChange={(e) => { setLocalText(e.target.value); markDirty(); }}
                rows={2}
                placeholder="Soruyu buraya yazın..."
                className="w-full bg-white/5 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>
            <div className="space-y-3">
              <div>
                <Label>Soru Tipi</Label>
                <select
                  value={localType}
                  onChange={(e) => { setLocalType(e.target.value as any); markDirty(); }}
                  className="w-full bg-white/5 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500/60 transition-colors"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`req-${question.id}`}
                  checked={localRequired}
                  onChange={(e) => { setLocalRequired(e.target.checked); markDirty(); }}
                  className="w-4 h-4 rounded border-border/50 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
                />
                <label htmlFor={`req-${question.id}`} className="text-xs text-muted-foreground cursor-pointer">
                  Zorunlu soru
                </label>
              </div>
            </div>
          </div>

          {/* Multiple choice options */}
          {localType === "multiple_choice" && (
            <div>
              <Label>Seçenekler</Label>
              <div className="space-y-2">
                {localOptions.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{oi + 1}.</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...localOptions];
                        next[oi] = e.target.value;
                        setLocalOptions(next);
                        markDirty();
                      }}
                      placeholder={`Seçenek ${oi + 1}`}
                      className="flex-1 bg-white/5 border border-border/50 rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-indigo-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => { setLocalOptions(localOptions.filter((_, i) => i !== oi)); markDirty(); }}
                      className="p-1 text-muted-foreground/50 hover:text-red-400 transition-colors"
                      disabled={localOptions.length <= 2}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => { setLocalOptions([...localOptions, ""]); markDirty(); }}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Seçenek ekle
                </button>
              </div>
            </div>
          )}

          {/* Skip Logic */}
          <SkipLogicEditor
            rules={localRules}
            questions={questions}
            currentIndex={index}
            onChange={(r) => { setLocalRules(r); markDirty(); }}
          />

          {/* Save button */}
          {dirty && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={save}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                <Save className="h-3.5 w-3.5" /> Kaydet
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Question Builder Modal ───────────────────────────────────────────────

type QuestionBuilderProps = {
  survey: { id: number; title: string; type: string };
  onClose: () => void;
};

const DEFAULT_QUESTION_FOR_TYPE = (type: string): Partial<Question> => {
  switch (type) {
    case "NPS": return { questionText: "Bu hizmeti bir arkadaşınıza önerir misiniz?", questionType: "nps" };
    case "CSAT": return { questionText: "Deneyiminizden ne kadar memnun kaldınız?", questionType: "csat" };
    case "CES": return { questionText: "Sorununuzu çözmek ne kadar kolaydı?", questionType: "ces" };
    default: return { questionText: "", questionType: "text" };
  }
};

export function QuestionBuilder({ survey, onClose }: QuestionBuilderProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["/api/surveys", survey.id, "questions"],
    queryFn: () => fetch(`/api/surveys/${survey.id}/questions`).then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`/api/surveys/${survey.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/surveys", survey.id, "questions"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetch(`/api/surveys/${survey.id}/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/surveys", survey.id, "questions"] });
      toast({ title: "Soru güncellendi" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/surveys/${survey.id}/questions/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/surveys", survey.id, "questions"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (order: { id: number; orderIndex: number }[]) =>
      fetch(`/api/surveys/${survey.id}/questions/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/surveys", survey.id, "questions"] }),
  });

  const handleAddQuestion = () => {
    const defaults = DEFAULT_QUESTION_FOR_TYPE(survey.type);
    addMutation.mutate({
      ...defaults,
      orderIndex: questions.length,
      isRequired: true,
      skipLogic: null,
      options: null,
    });
  };

  const handleAddDetractorFlow = () => {
    // Adds a smart NPS Detractor follow-up question with skip logic pre-filled
    const nextIndex = questions.length;
    addMutation.mutate(
      {
        questionText: "Deneyiminizde neyi iyileştirebiliriz?",
        questionType: "text",
        orderIndex: nextIndex,
        isRequired: false,
        skipLogic: null,
        options: null,
      },
      {
        onSuccess: (newQ: Question) => {
          // Now update the NPS question (first one) to add skip logic pointing here
          if (questions.length > 0) {
            const firstQ = questions[0];
            const existingRules = firstQ.skipLogic ?? [];
            updateMutation.mutate({
              id: firstQ.id,
              data: {
                skipLogic: [
                  ...existingRules,
                  { condition: "less_than", value: "7", goto: String(newQ.id) },
                  { condition: "greater_than", value: "8", goto: "end" },
                ],
              },
            });
          }
        },
      }
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...questions];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    reorderMutation.mutate(
      reordered.map((q, i) => ({ id: q.id, orderIndex: i }))
    );
  };

  const handleMoveDown = (index: number) => {
    if (index === questions.length - 1) return;
    const reordered = [...questions];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    reorderMutation.mutate(
      reordered.map((q, i) => ({ id: q.id, orderIndex: i }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-[#0f172a] border border-border/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground text-base">Soru Akışı & Skip Logic</p>
              <p className="text-xs text-muted-foreground">{survey.title} · {survey.type}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick actions */}
        {survey.type === "NPS" && questions.length > 0 && questions.length < 3 && (
          <div className="px-6 py-3 bg-indigo-500/5 border-b border-indigo-500/20 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-indigo-400 flex-shrink-0" />
            <p className="text-xs text-indigo-200/80 flex-1">
              NPS Detractor akışı: Puan &lt; 7 olduğunda otomatik takip sorusu ekleyin.
            </p>
            <button
              onClick={handleAddDetractorFlow}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              Hızlı Ekle
            </button>
          </div>
        )}

        {/* Question list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Yükleniyor...
            </div>
          )}

          {!isLoading && questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <GitBranch className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Henüz soru yok</p>
                <p className="text-xs text-muted-foreground mt-1">
                  İlk soruyu ekleyin ve koşullu yönlendirme kuralları tanımlayın.
                </p>
              </div>
            </div>
          )}

          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              total={questions.length}
              questions={questions}
              onUpdate={(patch) => updateMutation.mutate({ id: q.id, data: patch })}
              onDelete={() => deleteMutation.mutate(q.id)}
              onMoveUp={() => handleMoveUp(i)}
              onMoveDown={() => handleMoveDown(i)}
            />
          ))}

          {/* Add question button */}
          <button
            type="button"
            onClick={handleAddQuestion}
            disabled={addMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border/40 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-muted-foreground hover:text-indigo-300 text-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            {addMutation.isPending ? "Ekleniyor..." : "Soru Ekle"}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between flex-shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            {questions.length} soru · {questions.filter((q) => (q.skipLogic?.length ?? 0) > 0).length} skip logic kuralı
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-foreground border border-border/50 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
