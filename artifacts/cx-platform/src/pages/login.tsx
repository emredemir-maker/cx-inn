import React, { useState } from "react";
import { Users, Sparkles, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { useAppAuth } from "@/context/auth-context";

const CxInnLogoImg = ({ height, className = "" }: { height: number; className?: string }) => (
  <img
    src="/cx-inn-logo.png"
    height={height}
    alt="Cx-Inn"
    className={className}
    style={{ height, width: "auto", flexShrink: 0 }}
  />
);

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const stats = [
  { val: "94%",  label: "NPS Doğruluğu" },
  { val: "3.2×", label: "Daha Fazla Yanıt" },
  { val: "0",    label: "Manuel Anket" },
];

const featureItems = [
  {
    icon: Users,
    color: "bg-indigo-500/10 text-indigo-400",
    label: "Müşteri Segmentasyonu",
    sub: "NPS, CSAT & churn tahmini",
  },
  {
    icon: Sparkles,
    color: "bg-purple-500/10 text-purple-400",
    label: "Gemini AI Analizi",
    sub: "Sıfır anket, otomatik skor",
  },
  {
    icon: Zap,
    color: "bg-blue-500/10 text-blue-400",
    label: "REST API & Webhook",
    sub: "Pürüzsüz entegrasyon",
  },
];

const securityItems = [
  "Google tek tıkla giriş",
  "httpOnly şifreli çerez",
  "Firebase Auth koruması",
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
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "#08090b", fontFamily: "'Inter', sans-serif" }}
    >
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* ── Left: Hero copy + stats + features ── */}
        <div className="space-y-10">

          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white">
              Müşteri deneyimini <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(to bottom right, #ffffff, #a5b4fc)" }}
              >
                AI ile dönüştürün
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md leading-relaxed">
              Etkileşimleri analiz edin, NPS/CSAT tahmin edin ve kişiselleştirilmiş kampanyalar oluşturun.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map(({ val, label }) => (
              <div
                key={label}
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(18, 20, 26, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="text-2xl font-bold text-indigo-400">{val}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Feature items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featureItems.map(({ icon: Icon, color, label, sub }) => (
              <div
                key={label}
                className="p-4 rounded-xl flex items-start gap-4"
                style={{
                  background: "rgba(18, 20, 26, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className={`p-2 rounded-lg shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Login card ── */}
        <div className="flex justify-center lg:justify-end">
          <div
            className="w-full max-w-md p-8 rounded-3xl relative overflow-hidden shadow-2xl"
            style={{
              background: "rgba(18, 20, 26, 0.7)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {/* Decorative glow */}
            <div
              className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: "rgba(99,102,241,0.20)", filter: "blur(80px)" }}
            />

            <div className="relative z-10 flex flex-col items-center space-y-7">

              {/* Logo */}
              <div className="flex flex-col items-center gap-2">
                <CxInnLogoImg height={56} />
                <span className="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase">
                  B2B Müşteri Deneyimi Platformu
                </span>
              </div>

              {/* AI badge */}
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
                style={{
                  background: "rgba(99,102,241,0.10)",
                  border: "1px solid rgba(99,102,241,0.20)",
                }}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-medium text-indigo-300">
                  Gemini 2.5 Pro ile güçlendirildi
                </span>
              </div>

              {/* Title */}
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-white">Platforma giriş yapın</h2>
                <p className="text-sm text-gray-400">Google hesabınızla güvenli erişim</p>
              </div>

              {/* Google button */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-white text-gray-900 py-3.5 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all hover:bg-gray-100 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                ) : (
                  <GoogleIcon />
                )}
                {loading ? "Giriş yapılıyor..." : "Google ile Giriş Yap"}
              </button>

              {error && (
                <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 text-center">
                  {error}
                </div>
              )}

              {/* Divider */}
              <div className="w-full flex items-center gap-4">
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">
                  Güvenli kimlik doğrulama
                </span>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>

              {/* Security items */}
              <div className="space-y-3 w-full">
                {securityItems.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-6 w-full text-center pointer-events-none">
        <p className="text-[11px] text-gray-600 font-medium">
          Cx-Inn Platform © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
