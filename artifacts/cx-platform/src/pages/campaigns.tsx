import React, { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, Button, Modal, Label, Input, StatusBadge, LoadingScreen } from "@/components/ui-elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSurveysList } from "@/hooks/use-surveys";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  Plus, Send, Pause, CheckCircle, BarChart2, Users, MessageSquare,
  ChevronDown, X, Building2, Tag, UserCheck, Search,
  Sparkles, Loader2, ChevronRight, Copy, Check, AlertCircle, Mail,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Campaign = {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "completed";
  channel: string;
  targetSegment: string | null;
  totalTargeted: number;
  totalSent: number;
  totalCompleted: number;
  scheduledAt: string | null;
  createdAt: string;
  surveyId: number;
  surveyTitle: string;
  surveyType: string;
};

type Response = {
  id: number;
  score: number;
  feedback: string | null;
  sentiment: string;
  respondedAt: string;
  customerName: string | null;
  surveyType: string;
  surveyTitle: string;
};

type Segment = {
  id: number;
  name: string;
  description: string | null;
  customerCount: number;
  aiGenerated: boolean;
};

type CustomerGroup = {
  key: string;
  label: string;
  category: string;
  count: number;
  color: string;
};

type CustomerGroups = {
  total: number;
  groups: CustomerGroup[];
  companies: { name: string; count: number }[];
};

function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ["survey-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/survey-campaigns");
      if (!res.ok) throw new Error("Veri alınamadı");
      return res.json();
    },
  });
}

function useSegments() {
  return useQuery<Segment[]>({
    queryKey: ["segments"],
    queryFn: async () => {
      const res = await fetch("/api/segments");
      if (!res.ok) throw new Error("Segmentler alınamadı");
      return res.json();
    },
  });
}

function useCustomerGroups() {
  return useQuery<CustomerGroups>({
    queryKey: ["customer-groups"],
    queryFn: async () => {
      const res = await fetch("/api/customers/groups");
      if (!res.ok) throw new Error("Gruplar alınamadı");
      return res.json();
    },
  });
}

function useResponses(campaignId?: number) {
  return useQuery<Response[]>({
    queryKey: ["survey-responses", campaignId],
    queryFn: async () => {
      const url = campaignId ? `/api/survey-responses?campaignId=${campaignId}` : "/api/survey-responses";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Yanıtlar alınamadı");
      return res.json();
    },
    enabled: !!campaignId,
  });
}

const STATUS_LABELS: Record<string, string> = { draft: "Taslak", active: "Aktif", paused: "Duraklatıldı", completed: "Tamamlandı" };
const STATUS_VARIANTS: Record<string, any> = { draft: "outline", active: "success", paused: "warning", completed: "primary" };

type SelectedTarget = { key: string; label: string; count: number; type: "segment" | "group" | "company" };

function TargetSegmentPicker({
  selected,
  onChange,
  segments,
  customerGroups,
}: {
  selected: SelectedTarget[];
  onChange: (targets: SelectedTarget[]) => void;
  segments: Segment[];
  customerGroups: CustomerGroups | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"segment" | "group" | "company">("group");
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (target: SelectedTarget) => {
    const exists = selected.find(s => s.key === target.key);
    if (exists) onChange(selected.filter(s => s.key !== target.key));
    else onChange([...selected, target]);
  };

  const isSelected = (key: string) => selected.some(s => s.key === key);

  const COLOR_MAP: Record<string, string> = {
    destructive: "text-destructive", warning: "text-warning",
    success: "text-success", primary: "text-primary",
  };

  const groups = customerGroups?.groups ?? [];
  const companies = (customerGroups?.companies ?? []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSegments = segments.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = groups.filter(g =>
    g.label.toLowerCase().includes(search.toLowerCase())
  );

  const totalReach = selected.reduce((sum, s) => sum + s.count, 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-lg text-sm text-left flex items-center justify-between gap-2 hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <div className="flex-1 min-w-0">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Hedef seçin (segment, firma veya müşteri grubu)</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(s => (
                <span key={s.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/15 text-primary text-xs rounded-full border border-primary/20">
                  {s.label}
                  <span className="text-primary/60 text-[10px]">({s.count})</span>
                  <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); toggle(s); }} onKeyDown={e => e.key === "Enter" && toggle(s)} className="hover:text-destructive cursor-pointer">
                    <X className="h-2.5 w-2.5" />
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Tahmini kapsam: <span className="text-primary font-semibold">{totalReach} müşteri</span>
        </p>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#1a1f2e] border border-border/80 rounded-xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border/50">
            {[
              { key: "group" as const, label: "Müşteri Grupları", icon: UserCheck },
              { key: "segment" as const, label: "Segmentler", icon: Tag },
              { key: "company" as const, label: "Firmalar", icon: Building2 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setTab(key); setSearch(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                  tab === key
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-border/30">
            <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara..."
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>

          {/* Content */}
          <div className="max-h-60 overflow-y-auto py-1">
            {tab === "group" && (
              <>
                {filteredGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Grup bulunamadı</p>
                ) : (
                  <>
                    {["churn", "nps", "sentiment", "all"].map(cat => {
                      const catGroups = filteredGroups.filter(g => g.category === cat);
                      if (!catGroups.length) return null;
                      const catLabels: Record<string, string> = { churn: "Churn Riski", nps: "NPS Bandı", sentiment: "Duygu Durumu", all: "Genel" };
                      return (
                        <div key={cat}>
                          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 pt-2 pb-1">{catLabels[cat]}</p>
                          {catGroups.map(g => (
                            <button
                              key={g.key}
                              type="button"
                              onClick={() => toggle({ key: g.key, label: g.label, count: g.count, type: "group" })}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors",
                                isSelected(g.key) && "bg-primary/5"
                              )}
                            >
                              <div className={cn(
                                "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                                isSelected(g.key) ? "bg-primary border-primary" : "border-border"
                              )}>
                                {isSelected(g.key) && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <span className="flex-1 text-left text-foreground">{g.label}</span>
                              <span className={cn("text-xs font-semibold", COLOR_MAP[g.color] ?? "text-muted-foreground")}>
                                {g.count} kişi
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {tab === "segment" && (
              <>
                {filteredSegments.length === 0 ? (
                  <div className="text-center py-6">
                    <Tag className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {search ? "Segment bulunamadı" : "Henüz segment yok. Segmentler sayfasından oluşturun."}
                    </p>
                  </div>
                ) : (
                  filteredSegments.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle({ key: `seg_${s.id}`, label: s.name, count: s.customerCount ?? 0, type: "segment" })}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors",
                        isSelected(`seg_${s.id}`) && "bg-primary/5"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                        isSelected(`seg_${s.id}`) ? "bg-primary border-primary" : "border-border"
                      )}>
                        {isSelected(`seg_${s.id}`) && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-foreground">{s.name}</p>
                        {s.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{s.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-primary">{s.customerCount ?? 0} kişi</p>
                        {s.aiGenerated && <p className="text-[10px] text-muted-foreground">AI</p>}
                      </div>
                    </button>
                  ))
                )}
              </>
            )}

            {tab === "company" && (
              <>
                {companies.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    {search ? "Firma bulunamadı" : "Firma verisi yok"}
                  </p>
                ) : (
                  companies.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => toggle({ key: `co_${c.name}`, label: c.name, count: c.count, type: "company" })}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors",
                        isSelected(`co_${c.name}`) && "bg-primary/5"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                        isSelected(`co_${c.name}`) ? "bg-primary border-primary" : "border-border"
                      )}>
                        {isSelected(`co_${c.name}`) && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="h-6 w-6 rounded bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <span className="flex-1 text-left text-foreground">{c.name}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{c.count} kişi</span>
                    </button>
                  ))
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {selected.length > 0 && (
            <div className="border-t border-border/30 px-3 py-2 flex items-center justify-between bg-primary/5">
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-semibold">{selected.length}</span> hedef seçildi ·{" "}
                <span className="text-primary font-semibold">{totalReach}</span> müşteri kapsanıyor
              </p>
              <button
                type="button"
                onClick={() => { onChange([]); }}
                className="text-xs text-destructive hover:text-destructive/80"
              >
                Temizle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Personalize Modal ─────────────────────────────────────────────────────

type PersonalizedEmail = {
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  segment: string;
  churnRisk: string;
  npsScore: number | null;
  subject: string;
  greeting: string;
  headline: string;
  subheadline: string;
  cta: string;
  tone_note: string;
};

function AiPersonalizeModal({
  surveys,
  segments,
  customerGroups,
  companyName = "CX-Inn",
  onClose,
}: {
  surveys: any[];
  segments: any[];
  customerGroups: any;
  companyName?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"config" | "results">("config");
  const [surveyId, setSurveyId] = useState("");
  const [targetKey, setTargetKey] = useState("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PersonalizedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const selectedSurvey = surveys?.find((s: any) => String(s.id) === surveyId);

  const targetOptions = [
    { key: "all", label: "Tüm Müşteriler", category: "Genel" },
    { key: "high_churn", label: "Yüksek Churn Riskli", category: "Churn" },
    { key: "mid_churn", label: "Orta Churn Riskli", category: "Churn" },
    { key: "low_churn", label: "Düşük Churn Riskli", category: "Churn" },
    { key: "sentiment_positive", label: "Pozitif Duygu", category: "Duygu" },
    { key: "sentiment_neutral", label: "Nötr Duygu", category: "Duygu" },
    { key: "sentiment_negative", label: "Negatif Duygu", category: "Duygu" },
    ...(segments ?? []).map((s: any) => ({ key: `seg_${s.id}`, label: s.name, category: "Segment" })),
  ];

  const handleGenerate = async () => {
    if (!surveyId) { toast({ title: "Anket seçin", variant: "destructive" }); return; }
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/campaigns/ai-personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: Number(surveyId),
          targetKey,
          companyName,
          surveyType: selectedSurvey?.type ?? "NPS",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Hata");
      setResults(data.results);
      setTotal(data.total);
      setStep("results");
    } catch (e: any) {
      toast({ title: "Oluşturma hatası", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = (r: PersonalizedEmail) => {
    const text = `Konu: ${r.subject}\n\n${r.greeting}\n\n${r.headline}\n${r.subheadline}\n\n${r.cta}`;
    navigator.clipboard.writeText(text);
    setCopiedId(r.customerId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Kopyalandı", description: r.customerName });
  };

  const churnColor = (risk: string) =>
    risk === "high" ? "text-red-400" : risk === "medium" ? "text-amber-400" : "text-green-400";
  const churnLabel = (risk: string) =>
    risk === "high" ? "Yüksek" : risk === "medium" ? "Orta" : "Düşük";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/10">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </span>
            <div>
              <p className="font-bold text-white">AI ile Hiper-Kişiselleştirme</p>
              <p className="text-xs text-slate-400">Gemini, her müşteriye özel e-posta içeriği oluşturur</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Config step */}
        {step === "config" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
              <div className="flex items-start gap-2">
                <span className="text-indigo-400 text-lg">🎯</span>
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Etkileşim Geçmişi</p>
                  <p className="text-[11px] text-slate-400">Son 3 etkileşim analiz edilir</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-indigo-400 text-lg">🧠</span>
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Gemini 2.5 Flash</p>
                  <p className="text-[11px] text-slate-400">Ton ve içerik kişiselleştirilir</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-indigo-400 text-lg">⚠️</span>
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Churn Riski</p>
                  <p className="text-[11px] text-slate-400">Yüksek riskli = empati tonu</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-indigo-400 text-lg">😊</span>
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Duygu Durumu</p>
                  <p className="text-[11px] text-slate-400">Negatif = sorun çözme vurgusu</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold text-slate-300 mb-2 block">Anket Seç</Label>
              <select value={surveyId} onChange={(e) => setSurveyId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                <option value="">— Anket seçin —</option>
                {(surveys ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.title} ({s.type})</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-semibold text-slate-300 mb-2 block">Hedef Kitle</Label>
              <div className="grid grid-cols-2 gap-2">
                {targetOptions.map((opt) => (
                  <button key={opt.key} type="button" onClick={() => setTargetKey(opt.key)}
                    className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all",
                      targetKey === opt.key
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-200"
                        : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500")}>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-400 font-medium shrink-0">{opt.category}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-200/70">Segmentten en fazla 12 müşteri örneklenir. Sonuçlar önizleme amaçlıdır.</p>
            </div>

            <button onClick={handleGenerate} disabled={!surveyId || loading}
              className={cn("w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2",
                surveyId && !loading
                  ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed")}>
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Gemini oluşturuyor...</>
                : <><Sparkles className="h-4 w-4" /> Kişiselleştirilmiş E-postalar Oluştur</>}
            </button>
          </div>
        )}

        {/* Results step */}
        {step === "results" && (
          <div className="flex-1 overflow-y-auto">
            {/* Results header */}
            <div className="sticky top-0 px-6 py-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">
                {results.length} müşteri için kişiselleştirildi
                <span className="ml-2 text-slate-400 font-normal text-xs">(segmentten {total} müşteri)</span>
              </p>
              <button onClick={() => setStep("config")}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
                ← Yeniden yapılandır
              </button>
            </div>

            <div className="p-4 space-y-3">
              {results.map((r) => (
                <div key={r.customerId} className={cn("rounded-xl border transition-all",
                  expandedId === r.customerId ? "border-indigo-500/40 bg-indigo-500/5" : "border-slate-700 bg-slate-800/50")}>
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === r.customerId ? null : r.customerId)}>
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {r.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.customerName}</p>
                      <p className="text-xs text-slate-400 truncate">{r.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-[11px] font-medium", churnColor(r.churnRisk))}>
                        {churnLabel(r.churnRisk)} risk
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-700 text-slate-400">{r.segment}</span>
                      <ChevronRight className={cn("h-4 w-4 text-slate-500 transition-transform", expandedId === r.customerId && "rotate-90")} />
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedId === r.customerId && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Ton: {r.tone_note}</span>
                        <button onClick={() => copyEmail(r)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                          {copiedId === r.customerId ? <><Check className="h-3 w-3 text-green-400" /> Kopyalandı</> : <><Copy className="h-3 w-3" /> Kopyala</>}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="p-3 bg-slate-700/50 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Konu Satırı</p>
                          <p className="text-sm font-semibold text-white">{r.subject}</p>
                        </div>
                        <div className="p-3 bg-slate-700/50 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Selamlama</p>
                          <p className="text-sm text-slate-200">{r.greeting}</p>
                        </div>
                        <div className="p-3 bg-slate-700/50 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Başlık</p>
                          <p className="text-sm font-bold text-white">{r.headline}</p>
                        </div>
                        <div className="p-3 bg-slate-700/50 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Alt Başlık</p>
                          <p className="text-sm text-slate-200 leading-relaxed">{r.subheadline}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                            <p className="text-[10px] text-indigo-400 uppercase tracking-wider mb-1">CTA Butonu</p>
                            <p className="text-sm font-bold text-indigo-300">{r.cta}</p>
                          </div>
                          {r.customerEmail && (
                            <div className="flex-1 p-3 bg-slate-700/50 rounded-xl">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">E-posta</p>
                              <p className="text-xs text-slate-300 truncate">{r.customerEmail}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Campaigns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createModal, setCreateModal] = useState(false);
  const [responseModal, setResponseModal] = useState<Campaign | null>(null);
  const [addResponseModal, setAddResponseModal] = useState<Campaign | null>(null);
  const [aiPersonalizeOpen, setAiPersonalizeOpen] = useState(false);
  const { data: companySettings } = useCompanySettings();

  const { data: campaigns, isLoading } = useCampaigns();
  const { data: surveys } = useSurveysList();
  const { data: responses } = useResponses(responseModal?.id);
  const { data: segments } = useSegments();
  const { data: customerGroups } = useCustomerGroups();

  const [form, setForm] = useState({
    surveyId: "", name: "", description: "", channel: "email", scheduledAt: "",
  });
  const [selectedTargets, setSelectedTargets] = useState<SelectedTarget[]>([]);

  const [responseForm, setResponseForm] = useState({
    score: "", feedback: "", respondedAt: new Date().toISOString().slice(0, 16),
  });

  const totalTargeted = selectedTargets.reduce((sum, s) => sum + s.count, 0);
  const targetSegmentText = selectedTargets.map(s => s.label).join(", ");

  const createMutation = useMutation({
    mutationFn: async (data: typeof form & { targetSegment: string; totalTargeted: number }) => {
      const res = await fetch("/api/survey-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          surveyId: Number(data.surveyId),
          totalTargeted: data.totalTargeted,
          targetSegment: data.targetSegment || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-campaigns"] });
      setCreateModal(false);
      setForm({ surveyId: "", name: "", description: "", channel: "email", scheduledAt: "" });
      setSelectedTargets([]);
      toast({ title: "Kampanya oluşturuldu" });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/survey-campaigns/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["survey-campaigns"] }),
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const addResponseMutation = useMutation({
    mutationFn: async (data: typeof responseForm & { campaignId: number; surveyId: number }) => {
      const res = await fetch("/api/survey-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: data.surveyId,
          campaignId: data.campaignId,
          score: Number(data.score),
          feedback: data.feedback || null,
          respondedAt: new Date(data.respondedAt).toISOString(),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-responses"] });
      queryClient.invalidateQueries({ queryKey: ["survey-campaigns"] });
      setAddResponseModal(null);
      setResponseForm({ score: "", feedback: "", respondedAt: new Date().toISOString().slice(0, 16) });
      toast({ title: "Yanıt kaydedildi" });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const completionRate = (c: Campaign) => c.totalSent > 0 ? Math.round((c.totalCompleted / c.totalSent) * 100) : 0;

  const handleCloseCreate = () => {
    setCreateModal(false);
    setForm({ surveyId: "", name: "", description: "", channel: "email", scheduledAt: "" });
    setSelectedTargets([]);
  };

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      <PageHeader
        title="Anket Kampanyaları"
        description="NPS ve CSAT anket gönderimlerini yönetin, yanıt takibi yapın."
      >
        <Button variant="outline" onClick={() => setAiPersonalizeOpen(true)} className="gap-2 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10">
          <Sparkles className="h-4 w-4" /> AI ile Kişiselleştir
        </Button>
        <Button variant="primary" onClick={() => setCreateModal(true)} className="shadow-[0_0_20px_rgba(99,102,241,0.25)]">
          <Plus className="h-4 w-4" /> Yeni Kampanya
        </Button>
      </PageHeader>

      {/* Summary cards */}
      {campaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Toplam Kampanya", value: campaigns.length, icon: MessageSquare, color: "primary" },
            { label: "Aktif", value: campaigns.filter(c => c.status === "active").length, icon: Send, color: "success" },
            { label: "Toplam Gönderim", value: campaigns.reduce((a, c) => a + c.totalSent, 0), icon: Users, color: "warning" },
            { label: "Tamamlanan Yanıt", value: campaigns.reduce((a, c) => a + c.totalCompleted, 0), icon: CheckCircle, color: "success" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-2xl font-display font-bold text-foreground">{value}</p>
                </div>
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", `bg-${color}/10 text-${color}`)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!campaigns || campaigns.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="h-16 w-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Send className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">Henüz Kampanya Yok</h3>
          <p className="text-muted-foreground mt-2">NPS veya CSAT anket kampanyası oluşturarak gönderim yönetimine başlayın.</p>
          <Button variant="primary" className="mt-6" onClick={() => setCreateModal(true)}>
            <Plus className="h-4 w-4" /> İlk Kampanyayı Oluştur
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className={cn(
              "p-5 transition-all hover:border-primary/30",
              campaign.status === "active" && "border-success/30 shadow-[0_0_20px_rgba(34,197,94,0.06)]"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-display font-bold text-foreground">{campaign.name}</h3>
                    <StatusBadge status={STATUS_LABELS[campaign.status]} variant={STATUS_VARIANTS[campaign.status]} />
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-semibold",
                      campaign.surveyType === "NPS" ? "bg-blue-500/15 text-blue-400" :
                      campaign.surveyType === "CSAT" ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500/15 text-orange-400"
                    )}>
                      {campaign.surveyType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">{campaign.surveyTitle}</span>
                    {campaign.targetSegment && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <div className="flex flex-wrap gap-1">
                          {campaign.targetSegment.split(", ").map((seg, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">
                              <Users className="h-2.5 w-2.5" />
                              {seg}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {campaign.totalSent > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Yanıt oranı</span>
                        <span>{completionRate(campaign)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all"
                          style={{ width: `${completionRate(campaign)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {campaign.totalTargeted > 0 && <span>{campaign.totalTargeted} hedef</span>}
                    <span>{campaign.totalSent} gönderim</span>
                    <span className="text-success">{campaign.totalCompleted} yanıt</span>
                    {campaign.scheduledAt && <span>{formatDate(campaign.scheduledAt)}</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  {campaign.status === "draft" && (
                    <Button variant="primary" className="text-xs py-1.5 bg-success text-white hover:bg-success/90" onClick={() => statusMutation.mutate({ id: campaign.id, status: "active" })}>
                      <Send className="h-3.5 w-3.5" /> Başlat
                    </Button>
                  )}
                  {campaign.status === "active" && (
                    <Button variant="ghost" className="text-xs py-1.5 border border-border" onClick={() => statusMutation.mutate({ id: campaign.id, status: "paused" })}>
                      <Pause className="h-3.5 w-3.5" /> Durdur
                    </Button>
                  )}
                  {campaign.status === "paused" && (
                    <Button variant="primary" className="text-xs py-1.5" onClick={() => statusMutation.mutate({ id: campaign.id, status: "active" })}>
                      <Send className="h-3.5 w-3.5" /> Devam Et
                    </Button>
                  )}
                  <Button variant="ghost" className="text-xs py-1.5 border border-border" onClick={() => setAddResponseModal(campaign)}>
                    <Plus className="h-3.5 w-3.5" /> Yanıt Gir
                  </Button>
                  <Button variant="ghost" className="text-xs py-1.5" onClick={() => setResponseModal(campaign)}>
                    <BarChart2 className="h-3.5 w-3.5" /> Yanıtlar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal isOpen={createModal} onClose={handleCloseCreate} title="Yeni Anket Kampanyası">
        <form
          onSubmit={e => {
            e.preventDefault();
            createMutation.mutate({ ...form, targetSegment: targetSegmentText, totalTargeted });
          }}
          className="space-y-4"
        >
          <div>
            <Label>Anket *</Label>
            <select required value={form.surveyId} onChange={e => setForm(f => ({ ...f, surveyId: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">Anket seçin...</option>
              {surveys?.map(s => <option key={s.id} value={s.id}>{s.title} ({s.type})</option>)}
            </select>
          </div>
          <div>
            <Label>Kampanya Adı *</Label>
            <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Örn: Q1 2026 NPS Kampanyası" />
          </div>
          <div>
            <Label>Açıklama</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Opsiyonel" />
          </div>
          <div>
            <Label>Kanal</Label>
            <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="email">E-posta</option>
              <option value="sms">SMS</option>
              <option value="in-app">Uygulama İçi</option>
              <option value="web">Web</option>
            </select>
          </div>

          {/* Target Segment Picker */}
          <div>
            <Label>Hedef Kitle</Label>
            <p className="text-[11px] text-muted-foreground mb-1">Segment, firma veya müşteri grubu seçin. Birden fazla seçebilirsiniz.</p>
            <TargetSegmentPicker
              selected={selectedTargets}
              onChange={setSelectedTargets}
              segments={segments ?? []}
              customerGroups={customerGroups}
            />
          </div>

          <div>
            <Label>Planlanan Gönderim Tarihi</Label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={handleCloseCreate}>İptal</Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Kampanya Oluştur
              {totalTargeted > 0 && <span className="ml-1 text-primary-foreground/70">({totalTargeted} kişi)</span>}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Response Modal */}
      <Modal isOpen={!!addResponseModal} onClose={() => setAddResponseModal(null)} title="Manuel Yanıt Gir">
        {addResponseModal && (
          <form onSubmit={e => { e.preventDefault(); addResponseMutation.mutate({ ...responseForm, campaignId: addResponseModal.id, surveyId: addResponseModal.surveyId }); }} className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl text-sm text-primary">
              <strong>{addResponseModal.surveyTitle}</strong> — {addResponseModal.name}
            </div>
            <div>
              <Label>Skor *
                <span className="text-muted-foreground font-normal ml-2 text-xs">
                  {addResponseModal.surveyType === "NPS" ? "(0-10)" : addResponseModal.surveyType === "CSAT" ? "(1-5)" : "(1-7)"}
                </span>
              </Label>
              <Input required type="number"
                min={addResponseModal.surveyType === "NPS" ? "0" : "1"}
                max={addResponseModal.surveyType === "NPS" ? "10" : addResponseModal.surveyType === "CES" ? "7" : "5"}
                step="0.1"
                value={responseForm.score} onChange={e => setResponseForm(f => ({ ...f, score: e.target.value }))}
                placeholder={addResponseModal.surveyType === "NPS" ? "0-10" : "1-5"} />
            </div>
            <div>
              <Label>Yazılı Geri Bildirim</Label>
              <textarea value={responseForm.feedback} onChange={e => setResponseForm(f => ({ ...f, feedback: e.target.value }))}
                rows={3} placeholder="Müşterinin yazdığı yorum..."
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            </div>
            <div>
              <Label>Yanıt Tarihi</Label>
              <Input type="datetime-local" value={responseForm.respondedAt} onChange={e => setResponseForm(f => ({ ...f, respondedAt: e.target.value }))} />
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setAddResponseModal(null)}>İptal</Button>
              <Button type="submit" variant="primary" isLoading={addResponseMutation.isPending}>Kaydet</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* View Responses Modal */}
      <Modal isOpen={!!responseModal} onClose={() => setResponseModal(null)} title={`${responseModal?.name} — Yanıtlar`}>
        {responseModal && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {!responses || responses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz yanıt yok.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-primary/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{(responses.reduce((a, r) => a + r.score, 0) / responses.length).toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Ort. Skor</p>
                  </div>
                  <div className="bg-success/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-success">{responses.filter(r => r.sentiment === "positive").length}</p>
                    <p className="text-xs text-muted-foreground">Pozitif</p>
                  </div>
                  <div className="bg-destructive/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{responses.filter(r => r.sentiment === "negative").length}</p>
                    <p className="text-xs text-muted-foreground">Negatif</p>
                  </div>
                </div>
                {responses.map(r => (
                  <div key={r.id} className="bg-white/[0.02] border border-border/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground">{r.customerName || "Anonim"}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-lg font-bold", r.sentiment === "positive" ? "text-success" : r.sentiment === "negative" ? "text-destructive" : "text-warning")}>
                          {r.score}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.respondedAt)}</span>
                      </div>
                    </div>
                    {r.feedback && <p className="text-sm text-muted-foreground">{r.feedback}</p>}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* AI Personalize Modal */}
      {aiPersonalizeOpen && (
        <AiPersonalizeModal
          surveys={surveys ?? []}
          segments={segments ?? []}
          customerGroups={customerGroups}
          companyName={companySettings?.companyName ?? "CX-Inn"}
          onClose={() => setAiPersonalizeOpen(false)}
        />
      )}
    </Layout>
  );
}
