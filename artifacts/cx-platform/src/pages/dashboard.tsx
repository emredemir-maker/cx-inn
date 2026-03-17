import React from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, PageHeader, LoadingScreen } from "@/components/ui-elements";
import { MetricInfo } from "@/components/metric-info";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  MessageSquare,
  MessagesSquare,
  Send,
  AlertTriangle,
  ArrowRight,
  Zap,
  Flame,
  Ticket,
  Phone,
  CheckCircle,
  CircleDot,
  Lightbulb,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

type Metrics = {
  npsScore: number;
  csatScore: number;
  totalCustomers: number;
  highChurnCount: number;
  totalInteractions: number;
  openTickets: number;
  activeCampaigns: number;
  totalResponses: number;
  analysisCount: number;
};


function useMetrics() {
  return useQuery<Metrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/metrics");
      if (!res.ok) throw new Error("Metrikler alınamadı");
      return res.json();
    },
    refetchInterval: 30000,
  });
}

function useTrend() {
  return useQuery<any[]>({
    queryKey: ["dashboard-trend"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/trend");
      if (!res.ok) throw new Error("Trend verisi alınamadı");
      return res.json();
    },
  });
}

type RequestInsights = {
  painPoints: { label: string; count: number }[];
  topics: { label: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  typeBreakdown: { type: string; count: number }[];
};

function useRequestInsights() {
  return useQuery<RequestInsights>({
    queryKey: ["dashboard-request-insights"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/request-insights");
      if (!res.ok) throw new Error("Talepler alınamadı");
      return res.json();
    },
    refetchInterval: 60000,
  });
}

function useAnomalySummary() {
  return useQuery<{ summary: { total: number; critical: number; high: number; medium: number; low: number } }>({
    queryKey: ["anomalies"],
    queryFn: async () => {
      const res = await fetch("/api/anomalies");
      if (!res.ok) throw new Error("Anomaliler alınamadı");
      return res.json();
    },
  });
}

function StatCard({ title, value, sub, icon: Icon, color, href, metricKey }: any) {
  const content = (
    <Card className={cn(
      "p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default",
      href && "hover:border-primary/40 cursor-pointer"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
            {title}
            {metricKey && <MetricInfo metricKey={metricKey} side="bottom" />}
          </div>
          <h3 className="text-3xl font-display font-bold text-foreground">{value}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
        </div>
        <div className={cn("p-3 rounded-2xl flex-shrink-0", `bg-${color}/10 text-${color}`)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}


export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: trends } = useTrend();
  const { data: insights } = useRequestInsights();
  const { data: anomalyData } = useAnomalySummary();
  const anomalySummary = anomalyData?.summary;

  if (metricsLoading) return <Layout><LoadingScreen /></Layout>;

  const workflowSteps = [
    { label: "Etkileşim Gir", count: metrics?.totalInteractions ?? 0, sub: "ticket / sohbet / çağrı", href: "/interactions", color: "primary", metricKey: "totalInteractions" as const },
    { label: "Açık Talep", count: metrics?.openTickets ?? 0, sub: "çözüm bekliyor", href: "/interactions", color: "warning", metricKey: "openTickets" as const },
    { label: "AI Analizi", count: metrics?.analysisCount ?? 0, sub: "NPS/CSAT tahmini", href: "/interactions", color: "success", metricKey: "analysisCount" as const },
    { label: "Aktif Kampanya", count: metrics?.activeCampaigns ?? 0, sub: "anket gönderimi", href: "/campaigns", color: "primary", metricKey: "activeCampaigns" as const },
  ];

  return (
    <Layout>
      <PageHeader
        title="Gösterge Paneli"
        description="Müşteri deneyimi metrikleri, AI tahminleri ve kampanya durumu."
      />

      {/* Workflow Steps */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {workflowSteps.map((step) => (
          <React.Fragment key={step.label}>
            <Link href={step.href}>
              <Card className="p-5 cursor-pointer hover:border-primary/40 hover:-translate-y-0.5 transition-all">
                <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  {step.label}
                  <MetricInfo metricKey={step.metricKey} side="bottom" />
                </div>
                <p className="text-3xl font-display font-bold text-foreground">{step.count}</p>
                <p className="text-xs text-muted-foreground mt-1">{step.sub}</p>
              </Card>
            </Link>
          </React.Fragment>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Ort. NPS Skoru"
          value={metrics?.npsScore != null ? metrics.npsScore : "—"}
          sub={metrics?.npsScore != null ? "Gemini tahminlerinden" : "Henüz analiz yok"}
          icon={TrendingUp} color="primary"
          metricKey="nps"
        />
        <StatCard
          title="Ort. CSAT Skoru"
          value={metrics?.csatScore != null ? `${metrics.csatScore}/5` : "—"}
          sub={metrics?.csatScore != null ? "Gemini tahminlerinden" : "Henüz analiz yok"}
          icon={MessageSquare} color="success"
          metricKey="csat"
        />
        <StatCard title="Toplam Müşteri" value={metrics?.totalCustomers ?? 0} sub={`${metrics?.highChurnCount ?? 0} yüksek churn riski`} icon={MessagesSquare} color="warning" href="/customers" metricKey="totalCustomers" />
        <StatCard title="Toplam Yanıt" value={metrics?.totalResponses ?? 0} sub="Tüm kampanyalardan" icon={Send} color="primary" href="/campaigns" metricKey="totalResponses" />
      </div>

      {/* Anomaly Banner */}
      {anomalySummary && anomalySummary.total > 0 && (
        <Link href="/anomalies">
          <div className={cn(
            "mb-6 rounded-2xl border p-4 flex items-center gap-4 cursor-pointer hover:border-opacity-60 transition-all group",
            anomalySummary.critical > 0
              ? "bg-destructive/5 border-destructive/25 hover:border-destructive/40"
              : "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/35"
          )}>
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
              anomalySummary.critical > 0 ? "bg-destructive/15 text-destructive" : "bg-orange-500/15 text-orange-400"
            )}>
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-foreground">
                  {anomalySummary.total} Müşteri Anomali Tespit Edildi
                </p>
                {anomalySummary.critical > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/20 font-semibold">
                    <Flame className="h-3 w-3" />
                    {anomalySummary.critical} Kritik
                  </span>
                )}
                {anomalySummary.high > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                    {anomalySummary.high} Yüksek
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Sıfır Anket Motoru müşteri davranışlarından CX riski tespit etti. Anket tetiklemek için tıklayın.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2">
          <Card className="p-6 h-full">
            <div className="mb-6">
              <h3 className="text-lg font-display font-bold">NPS & CSAT Trendi</h3>
              <p className="text-sm text-muted-foreground">Zaman içindeki memnuniyet skoru değişimi</p>
            </div>
            <div className="h-[280px]">
              {!trends || trends.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Trend verisi için müşteri analizlerini tamamlayın.</p>
                  <Link href="/customers" className="text-xs text-primary hover:underline">Toplu Analiz Başlat →</Link>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gNps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gCsat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", color: "white" }} itemStyle={{ color: "white" }} />
                    <Area type="monotone" dataKey="nps" name="NPS (0-10)" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#gNps)" />
                    <Area type="monotone" dataKey="csat" name="CSAT (1-5)" stroke="hsl(var(--success))" strokeWidth={2.5} fillOpacity={1} fill="url(#gCsat)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Customer Request Insights */}
        <div>
          <Card className="p-0 h-full flex flex-col">
            <div className="p-5 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-display font-bold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-warning" />
                Müşteri Talepleri
              </h3>
              <Link href="/interactions" className="text-xs text-primary flex items-center gap-1 hover:underline">
                Kayıtlar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {!insights ? (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Veri yükleniyor…</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* Type & Status row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Type breakdown */}
                  <div className="bg-background/50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Kayıt Türü</p>
                    <div className="space-y-1.5">
                      {(() => {
                        const total = insights.typeBreakdown.reduce((s, t) => s + t.count, 0);
                        const typeMap: Record<string, { label: string; icon: any; color: string }> = {
                          ticket: { label: "Destek Talebi", icon: Ticket, color: "text-primary" },
                          chat: { label: "Sohbet", icon: MessageSquare, color: "text-success" },
                          call: { label: "Çağrı", icon: Phone, color: "text-warning" },
                        };
                        return insights.typeBreakdown.map(t => {
                          const meta = typeMap[t.type] ?? { label: t.type, icon: Ticket, color: "text-muted-foreground" };
                          const Icon = meta.icon;
                          return (
                            <div key={t.type} className="flex items-center gap-1.5">
                              <Icon className={cn("h-3 w-3 shrink-0", meta.color)} />
                              <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/50 rounded-full" style={{ width: `${(t.count / total) * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-5 text-right">{t.count}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Status breakdown */}
                  <div className="bg-background/50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Durum</p>
                    <div className="space-y-1.5">
                      {(() => {
                        const statusMap: Record<string, { label: string; color: string }> = {
                          open: { label: "Açık", color: "text-warning" },
                          resolved: { label: "Çözüldü", color: "text-success" },
                          escalated: { label: "Yükseltildi", color: "text-destructive" },
                          closed: { label: "Kapalı", color: "text-muted-foreground" },
                        };
                        const total = insights.statusBreakdown.reduce((s, t) => s + t.count, 0);
                        return insights.statusBreakdown.map(s => {
                          const meta = statusMap[s.status] ?? { label: s.status, color: "text-muted-foreground" };
                          return (
                            <div key={s.status} className="flex items-center gap-1.5">
                              <CircleDot className={cn("h-3 w-3 shrink-0", meta.color)} />
                              <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                                <div className="h-full bg-success/50 rounded-full" style={{ width: `${(s.count / total) * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-5 text-right">{s.count}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Top pain points */}
                {insights.painPoints.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      Öne Çıkan Sorunlar
                    </p>
                    <div className="space-y-1.5">
                      {(() => {
                        const max = insights.painPoints[0]?.count ?? 1;
                        return insights.painPoints.slice(0, 5).map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs text-foreground truncate">{p.label}</span>
                              </div>
                              <div className="h-1 bg-border/40 rounded-full overflow-hidden">
                                <div className="h-full bg-destructive/50 rounded-full transition-all" style={{ width: `${(p.count / max) * 100}%` }} />
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{p.count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Topic tags */}
                {insights.topics.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                      Konu Etiketleri
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        const max = insights.topics[0]?.count ?? 1;
                        return insights.topics.map((t, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-primary/20 text-primary/80 bg-primary/5"
                            style={{ opacity: 0.5 + (t.count / max) * 0.5 }}>
                            {t.label}
                            {t.count > 1 && <span className="ml-1 text-[10px] text-primary/50">{t.count}</span>}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
