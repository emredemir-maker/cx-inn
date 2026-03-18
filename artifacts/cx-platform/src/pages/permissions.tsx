import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/ui-elements";
import { useAppAuth } from "@/context/auth-context";
import { usePermissions, type AccessLevel, type PiiLevel, type RoleKey } from "@/context/permissions-context";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Eye, EyeOff, Check, X, AlertTriangle,
  Lock, Unlock, Users, Crown, Info, RotateCcw,
  Pencil, Save, ChevronDown,
  LayoutDashboard, BarChart2, Building2, MessagesSquare,
  Zap, MessageSquareQuote, Send, ClipboardCheck, Settings,
  UserCog, BookOpen, PieChart, BrainCircuit, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActionLevel = "true" | "false" | "approval";

/* ─── CONFIG ─── */

const ACCESS_LEVELS: AccessLevel[] = ["full", "readonly", "restricted", "approval", "none"];
const ACCESS_CONFIG: Record<AccessLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  full:       { label: "Tam Erişim",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", icon: <Check className="h-3 w-3" /> },
  readonly:   { label: "Görüntüleme", color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/25",       icon: <Eye className="h-3 w-3" /> },
  restricted: { label: "Kısıtlı",     color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25",     icon: <Lock className="h-3 w-3" /> },
  approval:   { label: "Onay Gerekli",color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/25",   icon: <AlertTriangle className="h-3 w-3" /> },
  none:       { label: "Erişim Yok",  color: "text-red-400/70",  bg: "bg-red-500/5 border-red-500/15",          icon: <X className="h-3 w-3" /> },
};
const PII_LEVELS: PiiLevel[] = ["visible", "masked"];
const PII_CONFIG: Record<PiiLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  visible: { label: "Görünür",     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", icon: <Unlock className="h-3 w-3" /> },
  masked:  { label: "Maskelenmiş", color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25",     icon: <EyeOff className="h-3 w-3" /> },
};
const ACTION_LEVELS: ActionLevel[] = ["true", "approval", "false"];
const ACTION_CONFIG: Record<ActionLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  true:     { label: "İzinli",     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", icon: <Check className="h-3 w-3" /> },
  approval: { label: "Onay Gerekli",color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25",  icon: <AlertTriangle className="h-3 w-3" /> },
  false:    { label: "Yasak",      color: "text-red-400/70",  bg: "bg-red-500/5 border-red-500/15",          icon: <X className="h-3 w-3" /> },
};

const ROLE_HEADERS: { key: RoleKey; label: string; color: string; icon: React.ReactNode; locked?: boolean }[] = [
  { key: "superadmin", label: "Süper Admin",    color: "text-amber-400",  icon: <Crown className="h-4 w-4" />,      locked: true },
  { key: "cx_manager", label: "CX Manager",     color: "text-indigo-400", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "cx_user",    label: "CX Kullanıcısı", color: "text-slate-400",  icon: <Users className="h-4 w-4" /> },
];

/* ─── MODULE ROWS ─── */
interface ModuleDef {
  key: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  note?: string;
}
const MODULE_DEFS: ModuleDef[] = [
  { key: "dashboard",        icon: <LayoutDashboard className="h-4 w-4" />, label: "Gösterge Paneli",        desc: "Özet metrikler, KPI kartları, risk alarmları" },
  { key: "analytics",        icon: <BarChart2 className="h-4 w-4" />,       label: "CX Analiz Raporu",       desc: "NPS/CSAT trendleri, acı noktaları, duygu analizi" },
  { key: "customers",        icon: <Users className="h-4 w-4" />,           label: "Müşteriler",             desc: "Müşteri listesi, profil, AI tahminleri", note: "E-posta görünürlüğü PII ayarına bağlıdır" },
  { key: "companies",        icon: <Building2 className="h-4 w-4" />,       label: "Firmalar",               desc: "Firma bazlı müşteri gruplama ve analiz", note: "E-posta görünürlüğü PII ayarına bağlıdır" },
  { key: "segments",         icon: <PieChart className="h-4 w-4" />,        label: "Segmentler",             desc: "Müşteri segmentleri oluşturma ve AI önerisi" },
  { key: "interactions",     icon: <MessagesSquare className="h-4 w-4" />,  label: "Etkileşim Kayıtları",    desc: "Müşteri etkileşimlerini görüntüleme ve içe aktarma" },
  { key: "anomalies",        icon: <Zap className="h-4 w-4" />,             label: "Sıfır Anket Motoru",     desc: "Anormallik tespiti ve otomatik anket tetikleme" },
  { key: "surveys",          icon: <MessageSquareQuote className="h-4 w-4" />, label: "Anket Şablonları",    desc: "Anket oluşturma, düzenleme ve AI tasarım önerisi" },
  { key: "campaigns",        icon: <Send className="h-4 w-4" />,            label: "Kampanya Yönetimi",      desc: "E-posta kampanyaları oluşturma ve gönderme" },
  { key: "approvals",        icon: <ClipboardCheck className="h-4 w-4" />,  label: "Onay Kuyruğu",          desc: "Bekleyen kampanya ve anket onayları" },
  { key: "audit_logs",       icon: <ShieldCheck className="h-4 w-4" />,     label: "Denetim Kaydı",         desc: "Sistem olayları ve kullanıcı aktivite geçmişi" },
  { key: "settings",         icon: <Settings className="h-4 w-4" />,        label: "Hesap Ayarları",         desc: "Şirket profili, API anahtarları, bildirim tercihleri" },
  { key: "user_management",  icon: <UserCog className="h-4 w-4" />,         label: "Kullanıcı Yönetimi",     desc: "Kullanıcı davet, rol atama, erişim kaldırma" },
  { key: "ai_analyze_single",icon: <BrainCircuit className="h-4 w-4" />,    label: "AI Analiz (Tekil)",      desc: "Tek müşteri için Gemini AI analizi tetikleme" },
  { key: "ai_analyze_bulk",  icon: <BrainCircuit className="h-4 w-4" />,    label: "AI Analiz (Toplu)",      desc: "Tüm müşterileri toplu AI analizi" },
  { key: "manual",           icon: <BookOpen className="h-4 w-4" />,        label: "Kullanım Kılavuzu",      desc: "Platform dokümantasyonu ve metrik tanımları" },
];

const PII_DEFS = [
  { key: "email", label: "E-posta Adresi", desc: "Müşteriler ve Firmalar sayfasındaki e-posta alanı" },
  { key: "phone", label: "Telefon Numarası", desc: "Müşteri profilindeki telefon numarası" },
];

interface ActionDef { key: string; label: string; note?: string; }
interface ActionCategory { category: string; actions: ActionDef[]; }
const ACTION_CATEGORIES: ActionCategory[] = [
  {
    category: "Veri Yönetimi",
    actions: [
      { key: "import_customers",    label: "Müşteri içe aktarma (CSV)" },
      { key: "add_interaction",     label: "Etkileşim kaydı ekleme" },
      { key: "exclude_interaction", label: "Etkileşim analizden hariç tutma" },
      { key: "delete_interaction",  label: "Etkileşim silme" },
      { key: "manage_segments",     label: "Segment oluşturma/güncelleme" },
    ],
  },
  {
    category: "Anket & Kampanya",
    actions: [
      { key: "create_survey",   label: "Anket şablonu oluşturma" },
      { key: "edit_survey",     label: "Anket soru düzenleme" },
      { key: "create_campaign", label: "Kampanya oluşturma" },
      { key: "send_campaign",   label: "Kampanya başlatma (gönderme)", note: "CX Manager → Onay gerektirirse 'Onay Gerekli' seçin" },
      { key: "trigger_survey",  label: "Sıfır-Anket tetikleme" },
    ],
  },
  {
    category: "Yapay Zeka",
    actions: [
      { key: "analyze_single",  label: "Tekil AI analiz tetikleme" },
      { key: "bulk_analyze",    label: "Toplu AI analiz" },
      { key: "nlp_query",       label: "AI NLP sorgu paneli" },
      { key: "ai_personalize",  label: "AI Kişiselleştirilmiş e-posta" },
    ],
  },
  {
    category: "Yönetim & Ayarlar",
    actions: [
      { key: "invite_user",     label: "Kullanıcı davet etme" },
      { key: "change_role",     label: "Kullanıcı rolü değiştirme" },
      { key: "remove_user",     label: "Kullanıcı erişimi kaldırma" },
      { key: "edit_settings",   label: "Şirket ayarları düzenleme" },
      { key: "manage_api_keys", label: "API anahtarı yönetimi" },
      { key: "approve",         label: "Onay verme/reddetme" },
      { key: "view_as",         label: "Rol önizleme (View As)" },
    ],
  },
];

/* ─── BADGE COMPONENTS ─── */

function AccessBadge({ level, editable, onClick }: {
  level: AccessLevel; editable?: boolean; onClick?: () => void;
}) {
  const cfg = ACCESS_CONFIG[level];
  return (
    <button
      onClick={editable ? onClick : undefined}
      disabled={!editable}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
        cfg.color, cfg.bg,
        editable && "cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95",
        !editable && "cursor-default",
      )}
    >
      {cfg.icon}
      {cfg.label}
      {editable && <ChevronDown className="h-2.5 w-2.5 opacity-60" />}
    </button>
  );
}

function PiiBadge({ level, editable, onClick }: {
  level: PiiLevel; editable?: boolean; onClick?: () => void;
}) {
  const cfg = PII_CONFIG[level];
  return (
    <button
      onClick={editable ? onClick : undefined}
      disabled={!editable}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
        cfg.color, cfg.bg,
        editable && "cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95",
        !editable && "cursor-default",
      )}
    >
      {cfg.icon}
      {cfg.label}
      {editable && <ChevronDown className="h-2.5 w-2.5 opacity-60" />}
    </button>
  );
}

function ActionBadge({ level, editable, onClick }: {
  level: ActionLevel; editable?: boolean; onClick?: () => void;
}) {
  const cfg = ACTION_CONFIG[level];
  return (
    <button
      onClick={editable ? onClick : undefined}
      disabled={!editable}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
        cfg.color, cfg.bg,
        editable && "cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95",
        !editable && "cursor-default",
      )}
    >
      {cfg.icon}
      {cfg.label}
      {editable && <ChevronDown className="h-2.5 w-2.5 opacity-60" />}
    </button>
  );
}

function LockedBadge({ level, type }: { level: string; type: "module" | "pii" | "action" }) {
  if (type === "module") return <AccessBadge level={level as AccessLevel} />;
  if (type === "pii") return <PiiBadge level={level as PiiLevel} />;
  return <ActionBadge level={level as ActionLevel} />;
}

const TABS = ["Modül Erişim", "Kişisel Veri (PII)", "Eylem Yetkileri"] as const;
type Tab = typeof TABS[number];

/* ─── MAIN PAGE ─── */

export default function PermissionsPage() {
  const { user } = useAppAuth();
  const { getModuleAccess, getPiiLevel, getActionLevel, updatePermission, resetPermissions, isLoading } = usePermissions();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Modül Erişim");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

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

  async function handleUpdate(role: RoleKey, key: string, value: string) {
    setSaving(true);
    try {
      await updatePermission(role, key, value);
      toast({ title: "Yetki güncellendi", description: `${role} → ${key}: ${value}` });
    } catch {
      toast({ title: "Hata", description: "Yetki güncellenemedi", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function cycleModule(role: RoleKey, key: string, current: AccessLevel) {
    const idx = ACCESS_LEVELS.indexOf(current);
    const next = ACCESS_LEVELS[(idx + 1) % ACCESS_LEVELS.length];
    handleUpdate(role, `module.${key}`, next);
  }

  function cyclePii(role: RoleKey, key: string, current: PiiLevel) {
    const next = current === "visible" ? "masked" : "visible";
    handleUpdate(role, `pii.${key}`, next);
  }

  function cycleAction(role: RoleKey, key: string, current: ActionLevel) {
    const idx = ACTION_LEVELS.indexOf(current);
    const next = ACTION_LEVELS[(idx + 1) % ACTION_LEVELS.length];
    handleUpdate(role, `action.${key}`, next);
  }

  async function handleReset(role?: RoleKey) {
    const label = role ? role : "tüm roller";
    setResetting(role ?? "all");
    try {
      await resetPermissions(role);
      toast({ title: "Sıfırlandı", description: `${label} varsayılan değerlere döndürüldü` });
    } catch {
      toast({ title: "Hata", description: "Sıfırlama başarısız", variant: "destructive" });
    } finally {
      setResetting(null);
    }
  }

  const editableRoles: RoleKey[] = ["cx_manager", "cx_user"];

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6">
        <PageHeader
          title="Yetki Matrisi"
          description="Rollere göre modül erişim, kişisel veri maskeleme ve eylem yetkileri"
          icon={<KeyRound className="h-6 w-6" />}
        />
        <div className="flex items-center gap-3 mt-1 flex-shrink-0">
          {editMode && (
            <button
              onClick={() => handleReset()}
              disabled={resetting !== null}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            >
              <RotateCcw className={cn("h-4 w-4", resetting === "all" && "animate-spin")} />
              Tümünü Sıfırla
            </button>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all",
              editMode
                ? "bg-primary text-white border-primary shadow-md"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-white/5",
            )}
          >
            {editMode ? <Save className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editMode ? "Düzenleme Modu Aktif" : "Düzenle"}
          </button>
        </div>
      </div>

      {editMode && (
        <div className="mb-5 p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
          <Pencil className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-sm text-primary">
            Hücrelere tıklayarak değerleri döngüsel olarak değiştirebilirsiniz.
            Süper Admin sütunu her zaman kilitlidir. Değişiklikler anında kaydedilir.
          </p>
          {saving && <span className="ml-auto text-xs text-muted-foreground animate-pulse">Kaydediliyor...</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card/50 rounded-xl border border-border/50 mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-white/5",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── MODULE ACCESS ── */}
      {activeTab === "Modül Erişim" && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-card/80 border-b border-border/50">
                <th className="text-left px-5 py-4 text-sm font-semibold text-muted-foreground w-[34%]">Modül</th>
                {ROLE_HEADERS.map((r) => (
                  <th key={r.key} className={cn("text-center px-4 py-4 text-sm font-semibold w-[22%]", r.color)}>
                    <div className="flex items-center justify-center gap-1.5">
                      {r.icon} {r.label}
                      {r.locked && <Lock className="h-3 w-3 opacity-50" />}
                    </div>
                    {editMode && !r.locked && (
                      <button
                        onClick={() => handleReset(r.key)}
                        disabled={resetting === r.key}
                        className="mt-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mx-auto"
                      >
                        <RotateCcw className={cn("h-2.5 w-2.5", resetting === r.key && "animate-spin")} />
                        Sıfırla
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_DEFS.map((mod, idx) => (
                <tr key={mod.key} className={cn("border-b border-border/30 hover:bg-white/[0.02] transition-colors", idx % 2 === 1 && "bg-white/[0.01]")}>
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-muted-foreground/60 flex-shrink-0">{mod.icon}</span>
                      <div>
                        <p className="font-medium text-foreground text-sm">{mod.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
                        {mod.note && (
                          <div className="flex items-center gap-1 mt-1">
                            <Info className="h-3 w-3 text-amber-400/70 flex-shrink-0" />
                            <span className="text-[10px] text-amber-400/70">{mod.note}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Superadmin — always locked */}
                  <td className="px-4 py-4 text-center">
                    <AccessBadge level={getModuleAccess(mod.key, "superadmin")} />
                  </td>
                  {/* CX Manager & CX User — editable */}
                  {(["cx_manager", "cx_user"] as RoleKey[]).map((role) => {
                    const current = getModuleAccess(mod.key, role);
                    return (
                      <td key={role} className="px-4 py-4 text-center">
                        <AccessBadge
                          level={current}
                          editable={editMode}
                          onClick={() => cycleModule(role, mod.key, current)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PII ── */}
      {activeTab === "Kişisel Veri (PII)" && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-400">PII Koruma Politikası</p>
              <p className="text-sm text-muted-foreground mt-1">
                LLM'e (Gemini) gönderilen tüm etkileşim içerikleri hangi rol için olursa olsun otomatik olarak
                e-posta ve telefon numaralarından arındırılır. Bu ayar değiştirilemez.
                Aşağıdaki ayarlar yalnızca uygulama arayüzündeki görünürlüğü etkiler.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-card/80 border-b border-border/50">
                  <th className="text-left px-5 py-4 text-sm font-semibold text-muted-foreground w-[40%]">Veri Alanı</th>
                  {ROLE_HEADERS.map((r) => (
                    <th key={r.key} className={cn("text-center px-4 py-4 text-sm font-semibold w-[20%]", r.color)}>
                      <div className="flex items-center justify-center gap-1.5">
                        {r.icon} {r.label}
                        {r.locked && <Lock className="h-3 w-3 opacity-50" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PII_DEFS.map((pii, idx) => (
                  <tr key={pii.key} className={cn("border-b border-border/30 hover:bg-white/[0.02]", idx % 2 === 1 && "bg-white/[0.01]")}>
                    <td className="px-5 py-5">
                      <p className="font-medium text-foreground text-sm">{pii.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pii.desc}</p>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <PiiBadge level={getPiiLevel(pii.key, "superadmin")} />
                    </td>
                    {(["cx_manager", "cx_user"] as RoleKey[]).map((role) => {
                      const current = getPiiLevel(pii.key, role);
                      return (
                        <td key={role} className="px-4 py-5 text-center">
                          <PiiBadge
                            level={current}
                            editable={editMode}
                            onClick={() => cyclePii(role, pii.key, current)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* LLM row — always locked */}
                <tr className="border-b border-border/30 bg-white/[0.01]">
                  <td className="px-5 py-5">
                    <p className="font-medium text-foreground text-sm">LLM'e Gönderilen İçerik</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Gemini AI'a gönderilen etkileşim içeriği — değiştirilemez</p>
                  </td>
                  {ROLE_HEADERS.map((r) => (
                    <td key={r.key} className="px-4 py-5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border text-blue-400 bg-blue-500/10 border-blue-500/25">
                        <ShieldCheck className="h-3 w-3" /> Otomatik Temizlenir
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ACTIONS ── */}
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
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground w-[40%]">Eylem</th>
                    {ROLE_HEADERS.map((r) => (
                      <th key={r.key} className={cn("text-center px-4 py-3 text-xs font-semibold w-[20%]", r.color)}>
                        <div className="flex items-center justify-center gap-1">{r.icon} {r.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cat.actions.map((act, idx) => (
                    <tr key={act.key} className={cn("border-b border-border/20 hover:bg-white/[0.02] transition-colors", idx % 2 === 1 && "bg-white/[0.01]")}>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-foreground">{act.label}</span>
                        {act.note && (
                          <p className="text-[10px] text-amber-400/70 mt-0.5">{act.note}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <ActionBadge level={getActionLevel(act.key, "superadmin")} />
                      </td>
                      {(["cx_manager", "cx_user"] as RoleKey[]).map((role) => {
                        const current = getActionLevel(act.key, role);
                        return (
                          <td key={role} className="px-4 py-3.5 text-center">
                            <ActionBadge
                              level={current}
                              editable={editMode}
                              onClick={() => cycleAction(role, act.key, current)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
