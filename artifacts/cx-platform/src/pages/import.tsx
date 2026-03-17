import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, PageHeader, Button, LoadingScreen } from "@/components/ui-elements";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGetCustomersQueryKey } from "@workspace/api-client-react";

type ImportResult = {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
};

const COLUMNS = [
  { key: "name", label: "name", desc: "Zorunlu — Müşteri adı soyadı", required: true },
  { key: "email", label: "email", desc: "Zorunlu — Benzersiz e-posta adresi", required: true },
  { key: "segment", label: "segment", desc: "İsteğe bağlı — Kurumsal / KOBİ / Bireysel / Genel", required: false },
  { key: "nps_score", label: "nps_score", desc: "İsteğe bağlı — 0–10 arası sayı", required: false },
  { key: "sentiment", label: "sentiment", desc: "İsteğe bağlı — positive / neutral / negative", required: false },
  { key: "churn_risk", label: "churn_risk", desc: "İsteğe bağlı — low / medium / high", required: false },
];

export default function ImportPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/import/customers", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sunucu hatası");
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Layout>
      <PageHeader
        title="Veri İçe Aktar"
        description="CSV dosyası yükleyerek müşteri verilerini platforma aktarın."
      >
        <a
          href="/api/import/template"
          download
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Download className="h-4 w-4" />
          Şablon CSV İndir
        </a>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: upload */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drop zone */}
          <Card className="overflow-hidden">
            <div
              className={cn(
                "relative border-2 border-dashed rounded-xl m-4 p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                dragging
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:border-primary/50 hover:bg-white/[0.02]"
              )}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {file ? (
                <>
                  <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB — yüklemek için butona basın
                  </p>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">CSV Dosyasını Sürükleyin</p>
                  <p className="text-sm text-muted-foreground mt-1">veya seçmek için buraya tıklayın</p>
                  <p className="text-xs text-muted-foreground/60 mt-3">Desteklenen format: .csv · Maks. 10 MB</p>
                </>
              )}
            </div>

            <div className="px-4 pb-4 flex gap-3">
              <Button
                variant="primary"
                className="flex-1 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                disabled={!file || uploading}
                isLoading={uploading}
                onClick={handleUpload}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Yükleniyor..." : "İçe Aktar"}
              </Button>
              {file && (
                <Button variant="ghost" onClick={reset} disabled={uploading}>
                  <RefreshCw className="h-4 w-4" />
                  Sıfırla
                </Button>
              )}
            </div>
          </Card>

          {/* Result */}
          {result && (
            <Card className="p-6 border-success/20 shadow-[0_0_30px_rgba(34,197,94,0.08)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-success/10 text-success flex items-center justify-center">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-foreground">İçe Aktarma Tamamlandı</h3>
                  <p className="text-sm text-muted-foreground">Müşteri listesi güncellendi.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/[0.03] rounded-xl p-4 text-center border border-border/50">
                  <p className="text-3xl font-display font-bold text-foreground">{result.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Toplam Satır</p>
                </div>
                <div className="bg-success/5 rounded-xl p-4 text-center border border-success/20">
                  <p className="text-3xl font-display font-bold text-success">{result.imported}</p>
                  <p className="text-xs text-success/70 mt-1">Aktarıldı</p>
                </div>
                <div className={cn("rounded-xl p-4 text-center border", result.skipped > 0 ? "bg-warning/5 border-warning/20" : "bg-white/[0.03] border-border/50")}>
                  <p className={cn("text-3xl font-display font-bold", result.skipped > 0 ? "text-warning" : "text-foreground")}>{result.skipped}</p>
                  <p className={cn("text-xs mt-1", result.skipped > 0 ? "text-warning/70" : "text-muted-foreground")}>Atlandı</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                  <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Hatalı Satırlar ({result.errors.length})
                  </p>
                  <ul className="space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-xs text-destructive/80 font-mono">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {error && (
            <Card className="p-5 border-destructive/20 bg-destructive/5">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right column: format guide */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-display font-bold text-foreground mb-1 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              CSV Format Kılavuzu
            </h3>
            <p className="text-xs text-muted-foreground mb-5">
              İlk satır başlık olmalıdır. UTF-8 kodlaması kullanın.
            </p>
            <div className="space-y-3">
              {COLUMNS.map(col => (
                <div key={col.key} className="flex items-start gap-3">
                  <code className={cn(
                    "text-xs px-2 py-0.5 rounded font-mono mt-0.5 flex-shrink-0",
                    col.required
                      ? "bg-primary/15 text-primary"
                      : "bg-white/5 text-muted-foreground"
                  )}>
                    {col.label}
                  </code>
                  <p className="text-xs text-muted-foreground leading-relaxed">{col.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-primary/[0.03] border-primary/20">
            <h3 className="font-display font-bold text-foreground mb-1 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Çakışma Yönetimi
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aynı e-posta adresine sahip bir müşteri zaten varsa, kaydı yeni veriyle güncellenir. Yeni müşteriler doğrudan eklenir.
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Önemli Notlar
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Virgülle ayrılmış (.csv) dosya formatı gereklidir.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Excel dosyalarını önce CSV olarak kaydedin.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                PII verileri otomatik maskelenerek denetim kaydına yazılır.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                Tek seferinde en fazla 10.000 satır aktarılabilir.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
