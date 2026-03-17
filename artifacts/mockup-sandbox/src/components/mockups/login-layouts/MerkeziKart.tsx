import { BarChart2, ShieldCheck, Sparkles, Users, MessageSquareQuote, Zap, Loader2 } from "lucide-react";
import { useState } from "react";

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const badges = [
  { icon: Sparkles, label: "Gemini AI", color: "from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-300" },
  { icon: Users, label: "Segmentasyon", color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300" },
  { icon: MessageSquareQuote, label: "Kampanyalar", color: "from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-300" },
  { icon: Zap, label: "REST API", color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300" },
];

export function MerkeziKart() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[30%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[40%] h-[40%] rounded-full bg-violet-700/8 blur-[100px]" />
        <div className="absolute top-[40%] right-[-5%] w-[30%] h-[30%] rounded-full bg-indigo-500/6 blur-[80px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.5)] mb-4">
            <BarChart2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold text-white tracking-tight">
            CX<span className="text-indigo-400">-Inn</span>
          </span>
          <p className="text-slate-500 text-sm mt-1">B2B Omnichannel CX Platformu</p>
        </div>

        {/* Glassmorphism card */}
        <div
          className="rounded-3xl border border-white/[0.07] p-8 space-y-6"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white">Hoş Geldiniz</h2>
            <p className="text-slate-400 text-sm">
              Google hesabınızla güvenli ve hızlı giriş yapın
            </p>
          </div>

          <button
            onClick={() => setLoading(!loading)}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.4)] active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : <GoogleIcon />}
            <span>{loading ? "Giriş yapılıyor..." : "Google ile Giriş Yap"}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] text-slate-600 tracking-wider uppercase">Güvenli Erişim</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Security items */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: ShieldCheck, label: "Firebase Auth" },
              { icon: ShieldCheck, label: "httpOnly Cookie" },
              { icon: ShieldCheck, label: "PII Maskeli" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <Icon className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] text-emerald-300/80 font-medium leading-tight text-center">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feature badges below card */}
        <div className="mt-6 flex justify-center flex-wrap gap-2">
          {badges.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r border text-xs font-medium ${color}`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-slate-700 mt-6">CX-Inn Platform © 2026</p>
      </div>
    </div>
  );
}
