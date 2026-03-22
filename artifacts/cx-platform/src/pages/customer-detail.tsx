import React from "react";
import { Layout } from "@/components/layout";
import { Card, StatusBadge, LoadingScreen } from "@/components/ui-elements";
import { useCustomerDetail } from "@/hooks/use-customers";
import { useRoute, Link } from "wouter";
import { ArrowLeft, User, Mail, Calendar, TrendingUp, Activity, Tag, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface InteractionRecord {
  id: number;
  subject?: string | null;
  type?: string | null;
  status?: string | null;
  channel?: string | null;
  tags?: string[] | null;
  interactedAt?: string | null;
  excludedFromAnalysis?: boolean | null;
}

// ─── Tag Cloud ────────────────────────────────────────────────────────────────
function TagCloud({ records }: { records: InteractionRecord[] }) {
  // Aggregate all tags across all records with frequency counts
  const tagCounts = new Map<string, number>();
  for (const rec of records) {
    for (const tag of rec.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  if (tagCounts.size === 0) return null;

  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] ?? 1;

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map(([tag, count]) => {
        // Scale opacity/size by frequency
        const weight = count / maxCount;
        return (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
              weight >= 0.8
                ? "bg-primary/20 border-primary/40 text-primary"
                : weight >= 0.5
                  ? "bg-primary/10 border-primary/20 text-primary/80"
                  : "bg-muted/40 border-border text-muted-foreground"
            )}
          >
            <Tag className="h-2.5 w-2.5" />
            {tag}
            {count > 1 && (
              <span className="ml-0.5 text-[10px] opacity-70">×{count}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Record Timeline Entry ────────────────────────────────────────────────────
function RecordEntry({ rec }: { rec: InteractionRecord }) {
  const typeLabel: Record<string, string> = {
    ticket: "Destek Talebi", chat: "Chat", call: "Çağrı",
    email: "E-posta", note: "Not",
  };
  const statusColor: Record<string, string> = {
    open: "text-yellow-400", resolved: "text-green-400",
    closed: "text-muted-foreground", pending: "text-blue-400",
  };
  const isExcluded = rec.excludedFromAnalysis;

  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-2 transition-opacity",
      isExcluded ? "opacity-50 border-border/30 bg-muted/10" : "border-border/50 bg-card/30"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3.5 w-3.5 text-primary/60 shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {rec.subject ?? typeLabel[rec.type ?? ""] ?? "Kayıt"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rec.status && (
            <span className={cn("text-xs font-medium", statusColor[rec.status] ?? "text-muted-foreground")}>
              {rec.status === "open" ? "Açık"
                : rec.status === "resolved" ? "Çözüldü"
                : rec.status === "closed" ? "Kapalı"
                : rec.status}
            </span>
          )}
          {rec.interactedAt && (
            <span className="text-[10px] text-muted-foreground">
              {formatDate(rec.interactedAt).split(",")[0]}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {rec.channel && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/30 text-muted-foreground">
            {rec.channel}
          </span>
        )}
        {rec.type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/30 text-muted-foreground">
            {typeLabel[rec.type] ?? rec.type}
          </span>
        )}
        {isExcluded && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/20 text-destructive/70">
            Analizden hariç
          </span>
        )}
      </div>
      {rec.tags && rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {rec.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded-full border border-primary/20"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const id = parseInt(params?.id || "0");
  const { data: customer, isLoading } = useCustomerDetail(id);

  if (isLoading) return <Layout><LoadingScreen /></Layout>;
  if (!customer) return <Layout><div className="p-8 text-center">Müşteri bulunamadı.</div></Layout>;

  const interactionRecords: InteractionRecord[] = (customer as any).interactionRecords ?? [];
  const taggedRecords = interactionRecords.filter(r => r.tags && r.tags.length > 0);

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Müşterilere Dön
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-8 text-center">
            <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-tr from-primary/20 to-accent/20 flex items-center justify-center border-4 border-card shadow-xl mb-4 relative">
              <User className="h-10 w-10 text-primary" />
              <div className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${
                customer.sentiment === "positive" ? "bg-success" :
                customer.sentiment === "negative" ? "bg-destructive" : "bg-warning"
              }`} />
            </div>
            <h2 className="text-2xl font-display font-bold mb-1">{customer.name}</h2>
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-6">
              <Mail className="h-4 w-4" /> {customer.email}
            </p>

            <div className="grid grid-cols-2 gap-4 text-left border-t border-border/50 pt-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">NPS Skoru</p>
                <p className="text-xl font-bold text-primary">{customer.npsScore || "Yok"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Segment</p>
                <StatusBadge status={customer.segment} variant="outline" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Churn Riski</p>
                <StatusBadge
                  status={customer.churnRisk === "low" ? "Düşük" : customer.churnRisk === "medium" ? "Orta" : "Yüksek"}
                  variant={customer.churnRisk === "high" ? "destructive" : customer.churnRisk === "medium" ? "warning" : "success"}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kayıt Tarihi</p>
                <p className="text-sm font-medium">{formatDate(customer.createdAt).split(",")[0]}</p>
              </div>
            </div>
          </Card>

          {/* Tag Cloud Card */}
          {taggedRecords.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-primary" />
                AI Etiket Analizi
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                  {taggedRecords.length} kayıt
                </span>
              </h3>
              <TagCloud records={interactionRecords} />
            </Card>
          )}
        </div>

        {/* Right column: timelines */}
        <div className="lg:col-span-2 space-y-5">
          {/* Interaction Records with Tags */}
          {interactionRecords.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Destek Kayıtları
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                  {interactionRecords.length} kayıt
                </span>
              </h3>
              <div className="space-y-2.5">
                {interactionRecords.map(rec => (
                  <RecordEntry key={rec.id} rec={rec} />
                ))}
              </div>
            </Card>
          )}

          {/* Simple Interaction Timeline */}
          <Card className="p-6">
            <h3 className="text-lg font-display font-bold mb-6 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Etkileşim Geçmişi
            </h3>

            <div className="space-y-6">
              {customer.interactions.map((interaction: any) => (
                <div key={interaction.id} className="relative pl-8 before:absolute before:left-3 before:top-8 before:bottom-[-32px] last:before:hidden before:w-px before:bg-border">
                  <div className={`absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-card z-10 ${
                    interaction.sentiment === "positive" ? "bg-success/20 text-success" :
                    interaction.sentiment === "negative" ? "bg-destructive/20 text-destructive" :
                    "bg-warning/20 text-warning"
                  }`}>
                    {interaction.sentiment === "positive"
                      ? <TrendingUp className="h-3 w-3" />
                      : <Activity className="h-3 w-3" />}
                  </div>

                  <div className="glass-panel p-4 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold capitalize text-foreground">
                        {interaction.event.replace("_", " ")}
                      </h4>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(interaction.createdAt)}
                      </span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <StatusBadge status={`Kanal: ${interaction.channel}`} variant="outline" />
                      {interaction.score !== null && (
                        <span className="text-sm font-medium">
                          Skor: <span className="text-primary">{interaction.score}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {customer.interactions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Kayıtlı etkileşim bulunamadı.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
