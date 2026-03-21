import React, { useState } from "react";
import { BarChart2, Users, MessageSquareQuote, Sparkles, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { useAppAuth } from "@/context/auth-context";

const CxInnLogoImg = ({ height, className = "" }: { height: number; className?: string }) => (
  <img src="/cx-inn-logo.png" height={height} alt="Cx-Inn"
    className={className} style={{ height, width: "auto", flexShrink: 0 }} />
);

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const features = [
  { icon: Sparkles, label: "Gemini AI Analizi", sub: "Sıfır anket, otomatik skor" },
  { icon: Users, label: "Müşteri Segmentasyonu", sub: "NPS, CSAT & churn tahmini" },
  { icon: MessageSquareQuote, label: "Hyper-Personalized", sub: "AI kampanya motoru" },
  { icon: Zap, label: "REST API & Webhook", sub: "PII maskeli entegrasyon" },
];

export default function LoginPage() {
  const { login } = useAppAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login();
    } catch {
      setError("Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col">
      <div className="flex flex-1 overflow-hidden">

        {/* ── Slim left accent rail ── */}
        <div className="w-16 shrink-0 bg-gradient-to-b from-indigo-600 via-indigo-800 to-slate-900 flex flex-col items-center py-8 gap-6">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.6)]">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 flex items-center">
            <p
              className="text-[10px] font-bold text-indigo-200/60 tracking-[0.25em] uppercase"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              CX-Inn Platform
            </p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Top bar */}
          <div className="flex items-center justify-between px-12 py-5 border-b border-slate-800/60">
            <div className="flex flex-col gap-1 shrink-0">
              <CxInnLogoImg height={52} />
              <span className="text-xs text-slate-400 font-medium tracking-widest uppercase pl-0.5">
                B2B CX Platformu
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>PII Maskeleme Aktif</span>
            </div>
          </div>

          {/* ── Three-column center area ── */}
          <div className="flex-1 grid lg:grid-cols-[1fr_1.1fr_1fr] grid-cols-1 gap-0">

            {/* Left: Hero copy + metrics */}
            <div className="flex flex-col justify-center px-10 space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span className="text-xs text-indigo-300 font-medium">
                    Gemini 2.5 ile güçlendirildi
                  </span>
                </div>
                <h1 className="text-4xl font-bold text-white leading-tight">
                  Müşteri deneyimini
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                    AI ile dönüştürün
                  </span>
                </h1>
                <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-xs">
                  Etkileşimleri analiz edin, NPS/CSAT tahmin edin ve
                  kişiselleştirilmiş kampanyalar oluşturun.
                </p>
              </div>

              {/* Metric pills */}
              <div className="flex flex-wrap gap-3">
                {[
                  { val: "94%", label: "NPS Doğruluğu" },
                  { val: "3.2×", label: "Daha Fazla Yanıt" },
                  { val: "0", label: "Manuel Anket" },
                ].map(({ val, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-start px-4 py-3 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <span className="text-xl font-bold text-indigo-400">{val}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Brand logo showcase */}
            <div className="flex items-center justify-center border-x border-slate-800/40">
              <div className="flex flex-col items-center gap-6 px-8">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-64 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
                  <CxInnLogoImg height={76} className="relative drop-shadow-[0_0_24px_rgba(99,102,241,0.35)]" />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
                    B2B Müşteri Deneyim Platformu
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-px bg-gradient-to-r from-transparent to-indigo-500/40" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                    <div className="w-10 h-px bg-gradient-to-l from-transparent to-indigo-500/40" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Login card */}
            <div className="flex items-center justify-center px-8">
              <div className="w-full max-w-sm">
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-8 space-y-6 shadow-2xl">
                  <div className="text-center space-y-1.5">
                    <h2 className="text-xl font-bold text-white">Platforma giriş yapın</h2>
                    <p className="text-slate-400 text-xs">
                      Google hesabınızla güvenli erişim
                    </p>
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                      : <GoogleIcon />
                    }
                    {loading ? "Giriş yapılıyor..." : "Google ile Giriş Yap"}
                  </button>

                  {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 text-center">
                      {error}
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 text-[10px] text-slate-600 bg-slate-900">
                        Güvenli kimlik doğrulama
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      "Google tek tıkla giriş",
                      "httpOnly şifreli çerez",
                      "Firebase Auth koruması",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-center text-[10px] text-slate-700 mt-5">
                  CX-Inn Platform © {new Date().getFullYear()}
                </p>
              </div>
            </div>
          </div>

          {/* ── Bottom feature strip ── */}
          <div className="grid grid-cols-4 border-t border-slate-800/60">
            {features.map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-8 py-5 border-r border-slate-800/60 last:border-r-0"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">{label}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
