import React, { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, Button, Modal, Label, Input, StatusBadge, LoadingScreen } from "@/components/ui-elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCustomersList } from "@/hooks/use-customers";
import {
  Plus, Phone, MessageSquare, Ticket, Trash2, BrainCircuit,
  Clock, User, CheckCircle, Upload, Download, FileText,
  AlertCircle, RefreshCw, Loader2, XCircle, Tag, Sparkles,
  ShieldCheck, ShieldOff, EyeOff, Eye, ScanSearch, Building2,
  ChevronDown, Search, X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type InteractionRecord = {
  id: number;
  customerId: number;
  customerName: string;
  company: string | null;
  type: "ticket" | "chat" | "call";
  subject: string;
  content: string;
  status: string;
  channel: string;
  agentName: string | null;
  durationSeconds: number | null;
  resolution: string | null;
  tags: string[] | null;
  isCustomerRequest: boolean | null;
  relevanceReason: string | null;
  excludedFromAnalysis: boolean | null;
  exclusionReason: string | null;
  interactedAt: string;
  createdAt: string;
};

const EXCLUSION_PRESETS = [
  "Otomatik sistem bildirimi",
  "Pazarlama / tanıtım e-postası",
  "İç firma iletişimi (müşteri talebi değil)",
  "No-reply / bot gönderimi",
  "Test hesabı kaydı",
  "Eski / geçersiz kayıt",
  "Rakip firma / potansiyel müşteri değil",
  "Diğer (aşağıya açıklayın)",
];

type BulkResult = { total: number; imported: number; skipped: number; customersCreated: number; importedCustomerIds: number[]; errors: string[] };

const TYPE_LABELS = { ticket: "Destek Talebi", chat: "Canlı Sohbet", call: "Çağrı Kaydı" };
const TYPE_ICONS = { ticket: Ticket, chat: MessageSquare, call: Phone };
const STATUS_VARIANTS: Record<string, any> = { open: "warning", resolved: "success", escalated: "destructive", closed: "outline" };
const STATUS_LABELS: Record<string, string> = { open: "Açık", resolved: "Çözüldü", escalated: "Yükseltildi", closed: "Kapalı" };

function useInteractionRecords(customerId?: number) {
  return useQuery<InteractionRecord[]>({
    queryKey: ["interaction-records", customerId],
    queryFn: async () => {
      const url = customerId ? `/api/interaction-records?customerId=${customerId}` : "/api/interaction-records";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Veri alınamadı");
      return res.json();
    },
  });
}

export default function Interactions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [analyzeCustomerId, setAnalyzeCustomerId] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkDragging, setBulkDragging] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Auto-analysis state
  const [autoAnalyzing, setAutoAnalyzing] = useState(false);
  const [autoAnalyzeDone, setAutoAnalyzeDone] = useState(0);
  const [autoAnalyzeTotal, setAutoAnalyzeTotal] = useState(0);

  // Relevance classification state
  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<{ classified: number; customerRequests: number; nonRelevant: number } | null>(null);

  // Exclusion reason modal state (single record)
  const [exclusionModalRec, setExclusionModalRec] = useState<InteractionRecord | null>(null);
  const [exclusionPreset, setExclusionPreset] = useState(EXCLUSION_PRESETS[0]);
  const [exclusionCustomText, setExclusionCustomText] = useState("");

  // Company exclusion modal state
  const [companyExcludeModal, setCompanyExcludeModal] = useState<{ company: string; customerName: string; allExcluded: boolean } | null>(null);
  const [companyExcludePreset, setCompanyExcludePreset] = useState(EXCLUSION_PRESETS[0]);
  const [companyExcludeCustomText, setCompanyExcludeCustomText] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);

  // Customer combobox (searchable dropdown)
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
        setCustomerSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const { data: customers } = useCustomersList();
  const { data: records, isLoading } = useInteractionRecords(filterCustomer ? Number(filterCustomer) : undefined);

  const [form, setForm] = useState({
    customerId: "", type: "ticket", subject: "", content: "",
    status: "open", channel: "email", agentName: "", durationSeconds: "", resolution: "",
    interactedAt: new Date().toISOString().slice(0, 16),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/interaction-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, customerId: Number(data.customerId), durationSeconds: data.durationSeconds ? Number(data.durationSeconds) : null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interaction-records"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      setModalOpen(false);
      setForm({ customerId: "", type: "ticket", subject: "", content: "", status: "open", channel: "email", agentName: "", durationSeconds: "", resolution: "", interactedAt: new Date().toISOString().slice(0, 16) });
      toast({ title: "Kaydedildi", description: "Etkileşim başarıyla eklendi." });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/interaction-records/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interaction-records"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });

  const handleAnalyze = async (customerId: number) => {
    setAnalyzing(true);
    setAnalyzeCustomerId(customerId);
    try {
      const res = await fetch("/api/cx-analyses/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      queryClient.invalidateQueries({ queryKey: ["dashboard-recent-analyses"] });
      toast({ title: "Analiz Tamamlandı", description: "Gemini NPS/CSAT tahmini hazır." });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
      setAnalyzeCustomerId(null);
    }
  };

  const toggleExclusionMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const res = await fetch(`/api/interaction-records/${id}/toggle-exclusion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-records"] });
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      setExclusionModalRec(null);
      setExclusionPreset(EXCLUSION_PRESETS[0]);
      setExclusionCustomText("");
      if (vars.reason) {
        toast({ title: "Hariç Tutuldu", description: "Kayıt analizden çıkarıldı. AI anomali raporu arka planda yenileniyor." });
      }
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const companyExcludeMutation = useMutation({
    mutationFn: async ({ company, reason, exclude }: { company: string; reason: string; exclude: boolean }) => {
      const res = await fetch("/api/interaction-records/company-exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, reason, exclude }),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
      return res.json();
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["interaction-records"] });
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      setCompanyExcludeModal(null);
      setCompanyExcludePreset(EXCLUSION_PRESETS[0]);
      setCompanyExcludeCustomText("");
      if (vars.exclude) {
        toast({ title: "Firma Hariç Tutuldu", description: `${data.updated} kayıt analizden çıkarıldı. Sıfır Anket raporu arka planda yenileniyor.` });
      } else {
        toast({ title: "Firma Dahil Edildi", description: `${data.updated} kayıt analize geri eklendi. Sıfır Anket raporu arka planda yenileniyor.` });
      }
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const handleClassifyRelevance = async () => {
    setClassifying(true);
    setClassifyResult(null);
    try {
      const res = await fetch("/api/interaction-records/classify-relevance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sınıflandırma başarısız");
      const customerRequests = data.results?.filter((r: any) => r.isCustomerRequest).length ?? 0;
      const nonRelevant = (data.results?.length ?? 0) - customerRequests;
      setClassifyResult({ classified: data.classified, customerRequests, nonRelevant });
      queryClient.invalidateQueries({ queryKey: ["interaction-records"] });
      toast({ title: "Sınıflandırma Tamamlandı", description: `${data.classified} kayıt Gemini tarafından sınıflandırıldı.` });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setClassifying(false);
    }
  };

  const handleBulkFile = (f: File) => {
    setBulkFile(f);
    setBulkResult(null);
    setBulkError(null);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const form = new FormData();
      form.append("file", bulkFile);
      const res = await fetch("/api/interaction-records/bulk", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sunucu hatası");
      setBulkResult(data);
      queryClient.invalidateQueries({ queryKey: ["interaction-records"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    } catch (e: any) {
      setBulkError(e.message);
    } finally {
      setBulkUploading(false);
    }
  };

  const closeBulkModal = () => {
    setBulkModalOpen(false);
    setBulkFile(null);
    setBulkResult(null);
    setBulkError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAutoAnalyze = async (customerIds: number[]) => {
    if (!customerIds.length) return;
    setAutoAnalyzing(true);
    setAutoAnalyzeDone(0);
    setAutoAnalyzeTotal(customerIds.length);
    try {
      await fetch("/api/cx-analyses/bulk-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds }),
      });

      // Poll for progress
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/cx-analyses/bulk-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerIds }),
          });
          const status = await statusRes.json();
          setAutoAnalyzeDone(status.done);
          if (status.done >= customerIds.length) {
            clearInterval(poll);
            setAutoAnalyzing(false);
            queryClient.invalidateQueries({ queryKey: ["interaction-records"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-recent-analyses"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            toast({ title: "Analiz Tamamlandı", description: `${customerIds.length} müşteri başarıyla analiz edildi. Etiketler eklendi.` });
          }
        } catch { clearInterval(poll); setAutoAnalyzing(false); }
      }, 4000);
      setTimeout(() => { clearInterval(poll); setAutoAnalyzing(false); }, 600000);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
      setAutoAnalyzing(false);
    }
  };

  const filtered = (records || []).filter(r => {
    if (filterType && r.type !== filterType) return false;
    if (!showExcluded && r.excludedFromAnalysis) return false;
    return true;
  });
  const groupedByCustomer: Record<string, InteractionRecord[]> = {};
  for (const r of filtered) {
    const key = `${r.customerId}__${r.customerName}`;
    if (!groupedByCustomer[key]) groupedByCustomer[key] = [];
    groupedByCustomer[key].push(r);
  }
  const unclassifiedCount = (records || []).filter(r => r.isCustomerRequest === null).length;
  const excludedCount = (records || []).filter(r => r.excludedFromAnalysis).length;

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      {/* Floating auto-analysis progress bar */}
      {autoAnalyzing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-96 bg-card border border-primary/30 rounded-2xl shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <p className="text-sm font-semibold text-primary">Gemini AI Analiz Yapıyor...</p>
            <span className="ml-auto text-xs text-muted-foreground">{autoAnalyzeDone}/{autoAnalyzeTotal}</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${autoAnalyzeTotal > 0 ? Math.max(5, (autoAnalyzeDone / autoAnalyzeTotal) * 100) : 5}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Etiketler ve NPS/CSAT tahminleri oluşturuluyor</p>
        </div>
      )}

      <PageHeader
        title="Etkileşim Kayıtları"
        description="Destek talepleri, canlı sohbetler ve çağrı kayıtlarını girerek AI analizine hazırlayın."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            className="border border-border hover:border-primary/40"
            onClick={() => setBulkModalOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Toplu Yükle
          </Button>
          <Button
            variant="ghost"
            className="border border-warning/40 text-warning hover:bg-warning/10"
            onClick={handleClassifyRelevance}
            disabled={classifying}
            title={unclassifiedCount > 0 ? `${unclassifiedCount} sınıflandırılmamış kayıt var` : "Tüm kayıtlar sınıflandırıldı"}
          >
            {classifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {classifying ? "Sınıflandırılıyor..." : "AI Sınıflandır"}
            {unclassifiedCount > 0 && !classifying && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-warning/20 text-warning rounded-full">{unclassifiedCount}</span>
            )}
          </Button>
          <Button variant="primary" onClick={() => setModalOpen(true)} className="shadow-[0_0_20px_rgba(99,102,241,0.25)]">
            <Plus className="h-4 w-4" /> Tekli Kayıt
          </Button>
        </div>
      </PageHeader>

      {/* Classification result banner */}
      {classifyResult && (
        <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4 flex-wrap">
          <ScanSearch className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-foreground">{classifyResult.classified} kayıt sınıflandırıldı</span>
            <span className="text-muted-foreground mx-2">—</span>
            <span className="text-success font-medium">{classifyResult.customerRequests} müşteri talebi</span>
            <span className="text-muted-foreground mx-2">·</span>
            <span className="text-destructive font-medium">{classifyResult.nonRelevant} alakasız (hariç tutuldu)</span>
          </div>
          <button onClick={() => setClassifyResult(null)} className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        {/* Searchable customer combobox */}
        <div ref={comboRef} className="relative">
          <button
            type="button"
            onClick={() => { setComboOpen(o => !o); setCustomerSearch(""); }}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[180px] max-w-[260px]"
          >
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate flex-1 text-left">
              {filterCustomer
                ? (customers?.find(c => String(c.id) === filterCustomer)?.name ?? "Müşteri")
                : "Tüm Müşteriler"}
            </span>
            {filterCustomer
              ? <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0" onClick={e => { e.stopPropagation(); setFilterCustomer(""); setComboOpen(false); }} />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            }
          </button>
          {comboOpen && (
            <div className="absolute z-50 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-background rounded-lg">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Müşteri ara..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  {customerSearch && <X className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={() => setCustomerSearch("")} />}
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => { setFilterCustomer(""); setComboOpen(false); setCustomerSearch(""); }}
                  className={cn("w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors", !filterCustomer && "text-primary font-medium")}
                >
                  Tüm Müşteriler
                </button>
                {(customers ?? [])
                  .filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                  .map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setFilterCustomer(String(c.id)); setComboOpen(false); setCustomerSearch(""); }}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors truncate", String(c.id) === filterCustomer && "text-primary font-medium bg-primary/5")}
                    >
                      {c.name}
                      {c.company && <span className="text-muted-foreground ml-1.5 text-xs">· {c.company}</span>}
                    </button>
                  ))}
                {(customers ?? []).filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">Sonuç bulunamadı</div>
                )}
              </div>
            </div>
          )}
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
          <option value="">Tüm Türler</option>
          <option value="ticket">Destek Talebi</option>
          <option value="chat">Canlı Sohbet</option>
          <option value="call">Çağrı Kaydı</option>
        </select>
        {excludedCount > 0 && (
          <button
            onClick={() => setShowExcluded(!showExcluded)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors",
              showExcluded
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-card border-border text-muted-foreground hover:border-destructive/30"
            )}
          >
            {showExcluded ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showExcluded ? "Hariç Tutulanları Gizle" : `Hariç Tutulanları Göster (${excludedCount})`}
          </button>
        )}
        <div className="ml-auto text-sm text-muted-foreground flex items-center gap-3">
          {filtered.length} kayıt
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <div className="h-16 w-16 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Ticket className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">Henüz Kayıt Yok</h3>
          <p className="text-muted-foreground mt-2 mb-6">Müşteri etkileşimlerini ekleyerek AI analizine başlayın.</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" className="border border-border" onClick={() => setBulkModalOpen(true)}>
              <Upload className="h-4 w-4" /> CSV / Excel ile Toplu Yükle
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Tekli Kayıt Ekle
            </Button>
          </div>
        </Card>
      )}

      {/* Records grouped by customer */}
      <div className="space-y-8">
        {Object.entries(groupedByCustomer).map(([key, items]) => {
          const [customerId, customerName] = key.split("__");
          const company = items[0]?.company ?? null;
          const allExcluded = items.every(r => r.excludedFromAnalysis);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {customerName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{customerName}</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{items.length} kayıt</p>
                      {company && (
                        <span className="text-xs text-muted-foreground/60 flex items-center gap-0.5">
                          <Building2 className="h-3 w-3" />{company}
                        </span>
                      )}
                      {allExcluded && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">Tümü Hariç</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {company && (
                    <button
                      onClick={() => setCompanyExcludeModal({ company, customerName, allExcluded })}
                      className={cn(
                        "text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-colors",
                        allExcluded
                          ? "border-success/30 text-success hover:bg-success/10"
                          : "border-border text-muted-foreground hover:border-destructive/30 hover:text-destructive"
                      )}
                    >
                      <Building2 className="h-3 w-3" />
                      {allExcluded ? "Firmayı Dahil Et" : "Firmayı Hariç Tut"}
                    </button>
                  )}
                  <Button variant="ghost" onClick={() => handleAnalyze(Number(customerId))}
                    disabled={analyzing && analyzeCustomerId === Number(customerId)}
                    className="text-primary border border-primary/20 hover:bg-primary/10">
                    {analyzing && analyzeCustomerId === Number(customerId)
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Analiz Ediliyor...</>
                      : <><BrainCircuit className="h-4 w-4" /> Gemini ile Analiz Et</>}
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {items.map(rec => {
                  const Icon = TYPE_ICONS[rec.type];
                  const isExcluded = !!rec.excludedFromAnalysis;
                  return (
                    <Card key={rec.id} className={cn(
                      "p-4 flex gap-4 group hover:border-primary/30 transition-colors",
                      isExcluded && "opacity-60 border-destructive/20 bg-destructive/5"
                    )}>
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center",
                        rec.type === "ticket" ? "bg-warning/10 text-warning" :
                        rec.type === "chat" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-foreground text-sm">{rec.subject}</h4>
                              {rec.isCustomerRequest === true && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success/10 text-success text-[10px] font-medium rounded-full border border-success/20">
                                  <ShieldCheck className="h-2.5 w-2.5" /> Müşteri Talebi
                                </span>
                              )}
                              {rec.isCustomerRequest === false && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] font-medium rounded-full border border-destructive/20">
                                  <ShieldOff className="h-2.5 w-2.5" /> Alakasız
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">{TYPE_LABELS[rec.type]}</span>
                              <span className="text-muted-foreground/30">·</span>
                              <StatusBadge status={STATUS_LABELS[rec.status]} variant={STATUS_VARIANTS[rec.status]} />
                              {rec.agentName && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />{rec.agentName}
                                </span>
                              )}
                              {rec.durationSeconds && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {Math.floor(rec.durationSeconds / 60)}:{String(rec.durationSeconds % 60).padStart(2, "0")} dk
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">{formatDate(rec.interactedAt)}</span>
                            <button
                              onClick={() => {
                                if (isExcluded) {
                                  toggleExclusionMutation.mutate({ id: rec.id });
                                } else {
                                  setExclusionModalRec(rec);
                                  setExclusionPreset(EXCLUSION_PRESETS[0]);
                                  setExclusionCustomText("");
                                }
                              }}
                              disabled={toggleExclusionMutation.isPending}
                              title={isExcluded ? "Analize Dahil Et" : "Analizden Çıkart"}
                              className={cn(
                                "opacity-0 group-hover:opacity-100 transition-all text-xs flex items-center gap-1 px-2 py-1 rounded-lg border",
                                isExcluded
                                  ? "border-success/30 text-success hover:bg-success/10"
                                  : "border-border text-muted-foreground hover:border-destructive/30 hover:text-destructive"
                              )}
                            >
                              {isExcluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                              {isExcluded ? "Dahil Et" : "Hariç Tut"}
                            </button>
                            <button onClick={() => deleteMutation.mutate(rec.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {rec.relevanceReason && (
                          <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{rec.relevanceReason}</p>
                        )}
                        {isExcluded && rec.exclusionReason && (
                          <p className="text-[11px] text-destructive/70 mt-1 flex items-center gap-1">
                            <EyeOff className="h-3 w-3 flex-shrink-0" />
                            Hariç tutma sebebi: {rec.exclusionReason}
                          </p>
                        )}
                        <p className="text-sm text-foreground/70 mt-2 leading-relaxed line-clamp-2">{rec.content}</p>
                        {rec.resolution && (
                          <p className="text-xs text-success mt-2 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> {rec.resolution}
                          </p>
                        )}
                        {rec.tags && rec.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {rec.tags.map((tag, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded-full border border-primary/20">
                                <Tag className="h-2.5 w-2.5" />{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── KAYIT HARİÇ TUTMA MODAL ──────────────────────────────────────── */}
      <Modal isOpen={!!exclusionModalRec} onClose={() => setExclusionModalRec(null)} title="Hariç Tutma Sebebi">
        {exclusionModalRec && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Hariç tutulacak kayıt:</p>
              <p className="text-sm font-semibold text-foreground">{exclusionModalRec.subject}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">{exclusionModalRec.customerName}</p>
            </div>
            <div>
              <Label>Hariç tutma sebebi *</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {EXCLUSION_PRESETS.map(preset => (
                  <button key={preset} type="button"
                    onClick={() => setExclusionPreset(preset)}
                    className={cn(
                      "text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                      exclusionPreset === preset
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-foreground/70 hover:border-border/80 hover:bg-muted/30"
                    )}>
                    {preset}
                  </button>
                ))}
              </div>
              {exclusionPreset === "Diğer (aşağıya açıklayın)" && (
                <textarea
                  className="w-full mt-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  rows={2}
                  placeholder="Açıklayınız..."
                  value={exclusionCustomText}
                  onChange={e => setExclusionCustomText(e.target.value)}
                />
              )}
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
              <span className="font-semibold text-primary">AI Öğrenmesi:</span> Bu sebep gelecekteki otomatik sınıflandırmalarda Gemini'ye örnek olarak gösterilecek.
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" className="border border-border" onClick={() => setExclusionModalRec(null)}>İptal</Button>
              <Button variant="primary"
                disabled={toggleExclusionMutation.isPending || (exclusionPreset === "Diğer (aşağıya açıklayın)" && !exclusionCustomText.trim())}
                onClick={() => {
                  const reason = exclusionPreset === "Diğer (aşağıya açıklayın)" ? exclusionCustomText.trim() : exclusionPreset;
                  toggleExclusionMutation.mutate({ id: exclusionModalRec.id, reason });
                }}>
                {toggleExclusionMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor...</> : <><EyeOff className="h-4 w-4" /> Hariç Tut</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── FİRMA HARİÇ TUTMA MODAL ──────────────────────────────────────── */}
      <Modal isOpen={!!companyExcludeModal} onClose={() => setCompanyExcludeModal(null)} title={companyExcludeModal?.allExcluded ? "Firmayı Analize Dahil Et" : "Firmayı Hariç Tut"}>
        {companyExcludeModal && (
          <div className="space-y-4">
            <div className={cn(
              "p-3 rounded-xl border flex items-start gap-3",
              companyExcludeModal.allExcluded ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
            )}>
              <Building2 className={cn("h-5 w-5 mt-0.5 flex-shrink-0", companyExcludeModal.allExcluded ? "text-success" : "text-destructive")} />
              <div>
                <p className="text-sm font-semibold text-foreground">{companyExcludeModal.company}</p>
                <p className="text-xs text-muted-foreground">
                  {companyExcludeModal.allExcluded
                    ? "Bu firmaya ait tüm kayıtlar analize dahil edilecek."
                    : "Bu firmaya ait tüm kayıtlar analizden çıkarılacak."}
                </p>
              </div>
            </div>
            {!companyExcludeModal.allExcluded && (
              <>
                <div>
                  <Label>Hariç tutma sebebi *</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {EXCLUSION_PRESETS.map(preset => (
                      <button key={preset} type="button"
                        onClick={() => setCompanyExcludePreset(preset)}
                        className={cn(
                          "text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                          companyExcludePreset === preset
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border text-foreground/70 hover:border-border/80 hover:bg-muted/30"
                        )}>
                        {preset}
                      </button>
                    ))}
                  </div>
                  {companyExcludePreset === "Diğer (aşağıya açıklayın)" && (
                    <textarea
                      className="w-full mt-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      rows={2}
                      placeholder="Açıklayınız..."
                      value={companyExcludeCustomText}
                      onChange={e => setCompanyExcludeCustomText(e.target.value)}
                    />
                  )}
                </div>
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">AI Öğrenmesi:</span> Bu sebep Gemini'nin otomatik sınıflandırmalarına rehberlik edecek, benzer firma kayıtları tanınacak.
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" className="border border-border" onClick={() => setCompanyExcludeModal(null)}>İptal</Button>
              <Button
                variant={companyExcludeModal.allExcluded ? "ghost" : "primary"}
                className={companyExcludeModal.allExcluded ? "border border-success/30 text-success hover:bg-success/10" : ""}
                disabled={companyExcludeMutation.isPending || (!companyExcludeModal.allExcluded && companyExcludePreset === "Diğer (aşağıya açıklayın)" && !companyExcludeCustomText.trim())}
                onClick={() => {
                  if (companyExcludeModal.allExcluded) {
                    companyExcludeMutation.mutate({ company: companyExcludeModal.company, reason: "", exclude: false });
                  } else {
                    const reason = companyExcludePreset === "Diğer (aşağıya açıklayın)" ? companyExcludeCustomText.trim() : companyExcludePreset;
                    companyExcludeMutation.mutate({ company: companyExcludeModal.company, reason, exclude: true });
                  }
                }}>
                {companyExcludeMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> İşleniyor...</>
                  : companyExcludeModal.allExcluded
                    ? <><Eye className="h-4 w-4" /> Firmayı Dahil Et</>
                    : <><Building2 className="h-4 w-4" /> Tüm Kayıtları Hariç Tut</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── TEKLI KAYIT MODAL ─────────────────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Etkileşim Kaydı">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Müşteri *</Label>
              <select required value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Seçin...</option>
                {customers?.map(c => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
              </select>
            </div>
            <div>
              <Label>Tür *</Label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="ticket">Destek Talebi</option>
                <option value="chat">Canlı Sohbet</option>
                <option value="call">Çağrı Kaydı</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Konu / Başlık *</Label>
            <Input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Örn: Fatura hatası, Teslimat gecikmesi..." />
          </div>
          <div>
            <Label>İçerik / Transkript *</Label>
            <textarea required value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder={form.type === "call" ? "Çağrı özeti veya transkript metni..." : form.type === "chat" ? "Sohbet dökümü..." : "Müşteri talebi ve şikayet detayı..."}
              rows={4} className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Durum</Label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="open">Açık</option>
                <option value="resolved">Çözüldü</option>
                <option value="escalated">Yükseltildi</option>
                <option value="closed">Kapalı</option>
              </select>
            </div>
            <div>
              <Label>Kanal</Label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="email">E-posta</option>
                <option value="phone">Telefon</option>
                <option value="chat">Canlı Sohbet</option>
                <option value="social">Sosyal Medya</option>
                <option value="in-app">Uygulama İçi</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Temsilci Adı</Label>
              <Input value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} placeholder="Opsiyonel" />
            </div>
            {form.type === "call" && (
              <div>
                <Label>Süre (saniye)</Label>
                <Input type="number" value={form.durationSeconds} onChange={e => setForm(f => ({ ...f, durationSeconds: e.target.value }))} placeholder="Örn: 180" />
              </div>
            )}
          </div>
          <div>
            <Label>Çözüm / Sonuç</Label>
            <Input value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} placeholder="Opsiyonel — uygulanan çözümü yazın" />
          </div>
          <div>
            <Label>Etkileşim Tarihi</Label>
            <Input type="datetime-local" value={form.interactedAt} onChange={e => setForm(f => ({ ...f, interactedAt: e.target.value }))} />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>Kaydet</Button>
          </div>
        </form>
      </Modal>

      {/* ── TOPLU YÜKLEME MODAL ────────────────────────────────────────────── */}
      <Modal isOpen={bulkModalOpen} onClose={closeBulkModal} title="Toplu Etkileşim Yükle (CSV / Excel)">
        <div className="space-y-5">
          {/* Info Banner */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-3">
            <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-primary">
              <p className="font-semibold mb-1">CSV veya Excel şablonunu indirin</p>
              <p className="text-primary/80 text-xs leading-relaxed">
                Şablondaki e-posta adresleri sistemdeki müşterilerle eşleşmelidir.
                Her satır bir etkileşim kaydıdır (ticket / chat / call).
              </p>
            </div>
          </div>

          {/* Template Downloads */}
          <div className="grid grid-cols-2 gap-3">
            <a href="/api/interaction-records/template-xlsx" download
              className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors group">
              <div className="h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                <Download className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Excel Şablonu</p>
                <p className="text-xs text-muted-foreground">.xlsx — sütun genişlikleri ayarlı</p>
              </div>
            </a>
            <a href="/api/interaction-records/template" download
              className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors group">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Download className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">CSV Şablonu</p>
                <p className="text-xs text-muted-foreground">.csv — hafif format</p>
              </div>
            </a>
          </div>

          {/* Drop Zone */}
          {!bulkResult && (
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
                bulkDragging ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50 hover:bg-white/[0.02]"
              )}
              onDragOver={e => { e.preventDefault(); setBulkDragging(true); }}
              onDragLeave={() => setBulkDragging(false)}
              onDrop={e => { e.preventDefault(); setBulkDragging(false); const f = e.dataTransfer.files[0]; if (f) handleBulkFile(f); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleBulkFile(e.target.files[0])} />
              {bulkFile ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="font-semibold text-foreground">{bulkFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{(bulkFile.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="font-semibold text-foreground">Dosyayı Sürükleyin veya Tıklayın</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx · .xls · .csv · Maks. 20 MB</p>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {bulkError && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-xl text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {bulkError}
            </div>
          )}

          {/* Result */}
          {bulkResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success/10 text-success flex items-center justify-center">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Yükleme Tamamlandı</p>
                  <p className="text-xs text-muted-foreground">Kayıtlar listeye eklendi</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.03] border border-border/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{bulkResult.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Toplam Satır</p>
                </div>
                <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-success">{bulkResult.imported}</p>
                  <p className="text-xs text-success/70 mt-0.5">Kayıt Eklendi</p>
                </div>
                {bulkResult.customersCreated > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{bulkResult.customersCreated}</p>
                    <p className="text-xs text-primary/70 mt-0.5">Yeni Müşteri</p>
                  </div>
                )}
                <div className={cn("rounded-xl p-3 text-center border", bulkResult.skipped > 0 ? "bg-warning/5 border-warning/20" : "bg-white/[0.03] border-border/50")}>
                  <p className={cn("text-2xl font-bold", bulkResult.skipped > 0 ? "text-warning" : "text-foreground")}>{bulkResult.skipped}</p>
                  <p className={cn("text-xs mt-0.5", bulkResult.skipped > 0 ? "text-warning/70" : "text-muted-foreground")}>Atlandı</p>
                </div>
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Hatalı Satırlar
                  </p>
                  <ul className="space-y-1">
                    {bulkResult.errors.map((err, i) => (
                      <li key={i} className="text-xs text-destructive/80 font-mono">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Auto-analysis section */}
              {bulkResult.importedCustomerIds?.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-primary">AI Otomatik Analiz</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {bulkResult.importedCustomerIds.length} müşteri için Gemini, etkileşimleri analiz ederek NPS/CSAT tahmini yapacak ve her kaydı etiketleyecek.
                  </p>
                  {autoAnalyzing ? (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-primary">Analiz ediliyor...</span>
                        <span className="text-muted-foreground">{autoAnalyzeDone} / {autoAnalyzeTotal}</span>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${autoAnalyzeTotal > 0 ? (autoAnalyzeDone / autoAnalyzeTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => {
                        handleAutoAnalyze(bulkResult.importedCustomerIds);
                        closeBulkModal();
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Tüm Müşterileri AI ile Analiz Et
                    </Button>
                  )}
                </div>
              )}

              <Button variant="ghost" className="w-full border border-border" onClick={() => { setBulkFile(null); setBulkResult(null); if (fileRef.current) fileRef.current.value = ""; }}>
                <RefreshCw className="h-4 w-4" /> Yeni Dosya Yükle
              </Button>
            </div>
          )}

          {/* Actions */}
          {!bulkResult && (
            <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={closeBulkModal} disabled={bulkUploading}>İptal</Button>
              <Button
                variant="primary"
                disabled={!bulkFile || bulkUploading}
                isLoading={bulkUploading}
                onClick={handleBulkUpload}
                className="min-w-[140px]"
              >
                {bulkUploading ? "Yükleniyor..." : <><Upload className="h-4 w-4" /> İçe Aktar</>}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
