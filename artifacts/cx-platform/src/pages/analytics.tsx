import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, PageHeader, LoadingScreen, StatusBadge } from "@/components/ui-elements";
import {
  TrendingDown, TrendingUp, AlertTriangle, ThumbsUp, ThumbsDown,
  Minus, Tag, MessageCircle, Zap, BarChart2, Users, Star, Activity,
  CalendarDays, Flame, Brain, Target, CheckCircle2, ChevronRight,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function npsColor(nps: number) {
  if (nps >= 7) return "text-green-400";
  if (nps >= 5) return "text-yellow-400";
  return "text-red-400";
}

function npsBg(nps: number) {
  if (nps >= 7) return "bg-green-400/10 border-green-400/20";
  if (nps >= 5) return "bg-yellow-400/10 border-yellow-400/20";
  return "bg-red-400/10 border-red-400/20";
}

function npsLabel(nps: number) {
  if (nps >= 9) return "Promoter";
  if (nps >= 7) return "Passive";
  return "Detractor";
}

function csatLabel(csat: number) {
  if (csat >= 4) return "Memnun";
  if (csat >= 3) return "Nötr";
  return "Memnun Değil";
}

function channelLabel(ch: string) {
  const map: Record<string, string> = {
    email: "E-posta", phone: "Telefon", chat: "Chat",
    web: "Web", sms: "SMS", "in-app": "Mobil",
  };
  return map[ch] ?? ch;
}

function sentimentLabel(s: string) {
  if (s === "positive") return "Olumlu";
  if (s === "negative") return "Olumsuz";
  return "Nötr";
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Verbatim Card ────────────────────────────────────────────────────────────

function VerbatimCard({ item, sentiment }: { item: any; sentiment: "negative" | "positive" }) {
  const isNeg = sentiment === "negative";
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-2",
      isNeg ? "border-red-400/20 bg-red-400/5" : "border-green-400/20 bg-green-400/5"
    )}>
      <div className="flex items-center gap-2">
        {isNeg
          ? <ThumbsDown className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
          : <ThumbsUp className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />}
        <span className="text-xs font-bold text-foreground">{item.customer_name}</span>
        {item.predicted_nps != null && (
          <span className={cn("text-xs font-bold ml-auto", npsColor(parseFloat(item.predicted_nps)))}>
            NPS {item.predicted_nps}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
        {item.content}
      </p>
      {item.key_topics && (
        <div className="flex flex-wrap gap-1 pt-1">
          {item.key_topics.split(", ").slice(0, 3).map((t: string) => (
            <span key={t} className="px-1.5 py-0.5 rounded-full bg-white/5 border border-border/20 text-[10px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type MonthStat = {
  monthKey: string;
  monthLabel: string;
  avgNps: number | null;
  avgCsat: number | null;
  interactionCount: number;
  analyzedCount: number;
  highChurnCount: number;
  negativeCount: number;
  positiveCount: number;
  topPainPoints: { painPoint: string; count: number }[];
  churnDist: Record<string, number>;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/analytics/nps-impact"],
    queryFn: () => fetch("/api/analytics/nps-impact").then((r) => r.json()),
  });

  const { data: trendData } = useQuery<{ months: MonthStat[] }>({
    queryKey: ["/api/analytics/monthly-trend"],
    queryFn: () => fetch("/api/analytics/monthly-trend").then((r) => r.json()),
    refetchInterval: 60000,
  });

  const { data: accuracyData } = useQuery<{
    stats: {
      total: number; maeNps: number | null; maeCsat: number | null;
      avgDevNps: number | null; avgDevCsat: number | null;
      overCount: number; underCount: number;
    };
    rows: Array<{
      id: number; customerId: number; customerName: string; customerCompany: string;
      surveyType: string; predictedScore: number; actualScore: number;
      deviation: number; absDeviation: number; overPredicted: boolean;
      usedForLearning: boolean; recordedAt: string;
    }>;
    monthlyTrend: Array<{ month: string; mae: number; recordCount: number }>;
  }>({
    queryKey: ["/api/analytics/prediction-accuracy"],
    queryFn: () => fetch("/api/analytics/prediction-accuracy").then((r) => r.json()),
    refetchInterval: 60000,
  });

  const months = trendData?.months ?? [];

  const [verbatimTab, setVerbatimTab] = useState<"negative" | "positive">("negative");

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  if (error || !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Analiz verisi yüklenemedi.
        </div>
      </Layout>
    );
  }

  const {
    overall, tagImpact, painImpact, channelImpact,
    sentimentDist, npsBands, csatBands, verbatimNegative, verbatimPositive,
  } = data;

  const totalNps = (npsBands.promoter ?? 0) + (npsBands.passive ?? 0) + (npsBands.detractor ?? 0);
  const totalCsat = (csatBands.satisfied ?? 0) + (csatBands.neutral ?? 0) + (csatBands.dissatisfied ?? 0);

  return (
    <Layout>
      <PageHeader
        title="CX Analiz Raporu"
        description="NPS/CSAT tahminlerini etkileyen kategoriler, ağrı noktaları ve müşteri sesleri."
      />

      {/* ─── Summary KPIs ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Ort. Tahmin NPS
          </p>
          <p className={cn("text-3xl font-black", npsColor(parseFloat(overall.avg_nps ?? "0")))}>
            {overall.avg_nps ?? "-"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{overall.total_analyzed} etkileşim analiz edildi</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" /> Ort. Tahmin CSAT
          </p>
          <p className={cn("text-3xl font-black", npsColor(parseFloat(overall.avg_csat ?? "0") * 1.8))}>
            {overall.avg_csat ?? "-"}
            <span className="text-sm font-normal text-muted-foreground"> / 5</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{csatLabel(parseFloat(overall.avg_csat ?? "0"))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> Yüksek Churn Riski
          </p>
          <p className="text-3xl font-black text-red-400">{overall.high_risk ?? "0"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">müşteri kritik bölgede</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Analiz Edilen
          </p>
          <p className="text-3xl font-black text-foreground">{overall.total_analyzed ?? "0"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">etkileşim</p>
        </Card>
      </div>

      {/* ─── Monthly Trend Chart ─── */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Aylık AI Tahmin Trendi
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerçek ölçüm değil — AI'ın etkileşimlerden ürettiği aylık NPS & CSAT tahminleri
            </p>
          </div>
          <span className="text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-lg border border-border/30">
            {months.length} ay
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-400/8 border border-amber-400/20">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-[11px] text-amber-300/90">
            Bu grafik gerçek anket ölçümlerini değil, Gemini AI'ın etkileşim kayıtlarından ürettiği NPS/CSAT tahminlerini göstermektedir. Gerçek ölçümler için anket kampanyası başlatın.
          </p>
        </div>
        {months.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground/50">
            <CalendarDays className="h-10 w-10" />
            <p className="text-sm">Veri biriktikçe aylık trend otomatik oluşacak</p>
          </div>
        ) : months.length === 1 ? (
          // Single month — show stat cards instead of empty chart
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            {[
              { label: "Tahmini NPS", value: months[0].avgNps?.toFixed(1) ?? "—", color: npsColor(months[0].avgNps ?? 0) },
              { label: "Tahmini CSAT", value: months[0].avgCsat ? `${months[0].avgCsat.toFixed(1)}/5` : "—", color: npsColor((months[0].avgCsat ?? 0) * 2) },
              { label: "Etkileşim", value: months[0].interactionCount, color: "text-foreground" },
              { label: "Yüksek Churn", value: months[0].highChurnCount, color: months[0].highChurnCount > 0 ? "text-red-400" : "text-success" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-xl border border-border/30 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{months[0].monthLabel}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months.map(m => ({ name: m.monthLabel, nps: m.avgNps, csat: m.avgCsat }))}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gNpsA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCsatA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "white" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Area type="monotone" dataKey="nps" name="Tahmin NPS (0-10)" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#gNpsA)" />
                <Area type="monotone" dataKey="csat" name="Tahmin CSAT (1-5)" stroke="hsl(var(--success))" strokeWidth={2.5} fillOpacity={1} fill="url(#gCsatA)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ─── Monthly Insight Cards ─── */}
      {months.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-primary" /> Aylık AI Tahmin İçgörüleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...months].reverse().map((m) => {
              const npsVal = m.avgNps ?? 0;
              const totalAnalyzed = m.analyzedCount;
              const churnHigh = m.highChurnCount;
              const negPct = totalAnalyzed > 0 ? Math.round((m.negativeCount / totalAnalyzed) * 100) : 0;
              const posPct = totalAnalyzed > 0 ? Math.round((m.positiveCount / totalAnalyzed) * 100) : 0;
              return (
                <Card key={m.monthKey} className="p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{m.monthLabel}</p>
                        <p className="text-[10px] text-muted-foreground">{m.interactionCount} etkileşim</p>
                      </div>
                    </div>
                    {churnHigh > 0 && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 border border-red-400/20 font-semibold">
                        <Flame className="h-2.5 w-2.5" /> {churnHigh} churn riski
                      </span>
                    )}
                  </div>

                  {/* NPS / CSAT */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Tahmini NPS</p>
                      <p className={cn("text-2xl font-black", npsColor(npsVal))}>
                        {m.avgNps?.toFixed(1) ?? "—"}
                      </p>
                      <p className={cn("text-[10px] font-semibold mt-0.5", npsColor(npsVal))}>
                        {npsVal >= 9 ? "Promoter" : npsVal >= 7 ? "Passive" : "Detractor"}
                      </p>
                    </div>
                    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Tahmini CSAT</p>
                      <p className={cn("text-2xl font-black", npsColor((m.avgCsat ?? 0) * 2))}>
                        {m.avgCsat?.toFixed(1) ?? "—"}
                        <span className="text-xs font-normal text-muted-foreground">/5</span>
                      </p>
                      <p className={cn("text-[10px] font-semibold mt-0.5", npsColor((m.avgCsat ?? 0) * 2))}>
                        {(m.avgCsat ?? 0) >= 4 ? "Memnun" : (m.avgCsat ?? 0) >= 3 ? "Nötr" : "Memnun Değil"}
                      </p>
                    </div>
                  </div>

                  {/* Sentiment bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span className="flex items-center gap-1"><ThumbsUp className="h-2.5 w-2.5 text-green-400" /> {posPct}% olumlu</span>
                      <span className="flex items-center gap-1">{negPct}% olumsuz <ThumbsDown className="h-2.5 w-2.5 text-red-400" /></span>
                    </div>
                    <div className="h-1.5 bg-border/40 rounded-full overflow-hidden flex">
                      <div className="h-full bg-green-400/60" style={{ width: `${posPct}%` }} />
                      <div className="h-full bg-yellow-400/40 flex-1" />
                      <div className="h-full bg-red-400/60" style={{ width: `${negPct}%` }} />
                    </div>
                  </div>

                  {/* Top pain points */}
                  {m.topPainPoints.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5 text-red-400" /> Öne Çıkan Sorunlar
                      </p>
                      <div className="space-y-1">
                        {m.topPainPoints.slice(0, 3).map((p, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="text-[10px] text-red-400/60 font-bold mt-0.5">{i + 1}.</span>
                            <span className="line-clamp-1">{p.painPoint}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── NPS & CSAT Bands ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" /> NPS Dağılımı (Tahmin)
          </h2>
          <div className="space-y-3">
            {[
              { key: "promoter", label: "Promoter (9-10)", color: "bg-green-400" },
              { key: "passive", label: "Passive (7-8)", color: "bg-yellow-400" },
              { key: "detractor", label: "Detractor (0-6)", color: "bg-red-400" },
            ].map(({ key, label, color }) => {
              const count = npsBands[key] ?? 0;
              const pct = totalNps > 0 ? Math.round((count / totalNps) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
                  <ScoreBar value={count} max={totalNps || 1} color={color} />
                  <span className="text-xs font-bold text-foreground w-10 text-right">{pct}%</span>
                  <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" /> CSAT Dağılımı (Tahmin)
          </h2>
          <div className="space-y-3">
            {[
              { key: "satisfied", label: "Memnun (4-5)", color: "bg-green-400" },
              { key: "neutral", label: "Nötr (3)", color: "bg-yellow-400" },
              { key: "dissatisfied", label: "Memnun Değil (1-2)", color: "bg-red-400" },
            ].map(({ key, label, color }) => {
              const count = csatBands[key] ?? 0;
              const pct = totalCsat > 0 ? Math.round((count / totalCsat) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
                  <ScoreBar value={count} max={totalCsat || 1} color={color} />
                  <span className="text-xs font-bold text-foreground w-10 text-right">{pct}%</span>
                  <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ─── Tag Impact Table ─── */}
      <Card className="mb-6">
        <div className="p-5 border-b border-border/50">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Etiket → NPS/CSAT Etkisi
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hangi etiket kategorisi NPS ve CSAT skorlarını nasıl etkiliyor?
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-border/30">
                <th className="p-4 text-xs font-semibold text-muted-foreground">Etiket</th>
                <th className="p-4 text-xs font-semibold text-muted-foreground text-center">Ticket #</th>
                <th className="p-4 text-xs font-semibold text-muted-foreground text-center">Ort. NPS</th>
                <th className="p-4 text-xs font-semibold text-muted-foreground text-center">NPS Etkisi</th>
                <th className="p-4 text-xs font-semibold text-muted-foreground text-center">Ort. CSAT</th>
                <th className="p-4 text-xs font-semibold text-muted-foreground text-center">CSAT Etkisi</th>
              </tr>
            </thead>
            <tbody>
              {tagImpact.map((item: any) => (
                <tr key={item.tag} className="border-b border-border/20 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Tag className="h-3 w-3 text-primary/60" />
                      {item.tag}
                    </span>
                  </td>
                  <td className="p-4 text-center text-sm font-mono">{item.ticketCount}</td>
                  <td className="p-4 text-center">
                    <span className={cn("text-sm font-bold", npsColor(item.avgNps))}>
                      {item.avgNps}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-center">
                      <ScoreBar value={item.avgNps} max={10} color={item.avgNps >= 7 ? "bg-green-400" : item.avgNps >= 5 ? "bg-yellow-400" : "bg-red-400"} />
                      <span className={cn("text-[10px] font-bold w-16 flex-shrink-0", npsColor(item.avgNps))}>
                        {npsLabel(item.avgNps)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={cn("text-sm font-bold", npsColor(item.avgCsat * 1.8))}>
                      {item.avgCsat}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-center">
                      <ScoreBar value={item.avgCsat} max={5} color={item.avgCsat >= 4 ? "bg-green-400" : item.avgCsat >= 3 ? "bg-yellow-400" : "bg-red-400"} />
                      <span className={cn("text-[10px] font-bold w-16 flex-shrink-0", npsColor(item.avgCsat * 1.8))}>
                        {csatLabel(item.avgCsat)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Pain Point Impact */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" /> Ağrı Noktası → NPS Etkisi
          </h2>
          <div className="space-y-2.5">
            {painImpact.map((item: any) => (
              <div key={item.painPoint} className={cn("rounded-xl border p-3", npsBg(item.avgNps))}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-foreground line-clamp-1 flex-1 mr-2">
                    {item.painPoint}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-xs font-bold", npsColor(item.avgNps))}>
                      NPS {item.avgNps}
                    </span>
                    <span className="text-[10px] text-muted-foreground">CSAT {item.avgCsat}</span>
                  </div>
                </div>
                <ScoreBar value={item.avgNps} max={10} color={item.avgNps >= 7 ? "bg-green-400" : item.avgNps >= 5 ? "bg-yellow-400" : "bg-red-400"} />
              </div>
            ))}
          </div>
        </Card>

        {/* Channel & Sentiment */}
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" /> Kanal → NPS/CSAT Etkisi
            </h2>
            <div className="space-y-2.5">
              {channelImpact.map((item: any) => (
                <div key={item.channel} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border/30">
                  <span className="text-sm font-semibold text-foreground w-24 flex-shrink-0">
                    {channelLabel(item.channel)}
                  </span>
                  <div className="flex-1">
                    <ScoreBar value={item.avgNps ?? 0} max={10} color={item.avgNps >= 7 ? "bg-green-400" : item.avgNps >= 5 ? "bg-yellow-400" : "bg-red-400"} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-xs font-bold", npsColor(item.avgNps ?? 0))}>
                      {item.avgNps ?? "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{item.count} kayıt</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" /> Duygu Durumu → NPS Etkisi
            </h2>
            <div className="space-y-2.5">
              {sentimentDist.map((item: any) => (
                <div key={item.sentiment} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border/30">
                  <div className="flex-shrink-0">
                    {item.sentiment === "positive"
                      ? <ThumbsUp className="h-4 w-4 text-green-400" />
                      : item.sentiment === "negative"
                      ? <ThumbsDown className="h-4 w-4 text-red-400" />
                      : <Minus className="h-4 w-4 text-yellow-400" />}
                  </div>
                  <span className="text-sm font-semibold text-foreground w-16 flex-shrink-0">
                    {sentimentLabel(item.sentiment)}
                  </span>
                  <div className="flex-1">
                    <ScoreBar value={item.avgNps ?? 0} max={10} color={item.avgNps >= 7 ? "bg-green-400" : item.avgNps >= 5 ? "bg-yellow-400" : "bg-red-400"} />
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={cn("text-xs font-bold", npsColor(item.avgNps ?? 0))}>
                      {item.avgNps ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{item.count} analiz</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ─── Prediction Accuracy ─── */}
      <Card className="mb-6">
        <div className="p-5 border-b border-border/50">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> AI Tahmin Doğruluğu
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerçek anket yanıtları ile AI tahminlerinin karşılaştırması — öğrenme döngüsü verileri
          </p>
        </div>
        <div className="p-5">
          {!accuracyData?.stats || accuracyData.stats.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="rounded-full bg-indigo-500/10 border border-indigo-500/20 p-4">
                <Brain className="h-8 w-8 text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Henüz gerçek anket yanıtı yok</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Müşterilere anket gönderip yanıt aldıkça, AI tahminleri ile gerçek skorlar
                  karşılaştırılacak ve sistem kendi kendini iyileştirecek.
                </p>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                {[
                  { icon: Target, label: "Tahmin kaydedildi", desc: "Her AI analizinde NPS/CSAT tahmini saklanır" },
                  { icon: CheckCircle2, label: "Anket yanıtı gelince", desc: "Tahmin ile gerçek sor otomatik eşleşir" },
                  { icon: Brain, label: "Gemini öğrenir", desc: "Sapma geçmişi sonraki analizlere beslenir" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <Icon className="h-4 w-4 text-indigo-400 mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Target className="h-3 w-3" /> Toplam Karşılaştırma
                  </p>
                  <p className="text-2xl font-black text-foreground">{accuracyData.stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">anket yanıtı eşleştirildi</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Activity className="h-3 w-3" /> NPS Ortalama Hata
                  </p>
                  <p className={cn("text-2xl font-black",
                    accuracyData.stats.maeNps == null ? "text-muted-foreground"
                    : accuracyData.stats.maeNps < 1.5 ? "text-green-400"
                    : accuracyData.stats.maeNps < 2.5 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {accuracyData.stats.maeNps != null ? `±${accuracyData.stats.maeNps.toFixed(2)}` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">puan (MAE)</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Star className="h-3 w-3" /> CSAT Ortalama Hata
                  </p>
                  <p className={cn("text-2xl font-black",
                    accuracyData.stats.maeCsat == null ? "text-muted-foreground"
                    : accuracyData.stats.maeCsat < 0.5 ? "text-green-400"
                    : accuracyData.stats.maeCsat < 1 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {accuracyData.stats.maeCsat != null ? `±${accuracyData.stats.maeCsat.toFixed(2)}` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">puan (MAE)</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Brain className="h-3 w-3" /> Sistematik Sapma (NPS)
                  </p>
                  <div className="flex items-center gap-1">
                    {accuracyData.stats.avgDevNps == null ? (
                      <p className="text-2xl font-black text-muted-foreground">—</p>
                    ) : accuracyData.stats.avgDevNps > 0 ? (
                      <>
                        <ArrowUpRight className="h-5 w-5 text-green-400" />
                        <p className="text-2xl font-black text-green-400">+{accuracyData.stats.avgDevNps.toFixed(2)}</p>
                      </>
                    ) : accuracyData.stats.avgDevNps < 0 ? (
                      <>
                        <ArrowDownRight className="h-5 w-5 text-red-400" />
                        <p className="text-2xl font-black text-red-400">{accuracyData.stats.avgDevNps.toFixed(2)}</p>
                      </>
                    ) : (
                      <p className="text-2xl font-black text-green-400">0.00</p>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {accuracyData.stats.avgDevNps != null && accuracyData.stats.avgDevNps > 0.3
                      ? "AI düşük tahmin ediyor"
                      : accuracyData.stats.avgDevNps != null && accuracyData.stats.avgDevNps < -0.3
                      ? "AI yüksek tahmin ediyor"
                      : "Tarafsız tahmin"}
                  </p>
                </div>
              </div>

              {/* MAE Trend Chart */}
              {accuracyData.monthlyTrend.length >= 2 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Aylık Ortalama Hata Trendi (MAE)</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={accuracyData.monthlyTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`±${v.toFixed(2)} puan`, "MAE"]}
                      />
                      <Line type="monotone" dataKey="mae" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Deviation Table */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Tahmin vs Gerçek — Müşteri Bazlı</p>
                <div className="overflow-x-auto rounded-lg border border-border/50">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="text-left p-2.5 font-semibold text-muted-foreground">Müşteri</th>
                        <th className="text-center p-2.5 font-semibold text-muted-foreground">Tür</th>
                        <th className="text-center p-2.5 font-semibold text-muted-foreground">AI Tahmini</th>
                        <th className="text-center p-2.5 font-semibold text-muted-foreground">Gerçek Skor</th>
                        <th className="text-center p-2.5 font-semibold text-muted-foreground">Sapma</th>
                        <th className="text-center p-2.5 font-semibold text-muted-foreground">Öğrenme</th>
                        <th className="text-right p-2.5 font-semibold text-muted-foreground">Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accuracyData.rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="p-2.5">
                            <p className="font-semibold text-foreground">{row.customerName ?? "—"}</p>
                            {row.customerCompany && (
                              <p className="text-[10px] text-muted-foreground">{row.customerCompany}</p>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              row.surveyType === "nps"
                                ? "bg-indigo-500/10 text-indigo-400"
                                : "bg-amber-500/10 text-amber-400"
                            )}>
                              {row.surveyType}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-foreground">
                            {row.predictedScore.toFixed(1)}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-foreground">
                            {row.actualScore.toFixed(1)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={cn("flex items-center justify-center gap-0.5 font-bold",
                              row.absDeviation < 1 ? "text-green-400"
                              : row.absDeviation < 2 ? "text-yellow-400" : "text-red-400"
                            )}>
                              {row.deviation > 0 ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : row.deviation < 0 ? (
                                <ArrowDownRight className="h-3 w-3" />
                              ) : (
                                <Minus className="h-3 w-3" />
                              )}
                              {Math.abs(row.deviation).toFixed(1)}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {row.usedForLearning ? (
                              <span className="text-[10px] text-green-400 flex items-center justify-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Kullanıldı
                              </span>
                            ) : (
                              <span className="text-[10px] text-indigo-400 flex items-center justify-center gap-0.5">
                                <Brain className="h-3 w-3" /> Bekliyor
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right text-muted-foreground">
                            {new Date(row.recordedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ─── Customer Verbatim ─── */}
      <Card>
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" /> Müşteri Sesleri
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI analiz edilen etkileşimlerden gerçek müşteri ifadeleri
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setVerbatimTab("negative")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                verbatimTab === "negative"
                  ? "bg-red-400/15 border border-red-400/30 text-red-400"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <ThumbsDown className="h-3 w-3" /> Olumsuz
            </button>
            <button
              onClick={() => setVerbatimTab("positive")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                verbatimTab === "positive"
                  ? "bg-green-400/15 border border-green-400/30 text-green-400"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <ThumbsUp className="h-3 w-3" /> Olumlu
            </button>
          </div>
        </div>
        <div className="p-5">
          {verbatimTab === "negative" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {verbatimNegative.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 text-center py-6">
                  Olumsuz etkileşim verisi bulunamadı.
                </p>
              )}
              {verbatimNegative.map((item: any, i: number) => (
                <VerbatimCard key={i} item={item} sentiment="negative" />
              ))}
            </div>
          )}
          {verbatimTab === "positive" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {verbatimPositive.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 text-center py-6">
                  Olumlu etkileşim verisi bulunamadı.
                </p>
              )}
              {verbatimPositive.map((item: any, i: number) => (
                <VerbatimCard key={i} item={item} sentiment="positive" />
              ))}
            </div>
          )}
        </div>
      </Card>
    </Layout>
  );
}
