import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, StatusBadge, Button, Input, Label, LoadingScreen } from "@/components/ui-elements";
import { useSegmentsList, useSegmentMutations, fetchAiSegmentSuggestions } from "@/hooks/use-segments";
import {
  PieChart, Users, TrendingUp, Sparkles, Plus, Trash2, RefreshCw,
  Pencil, X, Check, Wand2, Tag, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiSuggestion {
  name: string;
  description: string;
  criteria: string;
  sourceTags: string[];
  actionRecommendation: string;
  estimatedSize: string;
  estimatedCustomerCount: number;
}

// ─── AI Suggestions Modal ─────────────────────────────────────────────────────

function AiSuggestModal({
  onClose,
  onAccept,
}: {
  onClose: () => void;
  onAccept: (s: AiSuggestion) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [acceptedIdx, setAcceptedIdx] = useState<number[]>([]);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    setSuggestions([]);
    try {
      const data = await fetchAiSegmentSuggestions();
      setSuggestions(data.suggestions ?? []);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message ?? "Öneri alınamadı" });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (s: AiSuggestion, idx: number) => {
    onAccept(s);
    setAcceptedIdx((prev) => [...prev, idx]);
    toast({ title: `"${s.name}" segmenti oluşturuldu` });
  };

  const sizeColor = (size: string) => {
    if (size === "büyük") return "text-green-400";
    if (size === "orta") return "text-yellow-400";
    return "text-slate-400";
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border/50 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI Segment Analizi</h2>
              <p className="text-xs text-muted-foreground">
                Gemini gerçek etkileşim ve etiket verilerinizi analiz ederek segment önerileri oluşturur
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {suggestions.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="inline-flex p-4 rounded-2xl bg-primary/5 border border-primary/20 mb-4">
                <Wand2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Etiket verilerinizden segmentler oluştur
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Gemini; etkileşim etiketlerini, ağrı noktalarını ve müşteri davranışlarını analiz edip
                anlamlı müşteri grupları önerecek.
              </p>
              <Button onClick={handleGenerate} className="gap-2 px-6">
                <Sparkles className="h-4 w-4" />
                Segment Önerisi Oluştur
              </Button>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-xl border border-border/30 p-5 animate-pulse">
                  <div className="flex gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10" />
                    <div className="flex-1">
                      <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-white/10 rounded w-2/3" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((j) => <div key={j} className="h-6 w-20 bg-white/10 rounded-full" />)}
                  </div>
                </div>
              ))}
              <p className="text-center text-sm text-muted-foreground mt-2">
                Gemini etiket verilerini analiz ediyor…
              </p>
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {suggestions.length} segment önerisi oluşturuldu
                </p>
                <Button variant="ghost" onClick={handleGenerate} className="gap-2 text-xs h-8">
                  <RefreshCw className="h-3.5 w-3.5" /> Yeniden oluştur
                </Button>
              </div>

              {suggestions.map((s, i) => {
                const accepted = acceptedIdx.includes(i);
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border p-5 transition-all",
                      accepted
                        ? "border-success/40 bg-success/5"
                        : "border-border/40 bg-white/[0.02] hover:border-border/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-foreground">{s.name}</h3>
                          <span className={cn("text-xs font-semibold", sizeColor(s.estimatedSize))}>
                            · {s.estimatedSize}
                          </span>
                          {s.estimatedCustomerCount > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" /> ~{s.estimatedCustomerCount} müşteri
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{s.description}</p>
                      </div>
                      {accepted ? (
                        <div className="flex-shrink-0 flex items-center gap-1.5 text-success text-sm font-semibold">
                          <Check className="h-4 w-4" /> Oluşturuldu
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleAccept(s, i)}
                          className="flex-shrink-0 gap-2"
                          variant="outline"
                        >
                          <Plus className="h-4 w-4" /> Segmenti Oluştur
                        </Button>
                      )}
                    </div>

                    {/* Source tags */}
                    {s.sourceTags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {s.sourceTags.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
                          >
                            <Tag className="h-2.5 w-2.5" /> {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action recommendation */}
                    <div className="flex items-start gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                      <Zap className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{s.actionRecommendation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/50 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Kapat</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Manual Create/Edit Modal ─────────────────────────────────────────────────

function SegmentFormModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: { name: string; description: string; criteria: string; sourceTags: string[] };
  onClose: () => void;
  onSave: (data: { name: string; description: string; criteria: string; sourceTags: string[] }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [criteria, setCriteria] = useState(initial?.criteria ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.sourceTags ?? []);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    onSave({ name, description, criteria, sourceTags: tags });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border/50 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-foreground">{initial ? "Segmenti Düzenle" : "Manuel Segment Oluştur"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label>Segment Adı</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Teknik Destek Arayanlar" className="mt-1.5" />
          </div>
          <div>
            <Label>Açıklama</Label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Bu segmentin kim olduğunu kısaca açıklayın"
              className="w-full mt-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm resize-none focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <Label>Kriter / Açıklama</Label>
            <Input value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="Örn: churn_risk = high" className="mt-1.5" />
          </div>
          <div>
            <Label>Etiketler (kaynak taglar)</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Etiket girin, Enter'a basın"
              />
              <Button type="button" variant="outline" onClick={addTag} className="flex-shrink-0">Ekle</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                    <Tag className="h-2.5 w-2.5" /> {t}
                    <button type="button" onClick={() => removeTag(t)} className="ml-1 hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={onClose}>İptal</Button>
            <Button type="submit" isLoading={saving}>{initial ? "Güncelle" : "Oluştur"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Segment Card ─────────────────────────────────────────────────────────────

function SegmentCard({
  segment,
  onEdit,
  onDelete,
  onRefresh,
  refreshing,
}: {
  segment: any;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <Card className="p-5 hover:border-primary/40 transition-colors group flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl text-primary border border-primary/20 group-hover:scale-105 transition-transform">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground leading-tight">{segment.name}</h3>
            {segment.aiGenerated && (
              <span className="flex items-center gap-1 text-[10px] text-primary font-semibold mt-0.5">
                <Sparkles className="h-2.5 w-2.5" /> AI Segmenti
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            title="Sayıları Yenile"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{segment.description}</p>

      {/* Tags */}
      {segment.sourceTags && segment.sourceTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {segment.sourceTags.slice(0, 4).map((t: string) => (
            <span key={t} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/8 border border-primary/15 text-primary/80 text-[10px] font-medium">
              <Tag className="h-2 w-2" /> {t}
            </span>
          ))}
          {segment.sourceTags.length > 4 && (
            <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground text-[10px]">
              +{segment.sourceTags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-4">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Users className="h-3.5 w-3.5" />
            <span className="text-xs">Müşteri</span>
          </div>
          <p className="text-xl font-bold text-foreground">{segment.customerCount.toLocaleString("tr-TR")}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Ort. NPS</span>
          </div>
          <p className="text-xl font-bold text-primary">
            {segment.avgNps !== null && segment.avgNps !== undefined ? segment.avgNps : "—"}
          </p>
        </div>
      </div>

      <div className="border-t border-border/50 pt-3">
        <StatusBadge status={segment.criteria || "Manuel"} variant="outline" />
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Segments() {
  const { data: segments, isLoading } = useSegmentsList();
  const { create, update, remove, refresh } = useSegmentMutations();
  const { toast } = useToast();

  const [showAi, setShowAi] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editSegment, setEditSegment] = useState<any | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const handleAiAccept = (s: AiSuggestion) => {
    create.mutate({
      name: s.name,
      description: s.description,
      criteria: s.criteria,
      sourceTags: s.sourceTags,
      aiGenerated: true,
    });
  };

  const handleManualSave = (data: { name: string; description: string; criteria: string; sourceTags: string[] }) => {
    if (editSegment) {
      update.mutate(
        { id: editSegment.id, data },
        { onSuccess: () => { setEditSegment(null); toast({ title: "Segment güncellendi" }); } }
      );
    } else {
      create.mutate(
        { ...data, aiGenerated: false },
        { onSuccess: () => { setShowForm(false); toast({ title: "Segment oluşturuldu" }); } }
      );
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`"${name}" segmentini silmek istediğinizden emin misiniz?`)) return;
    remove.mutate(id, { onSuccess: () => toast({ title: "Segment silindi" }) });
  };

  const handleRefresh = async (id: number) => {
    setRefreshingId(id);
    try {
      await refresh.mutateAsync(id);
      toast({ title: "Müşteri sayıları güncellendi" });
    } finally {
      setRefreshingId(null);
    }
  };

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  const aiSegments = segments?.filter((s: any) => s.aiGenerated) ?? [];
  const manualSegments = segments?.filter((s: any) => !s.aiGenerated) ?? [];

  return (
    <Layout>
      <PageHeader
        title="Müşteri Segmentleri"
        description="AI destekli segmentasyon: etiket verilerinden otomatik gruplar, ya da kendiniz oluşturun."
      >
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Manuel Oluştur
          </Button>
          <Button onClick={() => setShowAi(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Segment Önerisi
          </Button>
        </div>
      </PageHeader>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <PieChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Toplam Segment</p>
            <p className="text-2xl font-bold text-foreground">{segments?.length ?? 0}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">AI Segment</p>
            <p className="text-2xl font-bold text-foreground">{aiSegments.length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-white/5 border border-border/50">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Manuel Segment</p>
            <p className="text-2xl font-bold text-foreground">{manualSegments.length}</p>
          </div>
        </Card>
      </div>

      {/* AI Segments */}
      {aiSegments.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">AI Segmentleri</h2>
            <div className="flex-1 border-t border-border/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {aiSegments.map((seg: any) => (
              <SegmentCard
                key={seg.id}
                segment={seg}
                onEdit={() => setEditSegment(seg)}
                onDelete={() => handleDelete(seg.id, seg.name)}
                onRefresh={() => handleRefresh(seg.id)}
                refreshing={refreshingId === seg.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Manual Segments */}
      {manualSegments.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Manuel Segmentler</h2>
            <div className="flex-1 border-t border-border/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {manualSegments.map((seg: any) => (
              <SegmentCard
                key={seg.id}
                segment={seg}
                onEdit={() => setEditSegment(seg)}
                onDelete={() => handleDelete(seg.id, seg.name)}
                onRefresh={() => handleRefresh(seg.id)}
                refreshing={refreshingId === seg.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!segments || segments.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="inline-flex p-5 rounded-2xl bg-primary/5 border border-primary/20 mb-5">
            <PieChart className="h-10 w-10 text-primary/60" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Henüz segment yok</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            "AI Segment Önerisi" ile Gemini etiket verilerinizden otomatik segmentler oluştursun,
            ya da kendiniz manuel olarak tanımlayın.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Manuel Oluştur
            </Button>
            <Button onClick={() => setShowAi(true)} className="gap-2">
              <Sparkles className="h-4 w-4" /> AI Segment Önerisi
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAi && (
        <AiSuggestModal
          onClose={() => setShowAi(false)}
          onAccept={handleAiAccept}
        />
      )}

      {(showForm || editSegment) && (
        <SegmentFormModal
          initial={editSegment ?? undefined}
          onClose={() => { setShowForm(false); setEditSegment(null); }}
          onSave={handleManualSave}
          saving={create.isPending || update.isPending}
        />
      )}
    </Layout>
  );
}
