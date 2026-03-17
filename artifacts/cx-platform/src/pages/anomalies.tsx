import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, Button, Modal, Label, LoadingScreen } from "@/components/ui-elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSurveysList } from "@/hooks/use-surveys";
import {
  AlertTriangle, Zap, TrendingDown, Shield, Users,
  Send, CheckCircle, ChevronRight, Activity, Brain,
  AlertCircle, BarChart2, Flame, Clock, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

type AnomalySummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

type Anomaly = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  segment: string | null;
  analysisId: number;
  predictedNps: number | null;
  predictedCsat: number | null;
  overallSentiment: string;
  churnRisk: string;
  painPoints: string[];
  keyTopics: string[];
  summary: string | null;
  recommendations: string | null;
  analyzedAt: string;
  openTickets: number;
  severity: "critical" | "high" | "medium" | "low";
  triggers: string[];
};

type AnomalyResponse = {
  summary: AnomalySummary;
  anomalies: Anomaly[];
};

function useAnomalies() {
  return useQuery<AnomalyResponse>({
    queryKey: ["anomalies"],
    queryFn: async () => {
      const res = await fetch("/api/anomalies");
      if (!res.ok) throw new Error("Anomaliler alınamadı");
      return res.json();
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });
}

const SEVERITY_CONFIG = {
  critical: {
    label: "Kritik",
    icon: Flame,
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    text: "text-destructive",
    badge: "bg-destructive/15 text-destructive border-destructive/20",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.08)]",
    dot: "bg-destructive",
  },
  high: {
    label: "Yüksek",
    icon: AlertTriangle,
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-400",
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.08)]",
    dot: "bg-orange-400",
  },
  medium: {
    label: "Orta",
    icon: AlertCircle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    text: "text-yellow-400",
    badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    glow: "",
    dot: "bg-yellow-400",
  },
  low: {
    label: "Düşük",
    icon: TrendingDown,
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    glow: "",
    dot: "bg-blue-400",
  },
};

const SENTIMENT_LABEL: Record<string, string> = { positive: "Pozitif", neutral: "Nötr", negative: "Negatif" };
const CHURN_LABEL: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };
const CHURN_COLOR: Record<string, string> = { low: "text-success", medium: "text-warning", high: "text-destructive" };

function NpsBar({ nps }: { nps: number | null }) {
  if (nps == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = nps >= 9 ? "text-success" : nps >= 7 ? "text-warning" : "text-destructive";
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("font-bold text-lg tabular-nums", color)}>{nps.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">/10</span>
    </div>
  );
}

export default function Anomalies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useAnomalies();
  const { data: surveys } = useSurveysList();

  const [triggerModal, setTriggerModal] = useState<Anomaly | null>(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [bulkSurveyId, setBulkSurveyId] = useState("");
  const [bulkMinSeverity, setBulkMinSeverity] = useState("high");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const triggerMutation = useMutation({
    mutationFn: async ({ customerId, customerName }: { customerId: number; customerName: string }) => {
      const res = await fetch(`/api/anomalies/${customerId}/trigger-survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: Number(selectedSurveyId), customerName }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-campaigns"] });
      setTriggerModal(null);
      setSelectedSurveyId("");
      toast({ title: "Anket tetiklendi", description: "Kampanya Yönetimi'nde görüntüleyebilirsiniz." });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/anomalies/bulk-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: Number(bulkSurveyId), minSeverity: bulkMinSeverity }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["survey-campaigns"] });
      setBulkModal(false);
      setBulkSurveyId("");
      toast({ title: "Toplu tetikleme tamamlandı", description: `${data.triggered} kampanya oluşturuldu.` });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const summary = data?.summary;
  const anomalies = data?.anomalies ?? [];
  const filtered = severityFilter === "all" ? anomalies : anomalies.filter(a => a.severity === severityFilter);

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      <PageHeader
        title="Sıfır Anket Motoru"
        description="Müşteri anket doldurmasa bile AI anomali tespiti ile CX riskini izleyin ve otomatik tepki verin."
      >
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Son güncelleme: {new Date(dataUpdatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="ghost" onClick={() => refetch()} disabled={isFetching} className="border border-border">
            {isFetching
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Yenileniyor...</>
              : <><Activity className="h-4 w-4" /> Yenile</>}
          </Button>
          {summary && summary.total > 0 && (
            <Button
              variant="primary"
              onClick={() => setBulkModal(true)}
              className="shadow-[0_0_20px_rgba(99,102,241,0.25)]"
            >
              <Zap className="h-4 w-4" /> Toplu Tetikle
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Toplam Anomali", value: summary?.total ?? 0, icon: Brain, color: "primary", filter: "all" },
          { label: "Kritik", value: summary?.critical ?? 0, icon: Flame, color: "destructive", filter: "critical" },
          { label: "Yüksek Risk", value: summary?.high ?? 0, icon: AlertTriangle, color: "warning", filter: "high" },
          { label: "Orta Risk", value: summary?.medium ?? 0, icon: AlertCircle, color: "yellow-400", filter: "medium" },
          { label: "Düşük Risk", value: summary?.low ?? 0, icon: TrendingDown, color: "blue-400", filter: "low" },
        ].map(({ label, value, icon: Icon, color, filter }) => (
          <Card
            key={label}
            className={cn(
              "p-4 cursor-pointer transition-all hover:border-primary/30",
              severityFilter === filter && "border-primary/50 bg-primary/5"
            )}
            onClick={() => setSeverityFilter(severityFilter === filter ? "all" : filter)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-2xl font-display font-bold text-foreground">{value}</p>
              </div>
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", `bg-${color}/10 text-${color}`)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* How it works banner */}
      <div className="mb-6 bg-gradient-to-r from-primary/10 via-indigo-500/5 to-transparent border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Zero-Survey Intelligence Aktif</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Müşteri anket doldurmadan AI; destek talebi hızı, tahminlenen NPS/CSAT ve duygu analizinden
            <span className="text-primary font-medium"> Sentetik CX Skoru</span> üretiyor.
            Anomali tespit edildiğinde tek tıkla anket tetiklenebiliyor.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-success font-semibold">Canlı</span>
        </div>
      </div>

      {/* Anomaly Feed */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Shield className="h-12 w-12 mx-auto text-success/40 mb-4" />
          <h3 className="text-lg font-display font-bold text-foreground">
            {severityFilter === "all" ? "Anomali Tespit Edilmedi" : `${SEVERITY_CONFIG[severityFilter as keyof typeof SEVERITY_CONFIG]?.label} Seviyesinde Anomali Yok`}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {severityFilter === "all"
              ? "Tüm müşterilerin CX sağlığı normal görünüyor. AI analiz verisi arttıkça daha hassas tespitler yapılacak."
              : "Bu risk seviyesinde anomali bulunamadı."}
          </p>
          {severityFilter !== "all" && (
            <Button variant="ghost" className="mt-4 border border-border" onClick={() => setSeverityFilter("all")}>
              Tüm Anomalileri Göster
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(anomaly => {
            const cfg = SEVERITY_CONFIG[anomaly.severity];
            const SevIcon = cfg.icon;
            const isExpanded = expandedId === anomaly.id;

            return (
              <Card
                key={anomaly.id}
                className={cn(
                  "overflow-hidden transition-all border",
                  cfg.border,
                  cfg.glow
                )}
              >
                {/* Main row */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm", cfg.bg, cfg.text)}>
                      {anomaly.name.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-display font-bold text-foreground">{anomaly.name}</h3>
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border", cfg.badge)}>
                          <SevIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {anomaly.company && (
                          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-border/50">
                            {anomaly.company}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mb-2">{anomaly.email}</p>

                      {/* Trigger reasons */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {anomaly.triggers.map((t, i) => (
                          <span key={i} className={cn("text-[11px] px-2 py-0.5 rounded-full border", cfg.badge)}>
                            {t}
                          </span>
                        ))}
                        {anomaly.openTickets >= 2 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-400 border-orange-500/20 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {anomaly.openTickets} açık talep
                          </span>
                        )}
                      </div>

                      {/* Metrics row */}
                      <div className="flex items-center gap-5 text-xs">
                        <div>
                          <span className="text-muted-foreground mr-1">Sentetik NPS:</span>
                          <NpsBar nps={anomaly.predictedNps} />
                        </div>
                        <div>
                          <span className="text-muted-foreground mr-1">CSAT:</span>
                          <span className={cn("font-semibold", anomaly.predictedCsat != null && anomaly.predictedCsat <= 2 ? "text-destructive" : "text-foreground")}>
                            {anomaly.predictedCsat != null ? `${anomaly.predictedCsat.toFixed(1)}/5` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground mr-1">Churn:</span>
                          <span className={cn("font-semibold", CHURN_COLOR[anomaly.churnRisk])}>
                            {CHURN_LABEL[anomaly.churnRisk]}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground mr-1">Duygu:</span>
                          <span className="font-semibold text-foreground">{SENTIMENT_LABEL[anomaly.overallSentiment]}</span>
                        </div>
                        <div className="ml-auto text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDate(anomaly.analyzedAt)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        variant="primary"
                        className="text-xs py-1.5 px-3"
                        onClick={() => { setTriggerModal(anomaly); setSelectedSurveyId(""); }}
                      >
                        <Send className="h-3.5 w-3.5" /> Anket Tetikle
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs py-1.5 px-3 border border-border"
                        onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                      >
                        <Brain className="h-3.5 w-3.5" />
                        {isExpanded ? "Kapat" : "AI Özeti"}
                        <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded AI details */}
                {isExpanded && (
                  <div className={cn("border-t border-border/30 px-4 py-4 space-y-3", cfg.bg)}>
                    {anomaly.summary && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">AI Özet</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{anomaly.summary}</p>
                      </div>
                    )}

                    {anomaly.painPoints.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ağrı Noktaları</p>
                        <div className="flex flex-wrap gap-1.5">
                          {anomaly.painPoints.map((p, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {anomaly.recommendations && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">AI Önerisi</p>
                        <p className="text-sm text-foreground/80 leading-relaxed italic">"{anomaly.recommendations}"</p>
                      </div>
                    )}

                    {anomaly.keyTopics.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Anahtar Konular</p>
                        <div className="flex flex-wrap gap-1.5">
                          {anomaly.keyTopics.map((t, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Single Trigger Modal */}
      <Modal isOpen={!!triggerModal} onClose={() => setTriggerModal(null)} title="Anket Tetikle">
        {triggerModal && (
          <form
            onSubmit={e => {
              e.preventDefault();
              triggerMutation.mutate({ customerId: triggerModal.id, customerName: triggerModal.name });
            }}
            className="space-y-4"
          >
            <div className={cn("p-3 rounded-xl border flex items-start gap-3", SEVERITY_CONFIG[triggerModal.severity].badge, SEVERITY_CONFIG[triggerModal.severity].border)}>
              {React.createElement(SEVERITY_CONFIG[triggerModal.severity].icon, { className: "h-4 w-4 flex-shrink-0 mt-0.5" })}
              <div>
                <p className="font-semibold text-sm">{triggerModal.name}</p>
                <p className="text-xs opacity-75">{triggerModal.email}</p>
                <p className="text-xs mt-1 opacity-75">Anomali: {triggerModal.triggers.join(" · ")}</p>
              </div>
            </div>

            <div>
              <Label>Anket Seçin *</Label>
              <select
                required
                value={selectedSurveyId}
                onChange={e => setSelectedSurveyId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Anket seçin...</option>
                {surveys?.map(s => <option key={s.id} value={s.id}>{s.title} ({s.type})</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Seçilen anket bu müşteri için yeni bir kampanya olarak oluşturulacak.
              </p>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setTriggerModal(null)}>İptal</Button>
              <Button type="submit" variant="primary" isLoading={triggerMutation.isPending}>
                <Send className="h-4 w-4" /> Tetikle
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk Trigger Modal */}
      <Modal isOpen={bulkModal} onClose={() => setBulkModal(false)} title="Toplu Anomali Tetikleme">
        <form
          onSubmit={e => { e.preventDefault(); bulkMutation.mutate(); }}
          className="space-y-4"
        >
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 text-sm text-warning">
            <p className="font-semibold mb-1">Toplu İşlem</p>
            <p className="text-xs opacity-80">
              Seçilen risk seviyesindeki tüm anomaliler için otomatik anket kampanyası oluşturulacak.
              Her müşteri için ayrı bir kampanya kaydı yaratılır.
            </p>
          </div>

          <div>
            <Label>Minimum Risk Seviyesi</Label>
            <select
              value={bulkMinSeverity}
              onChange={e => setBulkMinSeverity(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="critical">Sadece Kritik ({summary?.critical ?? 0} müşteri)</option>
              <option value="high">Kritik + Yüksek ({(summary?.critical ?? 0) + (summary?.high ?? 0)} müşteri)</option>
              <option value="medium">Kritik + Yüksek + Orta ({(summary?.critical ?? 0) + (summary?.high ?? 0) + (summary?.medium ?? 0)} müşteri)</option>
              <option value="low">Tümü ({summary?.total ?? 0} müşteri)</option>
            </select>
          </div>

          <div>
            <Label>Anket Seçin *</Label>
            <select
              required
              value={bulkSurveyId}
              onChange={e => setBulkSurveyId(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Anket seçin...</option>
              {surveys?.map(s => <option key={s.id} value={s.id}>{s.title} ({s.type})</option>)}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setBulkModal(false)}>İptal</Button>
            <Button type="submit" variant="primary" isLoading={bulkMutation.isPending}>
              <Zap className="h-4 w-4" /> Toplu Tetikle
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
