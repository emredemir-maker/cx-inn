import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, Button, LoadingScreen } from "@/components/ui-elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, TrendingUp, Ticket, AlertTriangle, BrainCircuit,
  ChevronDown, ChevronUp, ChevronsUpDown, Tag, Users, CheckCircle, Loader2, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { usePermissions } from "@/context/permissions-context";

function maskEmail(email: string): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked = local.length <= 2 ? "*".repeat(local.length) : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

type Company = {
  company: string;
  customerCount: number;
  avgNps: number | null;
  avgCsat: number | null;
  highChurnCount: number;
  negativeSentimentCount: number;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionSeconds: number | null;
  analysisCount: number;
  painPoints: string[];
  keyTopics: string[];
};

type CompanyCustomer = {
  id: number;
  name: string;
  email: string;
  npsScore: number | null;
  churnRisk: string;
  sentiment: string;
};

const CHURN_COLOR = { low: "text-success", medium: "text-warning", high: "text-destructive" };
const CHURN_LABEL = { low: "Düşük", medium: "Orta", high: "Yüksek" };
const SENTIMENT_COLOR = { positive: "text-success", neutral: "text-warning", negative: "text-destructive" };

function npsColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 7) return "text-success";
  if (score >= 5) return "text-warning";
  return "text-destructive";
}

function resolutionTime(secs: number | null) {
  if (!secs) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)} gün`;
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
}

function CompanyRow({ c, analyzing, onAnalyze }: { c: Company; analyzing: boolean; onAnalyze: () => void }) {
  const [open, setOpen] = useState(false);
  const { myPiiLevel } = usePermissions();
  const maskEmailField = myPiiLevel("email") === "masked";
  const { data: customers } = useQuery<CompanyCustomer[]>({
    queryKey: ["company-customers", c.company],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${encodeURIComponent(c.company)}/customers`);
      if (!res.ok) throw new Error("Hata");
      return res.json();
    },
    enabled: open,
  });

  const resolutionPct = c.totalTickets > 0
    ? Math.round((c.resolvedTickets / c.totalTickets) * 100)
    : 0;

  return (
    <Card className={cn("overflow-hidden transition-all", open && "ring-1 ring-primary/30")}>
      {/* Company Header Row */}
      <div
        className="p-5 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {/* Logo placeholder */}
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-700/20 border border-border flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-primary" />
        </div>

        {/* Name + counts */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{c.company}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c.customerCount} kişi · {c.totalTickets} kayıt · {c.analysisCount} analiz
          </p>
        </div>

        {/* NPS */}
        <div className="text-center w-16 flex-shrink-0">
          <p className={cn("text-xl font-bold", npsColor(c.avgNps))}>
            {c.avgNps !== null ? c.avgNps.toFixed(1) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">NPS</p>
        </div>

        {/* CSAT */}
        <div className="text-center w-16 flex-shrink-0">
          <p className={cn("text-xl font-bold", npsColor(c.avgCsat ? c.avgCsat * 2 : null))}>
            {c.avgCsat !== null ? c.avgCsat.toFixed(1) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">CSAT</p>
        </div>

        {/* Open tickets */}
        <div className="text-center w-20 flex-shrink-0">
          <p className={cn("text-xl font-bold", c.openTickets > 0 ? "text-warning" : "text-success")}>
            {c.openTickets}
          </p>
          <p className="text-[10px] text-muted-foreground">Açık Talep</p>
        </div>

        {/* Churn risk indicator */}
        <div className="text-center w-20 flex-shrink-0">
          <p className={cn("text-base font-bold", c.highChurnCount > 0 ? "text-destructive" : "text-success")}>
            {c.highChurnCount}
          </p>
          <p className="text-[10px] text-muted-foreground">Yüksek Churn</p>
        </div>

        {/* Analyse button */}
        <Button
          variant="ghost"
          className="text-primary border border-primary/20 hover:bg-primary/10 flex-shrink-0 text-xs"
          onClick={e => { e.stopPropagation(); onAnalyze(); }}
          disabled={analyzing}
        >
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
          {analyzing ? "Analiz..." : "Analiz Et"}
        </Button>

        {/* Expand toggle */}
        <div className="text-muted-foreground flex-shrink-0">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border/50 p-5 space-y-5 bg-white/[0.01]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Resolution rate */}
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Çözüm Oranı</p>
              <p className="text-2xl font-bold text-foreground">{resolutionPct}%</p>
              <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${resolutionPct}%` }} />
              </div>
            </div>
            {/* Avg resolution time */}
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Ort. Çözüm Süresi</p>
              <p className="text-2xl font-bold text-foreground">{resolutionTime(c.avgResolutionSeconds) ?? "—"}</p>
            </div>
            {/* Negative sentiment */}
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Negatif Sentiment</p>
              <p className="text-2xl font-bold text-foreground">{c.negativeSentimentCount}</p>
              <p className="text-xs text-muted-foreground">müşteri</p>
            </div>
            {/* Analysis count */}
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">AI Analizi</p>
              <p className="text-2xl font-bold text-foreground">{c.analysisCount}</p>
              <p className="text-xs text-muted-foreground">toplam</p>
            </div>
          </div>

          {/* Pain Points */}
          {c.painPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Acı Noktalar
              </p>
              <ul className="space-y-1">
                {c.painPoints.map((p, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span className="text-warning mt-1">•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Topics as tags */}
          {c.keyTopics.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" /> Konu Etiketleri
              </p>
              <div className="flex flex-wrap gap-2">
                {c.keyTopics.map((t, i) => (
                  <span key={i} className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Customers list */}
          {customers && customers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Kişiler ({customers.length})
              </p>
              <div className="space-y-2">
                {customers.map(cust => (
                  <div key={cust.id} className="flex items-center justify-between py-2 px-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {cust.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{cust.name}</p>
                        <p className="text-xs text-muted-foreground">{maskEmailField ? maskEmail(cust.email) : cust.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-foreground">
                        NPS: <span className={npsColor(cust.npsScore)}>{cust.npsScore?.toFixed(1) ?? "—"}</span>
                      </span>
                      <span className={cn("text-xs font-semibold", CHURN_COLOR[cust.churnRisk as keyof typeof CHURN_COLOR])}>
                        {CHURN_LABEL[cust.churnRisk as keyof typeof CHURN_LABEL]}
                      </span>
                      <Link href={`/customers/${cust.id}`}>
                        <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Companies() {
  const { toast } = useToast();
  const { myPiiLevel } = usePermissions();
  const maskEmailField = myPiiLevel("email") === "masked";
  const queryClient = useQueryClient();
  const [analyzingCompany, setAnalyzingCompany] = useState<string | null>(null);

  type SortKey = "name" | "nps" | "csat";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "nps" || key === "csat" ? "desc" : "asc"); }
  };

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error("Hata");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const analyzeCompany = async (c: Company) => {
    setAnalyzingCompany(c.company);
    try {
      // Get all customer IDs for this company
      const custRes = await fetch(`/api/companies/${encodeURIComponent(c.company)}/customers`);
      const customers: CompanyCustomer[] = await custRes.json();
      const customerIds = customers.map(cu => cu.id);

      const res = await fetch("/api/cx-analyses/bulk-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds }),
      });
      if (!res.ok) throw new Error("Analiz başlatılamadı");

      toast({
        title: "Analiz Başlatıldı",
        description: `${c.company} için ${customerIds.length} müşteri analiz ediliyor. Bu işlem arka planda devam edecek.`,
      });

      // Poll for completion
      let done = 0;
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/cx-analyses/bulk-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerIds }),
          });
          const status = await statusRes.json();
          done = status.done;
          if (done >= customerIds.length) {
            clearInterval(poll);
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["company-customers", c.company] });
            toast({ title: "Analiz Tamamlandı", description: `${c.company}: ${customerIds.length} müşteri analiz edildi.` });
            setAnalyzingCompany(null);
          }
        } catch {
          clearInterval(poll);
          setAnalyzingCompany(null);
        }
      }, 5000);

      // Safety timeout — stop polling after 5 minutes
      setTimeout(() => { clearInterval(poll); setAnalyzingCompany(null); }, 300000);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
      setAnalyzingCompany(null);
    }
  };

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  const totalCompanies = companies?.length ?? 0;
  const withAnalysis = companies?.filter(c => c.analysisCount > 0).length ?? 0;
  const highChurnCompanies = companies?.filter(c => c.highChurnCount > 0).length ?? 0;
  const totalOpenTickets = companies?.reduce((sum, c) => sum + c.openTickets, 0) ?? 0;

  const sortedCompanies = useMemo(() => {
    const list = [...(companies || [])];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = (a.company || "").localeCompare(b.company || "", "tr");
      else if (sortKey === "nps") cmp = ((a.avgNps ?? -1) - (b.avgNps ?? -1));
      else if (sortKey === "csat") cmp = ((a.avgCsat ?? -1) - (b.avgCsat ?? -1));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [companies, sortKey, sortDir]);

  return (
    <Layout>
      <PageHeader
        title="Firma Bazlı Analiz"
        description="B2B müşterilerinizi firma düzeyinde değerlendirin — NPS, CSAT, ticket metrikleri ve AI analizleri."
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Toplam Firma</p>
          <p className="text-3xl font-bold text-foreground">{totalCompanies}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-1">AI Analizi Yapılan</p>
          <p className="text-3xl font-bold text-primary">{withAnalysis}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Açık Talep (Toplam)</p>
          <p className={cn("text-3xl font-bold", totalOpenTickets > 0 ? "text-warning" : "text-success")}>{totalOpenTickets}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Yüksek Churn Riskli</p>
          <p className={cn("text-3xl font-bold", highChurnCompanies > 0 ? "text-destructive" : "text-success")}>{highChurnCompanies}</p>
          <p className="text-xs text-muted-foreground mt-0.5">firma</p>
        </Card>
      </div>

      {/* Column headers */}
      {companies && companies.length > 0 && (
        <div className="flex items-center gap-4 px-5 mb-2">
          {(["name", "nps", "csat"] as SortKey[]).map((key) => {
            const labels: Record<SortKey, string> = { name: "Firma", nps: "NPS", csat: "CSAT" };
            const widths: Record<SortKey, string> = { name: "flex-1", nps: "w-16", csat: "w-16" };
            return (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={cn(
                  "flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors",
                  widths[key],
                  key !== "name" && "justify-center",
                  sortKey === key ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                {labels[key]}
                {sortKey === key
                  ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                  : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
              </button>
            );
          })}
          <div className="w-20 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Açık</div>
          <div className="w-20 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Yük. Churn</div>
          <div className="w-20" />
          <div className="w-4" />
        </div>
      )}

      {/* Company list */}
      <div className="space-y-3">
        {!companies || companies.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold text-foreground">Henüz Firma Verisi Yok</h3>
            <p className="text-muted-foreground mt-2">Müşteri kaydı oluştururken firma alanını doldurun.</p>
          </Card>
        ) : (
          sortedCompanies.map(c => (
            <CompanyRow
              key={c.company}
              c={c}
              analyzing={analyzingCompany === c.company}
              onAnalyze={() => analyzeCompany(c)}
            />
          ))
        )}
      </div>
    </Layout>
  );
}
