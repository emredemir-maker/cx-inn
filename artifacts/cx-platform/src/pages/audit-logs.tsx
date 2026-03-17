import React from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, StatusBadge, LoadingScreen } from "@/components/ui-elements";
import { useAuditLogsList } from "@/hooks/use-audit-logs";
import { ShieldCheck, EyeOff } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AuditLogs() {
  const { data: logs, isLoading } = useAuditLogsList();

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      <PageHeader 
        title="Güvenlik ve Denetim (Audit Log)" 
        description="KVKK/GDPR uyumluluğu için tüm sistem hareketleri ve PII veri erişim kayıtları."
      >
        <div className="flex items-center gap-2 text-success bg-success/10 px-4 py-2 rounded-xl border border-success/20">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-semibold">Sistem Güvenli</span>
        </div>
      </PageHeader>

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-white/[0.02]">
              <th className="p-4 text-sm font-semibold text-muted-foreground">Tarih</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Kullanıcı</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Eylem</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Hedef Varlık</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Detaylar</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground text-center">PII Maskeleme</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((log) => (
              <tr key={log.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors font-mono text-sm">
                <td className="p-4 text-muted-foreground">{formatDate(log.createdAt)}</td>
                <td className="p-4 font-sans font-medium text-foreground">{log.userId}</td>
                <td className="p-4"><StatusBadge status={log.action} variant="outline" /></td>
                <td className="p-4">{log.entityType} #{log.entityId}</td>
                <td className="p-4 font-sans text-muted-foreground truncate max-w-[300px]" title={log.details}>
                  {log.details}
                </td>
                <td className="p-4 text-center">
                  {log.piiMasked ? (
                    <span className="inline-flex items-center gap-1 text-success bg-success/10 px-2 py-1 rounded-md text-xs font-sans font-semibold">
                      <EyeOff className="h-3 w-3" /> Maskeli
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
            {(!logs || logs.length === 0) && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground font-sans">Kayıt bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </Layout>
  );
}
