import React, { useRef } from "react";
import { Layout } from "@/components/layout";
import { useAppAuth } from "@/context/auth-context";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Code2, Shield, Brain, Database, Globe, Lock, Key, Zap, Server,
  FileText, Download, AlertTriangle, CheckCircle2, ArrowRight,
  Layers, Settings, Activity, Hash, Eye, BarChart3, RefreshCw,
  Terminal, Package, BookOpen, ChevronRight, Users, Cpu,
} from "lucide-react";

/* ── Access guard ─────────────────────────────────────────────── */
export default function TechDocsPage() {
  const { user } = useAppAuth();
  const [, setLocation] = useLocation();

  if (!user || user.role !== "superadmin") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Erişim Kısıtlı</h2>
          <p className="text-slate-400 text-sm text-center max-w-sm">
            Bu sayfa yalnızca <strong className="text-amber-400">Süper Admin</strong> rolüne sahip kullanıcılar tarafından görüntülenebilir.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </Layout>
    );
  }

  return <TechDocsContent />;
}

/* ── Reusable components ──────────────────────────────────────── */
function SectionTitle({ icon: Icon, title, subtitle, color }: {
  icon: React.ElementType; title: string; subtitle: string; color: string;
}) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border shrink-0", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function CodeBlock({ children, language = "bash" }: { children: string; language?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/60">
      <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700/60">
        <Terminal className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{language}</span>
      </div>
      <pre className="bg-[#0d1117] px-4 py-3 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

function PropRow({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <tr className="border-b border-slate-800/60 hover:bg-white/[0.015] transition-colors">
      <td className="py-2.5 pr-4 font-mono text-[11px] text-indigo-300">{name}</td>
      <td className="py-2.5 pr-4 font-mono text-[11px] text-amber-300/80">{type}</td>
      <td className="py-2.5 pr-4 text-[11px]">
        {required ? (
          <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] border border-red-500/20">Zorunlu</span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 text-[10px] border border-slate-600/40">Opsiyonel</span>
        )}
      </td>
      <td className="py-2.5 text-[11px] text-slate-400">{desc}</td>
    </tr>
  );
}

function EndpointCard({ method, path, auth, desc, children }: {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  auth: string;
  desc: string;
  children?: React.ReactNode;
}) {
  const METHOD_COLOR: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    PUT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
    PATCH: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <div className="rounded-xl border border-slate-700/60 overflow-hidden mb-4">
      <div className="bg-slate-800/80 px-4 py-3 flex items-center gap-3 border-b border-slate-700/40">
        <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border", METHOD_COLOR[method])}>
          {method}
        </span>
        <code className="font-mono text-sm text-white flex-1">{path}</code>
        <span className="text-[10px] text-slate-500 border border-slate-700 rounded px-2 py-0.5">{auth}</span>
      </div>
      <div className="px-4 py-3 bg-slate-900/40">
        <p className="text-sm text-slate-400 mb-3">{desc}</p>
        {children}
      </div>
    </div>
  );
}

/* ── Main content (only rendered for superadmin) ─────────────── */
function TechDocsContent() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePdfExport = () => {
    window.print();
  };

  return (
    <Layout>
      <div ref={printRef} className="max-w-5xl mx-auto pb-24 print:max-w-none">

        {/* ── Header ── */}
        <div className="relative rounded-2xl overflow-hidden border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 p-8 mb-10 print:border-amber-900 print:rounded-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Code2 className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-white">Teknik Dokümanlar</h1>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold border border-amber-500/20 uppercase tracking-wider">
                    Süper Admin
                  </span>
                </div>
                <p className="text-slate-400 text-sm">CX-Inn platform mimarisi, güvenlik, AI süreçleri ve API referansı</p>
                <p className="text-slate-600 text-xs mt-1">Versiyon 2.1 · {new Date().toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
            <button
              onClick={handlePdfExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition-all text-sm font-medium print:hidden"
            >
              <Download className="w-4 h-4" />
              PDF Olarak İndir
            </button>
          </div>

          {/* Quick navigation chips */}
          <div className="relative flex flex-wrap gap-2 mt-6 print:hidden">
            {[
              { id: "mimari", label: "Mimari" },
              { id: "guvenlik", label: "Güvenlik & PII" },
              { id: "ai-surecleri", label: "AI Süreçleri" },
              { id: "veri-modeli", label: "Veri Modeli" },
              { id: "api-v1", label: "API Referansı" },
              { id: "deployment", label: "Deployment" },
            ].map(({ id, label }) => (
              <a key={id} href={`#${id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all">
                <ChevronRight className="w-3 h-3 text-amber-500" />
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            1. SİSTEM MİMARİSİ
        ════════════════════════════════════════════════════════════ */}
        <section id="mimari" className="mb-16 scroll-mt-4">
          <SectionTitle
            icon={Layers} title="Sistem Mimarisi"
            subtitle="CX-Inn monorepo yapısı ve servis katmanları"
            color="bg-indigo-500/15 text-indigo-400 border-indigo-500/25"
          />

          {/* Architecture diagram (text-based) */}
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-6 mb-6 font-mono text-[11px] text-slate-400 leading-loose overflow-x-auto">
            <pre>{`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CX-Inn Monorepo (Turborepo)                       │
│                                                                             │
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐    │
│  │   cx-platform      │    │   api-server       │    │   lib/db          │    │
│  │   (React + Vite)   │    │   (Express + TS)   │    │   (Drizzle ORM)   │    │
│  │                   │    │                   │    │                   │    │
│  │  • React 18       │───▶│  • REST API       │───▶│  • PostgreSQL     │    │
│  │  • TanStack Query  │    │  • JWT / Firebase  │    │  • Schema (TS)    │    │
│  │  • Wouter Router  │    │  • Multer Upload   │    │  • Migrations     │    │
│  │  • Tailwind CSS   │    │  • Rate Limiting   │    │                   │    │
│  └───────────────────┘    └─────────┬─────────┘    └───────────────────┘    │
│                                     │                                       │
│                          ┌──────────▼──────────┐                           │
│                          │   External Services  │                           │
│                          │                      │                           │
│                          │  • Firebase Auth     │                           │
│                          │  • Google Gemini 2.5 │                           │
│                          │  • Resend (Email)    │                           │
│                          └──────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
`}</pre>
          </div>

          {/* Stack */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {[
              {
                icon: Globe, label: "Frontend", color: "text-blue-400",
                items: ["React 18 + TypeScript", "Vite 5 (SWC)", "TanStack Query v5", "Tailwind CSS + shadcn/ui", "Wouter (istemci yönlendirme)", "Lucide React ikonlar"],
              },
              {
                icon: Server, label: "Backend", color: "text-emerald-400",
                items: ["Node.js + Express 4", "TypeScript (strict)", "Multer (dosya yükleme)", "csv-parse / xlsx", "express-rate-limit", "cookie-parser + CORS"],
              },
              {
                icon: Database, label: "Veri & Servisler", color: "text-purple-400",
                items: ["PostgreSQL 15+", "Drizzle ORM (tip güvenli)", "Firebase Auth (OAuth)", "Google Gemini 2.5 Flash", "Resend API (e-posta)", "Turborepo (monorepo)"],
              },
            ].map(({ icon: Icon, label, color, items }) => (
              <div key={label} className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn("w-4 h-4", color)} />
                  <span className="text-sm font-semibold text-white">{label}</span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Request flow */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
            <p className="text-xs font-semibold text-slate-300 mb-4 uppercase tracking-wide">İstek Akışı (Browser → DB)</p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
              {[
                "Firebase Auth Token",
                "Cookie + authMiddleware",
                "requireAuth / requireRole",
                "Route Handler",
                "Drizzle ORM",
                "PostgreSQL",
              ].map((step, i) => (
                <React.Fragment key={step}>
                  <span className="px-2.5 py-1.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/40 text-[11px]">{step}</span>
                  {i < 5 && <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-slate-800 mb-16" />

        {/* ═══════════════════════════════════════════════════════════
            2. GÜVENLİK & PII
        ════════════════════════════════════════════════════════════ */}
        <section id="guvenlik" className="mb-16 scroll-mt-4">
          <SectionTitle
            icon={Shield} title="Güvenlik & PII Maskeleme"
            subtitle="Kimlik doğrulama, yetkilendirme ve kişisel veri koruması"
            color="bg-red-500/15 text-red-400 border-red-500/25"
          />

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Auth */}
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Kimlik Doğrulama</span>
              </div>
              <ul className="space-y-2.5">
                {[
                  { icon: CheckCircle2, color: "text-emerald-400", text: "Firebase Authentication (Google OAuth 2.0)" },
                  { icon: CheckCircle2, color: "text-emerald-400", text: "httpOnly + Secure çerez (SameSite=Strict)" },
                  { icon: CheckCircle2, color: "text-emerald-400", text: "Sunucu taraflı token doğrulama (admin.auth().verifyIdToken)" },
                  { icon: CheckCircle2, color: "text-emerald-400", text: "Oturum süresi: Firebase token (1 saat) + yenileme" },
                  { icon: CheckCircle2, color: "text-emerald-400", text: "V1 API: Bearer token (cx_live_xxxx) + hash kontrolü" },
                ].map(({ icon: Icon, color, text }) => (
                  <li key={text} className="flex items-start gap-2 text-xs text-slate-400">
                    <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", color)} />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* RBAC */}
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">RBAC Yetki Modeli</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-1.5 text-slate-500 font-medium">Rol</th>
                    <th className="text-left py-1.5 text-slate-500 font-medium">DB Değeri</th>
                    <th className="text-left py-1.5 text-slate-500 font-medium">Yetki</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <td className="py-1.5 text-amber-400 font-medium">Süper Admin</td>
                    <td className="py-1.5 font-mono text-[10px]">superadmin</td>
                    <td className="py-1.5">Tam Erişim</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-1.5 text-indigo-400 font-medium">CX Manager</td>
                    <td className="py-1.5 font-mono text-[10px]">cx_manager</td>
                    <td className="py-1.5">Onay + Analiz</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-400 font-medium">CX Kullanıcısı</td>
                    <td className="py-1.5 font-mono text-[10px]">cx_user</td>
                    <td className="py-1.5">Görüntüleme</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[10px] text-amber-300/70">
                Yetki matrisi dinamiktir — <code className="font-mono">permissions</code> tablosundan yüklenir. Her rota <code className="font-mono">requireRole()</code> middleware ile korunur.
              </div>
            </div>
          </div>

          {/* PII Masking */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">PII Maskeleme Sistemi</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Kişisel olarak tanımlanabilir veriler (PII) yetki matrisindeki ayarlara göre maskelenir. Maskeleme API yanıtı oluşturulurken gerçekleşir; kaynak veri veritabanında şifresiz saklanır.
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { label: "E-posta", raw: "ahmet@firma.com", masked: "ah***@firma.com" },
                { label: "Telefon", raw: "+90 532 123 45 67", masked: "+90 5** *** ** **" },
                { label: "Ad Soyad", raw: "Ahmet Yılmaz", masked: "Ahmet Y." },
              ].map(({ label, raw, masked }) => (
                <div key={label} className="rounded-lg bg-slate-900/60 border border-slate-700/40 p-3">
                  <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">{label}</p>
                  <p className="text-[11px] font-mono text-red-400 line-through">{raw}</p>
                  <p className="text-[11px] font-mono text-emerald-400 mt-1">{masked}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Security measures */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Güvenlik Önlemleri</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { label: "Rate Limiting", desc: "15dk pencerede 300 istek / IP (V1 hariç)" },
                { label: "CORS Politikası", desc: "ALLOWED_ORIGIN env var ile üretimde sıkı kontrol" },
                { label: "SQL Injection", desc: "Drizzle ORM parametrik sorgular, asla ham SQL yok" },
                { label: "XSS Önleme", desc: "sanitizeError() ile hata mesajı temizleme" },
                { label: "Dosya Yükleme", desc: "Multer: 20 MB limit, bellek içi (disk yazılmaz)" },
                { label: "Audit Logging", desc: "Kritik işlemler audit_logs tablosuna kaydedilir" },
                { label: "Cache Control", desc: "Cache-Control: private, no-store (Set-Cookie CDN sorunu)" },
                { label: "Şifre Yok", desc: "Şifre saklanmaz — yalnızca OAuth token doğrulaması" },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-white">{label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-slate-800 mb-16" />

        {/* ═══════════════════════════════════════════════════════════
            3. AI SÜREÇLERİ
        ════════════════════════════════════════════════════════════ */}
        <section id="ai-surecleri" className="mb-16 scroll-mt-4">
          <SectionTitle
            icon={Brain} title="AI Süreçleri"
            subtitle="Gemini 2.5 entegrasyonu, batch analiz, sınıflandırma ve önbellek"
            color="bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
          />

          {/* Gemini overview */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Model: Gemini 2.5 Flash</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Düşük gecikme (&lt;2 sn / etkileşim)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Türkçe metin anlama (native)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> JSON mode (yapılandırılmış çıktı)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Token maliyeti optimizasyonu (batch)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Canonical kelime hazinesi (tag sözlüğü)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Analiz Çıktıları</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: "npsPrediction", v: "0-10 NPS tahmini" },
                  { k: "csatScore", v: "1-5 CSAT skoru" },
                  { k: "sentimentScore", v: "pozitif/negatif/nötr" },
                  { k: "churnRisk", v: "high/medium/low" },
                  { k: "tags", v: "Konu etiketleri dizisi" },
                  { k: "painPoints", v: "Şikayet noktaları" },
                  { k: "summary", v: "Türkçe özet (1 cümle)" },
                  { k: "language", v: "Algılanan dil" },
                ].map(({ k, v }) => (
                  <div key={k} className="p-2 rounded-lg bg-slate-900/50">
                    <p className="font-mono text-[10px] text-indigo-300">{k}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Batch analysis */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Batch Analiz Motoru</span>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] border border-amber-500/20">v2.1+</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Toplu içe aktarma sonrasında AI analizi artık tek tek değil, grup halinde (batch) çalışır. Bu yaklaşım hem API maliyetini hem de süreyi önemli ölçüde düşürür.
            </p>
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              {[
                { label: "BATCH_SIZE", value: "5 müşteri / istek", desc: "Tek Gemini çağrısında" },
                { label: "BATCH_CONCURRENCY", value: "3 paralel batch", desc: "Aynı anda işlenen grup" },
                { label: "Gecikme", value: "400ms arası", desc: "Concurrency grupları arası" },
              ].map(({ label, value, desc }) => (
                <div key={label} className="rounded-lg bg-slate-900/50 border border-slate-700/40 p-3">
                  <p className="font-mono text-[10px] text-emerald-300">{label}</p>
                  <p className="text-sm font-bold text-white mt-1">{value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <CodeBlock language="typescript">{`// Batch prompt yapısı (cx-analysis.service.ts)
const BATCH_SIZE = 5;
const BATCH_CONCURRENCY = 3;

// N müşteri için tek prompt → JSON dizisi yanıtı
function buildBatchPrompt(customers, interactionsByCustomer, vocab) {
  // Her müşteri için etkileşimler birleştirilir
  // Canonical kelime hazinesi ile tag normalizasyonu
  // Tek Gemini çağrısı → [{customerId, npsPrediction, ...}]
}

// Başarısız müşteriler için bireysel fallback
async function parseBatchResponse(raw: string) {
  // JSON dizisi çıkarma + iki aşamalı fallback
}

// Promise.allSettled ile BATCH_CONCURRENCY=3 paralel çalışma
await Promise.allSettled(batchRound.map(runAndPersistBatch));`}</CodeBlock>
          </div>

          {/* Relevance classifier */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">İlgisizlik Sınıflandırıcı (classifyIrrelevant)</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              İçe aktarma sırasında kural tabanlı sınıflandırıcı otomatik no-reply e-postalar, fatura bildirimleri, OTP mesajları ve pazarlama içeriklerini tespit eder. AI çağrısına gerek kalmadan saniyeler içinde çalışır.
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { label: "NOREPLY_EMAIL_RE", count: "15+ regex", desc: "noreply@, donotreply@, mailer-daemon@, bounce@, notifications@…" },
                { label: "AUTOMATED_SUBJECT_PATTERNS", count: "30+ regex", desc: "Fatura, OTP, onay kodu, kargo takip, abonelik, bildirim, newsletter…" },
                { label: "AUTOMATED_BODY_PHRASES", count: "14 ifade", desc: '"bu e-postayı yanıtlamayınız", "otomatik bildirim", "unsubscribe"…' },
              ].map(({ label, count, desc }) => (
                <div key={label} className="rounded-lg bg-slate-900/50 border border-slate-700/40 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-mono text-[10px] text-cyan-300">{label}</p>
                    <span className="text-[9px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">{count}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Domain learning */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Otomatik Domain Öğrenme</span>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Sınıflandırıcı bir etkileşimi ilgisiz işaretlediğinde, kaynak e-posta domaini <code className="font-mono text-indigo-300">excluded_domains</code> tablosuna <code className="font-mono text-indigo-300">source="auto"</code> ile otomatik kaydedilir. Bir sonraki içe aktarmada bu domain doğrudan atlanır.
            </p>
            <CodeBlock language="sql">{`-- excluded_domains tablosu (runtime migration ile oluşturulur)
CREATE TABLE IF NOT EXISTS excluded_domains (
  id         SERIAL PRIMARY KEY,
  domain     TEXT NOT NULL UNIQUE,
  reason     TEXT,
  source     TEXT NOT NULL DEFAULT 'manual'
             CHECK (source IN ('manual','auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}</CodeBlock>
          </div>
        </section>

        <div className="border-t border-slate-800 mb-16" />

        {/* ═══════════════════════════════════════════════════════════
            4. VERİ MODELİ
        ════════════════════════════════════════════════════════════ */}
        <section id="veri-modeli" className="mb-16 scroll-mt-4">
          <SectionTitle
            icon={Database} title="Veri Modeli"
            subtitle="Ana tablolar ve ilişkiler (Drizzle ORM şeması)"
            color="bg-purple-500/15 text-purple-400 border-purple-500/25"
          />

          <div className="space-y-4">
            {[
              {
                table: "customers",
                desc: "Müşteri profilleri",
                fields: [
                  { name: "id", type: "serial PK", desc: "Otomatik artan birincil anahtar" },
                  { name: "name", type: "text", desc: "Müşteri adı soyadı" },
                  { name: "email", type: "text UNIQUE", desc: "E-posta (benzersiz)" },
                  { name: "company", type: "text?", desc: "Firma adı (opsiyonel)" },
                  { name: "segment", type: "text", desc: "Kullanıcı tarafından atanan segment" },
                  { name: "created_at", type: "timestamptz", desc: "Kayıt oluşturma zamanı" },
                ],
              },
              {
                table: "interaction_records",
                desc: "Destek etkileşimleri ve AI analiz sonuçları",
                fields: [
                  { name: "id", type: "serial PK", desc: "Birincil anahtar" },
                  { name: "customer_id", type: "int FK→customers", desc: "Müşteri referansı" },
                  { name: "type", type: "ticket|chat|call", desc: "Etkileşim türü" },
                  { name: "subject", type: "text", desc: "Konu başlığı" },
                  { name: "content", type: "text", desc: "İçerik metni" },
                  { name: "status", type: "enum", desc: "open / resolved / escalated" },
                  { name: "channel", type: "text", desc: "Kanal: email, phone, chat…" },
                  { name: "nps_prediction", type: "int?", desc: "Gemini NPS tahmini (0-10)" },
                  { name: "csat_score", type: "int?", desc: "CSAT skoru (1-5)" },
                  { name: "sentiment_score", type: "text?", desc: "positive/negative/neutral" },
                  { name: "churn_risk", type: "text?", desc: "high/medium/low" },
                  { name: "tags", type: "text[]?", desc: "Konu etiketleri dizisi" },
                  { name: "excluded_from_analysis", type: "bool", desc: "Hariç tutuldu mu? (no-reply vs.)" },
                  { name: "interacted_at", type: "timestamptz", desc: "Etkileşim zamanı" },
                ],
              },
              {
                table: "excluded_domains",
                desc: "İçe aktarmada atlanacak e-posta domainleri",
                fields: [
                  { name: "id", type: "serial PK", desc: "Birincil anahtar" },
                  { name: "domain", type: "text UNIQUE", desc: "Domain (örn: noreply.com)" },
                  { name: "reason", type: "text?", desc: "Hariç tutma nedeni" },
                  { name: "source", type: "manual|auto", desc: "Elle mi, otomatik mi eklendi" },
                  { name: "created_at", type: "timestamptz", desc: "Eklenme zamanı" },
                ],
              },
              {
                table: "segments",
                desc: "Müşteri segmentleri ve AI etiket eşleştirme",
                fields: [
                  { name: "id", type: "serial PK", desc: "Birincil anahtar" },
                  { name: "name", type: "text UNIQUE", desc: "Segment adı" },
                  { name: "description", type: "text?", desc: "Açıklama" },
                  { name: "source_tags", type: "text[]?", desc: "AI etiket eşleşme dizisi (LATERAL JOIN)" },
                  { name: "created_at", type: "timestamptz", desc: "Oluşturma zamanı" },
                ],
              },
            ].map(({ table, desc, fields }) => (
              <div key={table} className="rounded-xl border border-slate-700/40 bg-slate-800/20 overflow-hidden">
                <div className="bg-slate-800/60 px-4 py-2.5 flex items-center gap-2 border-b border-slate-700/40">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  <code className="font-mono text-sm text-white">{table}</code>
                  <span className="text-xs text-slate-500">— {desc}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/30">
                        <th className="text-left px-4 py-2 text-slate-500 font-medium w-48">Sütun</th>
                        <th className="text-left px-4 py-2 text-slate-500 font-medium w-44">Tip</th>
                        <th className="text-left px-4 py-2 text-slate-500 font-medium">Açıklama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map(({ name, type, desc: fdesc }) => (
                        <tr key={name} className="border-b border-slate-800/40 hover:bg-white/[0.01]">
                          <td className="px-4 py-2 font-mono text-indigo-300">{name}</td>
                          <td className="px-4 py-2 font-mono text-amber-300/80 text-[10px]">{type}</td>
                          <td className="px-4 py-2 text-slate-400">{fdesc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-slate-800 mb-16" />

        {/* ═══════════════════════════════════════════════════════════
            5. API V1 REFERANSI
        ════════════════════════════════════════════════════════════ */}
        <section id="api-v1" className="mb-16 scroll-mt-4">
          <SectionTitle
            icon={Terminal} title="API v1 Referansı"
            subtitle="Harici sistemler için REST API — Bearer token kimlik doğrulaması"
            color="bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
          />

          {/* Auth */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Kimlik Doğrulama</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Tüm <code className="font-mono text-indigo-300">/api/v1/</code> endpointleri <strong className="text-white">API Anahtarı</strong> gerektirir.
              Anahtar <em>Ayarlar → API Anahtarları</em> bölümünden oluşturulur.
            </p>
            <CodeBlock language="http">{`GET /api/v1/customers HTTP/1.1
Host: your-domain.com
Authorization: Bearer cx_live_xxxxxxxxxxxxxxxx
Content-Type: application/json`}</CodeBlock>
          </div>

          {/* Endpoints */}
          <EndpointCard method="GET" path="/api/v1/customers" auth="Bearer Token" desc="Tüm müşterileri listeler. Sayfalama ve filtreleme destekler.">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800"><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Parametre</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Tip</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Durum</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium">Açıklama</th></tr></thead>
                <tbody>
                  <PropRow name="page" type="number" desc="Sayfa numarası (varsayılan: 1)" />
                  <PropRow name="limit" type="number" desc="Sayfa başına kayıt (varsayılan: 50, max: 500)" />
                  <PropRow name="segment" type="string" desc="Segment filtresi" />
                  <PropRow name="search" type="string" desc="Ad veya e-posta ile arama" />
                </tbody>
              </table>
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/api/v1/interactions" auth="Bearer Token" desc="Tek bir etkileşim kaydı oluşturur. Oluşturma sonrası AI analizi otomatik tetiklenir.">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800"><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Alan</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Tip</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Durum</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium">Açıklama</th></tr></thead>
                <tbody>
                  <PropRow name="customer_email" type="string" required desc="Müşteri e-posta adresi (yeni müşteri otomatik oluşturulur)" />
                  <PropRow name="type" type="ticket|chat|call" required desc="Etkileşim türü" />
                  <PropRow name="subject" type="string" required desc="Konu başlığı" />
                  <PropRow name="content" type="string" required desc="Etkileşim içeriği" />
                  <PropRow name="channel" type="string" desc="email, phone, chat, web…" />
                  <PropRow name="interacted_at" type="ISO8601" desc="Etkileşim zamanı (varsayılan: şu an)" />
                </tbody>
              </table>
            </div>
          </EndpointCard>

          <EndpointCard method="GET" path="/api/v1/analytics/nps" auth="Bearer Token" desc="Belirtilen tarih aralığı için NPS istatistiklerini döndürür.">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800"><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Parametre</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Tip</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Durum</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium">Açıklama</th></tr></thead>
                <tbody>
                  <PropRow name="from" type="ISO8601" desc="Başlangıç tarihi (varsayılan: 30 gün önce)" />
                  <PropRow name="to" type="ISO8601" desc="Bitiş tarihi (varsayılan: bugün)" />
                  <PropRow name="segment" type="string" desc="Segment bazlı filtre" />
                </tbody>
              </table>
            </div>
          </EndpointCard>

          <EndpointCard method="GET" path="/api/v1/analytics/csat" auth="Bearer Token" desc="Belirtilen tarih aralığı için CSAT istatistiklerini döndürür.">
            <p className="text-xs text-slate-500 italic">NPS endpoint ile aynı parametre yapısı.</p>
          </EndpointCard>

          <EndpointCard method="POST" path="/api/interaction-records/bulk" auth="Session Cookie" desc="CSV veya Excel ile toplu etkileşim içe aktarma. multipart/form-data ile dosya gönderilir.">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800"><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Form Alanı</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Tip</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium pr-3">Durum</th><th className="text-left py-1.5 text-slate-500 text-xs font-medium">Açıklama</th></tr></thead>
                <tbody>
                  <PropRow name="file" type="File (.csv/.xlsx)" required desc="Maksimum 20MB. Standart veya Infoset formatı otomatik algılanır." />
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <p className="text-[11px] text-slate-500 mb-1.5">Başarılı yanıt örneği:</p>
              <CodeBlock language="json">{`{
  "total": 150,
  "imported": 142,
  "skipped": 8,
  "autoExcluded": 12,
  "customersCreated": 5,
  "importedCustomerIds": [1, 2, 3, ...],
  "errors": ["Satır 7: type değeri geçersiz..."]
}`}</CodeBlock>
            </div>
          </EndpointCard>

          {/* Error codes */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">HTTP Hata Kodları</span>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {[
                { code: "400", label: "Bad Request", desc: "Geçersiz parametre veya eksik zorunlu alan" },
                { code: "401", label: "Unauthorized", desc: "Token eksik veya süresi dolmuş" },
                { code: "403", label: "Forbidden", desc: "Yetki yetersiz (RBAC kısıtlaması)" },
                { code: "404", label: "Not Found", desc: "İstenen kaynak bulunamadı" },
                { code: "409", label: "Conflict", desc: "Çakışma: benzersiz kısıtlama ihlali" },
                { code: "429", label: "Too Many Requests", desc: "Rate limit aşıldı (15dk / 300 istek)" },
                { code: "500", label: "Internal Server Error", desc: "Sunucu hatası — sanitizeError ile maskelenir" },
              ].map(({ code, label, desc }) => (
                <div key={code} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/40">
                  <span className={cn(
                    "font-mono text-[11px] font-bold px-1.5 py-0.5 rounded",
                    code.startsWith("2") ? "bg-emerald-500/10 text-emerald-400" :
                    code.startsWith("4") ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400",
                  )}>{code}</span>
                  <div>
                    <p className="text-[11px] font-semibold text-white">{label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-slate-800 mb-16" />

        {/* ═══════════════════════════════════════════════════════════
            6. DEPLOYMENT
        ════════════════════════════════════════════════════════════ */}
        <section id="deployment" className="mb-16 scroll-mt-4">
          <SectionTitle
            icon={Package} title="Deployment & Ortam Değişkenleri"
            subtitle="Üretim ortamı için gerekli yapılandırma"
            color="bg-slate-500/15 text-slate-400 border-slate-500/25"
          />

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">api-server Ortam Değişkenleri</p>
              <CodeBlock language="env">{`# Veritabanı
DATABASE_URL=postgresql://user:pass@host:5432/db

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=service-account@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...

# E-posta Gönderimi (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com

# Güvenlik
ALLOWED_ORIGIN=https://yourdomain.com
NODE_ENV=production
JWT_SECRET=strong-random-secret-here`}</CodeBlock>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">cx-platform Ortam Değişkenleri</p>
              <CodeBlock language="env">{`# API Sunucusu URL
VITE_API_URL=https://api.yourdomain.com

# Firebase (istemci tarafı)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=1:...:web:...`}</CodeBlock>
              <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300">Güvenlik Notları</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-400">
                  <li>• FIREBASE_PRIVATE_KEY sadece sunucuda tutulur</li>
                  <li>• ALLOWED_ORIGIN üretimde mutlaka ayarlanmalı</li>
                  <li>• JWT_SECRET minimum 32 karakter olmalı</li>
                  <li>• DATABASE_URL SSL parametresi ile kullanılmalı</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Başlangıç Sırası</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
              {[
                "PostgreSQL başlatılır",
                "api-server ayağa kalkar",
                "Runtime migration çalışır",
                "Firebase Admin başlatılır",
                "cx-platform derlenir",
                "Nginx / CDN yönlendirir",
              ].map((step, i) => (
                <React.Fragment key={step}>
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/40 text-[11px]">
                    <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">{i + 1}</span>
                    {step}
                  </span>
                  {i < 5 && <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-5 text-center print:hidden">
          <Code2 className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">CX-Inn Teknik Dokümanlar — Yalnızca Süper Admin Erişimi</p>
          <p className="text-xs text-slate-600 mt-1">Bu dokümanı PDF olarak paylaşmak için sağ üstteki "PDF Olarak İndir" butonunu kullanın.</p>
        </div>

      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          pre { background: #f5f5f5 !important; color: #333 !important; border: 1px solid #ddd !important; }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </Layout>
  );
}
