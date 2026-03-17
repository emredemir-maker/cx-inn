import React from "react";
import { Layout } from "@/components/layout";
import { Card, StatusBadge, LoadingScreen } from "@/components/ui-elements";
import { useCustomerDetail } from "@/hooks/use-customers";
import { useRoute, Link } from "wouter";
import { ArrowLeft, User, Mail, Calendar, TrendingUp, Activity } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const id = parseInt(params?.id || "0");
  const { data: customer, isLoading } = useCustomerDetail(id);

  if (isLoading) return <Layout><LoadingScreen /></Layout>;
  if (!customer) return <Layout><div className="p-8 text-center">Müşteri bulunamadı.</div></Layout>;

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Müşterilere Dön
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card className="p-8 text-center h-full">
            <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-tr from-primary/20 to-accent/20 flex items-center justify-center border-4 border-card shadow-xl mb-4 relative">
              <User className="h-10 w-10 text-primary" />
              <div className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${customer.sentiment === 'positive' ? 'bg-success' : customer.sentiment === 'negative' ? 'bg-destructive' : 'bg-warning'}`}></div>
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
                  variant={customer.churnRisk === 'high' ? 'destructive' : customer.churnRisk === 'medium' ? 'warning' : 'success'} 
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kayıt Tarihi</p>
                <p className="text-sm font-medium">{formatDate(customer.createdAt).split(',')[0]}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card className="p-6 h-full">
            <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Etkileşim Geçmişi
            </h3>

            <div className="space-y-6">
              {customer.interactions.map((interaction, index) => (
                <div key={interaction.id} className="relative pl-8 before:absolute before:left-3 before:top-8 before:bottom-[-32px] last:before:hidden before:w-px before:bg-border">
                  <div className={`absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-card z-10 ${
                    interaction.sentiment === 'positive' ? 'bg-success/20 text-success' : 
                    interaction.sentiment === 'negative' ? 'bg-destructive/20 text-destructive' : 
                    'bg-warning/20 text-warning'
                  }`}>
                    {interaction.sentiment === 'positive' ? <TrendingUp className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                  </div>
                  
                  <div className="glass-panel p-4 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold capitalize text-foreground">{interaction.event.replace('_', ' ')}</h4>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(interaction.createdAt)}
                      </span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <StatusBadge status={`Kanal: ${interaction.channel}`} variant="outline" />
                      {interaction.score !== null && (
                        <span className="text-sm font-medium">Skor: <span className="text-primary">{interaction.score}</span></span>
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
