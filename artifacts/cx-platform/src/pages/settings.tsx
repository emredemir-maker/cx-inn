import React, { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  Settings, Building2, Mail, Globe, Briefcase, FileText,
  Save, CheckCircle, Image, Palette, Eye, EyeOff, Upload, X, Link2,
  Key, Plus, Trash2, Power, Copy, Check, AlertCircle, Clock, Webhook, Code2,
} from "lucide-react";
import { TestDataCleanup } from "@/components/test-data-cleanup";

type CompanySettings = {
  id: number;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  email: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  updatedAt: string;
};

type ApiKey = {
  id: number;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  fullKey?: string;
};

const INDUSTRY_OPTIONS = [
  "Teknoloji / SaaS", "E-Ticaret / Perakende", "Finans / Bankacılık",
  "Sağlık", "Lojistik / Kargo", "Üretim / Sanayi",
  "Eğitim", "Turizm / Otelcilik", "Medya / Yayıncılık", "Diğer",
];

function Field({ label, icon, children, hint }: {
  label: string; icon: React.ReactNode; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary/70">{icon}</span>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { realRole, currentTenantRole, tenants, currentTenantId } = useAppAuth();

  const currentTenant = tenants.find((t) => t.id === currentTenantId);

  // Allow access to: superadmin, and tenant_admin within their tenant
  const canEdit = realRole === "superadmin" || currentTenantRole === "tenant_admin";

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/company");
      if (!res.ok) throw new Error("Ayarlar alınamadı");
      return res.json();
    },
  });

  const [form, setForm] = useState({
    companyName: "",
    logoUrl: "",
    primaryColor: "#6366f1",
    email: "",
    website: "",
    industry: "",
    description: "",
  });
  const [logoPreview, setLogoPreview] = useState(false);

  useEffect(() => {
    if (settings) {
      const logoUrl = settings.logoUrl ?? "";
      setForm({
        companyName: settings.companyName ?? "",
        logoUrl,
        primaryColor: settings.primaryColor ?? "#6366f1",
        email: settings.email ?? "",
        website: settings.website ?? "",
        industry: settings.industry ?? "",
        description: settings.description ?? "",
      });
      if (logoUrl.startsWith("data:")) setLogoMode("file");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kayıt hatası");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast({ title: "Ayarlar kaydedildi", description: "Firma bilgileri başarıyla güncellendi." });
    },
    onError: (e: any) => {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  const [logoMode, setLogoMode] = useState<"url" | "file">("url");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Keys state
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const { data: apiKeys, refetch: refetchKeys } = useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/settings/api-keys");
      if (!res.ok) throw new Error("Anahtarlar alınamadı");
      return res.json();
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Oluşturulamadı");
      return res.json() as Promise<ApiKey>;
    },
    onSuccess: (data) => {
      refetchKeys();
      setNewKeyName("");
      setRevealedKey(data.fullKey ?? null);
      toast({ title: "API Anahtarı oluşturuldu", description: "Anahtarı şimdi kopyalayın — bir daha gösterilmeyecek." });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { refetchKeys(); toast({ title: "Anahtar silindi" }); },
  });

  const toggleKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/settings/api-keys/${id}/toggle`, { method: "PATCH" });
    },
    onSuccess: () => refetchKeys(),
  });

  const copyRevealedKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "Logo dosyası maksimum 2 MB olabilir.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      set("logoUrl", reader.result as string);
      setUploading(false);
    };
    reader.onerror = () => {
      toast({ title: "Okuma hatası", description: "Dosya okunamadı.", variant: "destructive" });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Hesap Ayarları</h1>
            <p className="text-muted-foreground mt-1">
              {currentTenant ? (
                <span>
                  <span className="font-medium" style={{ color: currentTenant.primaryColor }}>
                    {currentTenant.name}
                  </span>
                  {" "}firma bilgilerini düzenleyin. Bu bilgiler gönderilen e-posta ve anketlerde kullanılır.
                </span>
              ) : (
                "Firma bilgilerinizi düzenleyin. Bu bilgiler gönderilen e-posta ve anketlerde kullanılır."
              )}
            </p>
          </div>
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || !canEdit}
            title={!canEdit ? "Bu ayarları değiştirmek için yetkiniz yok" : undefined}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
              saveMutation.isPending
                ? "bg-primary/50 text-white/70 cursor-not-allowed"
                : !canEdit
                ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                : "bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            )}
          >
            {saveMutation.isPending
              ? <><div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Kaydediliyor...</>
              : <><Save className="h-4 w-4" /> Kaydet</>}
          </button>
        </div>

        {/* Email preview card */}
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Eye className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-semibold text-indigo-300">E-posta Önizlemesi</p>
          </div>
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            {/* Simulated email header */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: form.primaryColor + "22", borderBottom: `1px solid ${form.primaryColor}33` }}>
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="logo" className="h-8 max-w-[120px] object-contain" onError={() => {}} />
              ) : (
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.primaryColor + "40" }}>
                  <Building2 className="h-4 w-4" style={{ color: form.primaryColor }} />
                </div>
              )}
              <span className="font-bold text-white text-sm">{form.companyName || "Firma Adı"}</span>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-300">Merhaba [Müşteri Adı],</p>
              <p className="text-sm text-slate-400 mt-1">Deneyiminizi değerlendirmenizi rica ederiz...</p>
              <div className="mt-3 inline-block px-4 py-2 rounded-lg text-sm text-white font-semibold" style={{ backgroundColor: form.primaryColor }}>
                Anketi Doldur
              </div>
            </div>
            <div className="px-4 py-2 bg-slate-900 text-[11px] text-slate-500">
              {form.companyName || "CX-Inn"} · {form.email || "destek@firmaniz.com"}
            </div>
          </div>
        </div>

        {/* Settings form */}
        <div className="rounded-2xl border border-border/50 bg-card/30 p-6 space-y-6">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Firma Bilgileri
          </h2>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Firma / Marka Adı" icon={<Building2 className="h-3.5 w-3.5" />}
              hint="E-posta başlığında ve anket sayfasında görünür">
              <input
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="örn. Acme Teknoloji A.Ş."
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </Field>

            <Field label="Sektör" icon={<Briefcase className="h-3.5 w-3.5" />}>
              <select
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sektör seçin —</option>
                {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="İletişim E-postası" icon={<Mail className="h-3.5 w-3.5" />}
              hint="Anket gönderimlerinde 'Gönderen' adresi olarak kullanılır">
              <input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="destek@firmaniz.com"
                type="email"
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </Field>

            <Field label="Web Sitesi" icon={<Globe className="h-3.5 w-3.5" />}>
              <input
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://firmaniz.com"
                type="url"
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </Field>
          </div>

          <Field label="Kısa Açıklama" icon={<FileText className="h-3.5 w-3.5" />}
            hint="AI kişiselleştirme sırasında Gemini bu bilgiyi kullanır">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Firmanız hakkında kısa bir açıklama yazın..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </Field>
        </div>

        {/* Branding */}
        <div className="rounded-2xl border border-border/50 bg-card/30 p-6 space-y-6">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Marka & Görsel
          </h2>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Firma Logosu" icon={<Image className="h-3.5 w-3.5" />}
              hint="PNG, SVG veya JPG. Maksimum 2 MB.">
              <div className="space-y-3">
                {/* Mode toggle */}
                <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setLogoMode("file")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors",
                      logoMode === "file" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" /> Dosya Yükle
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoMode("url")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors",
                      logoMode === "url" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Link2 className="h-3.5 w-3.5" /> URL ile
                  </button>
                </div>

                {/* File upload area */}
                {logoMode === "file" && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      onChange={handleLogoFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={cn(
                        "w-full h-24 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 text-sm",
                        uploading
                          ? "border-primary/40 bg-primary/5 text-primary/60"
                          : "border-border/40 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground cursor-pointer"
                      )}
                    >
                      {uploading ? (
                        <>
                          <div className="h-5 w-5 border-2 border-primary/60 border-t-primary rounded-full animate-spin" />
                          <span>Yükleniyor...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5" />
                          <span>Tıkla veya sürükle</span>
                          <span className="text-xs opacity-60">PNG, SVG, JPG, WebP · max 2 MB</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* URL input */}
                {logoMode === "url" && (
                  <input
                    value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
                    onChange={(e) => set("logoUrl", e.target.value)}
                    placeholder="https://firmaniz.com/logo.png"
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  />
                )}

                {/* Preview + clear */}
                {form.logoUrl && (
                  <div className="p-3 bg-white/5 rounded-xl border border-border/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={form.logoUrl}
                        alt="Logo önizleme"
                        className="h-9 max-w-[140px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {form.logoUrl.startsWith("data:") ? "Yüklenen dosya" : "URL logosu"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { set("logoUrl", ""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Field>

            <Field label="Marka Rengi" icon={<Palette className="h-3.5 w-3.5" />}
              hint="E-posta buton ve başlık rengi">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  className="h-10 w-16 rounded-xl border border-border/50 bg-transparent cursor-pointer p-0.5"
                />
                <input
                  value={form.primaryColor}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm font-mono focus:outline-none focus:border-primary/50"
                />
                {/* Color swatches */}
                <div className="flex gap-1.5">
                  {["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"].map((c) => (
                    <button key={c} type="button" onClick={() => set("primaryColor", c)}
                      className="h-7 w-7 rounded-lg border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: form.primaryColor === c ? "white" : "transparent" }}
                    />
                  ))}
                </div>
              </div>
            </Field>
          </div>
        </div>

        {/* Save button (bottom) */}
        <div className="flex justify-end pb-4">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || !canEdit}
            title={!canEdit ? "Bu ayarları değiştirmek için yetkiniz yok" : undefined}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
              saveMutation.isPending
                ? "bg-primary/50 text-white/70 cursor-not-allowed"
                : !canEdit
                ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                : "bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            )}
          >
            {saveMutation.isPending
              ? <><div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Kaydediliyor...</>
              : <><Save className="h-4 w-4" /> Değişiklikleri Kaydet</>}
          </button>
        </div>

        {/* API Keys section */}
        <div className="rounded-2xl border border-border/50 bg-card/30 p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> API Entegrasyon Anahtarları
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Üçüncü taraf omnichannel servislerinizi REST API veya webhook ile CX-Inn'e bağlamak için API anahtarı oluşturun.
            </p>
          </div>

          {/* Endpoint reference */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold font-sans text-xs mb-2">
              <Code2 className="h-3.5 w-3.5" /> Temel Endpoint'ler
            </div>
            {[
              ["POST", "/api/v1/interactions", "Tekil etkileşim gönder"],
              ["POST", "/api/v1/interactions/batch", "Toplu etkileşim gönder (max 500)"],
              ["POST", "/api/v1/webhook/events", "Webhook event al"],
              ["GET",  "/api/v1/customers", "Müşteri listesi (PII maskeli)"],
              ["GET",  "/api/v1/customers/lookup?email=", "Email ile müşteri sorgula"],
            ].map(([method, path, desc]) => (
              <div key={path} className="flex items-center gap-2">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold",
                  method === "POST" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
                )}>{method}</span>
                <span className="text-slate-300">{path}</span>
                <span className="text-slate-500 hidden sm:inline">— {desc}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-indigo-500/20 text-slate-400">
              Header: <span className="text-emerald-400">X-API-Key: {"<anahtar>"}</span>
            </div>
          </div>

          {/* Revealed key (one-time display) */}
          {revealedKey && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <AlertCircle className="h-3.5 w-3.5" />
                Bu anahtar yalnızca bir kez gösterilecek — şimdi kopyalayın!
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-black/30 px-3 py-2 rounded-lg text-amber-300 break-all font-mono">
                  {revealedKey}
                </code>
                <button
                  onClick={copyRevealedKey}
                  className="shrink-0 p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
                >
                  {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setRevealedKey(null)}
                  className="shrink-0 p-2 rounded-lg hover:bg-white/10 text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Create new key */}
          <div className="flex gap-3">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Anahtar adı (örn. Zendesk Entegrasyonu)"
              className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              onKeyDown={(e) => e.key === "Enter" && newKeyName.trim() && createKeyMutation.mutate(newKeyName)}
            />
            <button
              onClick={() => newKeyName.trim() && createKeyMutation.mutate(newKeyName)}
              disabled={!newKeyName.trim() || createKeyMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {createKeyMutation.isPending
                ? <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Plus className="h-4 w-4" />
              }
              Oluştur
            </button>
          </div>

          {/* Keys list */}
          <div className="space-y-2">
            {!apiKeys || apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Henüz API anahtarı yok
              </div>
            ) : apiKeys.map((key) => (
              <div key={key.id} className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                key.isActive ? "border-border/40 bg-white/3" : "border-border/20 bg-white/1 opacity-60"
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{key.name}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                      key.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"
                    )}>
                      {key.isActive ? "Aktif" : "Devre Dışı"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs text-muted-foreground font-mono">{key.keyPrefix}</code>
                    {key.lastUsedAt && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Son kullanım: {new Date(key.lastUsedAt).toLocaleDateString("tr-TR")}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString("tr-TR")} oluşturuldu
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleKeyMutation.mutate(key.id)}
                    title={key.isActive ? "Devre dışı bırak" : "Aktif et"}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      key.isActive ? "hover:bg-amber-500/20 text-amber-400" : "hover:bg-emerald-500/20 text-emerald-400"
                    )}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                    title="Sil"
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Developer / Test Data Cleanup (superadmin only) ── */}
        {realRole === "superadmin" && (
          <TestDataCleanup />
        )}

        <div className="pb-8" />
      </div>
    </Layout>
  );
}
