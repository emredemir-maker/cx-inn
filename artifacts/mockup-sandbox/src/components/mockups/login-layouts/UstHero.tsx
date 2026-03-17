import { BarChart2, ShieldCheck, Sparkles, Users, MessageSquareQuote, Zap, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const features = [
  {
    icon: Sparkles,
    title: "Gemini AI Analizi",
    desc: "Sıfır anket, otomatik CX skoru",
    accent: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    icon: Users,
    title: "Müşteri Segmentasyonu",
    desc: "NPS, CSAT ve churn tahmini",
    accent: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: MessageSquareQuote,
    title: "Kişisel Kampanyalar",
    desc: "AI ile hyper-personalized e-posta",
    accent: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Zap,
    title: "REST API & Webhook",
    desc: "Omnichannel, PII maskeli",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

export function UstHero() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col overflow-y-auto">
      {/* ── Navigation ── */}
      <nav className="w-full flex items-center justify-between px-10 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.5)]">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">
            CX<span className="text-indigo-400">-Inn</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Sistem aktif
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative w-full py-14 px-10 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-indigo-600/10 blur-[100px] rounded-full" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="text-xs text-indigo-300 font-medium">Gemini 2.5 ile güçlendirildi</span>
          </div>
          <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
            Müşteri deneyimini<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400">
              AI ile dönüştürün
            </span>
          </h1>
          <p className="mt-5 text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
            B2B omnichannel CX platformu. Etkileşimleri analiz edin, NPS/CSAT tahmin edin
            ve kişiselleştirilmiş kampanyalar oluşturun.
          </p>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="px-10 pb-8">
        <div className="grid grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map(({ icon: Icon, title, desc, accent, bg }) => (
            <div
              key={title}
              className={`flex flex-col gap-3 p-4 rounded-2xl border ${bg} group cursor-default`}
            >
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4.5 h-4.5 ${accent}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{title}</p>
                <p className="text-[11px] text-slate-500 mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Login card ── */}
      <section className="flex-1 flex items-center justify-center px-6 pb-10">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-7 space-y-5 shadow-2xl">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">Platforma giriş yapın</h2>
              <p className="text-slate-400 text-xs">Google hesabınızla hızlı ve güvenli giriş yapın</p>
            </div>

            <button
              onClick={() => setLoading(!loading)}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : <GoogleIcon />}
              {loading ? "Giriş yapılıyor..." : "Google ile Giriş Yap"}
            </button>

            <div className="flex items-center gap-4 text-[10px] text-slate-600">
              {["Firebase Auth", "httpOnly Cookie", "PII Maskeli"].map((item, i) => (
                <span key={item} className="flex items-center gap-1">
                  {i > 0 && <span className="mr-3 text-slate-800">·</span>}
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-700 mt-4">CX-Inn Platform © 2026</p>
        </div>
      </section>
    </div>
  );
}
