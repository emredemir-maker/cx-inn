import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/ui-elements";
import { useAppAuth } from "@/context/auth-context";
import {
  ShieldCheck, Eye, EyeOff, Check, X, AlertTriangle,
  Lock, Unlock, Users, Crown, ChevronDown, ChevronUp,
  LayoutDashboard, BarChart2, Building2, MessagesSquare,
  Zap, MessageSquareQuote, Send, ClipboardCheck, Settings,
  UserCog, BookOpen, PieChart, BrainCircuit, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type AccessLevel = "full" | "readonly" | "restricted" | "approval" | "none";
type RoleKey = "superadmin" | "cx_manager" | "cx_user";

const ACCESS_CONFIG: Record<AccessLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  full:       { label: "Tam Erişim",     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", icon: <Check className="h-3.5 w-3.5" /> },
  readonly:   { label: "Görüntüleme",    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/25",    icon: <Eye className="h-3.5 w-3.5" /> },
  restricted: { label: "Kısıtlı",        color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25",  icon: <Lock className="h-3.5 w-3.5" /> },
  approval:   { label: "Onay Gerekli",   color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/25",icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  none:       { label: "Erişim Yok",     color: "text-red-400/70",  bg: "bg-red-500/5 border-red-500/15",       icon: <X className="h-3.5 w-3.5" /> },
};

interface ModuleRow {
  icon: React.ReactNode;
  module: string;
  description: string;
  superadmin: AccessLevel;
  cx_manager: AccessLevel;
  cx_user: AccessLevel;
  note?: string;
}

interface PiiRow {
  field: string;
  description: string;
  superadmin: "visible" | "masked" | "stripped";
  cx_manager: "visible" | "masked" | "stripped";
  cx_user: "visible" | "masked" | "stripped";
}

interface ActionRow {
  category: string;
  action: string;
  superadmin: boolean | "approval";
  cx_manager: boolean | "approval";
  cx_user: boolean | "approval";
  note?: string;
}

const MODULE_ROWS: ModuleRow[] = [
  {
    icon: <LayoutDashboard className="h-4 w-4" />,
    module: "Gösterge Paneli",
    description: "Özet metrikler, KPI kartları, risk alarmları",
    superadmin: "full", cx_manager: "full", cx_user: "full",
  },
  {
    icon: <BarChart2 className="h-4 w-4" />,
    module: "CX Analiz Raporu",
    description: "NPS/CSAT trendleri, acı noktaları, duygu analizi",
    superadmin: "full", cx_manager: "full", cx_user: "readonly",
  },
  {
    icon: <Users className="h-4 w-4" />,
    module: "Müşteriler",
    description: "Müşteri listesi, profil detayları, AI tahminleri",
    superadmin: "full", cx_manager: "full", cx_user: "readonly",
    note: "CX Kullanıcı e-posta maskelenmiş görür",
  },
  {
    icon: <Building2 className="h-4 w-4" />,
    module: "Firmalar",
    description: "Firma bazlı müşteri gruplama ve analiz",
    superadmin: "full", cx_manager: "full", cx_user: "readonly",
    note: "CX Kullanıcı e-posta maskelenmiş görür",
  },
  {
    icon: <PieChart className="h-4 w-4" />,
    module: "Segmentler",
    description: "Müşteri segmentleri oluşturma ve AI önerisi",
    superadmin: "full", cx_manager: "full", cx_user: "readonly",
  },
  {
    icon: <MessagesSquare className="h-4 w-4" />,
    module: "Etkileşim Kayıtları",
    description: "Müşteri etkileşimlerini görüntüleme ve içe aktarma",
    superadmin: "full", cx_manager: "full", cx_user: "readonly",
  },
  {
    icon: <Zap className="h-4 w-4" />,
    module: "Sıfır Anket Motoru",
    description: "Anormallik tespiti ve otomatik anket tetikleme",
    superadmin: "full", cx_manager: "full", cx_user: "readonly",
  },
  {
    icon: <MessageSquareQuote className="h-4 w-4" />,
    module: "Anket Şablonları",
    description: "Anket oluşturma, düzenleme ve AI tasarım önerisi",
    superadmin: "full", cx_manager: "full", cx_user: "readonly",
  },
  {
    icon: <Send className="h-4 w-4" />,
    module: "Kampanya Yönetimi",
    description: "E-posta kampanyaları oluşturma ve gönderme",
    superadmin: "full", cx_manager: "approval", cx_user: "none",
    note: "CX Manager kampanya oluşturabilir, superadmin onayı gerekir",
  },
  {
    icon: <ClipboardCheck className="h-4 w-4" />,
    module: "Onay Kuyruğu",
    description: "Bekleyen kampanya ve anket onayları",
    superadmin: "full", cx_manager: "full", cx_user: "none",
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    module: "Denetim Kaydı",
    description: "Sistem olayları ve kullanıcı aktivite geçmişi",
    superadmin: "full", cx_manager: "readonly", cx_user: "readonly",
  },
  {
    icon: <Settings className="h-4 w-4" />,
    module: "Hesap Ayarları",
    description: "Şirket profili, API anahtarları, bildirim tercihleri",
    superadmin: "full", cx_manager: "restricted", cx_user: "restricted",
    note: "Yalnızca Superadmin şirket ayarlarını ve API anahtarlarını düzenleyebilir",
  },
  {
    icon: <UserCog className="h-4 w-4" />,
    module: "Kullanıcı Yönetimi",
    description: "Kullanıcı davet etme, rol atama, erişim kaldırma",
    superadmin: "full", cx_manager: "none", cx_user: "none",
  },
  {
    icon: <BrainCircuit className="h-4 w-4" />,
    module: "AI Analiz (Tekil)",
    description: "Tek müşteri için Gemini AI analizi tetikleme",
    superadmin: "full", cx_manager: "full", cx_user: "none",
  },
  {
    icon: <BrainCircuit className="h-4 w-4" />,
    module: "AI Analiz (Toplu)",
    description: "Tüm müşterileri toplu AI analizi",
    superadmin: "full", cx_manager: "none", cx_user: "none",
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    module: "Kullanım Kılavuzu",
    description: "Platform dokümantasyonu ve metrik tanımları",
    superadmin: "full", cx_manager: "full", cx_user: "full",
  },
];

const PII_ROWS: PiiRow[] = [
  {
    field: "E-posta Adresi",
    description: "Müşteriler ve Firmalar sayfasındaki e-posta alanı",
    superadmin: "visible", cx_manager: "visible", cx_user: "masked",
  },
  {
    field: "Telefon Numarası",
    description: "Müşteri profilindeki telefon numarası (varsa)",
    superadmin: "visible", cx_manager: "visible", cx_user: "masked",
  },
  {
    field: "LLM'e Gönderilen İçerik",
    description: "Gemini AI'a gönderilen etkileşim içeriği — e-posta ve telefon otomatik temizlenir",
    superadmin: "stripped", cx_manager: "stripped", cx_user: "stripped",
  },
];

const PII_CONFIG = {
  visible: { label: "Tam Görünür",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", icon: <Unlock className="h-3.5 w-3.5" /> },
  masked:  { label: "Maskelenmiş",   color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25",    icon: <EyeOff className="h-3.5 w-3.5" /> },
  stripped:{ label: "Otomatik Temizlenir", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/25",  icon: <ShieldCheck className="h-3.5 w-3.5" /> },
};

interface ActionCategory {
  category: string;
  actions: ActionRow[];
}

const ACTION_CATEGORIES: ActionCategory[] = [
  {
    category: "Veri Yönetimi",
    actions: [
      { category: "", action: "Müşteri içe aktarma (CSV)", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Etkileşim kaydı ekleme", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Etkileşim analizden hariç tutma", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Etkileşim silme", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Segment oluşturma/güncelleme", superadmin: true, cx_manager: true, cx_user: false },
    ],
  },
  {
    category: "Anket & Kampanya",
    actions: [
      { category: "", action: "Anket şablonu oluşturma", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Anket soru düzenleme", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Kampanya oluşturma", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Kampanya başlatma (gönderme)", superadmin: true, cx_manager: "approval", cx_user: false, note: "CX Manager oluşturur, Superadmin onaylar" },
      { category: "", action: "Sıfır-Anket tetikleme", superadmin: true, cx_manager: true, cx_user: false },
    ],
  },
  {
    category: "Yapay Zeka",
    actions: [
      { category: "", action: "Tekil AI analiz tetikleme", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Toplu AI analiz", superadmin: true, cx_manager: false, cx_user: false },
      { category: "", action: "AI NLP sorgu paneli", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "AI Kişiselleştirilmiş e-posta", superadmin: true, cx_manager: true, cx_user: false },
    ],
  },
  {
    category: "Yönetim & Ayarlar",
    actions: [
      { category: "", action: "Kullanıcı davet etme", superadmin: true, cx_manager: false, cx_user: false },
      { category: "", action: "Kullanıcı rolü değiştirme", superadmin: true, cx_manager: false, cx_user: false },
      { category: "", action: "Kullanıcı erişimi kaldırma", superadmin: true, cx_manager: false, cx_user: false },
      { category: "", action: "Şirket ayarları düzenleme", superadmin: true, cx_manager: false, cx_user: false },
      { category: "", action: "API anahtarı yönetimi", superadmin: true, cx_manager: false, cx_user: false },
      { category: "", action: "Onay verme/reddetme", superadmin: true, cx_manager: true, cx_user: false },
      { category: "", action: "Rol önizleme (View As)", superadmin: true, cx_manager: false, cx_user: false },
    ],
  },
];

function AccessBadge({ level }: { level: AccessLevel }) {
  const cfg = ACCESS_CONFIG[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border", cfg.color, cfg.bg)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function PiiBadge({ level }: { level: "visible" | "masked" | "stripped" }) {
  const cfg = PII_CONFIG[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border", cfg.color, cfg.bg)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function ActionBadge({ value }: { value: boolean | "approval" }) {
  if (value === true)
    return <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/30"><Check className="h-3.5 w-3.5 text-emerald-400" /></span>;
  if (value === "approval")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-[10px] font-bold text-orange-400"><AlertTriangle className="h-3 w-3" />Onay</span>;
  return <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-500/5 border border-red-500/15"><X className="h-3.5 w-3.5 text-red-400/60" /></span>;
}

const ROLE_HEADERS: { key: RoleKey; label: string; color: string; icon: React.ReactNode }[] = [
  { key: "superadmin", label: "Süper Admin",    color: "text-amber-400",  icon: <Crown className="h-4 w-4" /> },
  { key: "cx_manager", label: "CX Manager",     color: "text-indigo-400", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "cx_user",    label: "CX Kullanıcısı", color: "text-slate-400",  icon: <Users className="h-4 w-4" /> },
];

const SECTION_TABS = ["Modül Erişim", "Kişisel Veri (PII)", "Eylem Yetkileri", "Özet"] as const;
type Tab = typeof SECTION_TABS[number];

export default function PermissionsPage() {
  const { user } = useAppAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("Modül Erişim");
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  if (user?.role !== "superadmin") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Lock className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-lg">Bu sayfaya erişim yalnızca Süper Admin'e aittir.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Yetki Matrisi"
        description="Rollere göre modül erişim, kişisel veri maskeleme ve eylem yetkileri"
        icon={<ShieldCheck className="h-6 w-6" />}
      />

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-3 mb-6">
        {Object.entries(ACCESS_CONFIG).map(([key, cfg]) => (
          <span key={key} className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border", cfg.color, cfg.bg)}>
            {cfg.icon} {cfg.label}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card/50 rounded-xl border border-border/50 mb-6 w-fit">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB: Modül Erişim ── */}
      {activeTab === "Modül Erişim" && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-card/80 border-b border-border/50">
                <th className="text-left px-5 py-4 text-sm font-semibold text-muted-foreground w-[35%]">Modül</th>
                {ROLE_HEADERS.map((r) => (
                  <th key={r.key} className={cn("text-center px-4 py-4 text-sm font-semibold w-[20%]", r.color)}>
                    <div className="flex items-center justify-center gap-1.5">
                      {r.icon}
                      {r.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_ROWS.map((row, idx) => (
                <tr
                  key={row.module}
                  className={cn(
                    "border-b border-border/30 transition-colors hover:bg-white/[0.02]",
                    idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]",
                  )}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-muted-foreground/60 flex-shrink-0">{row.icon}</span>
                      <div>
                        <p className="font-medium text-foreground text-sm">{row.module}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
                        {row.note && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Info className="h-3 w-3 text-amber-400/70 flex-shrink-0" />
                            <span className="text-[10px] text-amber-400/70">{row.note}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center"><AccessBadge level={row.superadmin} /></td>
                  <td className="px-4 py-4 text-center"><AccessBadge level={row.cx_manager} /></td>
                  <td className="px-4 py-4 text-center"><AccessBadge level={row.cx_user} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: Kişisel Veri (PII) ── */}
      {activeTab === "Kişisel Veri (PII)" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-400">PII Koruma Politikası</p>
              <p className="text-sm text-muted-foreground mt-1">
                Kişisel veriler (e-posta, telefon) rol bazında görüntüleme kısıtlamasına tabidir.
                Yapay zeka modeline (Gemini) gönderilen tüm etkileşim içerikleri, hangi rol tarafından
                tetiklenirse tetiklensin, otomatik olarak e-posta ve telefon numaralarından arındırılır.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-card/80 border-b border-border/50">
                  <th className="text-left px-5 py-4 text-sm font-semibold text-muted-foreground w-[35%]">Veri Alanı</th>
                  {ROLE_HEADERS.map((r) => (
                    <th key={r.key} className={cn("text-center px-4 py-4 text-sm font-semibold w-[20%]", r.color)}>
                      <div className="flex items-center justify-center gap-1.5">{r.icon}{r.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PII_ROWS.map((row, idx) => (
                  <tr key={row.field} className={cn("border-b border-border/30 hover:bg-white/[0.02]", idx % 2 === 0 ? "" : "bg-white/[0.01]")}>
                    <td className="px-5 py-5">
                      <p className="font-medium text-foreground text-sm">{row.field}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
                    </td>
                    <td className="px-4 py-5 text-center"><PiiBadge level={row.superadmin} /></td>
                    <td className="px-4 py-5 text-center"><PiiBadge level={row.cx_manager} /></td>
                    <td className="px-4 py-5 text-center"><PiiBadge level={row.cx_user} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            {Object.entries(PII_CONFIG).map(([key, cfg]) => (
              <div key={key} className={cn("p-4 rounded-xl border", cfg.bg)}>
                <div className={cn("flex items-center gap-2 font-semibold text-sm mb-1", cfg.color)}>
                  {cfg.icon} {cfg.label}
                </div>
                <p className="text-xs text-muted-foreground">
                  {key === "visible" && "Veri olduğu gibi görüntülenir, gizleme uygulanmaz."}
                  {key === "masked" && "E-posta: em***r@domain.com biçiminde gösterilir. Telefon: son 4 hane görünür."}
                  {key === "stripped" && "AI modeline gönderilmeden önce regex ile otomatik temizlenir: [E-POSTA], [TELEFON] ile değiştirilir."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: Eylem Yetkileri ── */}
      {activeTab === "Eylem Yetkileri" && (
        <div className="space-y-5">
          {ACTION_CATEGORIES.map((cat) => (
            <div key={cat.category} className="rounded-xl border border-border/50 overflow-hidden">
              <div className="px-5 py-3 bg-card/80 border-b border-border/50">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{cat.category}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-card/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground w-[46%]">Eylem</th>
                    {ROLE_HEADERS.map((r) => (
                      <th key={r.key} className={cn("text-center px-4 py-3 text-xs font-semibold w-[18%]", r.color)}>
                        <div className="flex items-center justify-center gap-1">{r.icon}{r.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cat.actions.map((row, idx) => (
                    <tr key={row.action} className={cn("border-b border-border/20 hover:bg-white/[0.02] transition-colors", idx % 2 === 0 ? "" : "bg-white/[0.01]")}>
                      <td className="px-5 py-3">
                        <span className="text-sm text-foreground">{row.action}</span>
                        {row.note && (
                          <span className="ml-2 text-[10px] text-amber-400/70 italic">{row.note}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center"><ActionBadge value={row.superadmin} /></td>
                      <td className="px-4 py-3 text-center"><ActionBadge value={row.cx_manager} /></td>
                      <td className="px-4 py-3 text-center"><ActionBadge value={row.cx_user} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Özet ── */}
      {activeTab === "Özet" && (
        <div className="grid grid-cols-3 gap-6">
          {ROLE_HEADERS.map((role) => {
            const moduleAccess = MODULE_ROWS.reduce<Record<string, number>>((acc, row) => {
              const level = row[role.key] as AccessLevel;
              acc[level] = (acc[level] || 0) + 1;
              return acc;
            }, {});

            const totalActions = ACTION_CATEGORIES.flatMap((c) => c.actions);
            const allowed = totalActions.filter((a) => a[role.key] === true || a[role.key] === "approval").length;
            const total = totalActions.length;

            return (
              <div key={role.key} className="rounded-xl border border-border/50 p-5 space-y-5 bg-card/20">
                <div className={cn("flex items-center gap-2 font-bold text-base", role.color)}>
                  {role.icon}
                  {role.label}
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Modül Erişim</p>
                  <div className="space-y-2">
                    {Object.entries(ACCESS_CONFIG).map(([key, cfg]) => {
                      const count = moduleAccess[key] || 0;
                      if (count === 0) return null;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className={cn("flex items-center gap-1.5 text-xs font-medium", cfg.color)}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full border", cfg.bg, cfg.color)}>
                            {count} modül
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Eylem Yetkileri</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{ width: `${(allowed / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground">{allowed}/{total}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">eylem yetkisi ({Math.round((allowed / total) * 100)}%)</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">PII Görünürlük</p>
                  <div className="space-y-1.5">
                    {PII_ROWS.map((row) => {
                      const level = row[role.key];
                      const cfg = PII_CONFIG[level];
                      return (
                        <div key={row.field} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{row.field}</span>
                          <span className={cn("text-[10px] font-bold flex items-center gap-1", cfg.color)}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
