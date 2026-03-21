import React, { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useAppAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  BookOpen, Search, ChevronRight, Users, Shield, Crown, Star,
  Upload, Brain, FileText, Megaphone, CheckSquare, Zap,
  Settings, Key, HelpCircle, ArrowRight, Circle, CheckCircle2,
  AlertCircle, Info, Code2, UserPlus, Mail, BarChart3, Lock,
  Sparkles, Layers, Globe, Eye, Edit3, Send, Bell, Filter,
  Download, RefreshCw, Clock, Hash, ChevronDown, ChevronUp,
  TrendingUp, Activity, AlertTriangle, MessageCircle, Target,
  Bot, Building2, SlidersHorizontal,
} from "lucide-react";
import type { UserRole } from "@/hooks/use-firebase-auth";

/* ─────────────────────────────── Types ─────────────────────── */

interface RoleBadgeProps { role: "superadmin" | "cx_manager" | "cx_user" | "all"; size?: "sm" | "md" }
interface Section { id: string; title: string; icon: React.ElementType; color: string }
interface StepProps { n: number; title: string; children: React.ReactNode }
interface TipProps { type?: "info" | "warning" | "success"; children: React.ReactNode }
interface FaqItemProps { q: string; a: string }
interface ScreenProps { title?: string; children: React.ReactNode; className?: string }
interface SearchResult { sectionId: string; sectionTitle: string; icon: React.ElementType; color: string; score: number; snippet: string }

/* ─────────────────────────────── Role Badge ─────────────────── */

const ROLE_CFG = {
  superadmin: { label: "Süper Admin", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Crown },
  cx_manager:  { label: "CX Manager",  color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", icon: Shield },
  cx_user:     { label: "CX Kullanıcısı", color: "bg-slate-500/15 text-slate-400 border-slate-500/30",  icon: Users },
  all:         { label: "Tüm Roller",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Star },
};

function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const cfg = ROLE_CFG[role];
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-semibold",
      cfg.color,
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
    )}>
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────── Screen Mockup ─────────────── */

function ScreenMockup({ title, children, className }: ScreenProps) {
  return (
    <div className={cn("rounded-xl overflow-hidden border border-slate-700/60 shadow-xl", className)}>
      {/* Browser chrome */}
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        {title && (
          <div className="flex-1 mx-2 bg-slate-700/60 rounded px-3 py-0.5 text-[10px] text-slate-500 truncate">
            cx-inn.replit.app/{title}
          </div>
        )}
      </div>
      <div className="bg-[#080c14]">{children}</div>
    </div>
  );
}

/* ─────────────────────────────── Layout Mockup ─────────────── */

function AppLayoutMockup({ activeItem, children }: { activeItem?: string; children: React.ReactNode }) {
  const navItems = ["Dashboard", "Anketler", "Kampanyalar", "Müşteriler", "Analitik"];
  return (
    <div className="flex h-[220px]">
      {/* Sidebar */}
      <div className="w-11 border-r border-slate-800 bg-slate-900 flex flex-col items-center py-2 gap-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 mb-1" />
        {navItems.map((item) => (
          <div key={item} className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            item === activeItem ? "bg-indigo-600/30 border border-indigo-600/40" : "hover:bg-slate-800",
          )}>
            <div className="w-3 h-3 rounded-sm bg-slate-600" />
          </div>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-hidden p-3">{children}</div>
    </div>
  );
}

/* ─────────────────────────────── Step ──────────────────────── */

function Step({ n, title, children }: StepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
          {n}
        </div>
        <div className="w-px flex-1 bg-slate-800 mt-1" />
      </div>
      <div className="pb-6 flex-1">
        <h4 className="text-sm font-semibold text-white mb-1.5">{title}</h4>
        <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Tip ───────────────────────── */

function Tip({ type = "info", children }: TipProps) {
  const cfg = {
    info:    { Icon: Info,        cls: "bg-blue-500/8 border-blue-500/20 text-blue-300" },
    warning: { Icon: AlertCircle, cls: "bg-amber-500/8 border-amber-500/20 text-amber-300" },
    success: { Icon: CheckCircle2,cls: "bg-emerald-500/8 border-emerald-500/20 text-emerald-300" },
  }[type];
  const { Icon, cls } = cfg;
  return (
    <div className={cn("flex items-start gap-2.5 p-3 rounded-lg border text-sm leading-relaxed", cls)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* ─────────────────────────────── FAQ Item ───────────────────── */

function FaqItem({ q, a }: FaqItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
      >
        <span className="text-sm font-medium text-slate-200">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Section Header ─────────────── */

function SectionHeader({ icon: Icon, title, subtitle, color, roles }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  roles: RoleBadgeProps["role"][];
}) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
        <p className="text-slate-400 text-sm mb-2.5">{subtitle}</p>
        <div className="flex flex-wrap gap-1.5">
          {roles.map((r) => <RoleBadge key={r} role={r} size="md" />)}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Sections Data ─────────────── */

const SECTIONS: Section[] = [
  { id: "giris",        title: "Platforma Giriş",         icon: BookOpen,    color: "#6366f1" },
  { id: "rol-sistemi",  title: "Rol Sistemi (RBAC)",       icon: Shield,      color: "#f59e0b" },
  { id: "kullanici",    title: "Kullanıcı Yönetimi",       icon: Users,       color: "#8b5cf6" },
  { id: "import",       title: "Etkileşim İçe Aktarma",    icon: Upload,      color: "#06b6d4" },
  { id: "ai-analiz",    title: "AI Analizi",               icon: Brain,       color: "#10b981" },
  { id: "anket",        title: "Anket Yönetimi",           icon: FileText,    color: "#3b82f6" },
  { id: "kampanya",     title: "Kampanya Yönetimi",        icon: Megaphone,   color: "#ec4899" },
  { id: "onay",         title: "Onay Akışı",               icon: CheckSquare, color: "#f97316" },
  { id: "zero-survey",  title: "Sıfır-Anket Motoru",       icon: Zap,         color: "#84cc16" },
  { id: "ayarlar",      title: "Ayarlar & API",            icon: Settings,    color: "#64748b" },
  { id: "rol-gorunum",  title: "Rol Görünümü (View As)",   icon: Eye,         color: "#f59e0b" },
  { id: "yetki-matrisi",title: "Yetki Matrisi",            icon: Lock,        color: "#ec4899" },
  { id: "cx-ai",         title: "Cx-Ai Asistanı",           icon: Bot,         color: "#06b6d4" },
  { id: "domain-yonetimi", title: "Domain Yönetimi",       icon: Globe,       color: "#8b5cf6" },
  { id: "firma-segment", title: "Firma & Segment",         icon: Layers,      color: "#f59e0b" },
  { id: "metrik",       title: "Metrik Tanımları",         icon: BarChart3,   color: "#06b6d4" },
  { id: "sss",          title: "Sıkça Sorulan Sorular",    icon: HelpCircle,  color: "#a855f7" },
];

/* ─────────────────────────────── Semantic Search Index ──────── */

const SECTION_INDEX: Array<{ id: string; title: string; icon: React.ElementType; color: string; keywords: string[]; snippets: string[] }> = [
  { id: "giris", title: "Platforma Giriş", icon: BookOpen, color: "#6366f1",
    keywords: ["giriş", "başlangıç", "hoşgeldiniz", "nedir", "genel", "platform", "cx-inn", "login", "oturum", "açılış", "ana sayfa", "dashboard", "gösterge"],
    snippets: ["Google hesabınızla giriş yapın", "Firebase Authentication ile güvenli oturum", "Ana gösterge paneli temel metrikleri gösterir", "Gemini 2.5 AI tabanlı CX platformu", "NPS ve CSAT tahminleri için AI analizi"] },
  { id: "rol-sistemi", title: "Rol Sistemi (RBAC)", icon: Shield, color: "#f59e0b",
    keywords: ["rol", "rbac", "yetki", "süper admin", "superadmin", "cx manager", "cx kullanıcı", "cx_user", "cx_manager", "izin", "erişim", "hiyerarşi", "3 rol", "kademeli"],
    snippets: ["Süper Admin: tam yetki, sistem yönetimi", "CX Manager: analiz, anket ve kampanya", "CX Kullanıcısı: sınırlı görüntüleme", "Rol bazlı erişim kontrolü (RBAC)", "3 kademeli yetkilendirme"] },
  { id: "kullanici", title: "Kullanıcı Yönetimi", icon: Users, color: "#8b5cf6",
    keywords: ["kullanıcı", "davet", "ekle", "sil", "düzenle", "yönet", "ekip", "üye", "personel", "rol atama", "davetiye", "e-posta daveti"],
    snippets: ["Yeni kullanıcıyı e-posta ile davet edin", "Kullanıcıya rol atayın: Süper Admin, CX Manager, CX Kullanıcısı", "Kullanıcıları listeleyin, düzenleyin veya silin", "Davetli kullanıcı Google hesabıyla giriş yapar"] },
  { id: "import", title: "Etkileşim İçe Aktarma", icon: Upload, color: "#06b6d4",
    keywords: ["içe aktar", "import", "yükle", "csv", "excel", "xlsx", "veri", "etkileşim", "dosya", "toplu", "bulk", "upload", "müşteri verisi", "şablon", "infoset", "otomatik hariç", "no-reply filtre"],
    snippets: ["CSV veya Excel ile toplu etkileşim yükleme (20MB)", "No-reply ve bildirim e-postaları otomatik hariç tutulur", "Batch AI analizi: 100 etkileşim ~15-20 saniye", "Infoset formatı otomatik algılanır"] },
  { id: "ai-analiz", title: "AI Analizi", icon: Brain, color: "#10b981",
    keywords: ["ai", "yapay zeka", "gemini", "analiz", "nps", "csat", "duygu", "tahmin", "puan", "skor", "sentiment", "nlp", "doğal dil", "segmentasyon", "ağrı noktası", "şikayet", "batch", "toplu analiz", "ai sınıflandır"],
    snippets: ["Gemini 2.5 AI her etkileşimi otomatik analiz eder", "Batch motor: 5 müşteri / tek çağrı, 3 paralel grup", "NPS: 0–10 skala, 9–10 Promoter, 7–8 Pasif, 0–6 Detractor", "AI Sınıflandır: seçili müşteri için yeniden analiz tetikler"] },
  { id: "anket", title: "Anket Yönetimi", icon: FileText, color: "#3b82f6",
    keywords: ["anket", "survey", "soru", "form", "geri bildirim", "feedback", "nps anketi", "csat anketi", "oluştur", "yayınla", "şablon", "tasarım"],
    snippets: ["Yeni anket oluşturun veya şablondan başlayın", "NPS ve CSAT anket şablonları hazır", "Anket onay akışına gönderilir", "Yayınlanan anket e-posta ile gönderilir", "Cevap oranı ve sonuç analizi"] },
  { id: "kampanya", title: "Kampanya Yönetimi", icon: Megaphone, color: "#ec4899",
    keywords: ["kampanya", "campaign", "e-posta", "email", "gönder", "mail", "toplu gönderim", "segmentasyon", "hedef kitle", "kişiselleştirme", "ai e-posta", "hyper personalized", "resend"],
    snippets: ["Müşteri segmentlerine hedefli kampanya", "AI ile kişiselleştirilmiş e-posta içeriği", "Kampanyayı onay akışına gönderin", "Açılma oranı ve tıklama analitiği", "Hyper-personalized AI e-posta"] },
  { id: "onay", title: "Onay Akışı", icon: CheckSquare, color: "#f97316",
    keywords: ["onay", "approval", "akış", "workflow", "bekleyen", "onayla", "reddet", "yönetici onayı", "taslak", "yayınla", "review", "inceleme"],
    snippets: ["Anket ve kampanyalar onay akışına girer", "CX Manager veya Süper Admin onayla veya reddet", "Reddedilen içerik gerekçesiyle iade edilir", "Bekleyen onaylar bildirim olarak gösterilir"] },
  { id: "zero-survey", title: "Sıfır-Anket Motoru", icon: Zap, color: "#84cc16",
    keywords: ["sıfır anket", "zero survey", "pasif", "arka plan", "otomatik analiz", "anket göndermeden", "pasif izleme", "nlp", "etkileşim tabanlı"],
    snippets: ["Müşteriye anket göndermeden memnuniyet tahmini", "Mevcut etkileşimler AI ile sürekli analiz edilir", "Pasif izleme: kanal bağımsız, gerçek zamanlı", "Müşteri profili otomatik güncellenir"] },
  { id: "ayarlar", title: "Ayarlar & API", icon: Settings, color: "#64748b",
    keywords: ["ayarlar", "settings", "api", "entegrasyon", "api anahtarı", "webhook", "şirket bilgileri", "bildirim", "güvenlik", "pii", "maskeleme", "rest api", "endpoint", "bearer"],
    snippets: ["Şirket bilgileri: ad, logo, sektör, iletişim", "REST API anahtarı oluşturun ve yönetin", "GET /customers, POST /interactions, GET /analytics/nps", "PII maskeleme: kişisel veri anonimleştirme", "Authorization: Bearer cx_live_xxxx"] },
  { id: "rol-gorunum", title: "Rol Görünümü (View As)", icon: Eye, color: "#f59e0b",
    keywords: ["view as", "rol görünümü", "önizleme", "simüle", "test", "göz ikonu", "impersonate", "önizleme modu", "sarı banner", "başka rol", "rol değiştir"],
    snippets: ["Süper Admin olarak başka rolün bakış açısını görün", "Üst çubukta göz ikonu ile View As", "Sarı banner: Önizleme Modu aktif olduğunda belirir", "CX Manager veya CX Kullanıcısı görünümü", "Gerçek oturum korunur kapanmaz"] },
  { id: "yetki-matrisi", title: "Yetki Matrisi", icon: Lock, color: "#ec4899",
    keywords: ["yetki matrisi", "permission matrix", "yetki düzenle", "erişim seviyesi", "tam erişim", "erişim yok", "kısıtlı", "modül erişimi", "pii yetki", "eylem yetki", "sıfırla", "reset", "veritabanı yetki"],
    snippets: ["Modül erişimi: Tam Erişim, Görüntüleme, Kısıtlı, Onay Gerekli, Erişim Yok", "PII sekmesi: e-posta maskeleme", "Eylem Yetkileri: Silme, Düzenleme, Onaylama", "Değişiklikler veritabanına kaydedilir anında etkili", "Süper Admin sütunu kilitlidir"] },
  { id: "cx-ai", title: "Cx-Ai Asistanı", icon: Bot, color: "#06b6d4",
    keywords: ["cx-ai", "cx ai", "ai asistan", "yapay zeka sorgu", "nlp sorgu", "doğal dil", "sorgula", "analitik soru", "sohbet", "panel", "bot", "ai sorgu", "pdf rapor ai"],
    snippets: ["Doğal dille analitik soru sorun: 'En kötü NPS kim?'", "Gemini AI anlık yanıt üretir", "Sağ üst köşedeki Cx-Ai butonuna tıklayın", "Yanıtlar PDF olarak dışa aktarılabilir"] },
  { id: "domain-yonetimi", title: "Domain Yönetimi", icon: Globe, color: "#8b5cf6",
    keywords: ["domain", "hariç tut", "exclude", "filtre", "no-reply", "bildirim", "otomatik", "domain listesi", "domain ekle", "domain sil", "içe aktarma filtresi", "spam", "bot mail"],
    snippets: ["Etkileşim kayıtlarında Domain Ayarları butonuna tıklayın", "Domain ekleyin: infoset.app, noreply.com…", "Sistem otomatik tespit ettiği domainleri kendi ekler", "Manuel ve otomatik domain rozetleri gösterilir"] },
  { id: "firma-segment", title: "Firma & Segment", icon: Layers, color: "#f59e0b",
    keywords: ["firma", "segment", "ai segment", "kolon", "müşteri kolonu", "segment önerisi", "ai etiket", "etiket örtüşme", "kullanıcı segmenti", "segment atama"],
    snippets: ["Müşteriler sayfasında Firma ve Segment ayrı kolondur", "Segment: kullanıcı atandıysa onu gösterir", "✦ AI rozeti: yapay zekanın önerdiği segment", "AI segment etiket örtüşmesiyle otomatik eşleşir"] },
  { id: "metrik", title: "Metrik Tanımları", icon: BarChart3, color: "#06b6d4",
    keywords: ["metrik", "tanım", "nps", "csat", "churn", "retention", "promoter", "detractor", "pasif", "puan", "benchmark", "iyi aralık", "hedef", "analitik"],
    snippets: ["NPS: 0–10, 9–10 Promoter, 7–8 Pasif, 0–6 Detractor", "CSAT: 1–5 müşteri memnuniyet puanı", "Churn Riski: yüksek orta düşük", "Retention Rate: müşteriyi elde tutma oranı", "İyi NPS hedefi: 8.5+"] },
  { id: "sss", title: "Sıkça Sorulan Sorular", icon: HelpCircle, color: "#a855f7",
    keywords: ["sss", "soru", "cevap", "yardım", "sorun", "hata", "faq", "destek", "support", "problem", "çözüm", "neden", "nasıl"],
    snippets: ["Sık sorulan sorular ve cevapları", "AI analizi neden başarısız olur?", "Anket onayda ne kadar bekler?", "CSV yükleme formatı nasıl olmalı?", "Kullanıcı daveti e-posta gelmiyor"] },
];

function semanticSearch(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  const results: SearchResult[] = [];

  for (const entry of SECTION_INDEX) {
    let score = 0;
    let bestSnippet = "";
    let bestSnippetScore = 0;

    const titleLower = entry.title.toLowerCase();
    if (titleLower === q) score += 200;
    else if (titleLower.includes(q)) score += 100;
    else { for (const w of words) { if (titleLower.includes(w)) score += 40; } }

    for (const kw of entry.keywords) {
      const kl = kw.toLowerCase();
      if (kl === q) score += 80;
      else if (kl.includes(q)) score += 50;
      else if (q.includes(kl) && kl.length >= 3) score += 35;
      else { for (const w of words) { if (kl.includes(w) || w.includes(kl)) score += 20; } }
    }

    for (const snippet of entry.snippets) {
      const sl = snippet.toLowerCase();
      let snScore = 0;
      if (sl.includes(q)) snScore = 60;
      else { for (const w of words) { if (sl.includes(w)) snScore += 15; } }
      if (snScore > bestSnippetScore) { bestSnippetScore = snScore; bestSnippet = snippet; }
      score += snScore;
    }

    if (score > 0) results.push({ sectionId: entry.id, sectionTitle: entry.title, icon: entry.icon, color: entry.color, score, snippet: bestSnippet || entry.snippets[0] || "" });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 6);
}

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q || q.length < 2) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) {
    const word = q.split(/\s+/).find((w) => text.toLowerCase().includes(w.toLowerCase()));
    if (!word) return text;
    const wi = text.toLowerCase().indexOf(word.toLowerCase());
    return <>{text.slice(0, wi)}<mark className="bg-indigo-500/30 text-indigo-200 rounded-[2px] px-0.5">{text.slice(wi, wi + word.length)}</mark>{text.slice(wi + word.length)}</>;
  }
  return <>{text.slice(0, idx)}<mark className="bg-indigo-500/30 text-indigo-200 rounded-[2px] px-0.5">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>;
}

/* ─────────────────────────────── Main Page ─────────────────── */

export default function ManualPage() {
  const { user } = useAppAuth();
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState("giris");
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement>>({});

  // IntersectionObserver for active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { root: contentRef.current, rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const searchResults: SearchResult[] = semanticSearch(search);
  const isSearching = search.trim().length >= 2;
  const filteredSections = isSearching
    ? SECTIONS.filter((s) => searchResults.some((r) => r.sectionId === s.id))
    : SECTIONS;

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reg = (id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current[id] = el;
  };

  return (
    <Layout>
      <div className="flex gap-6 relative min-h-[calc(100vh-120px)]">

        {/* ── Sticky Sidebar ── */}
        <aside className="w-56 shrink-0 sticky top-4 self-start max-h-[calc(100vh-100px)] overflow-y-auto pr-1 hidden lg:block">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kılavuzda ara…"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <span className="text-[10px]">✕</span>
              </button>
            )}
          </div>

          {isSearching ? (
            /* ── Semantic search results ── */
            <div className="space-y-1">
              <p className="text-[10px] text-slate-600 px-1 mb-2">
                {searchResults.length > 0 ? `${searchResults.length} sonuç bulundu` : "Sonuç bulunamadı"}
              </p>
              {searchResults.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <Search className="w-5 h-5 text-slate-700 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-600">"{search}" için eşleşme yok</p>
                  <p className="text-[10px] text-slate-700 mt-1">Farklı bir kelime deneyin</p>
                </div>
              )}
              {searchResults.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.sectionId}
                    onClick={() => { scrollTo(r.sectionId); setSearch(""); }}
                    className="w-full text-left rounded-xl border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/70 hover:border-indigo-500/30 transition-all p-2.5 group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3 h-3 shrink-0" style={{ color: r.color }} />
                      <span className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-white">
                        {highlight(r.sectionTitle, search)}
                      </span>
                    </div>
                    {r.snippet && (
                      <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 pl-5">
                        {highlight(r.snippet, search)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Normal nav ── */
            <nav className="space-y-0.5">
              {filteredSections.map((s) => {
                const Icon = s.icon;
                const isActive = activeId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-all",
                      isActive
                        ? "bg-indigo-600/15 text-indigo-300 font-semibold border border-indigo-500/20"
                        : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? s.color : undefined }} />
                    <span className="truncate">{s.title}</span>
                    {isActive && <ChevronRight className="w-3 h-3 ml-auto text-indigo-500" />}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Role tag */}
          {!isSearching && user?.role && (
            <div className="mt-6 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
              <p className="text-[10px] text-slate-600 mb-1.5">Aktif rolünüz</p>
              <RoleBadge role={user.role as RoleBadgeProps["role"]} size="md" />
            </div>
          )}
        </aside>

        {/* ── Content ── */}
        <div ref={contentRef} className="flex-1 space-y-16 pb-24">

          {/* Hero */}
          <div id="hero" className="relative rounded-2xl overflow-hidden border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-8">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.15),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">CX-Inn Kullanım Kılavuzu</h1>
                  <p className="text-slate-400 text-sm">AI destekli B2B müşteri deneyimi platformu</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
                Bu kılavuz CX-Inn platformunun tüm özelliklerini ve iş akışlarını kapsar.
                Sol menüden bölümlere atlayabilir ya da yukarıdaki arama kutusunu kullanabilirsiniz.
              </p>
              <div className="flex gap-2 mt-5 flex-wrap">
                {SECTIONS.map((s) => (
                  <button key={s.id} onClick={() => scrollTo(s.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all">
                    <s.icon className="w-3 h-3" style={{ color: s.color }} />
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 1. Platforma Giriş ── */}
          <section id="giris" ref={reg("giris")} className="scroll-mt-4">
            <SectionHeader
              icon={BookOpen} title="Platforma Giriş" color="bg-indigo-500/15 text-indigo-400 border-indigo-500/25"
              subtitle="CX-Inn'e ilk kez giriş yapma ve platforma genel bakış."
              roles={["all"]}
            />

            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Step n={1} title="Giriş Sayfasına Gidin">
                    Platform URL'sine gidin. Beyaz kart üzerindeki <strong className="text-white">"Google ile Giriş Yap"</strong> butonuna tıklayın.
                  </Step>
                  <Step n={2} title="Google Hesabınızı Seçin">
                    İş e-postanızla bağlı Google hesabını seçin. Superadmin tarafından davet edildiğiniz e-posta adresiyle giriş yapın.
                  </Step>
                  <Step n={3} title="Dashboard'a Yönlendirilir">
                    İlk girişte rolünüz otomatik atanır (davet üzerinden). Dashboard'da NPS/CSAT metriklerini göreceksiniz.
                  </Step>
                </div>

                <ScreenMockup title="login">
                  <div className="flex items-center justify-center h-[220px] p-4">
                    <div className="w-full max-w-[180px] bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 mx-auto mb-2 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">C</span>
                      </div>
                      <p className="text-white text-[11px] font-semibold mb-3">Platforma giriş yapın</p>
                      <div className="bg-white rounded-lg py-2 px-3 flex items-center gap-2 mb-3">
                        <Globe className="w-3 h-3 text-blue-500" />
                        <span className="text-[9px] text-slate-700 font-medium">Google ile Giriş Yap</span>
                      </div>
                      <div className="space-y-1.5">
                        {["Google tek tıkla giriş","Firebase Auth koruması","httpOnly şifreli çerez"].map(t => (
                          <div key={t} className="flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                            <span className="text-[8px] text-slate-400">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScreenMockup>
              </div>

              <Tip type="info">
                Giriş yapamıyorsanız Superadmin'den davet e-postası isteyin. Yalnızca davet edilmiş e-posta adresleri platforma erişebilir.
              </Tip>

              {/* Platform özeti kartları */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Brain, label: "Gemini 2.5 AI", desc: "NPS/CSAT tahmini" },
                  { icon: Zap, label: "Sıfır-Anket", desc: "Pasif analiz" },
                  { icon: Layers, label: "Segmentasyon", desc: "Müşteri kümeleme" },
                  { icon: Lock, label: "RBAC", desc: "3 kademeli yetki" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3 text-center">
                    <Icon className="w-5 h-5 text-indigo-400 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 2. Rol Sistemi ── */}
          <section id="rol-sistemi" ref={reg("rol-sistemi")} className="scroll-mt-4">
            <SectionHeader
              icon={Shield} title="Rol Sistemi (RBAC)" color="bg-amber-500/15 text-amber-400 border-amber-500/25"
              subtitle="CX-Inn üç kademeli rol sistemiyle çalışır. Her rol farklı yetkiler taşır."
              roles={["all"]}
            />

            <div className="space-y-4">
              {[
                {
                  role: "superadmin" as const,
                  cfg: ROLE_CFG.superadmin,
                  powers: ["Kullanıcı davet etme & rol atama","Tüm anket/kampanya yönetimi","Onay kuyruğunu yönetme","API anahtarı oluşturma","Sistem ayarlarını değiştirme","Audit log görüntüleme"],
                  cannot: [],
                },
                {
                  role: "cx_manager" as const,
                  cfg: ROLE_CFG.cx_manager,
                  powers: ["Anket & kampanya onaylama","CX Kullanıcı içeriklerini yönetme","Segment & analitik görüntüleme","Kendi anket/kampanya oluşturma"],
                  cannot: ["Kullanıcı rol değiştiremez","API anahtarı oluşturamaz"],
                },
                {
                  role: "cx_user" as const,
                  cfg: ROLE_CFG.cx_user,
                  powers: ["Anket taslağı oluşturma","Kampanya taslağı oluşturma","Müşteri & etkileşim görüntüleme","Analitik dashboard görüntüleme"],
                  cannot: ["Onay almadan yayınlayamaz","Kullanıcı yönetemez"],
                },
              ].map(({ role, cfg, powers, cannot }) => {
                const Icon = cfg.icon;
                return (
                  <div key={role} className={cn("rounded-xl border p-5", cfg.color.includes("amber") ? "border-amber-500/20 bg-amber-500/5" : cfg.color.includes("indigo") ? "border-indigo-500/20 bg-indigo-500/5" : "border-slate-600/20 bg-slate-500/5")}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", cfg.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{cfg.label}</p>
                        <RoleBadge role={role} size="sm" />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-1.5">Yetkiler</p>
                        <ul className="space-y-1">
                          {powers.map(p => (
                            <li key={p} className="flex items-start gap-1.5 text-xs text-slate-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" /> {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {cannot.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-1.5">Kısıtlamalar</p>
                          <ul className="space-y-1">
                            {cannot.map(c => (
                              <li key={c} className="flex items-start gap-1.5 text-xs text-slate-500">
                                <Circle className="w-3 h-3 text-slate-700 mt-0.5 shrink-0" /> {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Flow diagram */}
              <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-5">
                <p className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wide">Onay Akışı</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "CX Kullanıcı", sublabel: "Taslak oluşturur", color: "bg-slate-700 text-slate-300" },
                    null,
                    { label: "CX Manager", sublabel: "Onaylar/Reddeder", color: "bg-indigo-900/60 text-indigo-300" },
                    null,
                    { label: "Yayında", sublabel: "Aktif & görünür", color: "bg-emerald-900/40 text-emerald-300" },
                  ].map((item, i) => item === null ? (
                    <ArrowRight key={i} className="w-5 h-5 text-slate-600" />
                  ) : (
                    <div key={item.label} className={cn("px-3 py-2 rounded-lg text-center min-w-[90px]", item.color)}>
                      <p className="text-xs font-semibold">{item.label}</p>
                      <p className="text-[9px] opacity-70 mt-0.5">{item.sublabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 3. Kullanıcı Yönetimi ── */}
          <section id="kullanici" ref={reg("kullanici")} className="scroll-mt-4">
            <SectionHeader
              icon={Users} title="Kullanıcı Yönetimi & Davet" color="bg-violet-500/15 text-violet-400 border-violet-500/25"
              subtitle="Yeni kullanıcıları platforma davet edin, rolleri yönetin."
              roles={["superadmin"]}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Step n={1} title="Kullanıcı Yönetimi Sayfasına Gidin">
                  Sol menü altındaki <strong className="text-white">👑 Kullanıcı Yönetimi</strong> bağlantısına tıklayın. (Yalnızca Superadmin görür.)
                </Step>
                <Step n={2} title="E-posta ve Rol Girin">
                  Üst bölümdeki davet formuna kullanıcının e-posta adresini ve atanacak rolü girin.
                </Step>
                <Step n={3} title="Davet Et Butonuna Tıklayın">
                  Kullanıcıya platform linki ve rol bilgisi içeren bir davet e-postası otomatik gönderilir.
                </Step>
                <Step n={4} title="Kullanıcı Giriş Yapar">
                  Davet edilen kullanıcı Google hesabıyla ilk giriş yaptığında rolü otomatik atanır.
                </Step>
              </div>

              <ScreenMockup title="user-management">
                <AppLayoutMockup>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="w-3 h-3 text-violet-400" />
                      <span className="text-[10px] text-white font-semibold">Kullanıcı Yönetimi</span>
                    </div>
                    {/* Invite form mock */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex gap-1.5 items-center">
                      <Mail className="w-2.5 h-2.5 text-slate-500" />
                      <div className="flex-1 h-4 bg-slate-700 rounded text-[8px] px-1 flex items-center text-slate-500">kullanici@firma.com</div>
                      <div className="px-1.5 py-0.5 bg-slate-700 rounded text-[7px] text-slate-400">CX Manager</div>
                      <div className="px-1.5 py-0.5 bg-indigo-600 rounded text-[7px] text-white">Davet Et</div>
                    </div>
                    {/* User list mock */}
                    {[
                      { name: "Emre Demir", role: "SA", color: "text-amber-400" },
                      { name: "Ayşe Kaya", role: "CM", color: "text-indigo-400" },
                      { name: "Mehmet A.", role: "CU", color: "text-slate-400" },
                    ].map(u => (
                      <div key={u.name} className="flex items-center gap-2 py-1 border-b border-slate-800">
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[7px] text-slate-400">
                          {u.name[0]}
                        </div>
                        <span className="text-[9px] text-slate-300 flex-1">{u.name}</span>
                        <span className={cn("text-[8px] font-bold", u.color)}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <div className="mt-4 space-y-3">
              <Tip type="success">
                Bekleyen davetleri "Tekrar Gönder" butonu ile yeniden iletebilirsiniz. Kabul edilen davetler arşivde görünür.
              </Tip>
              <Tip type="warning">
                Kendi rolünüzü değiştiremezsiniz. Superadmin rolünü başka bir kullanıcıya atarken dikkatli olun.
              </Tip>
            </div>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 4. Etkileşim İçe Aktarma ── */}
          <section id="import" ref={reg("import")} className="scroll-mt-4">
            <SectionHeader
              icon={Upload} title="Etkileşim İçe Aktarma" color="bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
              subtitle="Müşteri destek etkileşimlerinizi CSV veya API ile platforma aktarın."
              roles={["superadmin", "cx_manager", "cx_user"]}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Step n={1} title="Etkileşimler Sayfasına Gidin">
                  Sol menüden <strong className="text-white">Etkileşim Kayıtları</strong> seçin. Sağ üstte <strong className="text-white">"İçe Aktar"</strong> butonunu bulun.
                </Step>
                <Step n={2} title="Şablon İndirin (İsteğe Bağlı)">
                  Standart format için <strong className="text-white">CSV Şablon İndir</strong> veya <strong className="text-white">Excel Şablon İndir</strong> seçeneğini kullanın.
                  Sütunlar: <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">customer_email, type, subject, content, status, channel, agent_name, duration_seconds, resolution, interacted_at</code>
                </Step>
                <Step n={3} title="Dosyayı Yükleyin">
                  CSV veya Excel dosyanızı sürükleyin ya da seçin. Maksimum dosya boyutu <strong className="text-white">20 MB</strong>. Infoset formatı otomatik algılanır.
                </Step>
                <Step n={4} title="Otomatik Filtreleme Çalışır">
                  Sistem yükleme sırasında <strong className="text-white">no-reply e-postaları</strong>, fatura bildirimleri, OTP mesajları ve pazarlama içeriklerini otomatik tespit eder ve <em>hariç tutuldu</em> olarak işaretler. Hariç tutulan kayıtlar AI analizine dahil edilmez.
                </Step>
                <Step n={5} title="Batch AI Analizi Başlar">
                  Yükleme sonrası Gemini AI etkileşimleri <strong className="text-white">5'li gruplar halinde (batch)</strong> paralel olarak analiz eder. 100 etkileşim yaklaşık 15–20 saniyede tamamlanır.
                </Step>
              </div>

              <ScreenMockup title="interactions">
                <AppLayoutMockup activeItem="Etkileşimler">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-white font-semibold">Etkileşimler</span>
                      <div className="flex items-center gap-1 bg-indigo-600 px-2 py-0.5 rounded text-[8px] text-white">
                        <Upload className="w-2 h-2" /> İçe Aktar
                      </div>
                    </div>
                    {/* Upload zone */}
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-3 text-center mb-2">
                      <Upload className="w-4 h-4 text-slate-500 mx-auto mb-1" />
                      <p className="text-[8px] text-slate-500">CSV dosyasını buraya sürükleyin</p>
                    </div>
                    {/* Rows */}
                    {["Şikayet — Kargo gecikmesi","Memnuniyet — Hızlı destek","İstek — Yeni özellik"].map((t, i) => (
                      <div key={t} className="flex items-center gap-2 py-1 border-b border-slate-800">
                        <div className={cn("w-1.5 h-1.5 rounded-full", i === 0 ? "bg-red-500" : i === 1 ? "bg-emerald-500" : "bg-amber-500")} />
                        <span className="text-[8px] text-slate-400 flex-1 truncate">{t}</span>
                        <span className="text-[7px] text-indigo-400">{[42, 91, 67][i]}</span>
                      </div>
                    ))}
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <div className="mt-4 space-y-4">
              {/* Auto-exclusion info */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-amber-400" />
                  <p className="text-xs font-semibold text-amber-300">Otomatik İlgisizlik Filtresi</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  İçe aktarma sonucu panelinde <strong className="text-white">"Otomatik Hariç Tutuldu"</strong> sayısını görebilirsiniz.
                  Bu kayıtlar veritabanına eklenir ancak AI analizinden çıkarılır — böylece no-reply bildirimleri metriklerinizi bozmaz.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["no-reply@…","noreply@…","OTP / Onay Kodu","Fatura Bildirimi","Kargo Takip","Newsletter","Sistem Bildirimi"].map(c => (
                    <span key={c} className="px-2 py-1 rounded-full bg-amber-500/10 text-[10px] text-amber-300 border border-amber-500/20">{c}</span>
                  ))}
                </div>
              </div>

              {/* Channels */}
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4">
                <p className="text-xs font-semibold text-slate-300 mb-3">Desteklenen Veri Kanalları</p>
                <div className="flex flex-wrap gap-2">
                  {["E-posta","Telefon","Chat / WhatsApp","Sosyal Medya","Web Formu","API"].map(c => (
                    <span key={c} className="px-2 py-1 rounded-full bg-slate-700 text-[10px] text-slate-300 border border-slate-600">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 5. AI Analizi ── */}
          <section id="ai-analiz" ref={reg("ai-analiz")} className="scroll-mt-4">
            <SectionHeader
              icon={Brain} title="AI Analizi (Gemini 2.5)" color="bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
              subtitle="Google Gemini 2.5 Flash modeli etkileşimlerinizi analiz ederek NPS, CSAT ve duygu tespiti yapar."
              roles={["all"]}
            />

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { icon: BarChart3, label: "NPS Tahmini",    desc: "−100 ile +100 arası Net Promoter Score", color: "text-indigo-400" },
                { icon: Star,      label: "CSAT Skoru",    desc: "1–5 müşteri memnuniyeti puanı",           color: "text-amber-400" },
                { icon: Brain,     label: "Duygu Analizi", desc: "Pozitif / Negatif / Nötr sınıflandırma", color: "text-emerald-400" },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-4">
                  <Icon className={cn("w-6 h-6 mb-2", color)} />
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-400 mt-1">{desc}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Analiz Nasıl Çalışır?</h4>
                <div className="space-y-4">
                  <Step n={1} title="Etkileşim Yüklenir">
                    CSV içe aktarma veya API ile etkileşim platforma eklenir.
                  </Step>
                  <Step n={2} title="Gemini Çağrısı">
                    Her etkileşim için Gemini 2.5 Flash modeline prompt gönderilir; duygu, konu ve şikayet kategorisi çıkarılır.
                  </Step>
                  <Step n={3} title="Skor Hesaplanır">
                    Duygu ağırlıkları ve tarihsel verilerle birleşerek NPS/CSAT tahmini oluşturulur.
                  </Step>
                  <Step n={4} title="Dashboard'a Yansır">
                    Tüm metrikler analitik dashboard'da ve müşteri profilinde güncellenir.
                  </Step>
                </div>
              </div>

              <ScreenMockup title="analytics">
                <AppLayoutMockup activeItem="Analitik">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-white font-semibold">AI Analitik</span>
                      <div className="flex items-center gap-1 text-[8px] text-emerald-400">
                        <Sparkles className="w-2 h-2" /> Gemini 2.5
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 mb-3">
                      {[
                        { label: "NPS", val: "+62", color: "text-indigo-400" },
                        { label: "CSAT", val: "4.3", color: "text-amber-400" },
                        { label: "Churn Risk", val: "%12", color: "text-red-400" },
                      ].map(m => (
                        <div key={m.label} className="bg-slate-800 rounded-lg p-1.5 text-center">
                          <p className={cn("text-sm font-bold", m.color)}>{m.val}</p>
                          <p className="text-[7px] text-slate-500">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Mini bar chart */}
                    <div className="flex items-end gap-1 h-10">
                      {[60,80,55,90,70,85,72].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `rgba(99,102,241,${0.3 + i * 0.05})` }} />
                      ))}
                    </div>
                    <p className="text-[7px] text-slate-600 text-center mt-1">Son 7 gün NPS trendi</p>
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <Tip type="success">
              Batch analiz motoru 5 müşteriyi tek bir Gemini çağrısında işler ve 3 grubu paralel çalıştırır. 100 etkileşim için toplam süre yaklaşık 15–20 saniyedir. Dashboard otomatik yenilenir.
            </Tip>

            {/* AI Classify button info */}
            <div className="mt-4 rounded-xl border border-slate-700/40 bg-slate-800/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <p className="text-xs font-semibold text-slate-200">"AI Sınıflandır" Butonu Nedir?</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Etkileşim Kayıtları sayfasındaki <strong className="text-white">AI Sınıflandır</strong> butonu, seçili müşteri için mevcut tüm etkileşimleri yeniden analiz eder.
                Önceden analiz edilmemiş veya güncellenmiş kayıtlar için tetiklenebilir. İşlem arka planda çalışır;
                tamamlandığında müşteri profili ve analitik dashboard güncellenir.
              </p>
            </div>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── Cx-Ai Asistanı ── */}
          <section id="cx-ai" ref={reg("cx-ai")} className="scroll-mt-4">
            <SectionHeader
              icon={Bot} title="Cx-Ai Asistanı" color="bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
              subtitle="Doğal dille analitik soru sorun — Gemini AI anlık yanıt üretir."
              roles={["all"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <Step n={1} title="Cx-Ai Butonuna Tıklayın">
                  Sağ üst menüdeki indigo→teal renk gradyanlı <strong className="text-white">Cx-Ai</strong> butonuna tıklayın. Panel sağ tarafta açılır.
                </Step>
                <Step n={2} title="Sorunuzu Yazın">
                  Doğal Türkçe ile analitik sorular sorun. Örneğin:
                  <ul className="mt-1.5 space-y-1 text-slate-500">
                    {[
                      '"En yüksek churn riski olan müşteri kim?"',
                      '"Bu ay NPS nasıl değişti?"',
                      '"Hangi segmentte en çok şikayet var?"',
                    ].map(q => <li key={q} className="flex items-start gap-1.5"><span className="text-teal-500 mt-0.5">›</span>{q}</li>)}
                  </ul>
                </Step>
                <Step n={3} title="Yanıtı İnceleyin">
                  Gemini AI müşteri verilerinize dayanarak gerçek zamanlı yanıt oluşturur. Yanıt metni ve önerilen aksiyonlar panel içinde görünür.
                </Step>
                <Step n={4} title="PDF Olarak Kaydedin">
                  Panel içindeki <strong className="text-white">PDF İndir</strong> butonu ile konuşma geçmişini dışa aktarabilirsiniz.
                </Step>
              </div>

              <ScreenMockup title="cx-ai">
                <AppLayoutMockup>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 via-teal-500 to-emerald-500 flex items-center justify-center">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-[10px] text-white font-semibold">Cx-Ai Asistanı</span>
                    </div>
                    {/* Chat messages */}
                    <div className="bg-slate-800/60 rounded-lg p-2 border border-slate-700/40">
                      <p className="text-[8px] text-teal-300">Siz</p>
                      <p className="text-[8px] text-slate-300 mt-0.5">En yüksek churn riskli 3 müşteri?</p>
                    </div>
                    <div className="bg-teal-500/5 rounded-lg p-2 border border-teal-500/20">
                      <p className="text-[8px] text-teal-400">Cx-Ai</p>
                      <div className="space-y-0.5 mt-0.5">
                        {["1. Ahmet Y. — %89 risk","2. Zeynep K. — %76 risk","3. Can D. — %71 risk"].map(t => (
                          <p key={t} className="text-[8px] text-slate-300">{t}</p>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1 h-5 bg-slate-800 rounded-lg border border-slate-700 px-1.5 flex items-center">
                        <span className="text-[7px] text-slate-600">Bir soru sorun…</span>
                      </div>
                      <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center">
                        <Send className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <div className="grid md:grid-cols-3 gap-3 mb-4">
              {[
                { icon: BarChart3, label: "Analitik Sorgular", examples: ["NPS trendi nasıl?", "CSAT ortalaması ne?", "En çok şikayet edilen sorun?"] },
                { icon: Users, label: "Müşteri Sorguları", examples: ["Churn riski yüksek olanlar?", "Promoter müşteriler kimler?", "Segment dağılımı nasıl?"] },
                { icon: TrendingUp, label: "Tahmin & Öneriler", examples: ["Hangi segmenti önceliklemeliyim?", "Aksiyon öner", "Bu ay ne değişti?"] },
              ].map(({ icon: Icon, label, examples }) => (
                <div key={label} className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-teal-400" />
                    <span className="text-[11px] font-semibold text-white">{label}</span>
                  </div>
                  <ul className="space-y-1">
                    {examples.map(e => (
                      <li key={e} className="text-[10px] text-slate-500 flex items-start gap-1">
                        <span className="text-teal-600">›</span> {e}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Tip type="info">
              Cx-Ai yalnızca kendi şirketinizin verilerine erişir. Yanıtlar gerçek zamanlı veritabanı verisiyle oluşturulur — statik raporlar değil.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── Domain Yönetimi ── */}
          <section id="domain-yonetimi" ref={reg("domain-yonetimi")} className="scroll-mt-4">
            <SectionHeader
              icon={Globe} title="Domain Yönetimi" color="bg-violet-500/15 text-violet-400 border-violet-500/25"
              subtitle="İçe aktarma sırasında atlanacak e-posta domainlerini yönetin."
              roles={["superadmin", "cx_manager"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <Step n={1} title="Domain Ayarları Panelini Açın">
                  Etkileşim Kayıtları sayfasının sağ üst köşesindeki <strong className="text-white">Domain Ayarları</strong> butonuna tıklayın. Mevcut domain sayısı rozet olarak gösterilir.
                </Step>
                <Step n={2} title="Domain Ekleyin">
                  Metin kutusuna domain yazın (örn: <code className="text-violet-300 bg-violet-500/10 px-1 rounded">infoset.app</code>) ve bir açıklama girin. Enter veya <strong className="text-white">Ekle</strong> butonuna tıklayın.
                </Step>
                <Step n={3} title="Domain Listesini İnceleyin">
                  <strong className="text-white">Manuel</strong> etiketi elle eklenen, <strong className="text-white">✦ Otomatik</strong> etiketi sistemin kendi tespit ettiği domainleri gösterir.
                </Step>
                <Step n={4} title="Domain Silin">
                  Bir domainın üzerine geldiğinizde çöp kutusu ikonu belirir. Tıklayarak hariç tutma listesinden çıkarabilirsiniz.
                </Step>
              </div>

              <ScreenMockup title="interactions#domains">
                <AppLayoutMockup>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white font-semibold">Domain Yönetimi</span>
                      <span className="text-[7px] text-slate-500">3 domain aktif</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1 h-5 bg-slate-800 rounded border border-slate-700 px-1.5 flex items-center">
                        <span className="text-[7px] text-slate-600">domain.com</span>
                      </div>
                      <div className="px-1.5 py-0.5 bg-violet-600 rounded text-[7px] text-white">Ekle</div>
                    </div>
                    {[
                      { domain: "infoset.app", badge: "Manuel", color: "text-slate-400 bg-slate-700/50" },
                      { domain: "noreply.com", badge: "✦ Otomatik", color: "text-violet-300 bg-violet-500/10" },
                      { domain: "billing.co", badge: "✦ Otomatik", color: "text-violet-300 bg-violet-500/10" },
                    ].map(({ domain, badge, color }) => (
                      <div key={domain} className="flex items-center gap-2 py-1 border-b border-slate-800">
                        <Globe className="w-2.5 h-2.5 text-slate-500" />
                        <span className="text-[9px] text-slate-300 flex-1 font-mono">{domain}</span>
                        <span className={cn("text-[7px] px-1.5 py-0.5 rounded-full", color)}>{badge}</span>
                      </div>
                    ))}
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <div className="space-y-3">
              <Tip type="info">
                Sistem içe aktarma sırasında otomatik tespit ettiği domainleri listeye ekler. Bu sayede aynı domain'den gelen kayıtlar bir sonraki içe aktarmada direkt atlanır.
              </Tip>
              <Tip type="warning">
                Bir domaini sildikten sonra, o domainden gelen e-postalar tekrar içe aktarma sürecine dahil edilir. Yanlışlıkla silinmiş domainleri tekrar ekleyin.
              </Tip>
            </div>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── Firma & Segment Kolonları ── */}
          <section id="firma-segment" ref={reg("firma-segment")} className="scroll-mt-4">
            <SectionHeader
              icon={Layers} title="Firma & Segment Kolonları" color="bg-amber-500/15 text-amber-400 border-amber-500/25"
              subtitle="Müşteriler sayfasında Firma ve Segment bilgileri artık ayrı kolonlarda görünür."
              roles={["all"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Müşteriler tablosundaki <strong className="text-white">Segment</strong> kolonu üç öncelik sırasına göre değer gösterir:
                </p>
                <div className="space-y-3">
                  {[
                    { n: 1, label: "Kullanıcı Segmenti", desc: 'Müşteriye elle atanmış segment (örn: "VIP", "Churn Risk"). "Genel" dışında bir değer varsa önceliğe sahiptir.', color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
                    { n: 2, label: "✦ AI Segment", desc: 'Etkileşim etiketleriyle segment tablosundaki source_tags örtüştüğünde Gemini\'nin önerdiği segment. ✦ rozeti ile işaretlidir.', color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" },
                    { n: 3, label: "— (Boş)", desc: 'Kullanıcı segmenti "Genel" ve hiçbir etiket eşleşmesi yoksa çizgi gösterilir.', color: "bg-slate-700/30 border-slate-600/30 text-slate-400" },
                  ].map(({ n, label, desc, color }) => (
                    <div key={n} className={cn("rounded-xl border p-4", color)}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">{n}</span>
                        <span className="text-sm font-semibold text-white">{label}</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-80">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <ScreenMockup title="customers">
                <AppLayoutMockup activeItem="Müşteriler">
                  <div>
                    <div className="grid grid-cols-4 gap-1 mb-2 border-b border-slate-700 pb-1">
                      {["Ad Soyad", "Firma", "Segment", "NPS"].map(h => (
                        <span key={h} className="text-[7px] text-slate-500 font-semibold uppercase tracking-wide">{h}</span>
                      ))}
                    </div>
                    {[
                      { name: "Ahmet Y.", company: "Firma A", segment: "VIP", segColor: "text-emerald-400" },
                      { name: "Zeynep K.", company: "Firma B", segment: "✦ Churn Risk", segColor: "text-indigo-300" },
                      { name: "Can D.", company: "Startup X", segment: "—", segColor: "text-slate-600" },
                    ].map(r => (
                      <div key={r.name} className="grid grid-cols-4 gap-1 py-1 border-b border-slate-800/40">
                        <span className="text-[8px] text-slate-300">{r.name}</span>
                        <span className="text-[8px] text-slate-400">{r.company}</span>
                        <span className={cn("text-[8px] font-medium", r.segColor)}>{r.segment}</span>
                        <span className="text-[8px] text-indigo-400">{["+62", "+45", "-12"][["Ahmet Y.", "Zeynep K.", "Can D."].indexOf(r.name)]}</span>
                      </div>
                    ))}
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <Tip type="info">
              AI segment eşleştirmesi gerçek zamanlı olarak Segmentler sayfasındaki <strong className="text-white">Kaynak Etiketler</strong> ile etkileşim etiketlerinin örtüşmesine dayanır. Doğru etiketler atandığında AI segmentleri otomatik güncellenir.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 6. Anket Yönetimi ── */}
          <section id="anket" ref={reg("anket")} className="scroll-mt-4">
            <SectionHeader
              icon={FileText} title="Anket Yönetimi" color="bg-blue-500/15 text-blue-400 border-blue-500/25"
              subtitle="NPS, CSAT ve özel anketler oluşturun, kişiselleştirin ve gönderin."
              roles={["superadmin", "cx_manager", "cx_user"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <Step n={1} title="Yeni Anket Oluşturun">
                  <strong className="text-white">Anketler → Yeni Anket</strong> yolunu izleyin. Anket türünü seçin: NPS, CSAT veya Özel.
                </Step>
                <Step n={2} title="Blokları Düzenleyin">
                  Drag & drop blok editörü ile soru, derecelendirme ve metin blokları ekleyin. Sıralarını değiştirin.
                </Step>
                <Step n={3} title="Segmente Göre Hedefleyin">
                  Hangi müşteri segmentine gönderileceğini belirtin. AI kişiselleştirme için segment verisini kullanır.
                </Step>
                <Step n={4} title="Onaya Gönderin (CX User)">
                  CX User ise taslağı CX Manager onayına gönderin. Onay sonrası gönderim aktif olur.
                </Step>
                <Step n={5} title="Test E-postası Gönderin">
                  Gerçek gönderimden önce kendinize test e-postası göndererek görünümü kontrol edin.
                </Step>
              </div>

              <ScreenMockup title="surveys">
                <AppLayoutMockup activeItem="Anketler">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-white font-semibold">Anketler</span>
                      <div className="px-2 py-0.5 bg-indigo-600 rounded text-[8px] text-white">+ Yeni</div>
                    </div>
                    {[
                      { title: "Q4 NPS Anketi", status: "Yayında", color: "bg-emerald-500" },
                      { title: "Onboarding CSAT", status: "Onay Bekliyor", color: "bg-amber-500" },
                      { title: "Ürün Geri Bildirim", status: "Taslak", color: "bg-slate-600" },
                    ].map(s => (
                      <div key={s.title} className="flex items-center gap-2 py-1.5 border-b border-slate-800">
                        <FileText className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] text-slate-300 flex-1">{s.title}</span>
                        <div className="flex items-center gap-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
                          <span className="text-[7px] text-slate-500">{s.status}</span>
                        </div>
                      </div>
                    ))}
                    {/* Block editor hint */}
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {["NPS Sorusu","Açık Uç","Derecelendirme"].map(b => (
                        <div key={b} className="bg-slate-800 border border-dashed border-slate-600 rounded p-1 text-center text-[7px] text-slate-500">{b}</div>
                      ))}
                    </div>
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-4">
              <p className="text-xs font-semibold text-white mb-2">Anket Durumları</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { s: "Taslak", desc: "Düzenleniyor", color: "bg-slate-600" },
                  { s: "Onay Bekliyor", desc: "Manager inceliyor", color: "bg-amber-500" },
                  { s: "Yayında", desc: "Gönderim aktif", color: "bg-emerald-500" },
                  { s: "Reddedildi", desc: "Revizyon gerekli", color: "bg-red-500" },
                  { s: "Tamamlandı", desc: "Arşivlendi", color: "bg-slate-500" },
                ].map(({ s, desc, color }) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", color)} />
                    <div>
                      <span className="text-xs text-slate-300">{s}</span>
                      <span className="text-[10px] text-slate-600 ml-1">— {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 7. Kampanya Yönetimi ── */}
          <section id="kampanya" ref={reg("kampanya")} className="scroll-mt-4">
            <SectionHeader
              icon={Megaphone} title="Kampanya Yönetimi" color="bg-pink-500/15 text-pink-400 border-pink-500/25"
              subtitle="AI ile kişiselleştirilmiş e-posta kampanyaları oluşturun ve segment bazlı gönderin."
              roles={["superadmin", "cx_manager", "cx_user"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <Step n={1} title="Kampanya Oluşturun">
                  <strong className="text-white">Kampanyalar → Yeni Kampanya</strong> ile başlayın. Kampanya adı ve hedef segmenti belirleyin.
                </Step>
                <Step n={2} title="AI Kişiselleştirme">
                  <strong className="text-white">"AI ile Kişiselleştir"</strong> butonuna tıklayın. Gemini AI, segment özelliklerine göre otomatik konu satırı ve gövde metnini oluşturur.
                </Step>
                <Step n={3} title="İçeriği Düzenleyin">
                  Oluşturulan içeriği ihtiyaca göre düzenleyin. Değişken alanları kullanarak kişiselleştirme ekleyin: <code className="text-pink-300 bg-pink-500/10 px-1 rounded">{"{{first_name}}"}</code>
                </Step>
                <Step n={4} title="Onay & Gönderim">
                  Onay alındıktan sonra planlı veya anlık gönderim yapın.
                </Step>
              </div>

              <ScreenMockup title="campaigns">
                <AppLayoutMockup activeItem="Kampanyalar">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-white font-semibold">Kampanyalar</span>
                      <div className="flex items-center gap-1 text-[8px] text-pink-400">
                        <Sparkles className="w-2 h-2" /> AI Kişiselleştir
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2 mb-2 border border-pink-500/20">
                      <p className="text-[8px] text-pink-300 mb-1">AI Oluşturulmuş İçerik</p>
                      <p className="text-[7px] text-slate-400 leading-relaxed">Sayın {"{{"}<span className="text-pink-300">first_name</span>{"}}"}, özel teklifimizi sizinle paylaşmak istiyoruz...</p>
                    </div>
                    {[
                      { name: "Churn Risk Kampanyası", sent: "2,341" },
                      { name: "Promoter Ödül Maili",  sent: "891" },
                    ].map(c => (
                      <div key={c.name} className="flex items-center gap-2 py-1.5 border-b border-slate-800">
                        <Megaphone className="w-3 h-3 text-pink-400" />
                        <span className="text-[8px] text-slate-300 flex-1 truncate">{c.name}</span>
                        <span className="text-[7px] text-slate-500">{c.sent} gönderildi</span>
                      </div>
                    ))}
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <Tip type="success">
              AI Kişiselleştirme segment profiline göre farklı mesajlar oluşturur — aynı kampanyayı farklı segmentlere çok daha etkili şekilde iletebilirsiniz.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 8. Onay Akışı ── */}
          <section id="onay" ref={reg("onay")} className="scroll-mt-4">
            <SectionHeader
              icon={CheckSquare} title="Onay Akışı" color="bg-orange-500/15 text-orange-400 border-orange-500/25"
              subtitle="CX User tarafından oluşturulan içeriklerin CX Manager tarafından onaylanması süreci."
              roles={["superadmin", "cx_manager"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">CX Manager için Onay Süreci</h4>
                <div className="space-y-4">
                  <Step n={1} title="Onay Kuyruğunu Açın">
                    Sol menüden <strong className="text-white">Onay Kuyruğu</strong> linkine tıklayın. (Yalnızca CX Manager ve Superadmin görür.)
                  </Step>
                  <Step n={2} title="İçeriği İnceleyin">
                    Anket veya kampanya detaylarını gözden geçirin. Önizleme butonu ile nasıl görüneceğini kontrol edin.
                  </Step>
                  <Step n={3} title="Onayla veya Reddet">
                    <span className="text-emerald-400 font-semibold">Onayla</span> tıklarsanız içerik aktif olur.
                    <span className="text-red-400 font-semibold"> Reddet</span> tıklarsanız revizyon notu ekleyin.
                  </Step>
                </div>
              </div>

              <ScreenMockup title="approvals">
                <AppLayoutMockup>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckSquare className="w-3 h-3 text-orange-400" />
                      <span className="text-[10px] text-white font-semibold">Onay Kuyruğu</span>
                      <span className="ml-auto px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[8px] rounded-full">3 bekliyor</span>
                    </div>
                    {[
                      { title: "Q4 NPS Anketi", by: "Ayşe K.", type: "Anket" },
                      { title: "Churn Kampanyası", by: "Mehmet A.", type: "Kampanya" },
                    ].map(item => (
                      <div key={item.title} className="bg-slate-800 rounded-lg p-2 mb-2 border border-slate-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white font-medium">{item.title}</span>
                          <span className="text-[7px] text-slate-500">{item.type}</span>
                        </div>
                        <p className="text-[7px] text-slate-500 mb-1.5">Oluşturan: {item.by}</p>
                        <div className="flex gap-1">
                          <div className="flex-1 py-0.5 bg-emerald-600/30 border border-emerald-600/30 rounded text-[7px] text-emerald-400 text-center">✓ Onayla</div>
                          <div className="flex-1 py-0.5 bg-red-600/20 border border-red-600/20 rounded text-[7px] text-red-400 text-center">✕ Reddet</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AppLayoutMockup>
              </ScreenMockup>
            </div>

            <Tip type="warning">
              Reddedilen içeriklerde revizyon notunuz CX User'a bildirilir. İçerik "Taslak" durumuna döner ve düzenlenerek tekrar gönderilebilir.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 9. Sıfır-Anket Motoru ── */}
          <section id="zero-survey" ref={reg("zero-survey")} className="scroll-mt-4">
            <SectionHeader
              icon={Zap} title="Sıfır-Anket Motoru" color="bg-lime-500/15 text-lime-400 border-lime-500/25"
              subtitle="Müşterilere anket göndermeden, mevcut etkileşim verilerinden otomatik NPS/CSAT tahmini yapan pasif analiz motoru."
              roles={["all"]}
            />

            <div className="rounded-xl bg-gradient-to-r from-lime-950/30 to-slate-900 border border-lime-500/20 p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-lime-500/15 border border-lime-500/25 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-lime-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Nasıl Çalışır?</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Sıfır-Anket Motoru, müşterilerin destek etkileşimlerini (e-posta, chat, telefon) analiz ederek
                    gerçek zamanlı NPS ve CSAT tahmini yapar. Tek bir anket göndermeden müşteri memnuniyetini ölçersiniz.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { icon: Eye,        title: "Pasif İzleme",    desc: "Tüm etkileşim kanallarını gözlemler",         step: "1" },
                { icon: Brain,      title: "AI Çıkarımı",     desc: "Gemini duygu + intent analizi yapar",          step: "2" },
                { icon: BarChart3,  title: "Skor Güncellenir",desc: "Müşteri profili ve dashboard otomatik güncellenir", step: "3" },
              ].map(({ icon: Icon, title, desc, step }) => (
                <div key={title} className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-3 text-5xl font-black text-slate-800 select-none">{step}</div>
                  <Icon className="w-5 h-5 text-lime-400 mb-2" />
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 mt-1">{desc}</p>
                </div>
              ))}
            </div>

            <Tip type="success">
              Sıfır-Anket Motoru, anket yorgunluğunu ortadan kaldırır. Yüzlerce müşteri etkileşiminden anlamlı metrikler çıkarmanızı sağlar.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 10. Ayarlar & API ── */}
          <section id="ayarlar" ref={reg("ayarlar")} className="scroll-mt-4">
            <SectionHeader
              icon={Settings} title="Ayarlar & API Entegrasyonu" color="bg-slate-500/15 text-slate-400 border-slate-500/25"
              subtitle="Platform ayarlarını yapılandırın ve harici sistemlerle REST API üzerinden entegre olun."
              roles={["superadmin", "cx_manager"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Şirket Ayarları</h4>
                <div className="space-y-3">
                  {[
                    { icon: Globe,  label: "Şirket Bilgileri",    desc: "Ad, logo, sektör, iletişim bilgileri" },
                    { icon: Bell,   label: "Bildirimler",          desc: "E-posta ve push bildirim tercihleri" },
                    { icon: Lock,   label: "Güvenlik",             desc: "Oturum süresi, IP kısıtlamaları" },
                    { icon: Filter, label: "PII Maskeleme",        desc: "Kişisel veri anonimleştirme kuralları" },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="text-[10px] text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">REST API</h4>
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-900 border border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-white">API Anahtarı Oluşturun</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">Ayarlar → API Entegrasyonu bölümünden yeni anahtar oluşturun.</p>
                    <div className="bg-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-400">
                      <span className="text-slate-600">Authorization: </span>
                      <span className="text-indigo-300">Bearer cx_live_xxxx...</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900 border border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-white">Örnek Endpoint'ler</span>
                    </div>
                    {[
                      { method: "GET",  path: "/api/v1/customers" },
                      { method: "POST", path: "/api/v1/interactions" },
                      { method: "GET",  path: "/api/v1/analytics/nps" },
                    ].map(({ method, path }) => (
                      <div key={path} className="flex items-center gap-2 py-1">
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                          method === "GET" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400")}>
                          {method}
                        </span>
                        <code className="text-[9px] text-slate-400 font-mono">{path}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Tip type="warning">
              API anahtarları yalnızca oluşturulduğunda bir kez görüntülenir. Güvenli bir yerde saklayın; kaybederseniz yeni anahtar oluşturmanız gerekir.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 12. Rol Görünümü (View As) ── */}
          <section id="rol-gorunum" ref={reg("rol-gorunum")} className="scroll-mt-4">
            <SectionHeader
              icon={Eye} title="Rol Görünümü (View As)" color="bg-amber-500/15 text-amber-400 border-amber-500/25"
              subtitle="Süper Admin olarak diğer rollerin gözünden platformu deneyimleyin — gerçek oturumunuzu kaybetmeden."
              roles={["superadmin"]}
            />

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Nasıl Kullanılır?</h4>
                <Step n={1} title="Göz İkonu">
                  Üst çubukta sağ üstteki göz (<Eye className="inline w-3 h-3 text-amber-400" />) ikonuna tıklayın. Bu ikon yalnızca Süper Admin hesaplarda görünür.
                </Step>
                <Step n={2} title="Rol Seçin">
                  Açılan menüden <RoleBadge role="cx_manager" /> veya <RoleBadge role="cx_user" /> seçin. Seçim anında uygulanır.
                </Step>
                <Step n={3} title="Sarı Banner">
                  Ekranın üstünde <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold"><Eye className="w-2.5 h-2.5" />Önizleme Modu</span> banner'ı belirir. Hangi rolü gördüğünüz açıkça gösterilir.
                </Step>
                <Step n={4} title="Çıkış">
                  Menüden "Kendi Görünümüm" seçeneğiyle veya banner'daki "Çıkış" butonuyla normal moda dönün.
                </Step>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Ne Değişir?</h4>
                <div className="space-y-2.5">
                  {[
                    { icon: Shield,    label: "Sidebar Menüsü",     desc: "Seçilen rolün erişebildiği sayfalar görünür, diğerleri gizlenir." },
                    { icon: Filter,    label: "PII Maskeleme",       desc: "CX Kullanıcısı seçilirse e-posta adresleri maskelenir." },
                    { icon: Lock,      label: "Buton/Aksiyon Kısıtı",desc: "Silme, düzenleme, onaylama butonları role göre gizlenir." },
                    { icon: Eye,       label: "Gerçek Oturum Korunur",desc: "Gerçek Süper Admin yetkiniz arka planda aktif kalmaya devam eder." },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <Icon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ScreenMockup title="dashboard" className="mb-6">
              <div className="p-0">
                <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-300">Önizleme Modu — CX Kullanıcısı olarak görüntülüyorsunuz</span>
                  </div>
                  <button className="text-[10px] text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full hover:bg-amber-500/10">Çıkış</button>
                </div>
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-white">Dashboard</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                      <Eye className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="text-[10px] text-slate-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 text-amber-400">CX Kullanıcısı</div>
                  </div>
                </div>
                <div className="p-4 text-[10px] text-slate-500 italic">Sayfa içeriği CX Kullanıcısı izinleriyle yüklendi…</div>
              </div>
            </ScreenMockup>

            <Tip type="success">
              View As özelliği test ve kalite güvencesi için idealdir. Yeni bir kullanıcı eklemeden önce onların deneyimini canlıda görebilirsiniz.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 13. Yetki Matrisi ── */}
          <section id="yetki-matrisi" ref={reg("yetki-matrisi")} className="scroll-mt-4">
            <SectionHeader
              icon={Lock} title="Yetki Matrisi" color="bg-pink-500/15 text-pink-400 border-pink-500/25"
              subtitle="Roller bazında modül erişimi, kişisel veri görünürlüğü ve eylem yetkilerini veritabanına kaydederek dinamik olarak düzenleyin."
              roles={["superadmin"]}
            />

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { icon: Layers,   label: "Modül Erişimi",   desc: "Her rolün hangi sayfaları görebileceğini belirler.", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
                { icon: Filter,   label: "Kişisel Veri (PII)", desc: "E-posta gibi alanların maskelenip maskelenmeyeceğini ayarlar.", color: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/20" },
                { icon: CheckSquare, label: "Eylem Yetkileri", desc: "Silme, düzenleme ve onaylama butonlarının görünürlüğü.", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              ].map(({ icon: Icon, label, desc, color, bg }) => (
                <div key={label} className={`p-4 rounded-xl border ${bg} flex flex-col gap-2`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white mb-3">Erişim Seviyeleri (Modül Erişimi)</h4>
              <div className="space-y-2">
                {[
                  { label: "Tam Erişim",      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", desc: "Görüntüleme + tüm düzenleme aksiyonları etkin." },
                  { label: "Görüntüleme",     badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",         desc: "Yalnızca okuma; ekleme/silme/düzenleme butonları gizli." },
                  { label: "Kısıtlı",         badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",      desc: "Sayfaya erişilir ama belirli alanlar/tablolar gizlenir." },
                  { label: "Onay Gerekli",    badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",   desc: "Her aksiyon Süper Admin onayına gönderilir." },
                  { label: "Erişim Yok",      badge: "bg-red-500/20 text-red-300 border-red-500/30",            desc: "Sayfa sidebar'dan gizlenir, URL ile de açılamaz." },
                ].map(({ label, badge, desc }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge} shrink-0`}>{label}</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white mb-3">Nasıl Düzenlenir?</h4>
              <Step n={1} title="Yetki Matrisi Sayfasına Gidin">
                Sol menüden <span className="text-indigo-400 font-medium">Süper Admin → Yetki Matrisi</span> yolunu izleyin.
              </Step>
              <Step n={2} title="Düzenle Butonuna Tıklayın">
                Sayfanın sağ üstündeki <span className="inline-flex items-center gap-1 bg-indigo-600/20 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30 font-semibold"><Edit3 className="w-2.5 h-2.5" />Düzenle</span> butonuyla düzenleme modunu etkinleştirin.
              </Step>
              <Step n={3} title="Hücreye Tıklayın">
                İstediğiniz rol-modül kesişimindeki hücreye tıklayın. Her tıklamada değer döngüsel olarak değişir.
              </Step>
              <Step n={4} title="Kaydet">
                Değişiklikler anında veritabanına kaydedilir. Sayfayı yenileseniz de korunur.
              </Step>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white">Süper Admin Sütunu Kilitli</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Süper Admin yetkilerini hiçbir zaman düzenleyemezsiniz. Bu sütun her zaman gri ve kilitli görünür.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">Varsayılana Sıfırla</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Her rolün yanındaki "Sıfırla" butonuyla o role ait tüm ayarları platform varsayılanına döndürebilirsiniz.
                </p>
              </div>
            </div>

            <Tip type="warning">
              Yetki Matrisi değişiklikleri anlık etkili olur — oturum açık kullanıcılar sonraki sayfa yenilemesinde yeni kısıtlamalarla karşılaşır. Düzenlemeden önce etkilenen kullanıcıları bilgilendirin.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 14. Metrik Tanımları ── */}
          <section id="metrik" ref={reg("metrik")} className="scroll-mt-4">
            <SectionHeader
              icon={BarChart3} title="Metrik Tanımları" color="bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
              subtitle="Gösterge Paneli ve CX Analiz Raporu'ndaki tüm metriklerin açıklamaları, ölçekleri ve iyi aralıkları."
              roles={["all"]}
            />

            {/* ── Gösterge Paneli Metrikleri ── */}
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" /> Gösterge Paneli Metrikleri
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                {
                  icon: TrendingUp, iconColor: "text-indigo-400", bgColor: "bg-indigo-500/10",
                  name: "NPS Skoru (0–10)", fullName: "Bireysel Tahmin NPS Skoru",
                  desc: "Gemini AI'ın her müşteri için tahmin ettiği bireysel NPS puanı. 9–10 Destekleyici, 7–8 Pasif, 0–6 Eleştirmen olarak sınıflandırılır. Klasik kurumsal NPS (−100/+100) değil.",
                  formula: "Gemini AI → etkileşim analizi → 0–10 tahmin skoru",
                  scale: "0 (en kötü) → 5 (nötr) → 10 (mükemmel)",
                  good: "9–10 Destekleyici · 7–8 Pasif · 0–6 Eleştirmen",
                  source: "Gemini AI — etkileşim analizinden tahmin",
                  note: "Gerçek anket ölçümü değil, AI tahminidir.",
                },
                {
                  icon: Star, iconColor: "text-emerald-400", bgColor: "bg-emerald-500/10",
                  name: "CSAT Skoru", fullName: "Customer Satisfaction Score",
                  desc: "Belirli bir etkileşim veya deneyimden sonra müşterinin genel memnuniyetini ölçer.",
                  formula: "Memnun Yanıtlar / Toplam Yanıt × 5",
                  scale: "1 (çok kötü) → 3 (orta) → 5 (mükemmel)",
                  good: "3.5+ kabul edilebilir · 4.0+ iyi · 4.5+ mükemmel",
                  source: "Gemini AI — etkileşim analizinden tahmin",
                  note: "Gerçek anket ölçümü değil, AI tahminidir.",
                },
                {
                  icon: Upload, iconColor: "text-sky-400", bgColor: "bg-sky-500/10",
                  name: "Etkileşim Gir", fullName: "Toplam Etkileşim Sayısı",
                  desc: "Sisteme yüklenmiş tüm müşteri etkileşimlerinin (destek talepleri, sohbetler, e-postalar, çağrılar) toplam sayısı.",
                  formula: null,
                  scale: "0 ve üzeri — ne kadar fazla, o kadar zengin analiz",
                  good: "Tüm kanallardan düzenli içe aktarma yapılmalı",
                  source: "CSV içe aktarma veya API entegrasyonu",
                  note: null,
                },
                {
                  icon: AlertTriangle, iconColor: "text-amber-400", bgColor: "bg-amber-500/10",
                  name: "Açık Talep", fullName: "Çözüm Bekleyen Destek Talepleri",
                  desc: "Henüz çözüme kavuşturulmamış, bekleyen destek taleplerinin anlık sayısı.",
                  formula: null,
                  scale: "0 idealdir; yüksek değer ekip yükünü işaret eder",
                  good: "Mümkün olduğunca düşük tutulmalı",
                  source: "Statüsü 'açık' olan etkileşim kayıtları",
                  note: null,
                },
                {
                  icon: Brain, iconColor: "text-violet-400", bgColor: "bg-violet-500/10",
                  name: "AI Analizi", fullName: "Gemini AI Tarafından Analiz Edilen Etkileşimler",
                  desc: "Gemini AI'ın NPS, CSAT tahmini ve duygu sınıflandırması tamamladığı etkileşim sayısı.",
                  formula: null,
                  scale: "Toplam etkileşim sayısına yakın olmalı",
                  good: "Analiz sayısı = toplam etkileşim olması hedeflenmeli",
                  source: "Gemini 2.5 Flash — etkileşim yüklendiğinde otomatik",
                  note: "Düşükse içe aktarma hâlâ devam ediyor olabilir.",
                },
                {
                  icon: Megaphone, iconColor: "text-pink-400", bgColor: "bg-pink-500/10",
                  name: "Aktif Kampanya", fullName: "Yayında Olan Kampanya Sayısı",
                  desc: "Şu an aktif olan ve müşterilere gönderim yapılan anket veya e-posta kampanyalarının sayısı.",
                  formula: null,
                  scale: "0 ve üzeri",
                  good: "Çok fazla eş zamanlı kampanya müşteri yorgunluğuna yol açabilir",
                  source: "Onaylanmış ve yayında olan kampanya kayıtları",
                  note: null,
                },
                {
                  icon: Users, iconColor: "text-orange-400", bgColor: "bg-orange-500/10",
                  name: "Toplam Müşteri", fullName: "Platformdaki Kayıtlı Müşteri Sayısı",
                  desc: "Sistemde profili bulunan tüm müşterilerin sayısı. Parantez içindeki rakam yüksek churn riski taşıyanları gösterir.",
                  formula: null,
                  scale: "Büyüdükçe segment analizi önem kazanır",
                  good: "Churn riski yüksek müşteri oranı %10'un altında tutulmalı",
                  source: "Etkileşim içe aktarmada otomatik oluşturulan profiller",
                  note: null,
                },
                {
                  icon: Send, iconColor: "text-blue-400", bgColor: "bg-blue-500/10",
                  name: "Toplam Yanıt", fullName: "Tüm Kampanyalardan Gelen Yanıt Sayısı",
                  desc: "Anket ve e-posta kampanyalarından alınan toplam geri bildirim sayısı.",
                  formula: "Doldurulmuş anket + form gönderimi",
                  scale: "0 ve üzeri",
                  good: "Yanıt oranı %30'un üzerinde olması hedeflenmeli",
                  source: "Kampanya tıklama ve form gönderim kayıtları",
                  note: null,
                },
              ].map((m) => (
                <div key={m.name} className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 flex flex-col gap-2.5">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", m.bgColor)}>
                      <m.icon className={cn("w-4 h-4", m.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white leading-tight">{m.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 italic">{m.fullName}</p>
                    </div>
                  </div>
                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed">{m.desc}</p>
                  {/* Details grid */}
                  <div className="space-y-1.5">
                    {m.formula && (
                      <div className="flex gap-2">
                        <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">Formül</span>
                        <span className="text-[10px] text-indigo-300 font-mono leading-snug">{m.formula}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">Ölçek</span>
                      <span className="text-[10px] text-slate-400 leading-snug">{m.scale}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">İyi Aralık</span>
                      <span className="text-[10px] text-emerald-400 leading-snug">{m.good}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">Kaynak</span>
                      <span className="text-[10px] text-slate-500 leading-snug">{m.source}</span>
                    </div>
                  </div>
                  {m.note && (
                    <div className="flex items-start gap-1.5 bg-amber-500/8 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-300/80 italic leading-snug">{m.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── CX Analiz Raporu Metrikleri ── */}
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" /> CX Analiz Raporu Metrikleri
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[
                {
                  icon: TrendingUp, iconColor: "text-indigo-400", bgColor: "bg-indigo-500/10",
                  name: "Aylık AI Tahmin Trendi", fullName: "Gemini Aylık NPS & CSAT Tahmin Grafiği",
                  desc: "Gemini AI'ın etkileşim kayıtlarından ürettiği aylık NPS ve CSAT tahminlerinin zaman içindeki değişimini gösteren alan grafiği.",
                  formula: "Her ay için AI analiz sonuçlarının ortalaması",
                  scale: "NPS: 0 → 10 · CSAT: 1 → 5",
                  good: "NPS 8.0 üzeri · CSAT 4.0 üzeri hedeflenmeli",
                  source: "Aylık gruplanan Gemini AI analiz sonuçları",
                  note: "Bu grafik gerçek anket ölçümlerini değil, AI tahminlerini yansıtır.",
                },
                {
                  icon: AlertTriangle, iconColor: "text-red-400", bgColor: "bg-red-500/10",
                  name: "Yüksek Churn Riski", fullName: "Kritik Müşteri Segmenti",
                  desc: "Yakın gelecekte ürün veya hizmeti terk etme olasılığı yüksek olan müşterilerin sayısı.",
                  formula: "AI: negatif etkileşim yoğunluğu + düşük NPS/CSAT kombinasyonu",
                  scale: "Düşük · Orta · Yüksek (kırmızı = kritik)",
                  good: "Yüksek churn sayısı sıfıra yakın olmalı",
                  source: "Gemini AI etkileşim + skor kombinasyon analizi",
                  note: "Churn riski yüksek müşterilere önleyici kampanya başlatın.",
                },
                {
                  icon: AlertCircle, iconColor: "text-orange-400", bgColor: "bg-orange-500/10",
                  name: "Ağrı Noktası → NPS Etkisi", fullName: "En Sık Şikayet Kategorilerinin NPS'e Etkisi",
                  desc: "Müşteri etkileşimlerinde en sık tekrar eden şikayet kategorileri ve her kategorinin ortalama NPS skoru üzerindeki etkisi.",
                  formula: "Şikayet etiketi × ortalama NPS frekans analizi",
                  scale: "Her ağrı noktası için NPS (−100 → +100)",
                  good: "Her ağrı noktası için hedefe yönelik kampanya planlanmalı",
                  source: "Gemini NLP kategori çıkarımı",
                  note: null,
                },
                {
                  icon: MessageCircle, iconColor: "text-sky-400", bgColor: "bg-sky-500/10",
                  name: "Duygu Durumu → NPS Etkisi", fullName: "Duygu Sınıflandırması ve NPS İlişkisi",
                  desc: "Etkileşimlerin pozitif, negatif veya nötr olarak sınıflandırılma oranları ve her duygu sınıfının NPS üzerindeki etkisi.",
                  formula: "Pozitif + Negatif + Nötr = %100",
                  scale: "Her segment için NPS (−100 → +100)",
                  good: "Pozitif etkileşim oranı %50 üzerinde olmalı",
                  source: "Gemini sentiment analizi",
                  note: null,
                },
                {
                  icon: Target, iconColor: "text-violet-400", bgColor: "bg-violet-500/10",
                  name: "AI Tahmin Doğruluğu (MAE)", fullName: "Mean Absolute Error — Ortalama Mutlak Hata",
                  desc: "AI'ın NPS ve CSAT tahminleri ile gerçek anket sonuçları arasındaki ortalama sapma miktarı. Ne kadar düşükse AI o kadar doğrudur.",
                  formula: "Σ|Tahmin − Gerçek| ÷ Toplam Karşılaştırma Sayısı",
                  scale: "0 = mükemmel · Düşük değer her zaman daha iyidir",
                  good: "MAE < 1.0 mükemmel · MAE < 2.0 kabul edilebilir",
                  source: "Anket yanıtları ile AI tahminleri karşılaştırılarak hesaplanır",
                  note: "Daha fazla anket yanıtı toplandıkça doğruluk oranı artar.",
                },
              ].map((m) => (
                <div key={m.name} className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 flex flex-col gap-2.5">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", m.bgColor)}>
                      <m.icon className={cn("w-4 h-4", m.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white leading-tight">{m.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 italic">{m.fullName}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{m.desc}</p>
                  <div className="space-y-1.5">
                    {m.formula && (
                      <div className="flex gap-2">
                        <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">Formül</span>
                        <span className="text-[10px] text-indigo-300 font-mono leading-snug">{m.formula}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">Ölçek</span>
                      <span className="text-[10px] text-slate-400 leading-snug">{m.scale}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">İyi Aralık</span>
                      <span className="text-[10px] text-emerald-400 leading-snug">{m.good}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[9px] uppercase tracking-wide text-slate-600 w-14 shrink-0 pt-0.5">Kaynak</span>
                      <span className="text-[10px] text-slate-500 leading-snug">{m.source}</span>
                    </div>
                  </div>
                  {m.note && (
                    <div className="flex items-start gap-1.5 bg-amber-500/8 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-300/80 italic leading-snug">{m.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Tip type="info">
              Gösterge Paneli ve CX Analiz Raporu sayfalarındaki her metrik başlığının yanında küçük bir <strong>ⓘ</strong> ikonu bulunur. Üzerine geldiğinizde bu tanımların kısa bir özeti görüntülenir.
            </Tip>
          </section>

          <div className="border-t border-slate-800" />

          {/* ── 11. SSS ── */}
          <section id="sss" ref={reg("sss")} className="scroll-mt-4">
            <SectionHeader
              icon={HelpCircle} title="Sıkça Sorulan Sorular" color="bg-purple-500/15 text-purple-400 border-purple-500/25"
              subtitle="En çok karşılaşılan sorular ve yanıtları."
              roles={["all"]}
            />

            <div className="space-y-2">
              {[
                { q: "Platforma nasıl giriş yapabilirim?", a: "CX-Inn yalnızca Google OAuth ile giriş destekler. Superadmin tarafından davet edilen e-posta adresiyle Google hesabınıza giriş yapmanız gerekir. Farklı bir e-posta ile giriş yapıldığında 'cx_user' rolü atanır." },
                { q: "Rolümü kim değiştirebilir?", a: "Yalnızca Superadmin diğer kullanıcıların rollerini değiştirebilir. Kendi rolünüzü kendiniz değiştiremezsiniz. Kullanıcı Yönetimi sayfasındaki dropdown menüden anlık değişiklik yapılabilir." },
                { q: "Anketim neden yayınlanmıyor?", a: "CX User rolündeyseniz anketleriniz CX Manager veya Superadmin onayı olmadan yayınlanamaz. Onay Kuyruğu sayfasından durumu takip edebilirsiniz. Reddedilmişse revizyon notunu okuyun ve düzenleyerek tekrar gönderin." },
                { q: "AI analizi ne kadar sürede tamamlanır?", a: "Toplu içe aktarma ile 100 etkileşim yaklaşık 15–20 saniyede tamamlanır. Batch analiz motoru 5 müşteriyi tek Gemini çağrısında işler ve 3 grubu paralel çalıştırır. Dashboard otomatik yenilenir." },
                { q: "CSV dosyam hangi formatta olmalı?", a: "Standart format için sütunlar: customer_email (zorunlu), type (ticket/chat/call), subject, content, status, channel, agent_name, duration_seconds, resolution, interacted_at. Şablon indirmek için Etkileşimler sayfasındaki 'Şablon İndir' butonunu kullanın." },
                { q: "Cx-Ai nedir, nasıl kullanılır?", a: "Cx-Ai, sağ üst köşedeki teal renk gradyanlı butona tıklayarak açılan yapay zeka sohbet panelidir. Doğal Türkçe ile 'En churn riskli müşteri kim?', 'Bu ay NPS nasıl değişti?' gibi sorular sorabilirsiniz. Yanıtlar PDF olarak dışa aktarılabilir." },
                { q: "Domain yönetimi ne işe yarıyor?", a: "Etkileşim Kayıtları sayfasındaki Domain Ayarları panelinden hariç tutmak istediğiniz e-posta domainlerini (örn: infoset.app) ekleyebilirsiniz. Bir sonraki içe aktarmada bu domainlerden gelen etkileşimler atlanır. Sistem otomatik tespit ettiği domainleri de listeye ekler." },
                { q: "Segment kolonunda '✦ AI' işareti ne anlama geliyor?", a: "Müşterilere Segmentler sayfasında tanımlı kaynak etiketlerle, etkileşim etiketleri örtüşünce Gemini AI'ın önerdiği segment atanır. Kullanıcı tarafından elle atanmış segment varsa o öncelik taşır; ✦ işareti AI'ın önerdiğini gösterir." },
                { q: "Davet e-postası gelmiyor ne yapmalıyım?", a: "Önce spam/gereksiz klasörünüzü kontrol edin. Gelmiyorsa Superadmin'den Kullanıcı Yönetimi sayfasında 'Bekleyen Davetler' bölümündeki 'Tekrar Gönder' butonuna tıklamasını isteyin." },
                { q: "API rate limit nedir?", a: "Varsayılan olarak API anahtarı başına dakikada 60, saatte 1000 istek limitine tabidir. Daha yüksek limitler için Superadmin ile iletişime geçin." },
                { q: "PII maskeleme nasıl çalışır?", a: "Ayarlar → Güvenlik bölümünden PII maskeleme aktif edildiğinde, e-posta ve telefon gibi kişisel veriler loglarda ve AI analizi çıktılarında otomatik anonimleştirilir. Asıl veri şifreli olarak saklanmaya devam eder." },
              ].map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
            </div>
          </section>

          {/* Footer */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-5 text-center">
            <BookOpen className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              Burada bulamadığınız bir sorunuz mu var?
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Superadmin ile iletişime geçin veya API dokümantasyonunu inceleyin.
            </p>
          </div>

        </div>
      </div>
    </Layout>
  );
}
