import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Trash2, ChevronDown, ChevronRight, AlertTriangle, Users,
  MessageSquare, BarChart2, Brain, FileText, Shield,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type Scope = "customers" | "interactions" | "surveys" | "ai_data" | "conversations" | "audit_logs";
type DateRange = "all" | "7days" | "today";

interface Counts {
  customers: number;
  interactions: number;
  surveyData: number;
  aiData: number;
  conversations: number;
  surveys: number;
  auditLogs: number;
}

interface Category {
  scope: Scope;
  label: string;
  description: string;
  icon: React.ReactNode;
  countKey: keyof Counts;
  color: string;
}

const CATEGORIES: Category[] = [
  {
    scope: "customers",
    label: "Müşteriler + Bağlı Veriler",
    description: "Müşteriler, etkileşimler, etkileşim kayıtları ve tüm bağlı veriler",
    icon: <Users className="h-4 w-4" />,
    countKey: "customers",
    color: "text-blue-400",
  },
  {
    scope: "interactions",
    label: "Etkileşim Kayıtları",
    description: "Tekil etkileşimler ve etkileşim kayıtları (müşteri silinmez)",
    icon: <MessageSquare className="h-4 w-4" />,
    countKey: "interactions",
    color: "text-cyan-400",
  },
  {
    scope: "surveys",
    label: "Anket & Kampanya Verileri",
    description: "Anketler, kampanyalar, anket yanıtları, segmentler",
    icon: <BarChart2 className="h-4 w-4" />,
    countKey: "surveys",
    color: "text-purple-400",
  },
  {
    scope: "ai_data",
    label: "AI Analizleri",
    description: "CX analizleri, tahmin doğrulukları, AI onay kayıtları",
    icon: <Brain className="h-4 w-4" />,
    countKey: "aiData",
    color: "text-violet-400",
  },
  {
    scope: "conversations",
    label: "Konuşmalar",
    description: "AI asistan konuşma geçmişi ve mesajlar",
    icon: <MessageSquare className="h-4 w-4" />,
    countKey: "conversations",
    color: "text-emerald-400",
  },
  {
    scope: "audit_logs",
    label: "Denetim Logları",
    description: "Sistem aktivite logları",
    icon: <Shield className="h-4 w-4" />,
    countKey: "auditLogs",
    color: "text-orange-400",
  },
];

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: "Tümü",
  "7days": "Son 7 Gün",
  today: "Bugün",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function CountBadge({ value, loading }: { value: number; loading: boolean }) {
  if (loading) return <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-muted-foreground animate-pulse">...</span>;
  if (value === 0) return <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-muted-foreground">0</span>;
  return (
    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-[10px] font-semibold text-red-400">
      {value.toLocaleString("tr-TR")}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function TestDataCleanup() {
  const { realRole, refreshSession } = useAppAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only render for superadmin
  if (realRole !== "superadmin") return null;

  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<Scope>>(new Set());
  const [emailPattern, setEmailPattern] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // ── Live counts query ────────────────────────────────────────────────────

  const countsParams = new URLSearchParams();
  if (emailPattern.trim()) countsParams.set("emailPattern", emailPattern.trim());
  if (dateRange !== "all") countsParams.set("dateRange", dateRange);

  const { data: counts, isLoading: countsLoading, error: countsError } = useQuery<Counts>({
    queryKey: ["test-data-counts", emailPattern, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/test-data/counts?${countsParams}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        // Backend session expired — try to refresh silently then retry once
        const refreshed = await refreshSession();
        if (refreshed) {
          const retry = await fetch(`/api/admin/test-data/counts?${countsParams}`, {
            credentials: "include",
          });
          if (retry.ok) return retry.json();
        }
        throw new Error("Oturum süresi doldu — lütfen sayfayı yenileyin");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details ?? body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: expanded,
    retry: 0,
  });

  // ── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/test-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopes: Array.from(selected),
          filters: {
            ...(emailPattern.trim() && { emailPattern: emailPattern.trim() }),
            ...(dateRange !== "all" && { dateRange }),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Silme başarısız");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setShowModal(false);
      setConfirmText("");
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["test-data-counts"] });
      // Invalidate all major data queries so dashboard refreshes
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["interactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast({
        title: "Test verileri temizlendi",
        description: `${data.totalDeleted} kayıt silindi.`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  // ── Derived ──────────────────────────────────────────────────────────────

  const toggleScope = (scope: Scope) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const totalToDelete = counts
    ? CATEGORIES
        .filter((c) => selected.has(c.scope))
        .reduce((sum, c) => sum + (counts[c.countKey] ?? 0), 0)
    : 0;

  const canDelete = selected.size > 0 && !deleteMutation.isPending;
  const CONFIRM_WORD = "SİL";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Section card ── */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden">
        {/* Header (collapsible) */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-full flex items-center gap-3 p-5 text-left hover:bg-red-500/5 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Geliştirici &amp; Test Araçları</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 uppercase tracking-wider">
                Süper Admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Test verilerini güvenli şekilde temizle</p>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {/* Body */}
        {expanded && (
          <div className="px-5 pb-5 space-y-5 border-t border-red-500/10">

            {/* Warning */}
            <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mt-5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90">
                Silinen veriler <strong>geri alınamaz</strong>. Yalnızca test ve geliştirme ortamında kullanın.
              </p>
            </div>

            {/* Count fetch error */}
            {countsError && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300/90">Sayım alınamadı: {(countsError as Error).message}</p>
              </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  E-posta Domain Filtresi
                </label>
                <input
                  value={emailPattern}
                  onChange={(e) => setEmailPattern(e.target.value)}
                  placeholder="örn. example.com"
                  className="w-full h-9 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20"
                />
                <p className="text-[11px] text-muted-foreground">Boş = tüm e-postalar</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tarih Aralığı
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="w-full h-9 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-red-500/40"
                >
                  {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((k) => (
                    <option key={k} value={k} className="bg-background">{DATE_RANGE_LABELS[k]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category checkboxes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Silinecek Kategoriler
              </label>
              <div className="space-y-1.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = selected.has(cat.scope);
                  const cnt = counts?.[cat.countKey] ?? 0;
                  return (
                    <label
                      key={cat.scope}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                        isSelected
                          ? "border-red-500/40 bg-red-500/8"
                          : "border-border/30 hover:border-border/60 hover:bg-white/3"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleScope(cat.scope)}
                        className="h-4 w-4 rounded accent-red-500"
                      />
                      <span className={cn("shrink-0", cat.color)}>{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{cat.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{cat.description}</div>
                      </div>
                      <CountBadge value={cnt} loading={countsLoading} />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Delete button */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {selected.size === 0
                  ? "Kategori seçilmedi"
                  : `${selected.size} kategori seçildi · ${totalToDelete.toLocaleString("tr-TR")} kayıt silinecek`}
              </p>
              <button
                onClick={() => { setShowModal(true); setConfirmText(""); }}
                disabled={!canDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Temizle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirmation modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setConfirmText(""); } }}
        >
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-background shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Veri Silmeyi Onayla</h3>
                <p className="text-xs text-muted-foreground">Bu işlem geri alınamaz</p>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-2">
              {CATEGORIES.filter((c) => selected.has(c.scope)).map((cat) => (
                <div key={cat.scope} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={cat.color}>{cat.icon}</span>
                    {cat.label}
                  </span>
                  <span className="font-semibold text-red-400">
                    {(counts?.[cat.countKey] ?? 0).toLocaleString("tr-TR")} kayıt
                  </span>
                </div>
              ))}
              <div className="border-t border-red-500/20 pt-2 flex items-center justify-between text-sm font-bold">
                <span className="text-foreground">Toplam</span>
                <span className="text-red-400">{totalToDelete.toLocaleString("tr-TR")} kayıt</span>
              </div>
              {emailPattern && (
                <p className="text-[11px] text-amber-400/80 pt-1">
                  Yalnızca <strong>@{emailPattern.replace(/^@/, "")}</strong> domain'li kayıtlar
                </p>
              )}
              {dateRange !== "all" && (
                <p className="text-[11px] text-amber-400/80">
                  Yalnızca <strong>{DATE_RANGE_LABELS[dateRange]}</strong> içindeki kayıtlar
                </p>
              )}
            </div>

            {/* Confirm input */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Onaylamak için <strong className="text-foreground font-mono">{CONFIRM_WORD}</strong> yazın:
              </label>
              <input
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm font-mono focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setConfirmText(""); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-semibold text-foreground hover:bg-white/5 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={confirmText !== CONFIRM_WORD || deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteMutation.isPending ? (
                  <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleteMutation.isPending ? "Siliniyor..." : "Kalıcı Olarak Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
