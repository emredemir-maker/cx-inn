import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, StatusBadge, Button, LoadingScreen } from "@/components/ui-elements";
import { useCustomersList } from "@/hooks/use-customers";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, User, BrainCircuit, Loader2, Sparkles, ChevronDown, CheckCircle2, Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Customers() {
  const { data: customers, isLoading } = useCustomersList();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);

  const getSentimentVariant = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "success";
      case "neutral": return "warning";
      case "negative": return "destructive";
      default: return "default";
    }
  };

  const getChurnVariant = (risk: string) => {
    switch (risk) {
      case "low": return "success";
      case "medium": return "warning";
      case "high": return "destructive";
      default: return "default";
    }
  };

  const handleBulkAnalyze = async (customerIds: number[]) => {
    if (!customerIds.length) {
      toast({ title: "Analiz edilecek müşteri yok", description: "Tüm müşteriler zaten analiz edilmiş." });
      return;
    }
    setMenuOpen(false);
    setBulkAnalyzing(true);
    setBulkDone(0);
    setBulkTotal(customerIds.length);

    try {
      await fetch("/api/cx-analyses/bulk-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds }),
      });

      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/cx-analyses/bulk-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerIds }),
          });
          const status = await statusRes.json();
          setBulkDone(status.done);
          if (status.done >= customerIds.length) {
            clearInterval(poll);
            setBulkAnalyzing(false);
            queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-recent-analyses"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            toast({ title: "Analiz Tamamlandı", description: `${customerIds.length} müşteri başarıyla analiz edildi.` });
          }
        } catch { clearInterval(poll); setBulkAnalyzing(false); }
      }, 4000);

      setTimeout(() => { clearInterval(poll); setBulkAnalyzing(false); }, 600000);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
      setBulkAnalyzing(false);
    }
  };

  const [segmentSubmenu, setSegmentSubmenu] = useState(false);

  const allIds = useMemo(() => (customers || []).map(c => c.id), [customers]);
  const unanalyzedIds = useMemo(() => (customers || []).filter(c => !c.npsScore).map(c => c.id), [customers]);
  const analyzedCount = allIds.length - unanalyzedIds.length;

  // Unique segments with their customer IDs
  const segmentGroups = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const c of customers || []) {
      const seg = c.segment || "Genel";
      if (!map[seg]) map[seg] = [];
      map[seg].push(c.id);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [customers]);

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      {/* Floating bulk analysis progress bar */}
      {bulkAnalyzing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-96 bg-card border border-primary/30 rounded-2xl shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <p className="text-sm font-semibold text-primary">Gemini AI Analiz Yapıyor...</p>
            <span className="ml-auto text-xs text-muted-foreground">{bulkDone}/{bulkTotal}</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${bulkTotal > 0 ? Math.max(5, (bulkDone / bulkTotal) * 100) : 5}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">NPS/CSAT tahminleri ve etiketler oluşturuluyor</p>
        </div>
      )}

      <PageHeader
        title="Müşteri Profilleri"
        description="Müşteri sağlığı, duygu analizi ve etkileşim geçmişi."
      >
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            disabled={bulkAnalyzing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
              bulkAnalyzing
                ? "bg-primary/10 text-primary/50 border-primary/20 cursor-not-allowed"
                : "bg-primary text-white border-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            )}
          >
            {bulkAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Toplu Analiz Et
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-3 border-b border-border/50">
                  <p className="text-xs text-muted-foreground">
                    {analyzedCount}/{allIds.length} müşteri analiz edildi
                  </p>
                  <div className="h-1.5 bg-border rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full transition-all"
                      style={{ width: `${allIds.length > 0 ? (analyzedCount / allIds.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleBulkAnalyze(allIds)}
                  className="w-full flex items-start gap-3 p-4 hover:bg-white/5 transition-colors text-left"
                >
                  <BrainCircuit className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Tüm Müşterileri Analiz Et</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{allIds.length} müşteri — daha önce analiz edilenler güncellenir</p>
                  </div>
                </button>
                <button
                  onClick={() => handleBulkAnalyze(unanalyzedIds)}
                  disabled={unanalyzedIds.length === 0}
                  className="w-full flex items-start gap-3 p-4 hover:bg-white/5 transition-colors text-left border-t border-border/50 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Sadece Analiz Edilmemişleri</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {unanalyzedIds.length === 0
                        ? "Tüm müşteriler analiz edilmiş"
                        : `${unanalyzedIds.length} müşteri — daha hızlı, sadece eksikler`}
                    </p>
                  </div>
                </button>

                {/* Segment-based analysis */}
                <div className="border-t border-border/50">
                  <button
                    onClick={() => setSegmentSubmenu(v => !v)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
                  >
                    <Layers className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Segment / Firmaya Göre</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Belirli bir grubu seç</p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", segmentSubmenu && "rotate-180")} />
                  </button>

                  {segmentSubmenu && (
                    <div className="max-h-60 overflow-y-auto border-t border-border/50">
                      {segmentGroups.map(([seg, ids]) => (
                        <button
                          key={seg}
                          onClick={() => handleBulkAnalyze(ids)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="text-sm text-foreground truncate flex-1">{seg}</span>
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{ids.length} müşteri</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </PageHeader>

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-white/[0.02]">
              <th className="p-4 text-sm font-semibold text-muted-foreground">Müşteri</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Segment</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground text-center">NPS</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Duygu Durumu</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Churn Riski</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Son Etkileşim</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground text-right">Detay</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => (
              <tr key={customer.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4"><StatusBadge status={customer.segment} variant="outline" /></td>
                <td className="p-4 text-center font-mono font-bold text-primary">{customer.npsScore || "—"}</td>
                <td className="p-4">
                  {customer.sentiment ? (
                    <StatusBadge
                      status={customer.sentiment === "positive" ? "Olumlu" : customer.sentiment === "negative" ? "Olumsuz" : "Nötr"}
                      variant={getSentimentVariant(customer.sentiment)}
                    />
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </td>
                <td className="p-4">
                  {customer.churnRisk ? (
                    <StatusBadge
                      status={customer.churnRisk === "low" ? "Düşük" : customer.churnRisk === "medium" ? "Orta" : "Yüksek"}
                      variant={getChurnVariant(customer.churnRisk)}
                    />
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </td>
                <td className="p-4 text-sm text-muted-foreground">{formatDate(customer.lastInteraction)}</td>
                <td className="p-4 text-right">
                  <Link href={`/customers/${customer.id}`} className="inline-flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Layout>
  );
}
