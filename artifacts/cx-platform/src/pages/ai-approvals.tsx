import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, PageHeader, StatusBadge, Button, Modal, Label, Input, LoadingScreen } from "@/components/ui-elements";
import { useAiApprovalsList, useAiApprovalMutations } from "@/hooks/use-ai-approvals";
import { useCustomersList } from "@/hooks/use-customers";
import { useSurveysList } from "@/hooks/use-surveys";
import { Check, X, Sparkles, AlertCircle, BrainCircuit, Wand2, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getGetAiApprovalsQueryKey } from "@workspace/api-client-react";

const TONE_OPTIONS = [
  { value: "empathetic", label: "Empatik — anlayışlı ve destekleyici" },
  { value: "friendly", label: "Samimi — sıcak ve dostane" },
  { value: "formal", label: "Resmi — kurumsal ve profesyonel" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: "E-posta" },
  { value: "in-app", label: "Uygulama İçi" },
  { value: "web", label: "Web" },
  { value: "sms", label: "SMS" },
];

export default function AiApprovals() {
  const queryClient = useQueryClient();
  const { data: approvals, isLoading } = useAiApprovalsList();
  const { approve, reject } = useAiApprovalMutations();
  const { data: customers } = useCustomersList();
  const { data: surveys } = useSurveysList();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [generateForm, setGenerateForm] = useState({
    customerId: "",
    surveyId: "",
    tone: "empathetic",
    channel: "email",
    originalText: "",
  });

  const pendingApprovals = approvals?.filter(a => a.status === "pending") || [];
  const processedApprovals = approvals?.filter(a => a.status !== "pending") || [];

  const handleApprove = (id: number) => {
    approve.mutate({ id });
  };

  const handleRejectClick = (id: number) => {
    setSelectedId(id);
    setRejectModalOpen(true);
  };

  const submitReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId) {
      reject.mutate({ id: selectedId, data: { reason: rejectReason } }, {
        onSuccess: () => {
          setRejectModalOpen(false);
          setRejectReason("");
          setSelectedId(null);
        }
      });
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/ai/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(generateForm.customerId),
          surveyId: Number(generateForm.surveyId),
          tone: generateForm.tone,
          channel: generateForm.channel,
          originalText: generateForm.originalText,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bilinmeyen hata");
      }
      await queryClient.invalidateQueries({ queryKey: getGetAiApprovalsQueryKey() });
      setGenerateModalOpen(false);
      setGenerateForm({ customerId: "", surveyId: "", tone: "empathetic", channel: "email", originalText: "" });
    } catch (err: any) {
      setGenerateError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      <PageHeader
        title="AI Onay Kuyruğu"
        description="LLM tarafından kişiselleştirilmiş müşteri iletişim metinlerini inceleyin."
      >
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <Sparkles className="h-5 w-5" />
            {pendingApprovals.length} Bekleyen Onay
          </div>
          <Button
            variant="primary"
            onClick={() => setGenerateModalOpen(true)}
            className="flex items-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            <Wand2 className="h-4 w-4" />
            Gemini ile Üret
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-6">
        {pendingApprovals.length === 0 && (
          <Card className="p-12 text-center border-dashed">
            <div className="h-16 w-16 mx-auto bg-success/10 text-success rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-display font-bold text-foreground">Kuyruk Boş</h3>
            <p className="text-muted-foreground mt-2">Bekleyen AI onayı bulunmuyor. Harika iş çıkardınız!</p>
          </Card>
        )}

        {pendingApprovals.map((item) => (
          <Card key={item.id} className="overflow-hidden border-primary/20 shadow-[0_4px_30px_rgba(59,130,246,0.05)]">
            <div className="p-4 border-b border-border/50 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                  {item.customerName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{item.customerName}</h4>
                  <div className="flex gap-2 mt-1">
                    <StatusBadge status={item.toneUsed === 'empathetic' ? 'Empatik' : item.toneUsed === 'friendly' ? 'Samimi' : 'Resmi'} variant="primary" />
                    <StatusBadge status={item.channel.toUpperCase()} variant="outline" />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-2">{formatDate(item.createdAt)}</p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => handleRejectClick(item.id)} isLoading={reject.isPending && selectedId === item.id}>
                    <X className="h-4 w-4" /> Reddet
                  </Button>
                  <Button variant="primary" className="bg-success text-white hover:bg-success/90 shadow-[0_0_15px_rgba(34,197,94,0.3)]" onClick={() => handleApprove(item.id)} isLoading={approve.isPending}>
                    <Check className="h-4 w-4" /> Onayla
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
              <div className="p-6 bg-black/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Orijinal Şablon</p>
                <p className="text-sm text-foreground/80 leading-relaxed font-mono whitespace-pre-wrap">{item.originalText}</p>
              </div>
              <div className="p-6 bg-primary/[0.03] relative">
                <Sparkles className="absolute top-4 right-4 h-6 w-6 text-primary opacity-20" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4" /> Gemini Kişiselleştirilmiş Metin
                </p>
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{item.personalizedText}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {processedApprovals.length > 0 && (
        <div className="mt-12">
          <h3 className="text-lg font-display font-bold mb-4 text-muted-foreground">Geçmiş İşlemler</h3>
          <Card className="overflow-x-auto opacity-70 hover:opacity-100 transition-opacity">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="p-4 text-sm font-semibold text-muted-foreground">Müşteri</th>
                  <th className="p-4 text-sm font-semibold text-muted-foreground">Durum</th>
                  <th className="p-4 text-sm font-semibold text-muted-foreground">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {processedApprovals.map(item => (
                  <tr key={item.id} className="border-b border-border/50">
                    <td className="p-4 font-medium">{item.customerName}</td>
                    <td className="p-4">
                      <StatusBadge
                        status={item.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                        variant={item.status === 'approved' ? 'success' : 'destructive'}
                      />
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      <Modal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="İçeriği Reddet">
        <form onSubmit={submitReject} className="space-y-4">
          <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl flex items-start gap-3 mb-4 text-warning">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Reddetme nedeniniz, AI modelinin gelecekteki kişiselleştirmelerini iyileştirmek için kullanılacaktır.</p>
          </div>
          <div>
            <Label>Geri Bildirim / Reddetme Nedeni</Label>
            <Input
              required
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Örn: Dil çok samimi olmuş, müşteri kurumsal bir hesaba ait."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setRejectModalOpen(false)}>İptal</Button>
            <Button type="submit" variant="destructive" isLoading={reject.isPending}>Reddet ve Eğit</Button>
          </div>
        </form>
      </Modal>

      {/* Gemini Generate Modal */}
      <Modal isOpen={generateModalOpen} onClose={() => { setGenerateModalOpen(false); setGenerateError(null); }} title="Gemini ile Kişiselleştirilmiş Metin Üret">
        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-start gap-3 text-primary">
            <BrainCircuit className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Gemini AI, müşterinin geçmiş etkileşimlerini ve psikolojik durumunu analiz ederek şablon metni kişiselleştirecek. Sonuç onay kuyruğuna eklenecektir.</p>
          </div>

          <div>
            <Label>Müşteri</Label>
            <select
              required
              value={generateForm.customerId}
              onChange={e => setGenerateForm(f => ({ ...f, customerId: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Müşteri seçin —</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.segment}) — Churn: {c.churnRisk === 'high' ? '🔴 Yüksek' : c.churnRisk === 'medium' ? '🟡 Orta' : '🟢 Düşük'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Anket</Label>
            <select
              required
              value={generateForm.surveyId}
              onChange={e => setGenerateForm(f => ({ ...f, surveyId: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Anket seçin —</option>
              {surveys?.map(s => (
                <option key={s.id} value={s.id}>{s.title} ({s.type})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ton</Label>
              <select
                value={generateForm.tone}
                onChange={e => setGenerateForm(f => ({ ...f, tone: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {TONE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Kanal</Label>
              <select
                value={generateForm.channel}
                onChange={e => setGenerateForm(f => ({ ...f, channel: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {CHANNEL_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Şablon Metin</Label>
            <textarea
              required
              value={generateForm.originalText}
              onChange={e => setGenerateForm(f => ({ ...f, originalText: e.target.value }))}
              placeholder="Örn: Merhaba, deneyiminizi değerlendirmek ister misiniz?"
              rows={3}
              className="w-full mt-1 px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {generateError && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {generateError}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => { setGenerateModalOpen(false); setGenerateError(null); }} disabled={isGenerating}>
              İptal
            </Button>
            <Button type="submit" variant="primary" disabled={isGenerating} className="min-w-[160px] shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Üretiliyor...</>
              ) : (
                <><Wand2 className="h-4 w-4" /> Gemini ile Üret</>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
