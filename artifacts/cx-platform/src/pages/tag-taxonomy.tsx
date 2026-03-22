import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Tags,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Sparkles,
  Merge,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Hash,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TagSynonymGroup {
  id: number;
  canonicalName: string;
  synonyms: string[];
  createdAt: string;
  updatedAt: string;
}

interface TagCount {
  tag: string;
  cnt: string; // comes as string from SQL COUNT
}

interface AiSuggestedGroup {
  canonicalName: string;
  synonyms: string[];
}

// ─── API helpers ──────────────────────────────────────────────────────────────
const BASE = "/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SynonymBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 text-xs border border-slate-600/40">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-slate-500 hover:text-red-400 transition-colors">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

function ConfirmInline({
  message,
  onConfirm,
  onCancel,
  danger = false,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-700/50 border border-slate-600/40">
      <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${danger ? "text-red-400" : "text-amber-400"}`} />
      <span className="text-xs text-slate-300 flex-1">{message}</span>
      <button
        onClick={onConfirm}
        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
          danger
            ? "bg-red-600/80 hover:bg-red-500 text-white"
            : "bg-amber-600/80 hover:bg-amber-500 text-white"
        }`}
      >
        Evet
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-0.5 rounded bg-slate-600/60 hover:bg-slate-500/60 text-slate-300 text-xs transition-colors"
      >
        İptal
      </button>
    </div>
  );
}

function GroupCard({
  group,
  onUpdate,
  onDelete,
  onMergeIntoThis,
  allGroups,
}: {
  group: TagSynonymGroup;
  onUpdate: (id: number, data: { canonicalName?: string; synonyms?: string[] }) => void;
  onDelete: (id: number) => void;
  onMergeIntoThis: (targetId: number, sourceId: number) => void;
  allGroups: TagSynonymGroup[];
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.canonicalName);
  const [draftSynonyms, setDraftSynonyms] = useState<string[]>(group.synonyms);
  const [newSyn, setNewSyn] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [pendingMergeSourceId, setPendingMergeSourceId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onUpdate(group.id, { canonicalName: draftName.trim(), synonyms: draftSynonyms });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraftName(group.canonicalName);
    setDraftSynonyms(group.synonyms);
    setEditing(false);
    setNewSyn("");
  };

  const addSynonym = () => {
    const trimmed = newSyn.trim();
    if (trimmed && !draftSynonyms.includes(trimmed)) {
      setDraftSynonyms(prev => [...prev, trimmed]);
      setNewSyn("");
    }
  };

  const removeSynonym = (s: string) => {
    setDraftSynonyms(prev => prev.filter(x => x !== s));
  };

  const otherGroups = allGroups.filter(g => g.id !== group.id);
  const pendingMergeSource = pendingMergeSourceId
    ? otherGroups.find(g => g.id === pendingMergeSourceId)
    : null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              className="w-full bg-slate-700/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-white text-sm font-semibold focus:outline-none focus:border-indigo-500/50"
            />
          ) : (
            <h3 className="text-white font-semibold text-sm truncate">{group.canonicalName}</h3>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                className="p-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                title="Kaydet"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
                title="İptal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:text-indigo-400 transition-colors"
                title="Düzenle"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {otherGroups.length > 0 && (
                <button
                  onClick={() => { setShowMerge(v => !v); setConfirmDelete(false); setPendingMergeSourceId(null); }}
                  className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:text-amber-400 transition-colors"
                  title="Başka grupla birleştir"
                >
                  <Merge className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { setConfirmDelete(true); setShowMerge(false); setPendingMergeSourceId(null); }}
                className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:text-red-400 transition-colors"
                title="Sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmInline
          message={`"${group.canonicalName}" grubu silinsin mi?`}
          onConfirm={() => { onDelete(group.id); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
          danger
        />
      )}

      {/* Synonyms */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">Eş anlamlılar</p>
        <div className="flex flex-wrap gap-1.5">
          {(editing ? draftSynonyms : group.synonyms).map(syn => (
            <SynonymBadge
              key={syn}
              tag={syn}
              onRemove={editing ? () => removeSynonym(syn) : undefined}
            />
          ))}
          {(editing ? draftSynonyms : group.synonyms).length === 0 && (
            <span className="text-xs text-slate-600 italic">Henüz eş anlamlı yok</span>
          )}
        </div>

        {editing && (
          <div className="mt-2 flex gap-2">
            <input
              value={newSyn}
              onChange={e => setNewSyn(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addSynonym()}
              placeholder="Yeni eş anlamlı ekle…"
              className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded-lg px-2.5 py-1 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
            <button
              onClick={addSynonym}
              className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-white text-xs transition-colors"
            >
              Ekle
            </button>
          </div>
        )}
      </div>

      {/* Merge panel */}
      {showMerge && !editing && (
        <div className="pt-2 border-t border-slate-700/40 space-y-2">
          <p className="text-xs text-amber-400/80">
            Başka bir grubu bu gruba birleştir (diğer grup silinir):
          </p>

          {/* Merge confirmation */}
          {pendingMergeSource ? (
            <ConfirmInline
              message={`"${pendingMergeSource.canonicalName}" bu gruba birleştirilsin mi?`}
              onConfirm={() => {
                onMergeIntoThis(group.id, pendingMergeSource.id);
                setShowMerge(false);
                setPendingMergeSourceId(null);
              }}
              onCancel={() => setPendingMergeSourceId(null)}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {otherGroups.map(og => (
                <button
                  key={og.id}
                  onClick={() => setPendingMergeSourceId(og.id)}
                  className="text-left px-3 py-1.5 bg-slate-700/40 hover:bg-amber-500/10 border border-slate-600/30 hover:border-amber-500/30 rounded-lg text-xs text-slate-300 hover:text-amber-300 transition-colors"
                >
                  <span className="font-medium">{og.canonicalName}</span>
                  {og.synonyms.length > 0 && (
                    <span className="text-slate-500 ml-1">+ {og.synonyms.length} eş anlamlı</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Suggestion Card ───────────────────────────────────────────────────────
function AiSuggestionCard({
  group,
  onAccept,
  onDismiss,
}: {
  group: AiSuggestedGroup;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-indigo-950/40 rounded-xl border border-indigo-500/20 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-indigo-400/70 mb-0.5">Önerilen ana etiket</p>
          <h4 className="text-white font-semibold text-sm">{group.canonicalName}</h4>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onAccept}
            className="px-3 py-1 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-white text-xs font-medium transition-colors flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Kabul Et
          </button>
          <button
            onClick={onDismiss}
            className="px-2 py-1 bg-slate-700/60 hover:bg-slate-600/60 rounded-lg text-slate-400 hover:text-white text-xs transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.synonyms.map(s => (
          <SynonymBadge key={s} tag={s} />
        ))}
      </div>
    </div>
  );
}

// ─── Tag Counts Panel ─────────────────────────────────────────────────────────
function TagCountsPanel({ groups }: { groups: TagSynonymGroup[] }) {
  const [open, setOpen] = useState(false);
  const [ungroupedOnly, setUngroupedOnly] = useState(false);

  const { data: tagCounts } = useQuery<TagCount[]>({
    queryKey: ["/api/tag-taxonomy/tag-counts"],
    queryFn: () => apiFetch("/tag-taxonomy/tag-counts"),
    enabled: open,
  });

  const groupedTags = new Set(groups.flatMap(g => [g.canonicalName, ...g.synonyms]));

  // Sort numerically by count (DB returns string), filter by toggle
  const sortedCounts = tagCounts
    ? [...tagCounts]
        .sort((a, b) => Number(b.cnt) - Number(a.cnt))
        .filter(tc => !ungroupedOnly || !groupedTags.has(tc.tag))
    : [];

  const ungroupedCount = tagCounts
    ? tagCounts.filter(tc => !groupedTags.has(tc.tag)).length
    : 0;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">Etiket Kullanım Sayıları</span>
          {tagCounts && ungroupedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">
              {ungroupedCount} gruplandırılmamış
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-700/40 pt-3">
          {/* Filter toggle */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500">
              Yeşil = gruplandırılmış · Gri = henüz gruplandırılmamış
            </p>
            <button
              onClick={() => setUngroupedOnly(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                ungroupedOnly
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-slate-700/40 border-slate-600/30 text-slate-400 hover:text-slate-300"
              }`}
            >
              <span>{ungroupedOnly ? "Tümünü Göster" : "Sadece Gruplandırılmamış"}</span>
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {!tagCounts ? (
              <p className="text-xs text-slate-500">Yükleniyor…</p>
            ) : sortedCounts.length === 0 ? (
              <p className="text-xs text-slate-500">
                {ungroupedOnly ? "Tüm etiketler gruplandırılmış!" : "Henüz etiket yok."}
              </p>
            ) : (
              sortedCounts.map(tc => (
                <div
                  key={tc.tag}
                  className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs ${
                    groupedTags.has(tc.tag)
                      ? "bg-green-900/20 border border-green-700/20 text-green-300"
                      : "bg-slate-700/30 border border-slate-700/30 text-slate-300"
                  }`}
                >
                  <span className="font-medium truncate">{tc.tag}</span>
                  <span className="text-slate-500 shrink-0 ml-2">{Number(tc.cnt)}×</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TagTaxonomyPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/tag-taxonomy"] });

  const { data: groups = [], isLoading } = useQuery<TagSynonymGroup[]>({
    queryKey: ["/api/tag-taxonomy"],
    queryFn: () => apiFetch("/tag-taxonomy"),
  });

  const [showNewForm, setShowNewForm] = useState(false);
  const [newCanonical, setNewCanonical] = useState("");
  const [newSynonymInput, setNewSynonymInput] = useState("");
  const [newSynonyms, setNewSynonyms] = useState<string[]>([]);

  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestedGroup[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [search, setSearch] = useState("");

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { canonicalName: string; synonyms: string[] }) =>
      apiFetch("/tag-taxonomy", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast({ title: "Grup oluşturuldu" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { canonicalName?: string; synonyms?: string[] } }) =>
      apiFetch(`/tag-taxonomy/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast({ title: "Güncellendi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tag-taxonomy/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Grup silindi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, sourceId }: { targetId: number; sourceId: number }) =>
      apiFetch("/tag-taxonomy/merge", { method: "POST", body: JSON.stringify({ targetId, sourceId }) }),
    onSuccess: () => { invalidate(); toast({ title: "Gruplar birleştirildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!newCanonical.trim()) return;
    createMutation.mutate({ canonicalName: newCanonical.trim(), synonyms: newSynonyms });
    setNewCanonical("");
    setNewSynonyms([]);
    setNewSynonymInput("");
    setShowNewForm(false);
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const result = await apiFetch("/tag-taxonomy/ai-suggest", { method: "POST" });
      setAiSuggestions(result.groups ?? []);
      if ((result.groups ?? []).length === 0) {
        toast({ title: "AI önerisi yok", description: "Tüm etiketler zaten gruplandırılmış veya gruplandırılacak yeterli benzerlik bulunamadı." });
      }
    } catch (e: any) {
      toast({ title: "AI hatası", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const acceptAiSuggestion = (suggestion: AiSuggestedGroup) => {
    createMutation.mutate({ canonicalName: suggestion.canonicalName, synonyms: suggestion.synonyms });
    setAiSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  const handleNormalizeAll = async () => {
    setNormalizing(true);
    try {
      const result = await apiFetch("/tag-taxonomy/normalize-all", { method: "POST" });
      toast({ title: "Etiketler normalize edildi", description: `${result.updated} etkileşim kaydı güncellendi.` });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setNormalizing(false);
    }
  };

  const addNewSynonym = () => {
    const t = newSynonymInput.trim();
    if (t && !newSynonyms.includes(t)) {
      setNewSynonyms(prev => [...prev, t]);
      setNewSynonymInput("");
    }
  };

  const filteredGroups = groups.filter(g =>
    !search ||
    g.canonicalName.toLowerCase().includes(search.toLowerCase()) ||
    g.synonyms.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Tags className="w-6 h-6 text-indigo-400" />
              Etiket Taksonomi Yönetimi
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Semantik olarak benzer etiketleri gruplandır; AI analizleri bu sözlüğü kullanarak tutarlı etiketler üretir.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleNormalizeAll}
              disabled={normalizing || groups.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-600/60 disabled:opacity-40 rounded-lg text-slate-300 hover:text-white text-sm transition-colors border border-slate-600/40"
            >
              <RefreshCw className={`w-4 h-4 ${normalizing ? "animate-spin" : ""}`} />
              Hepsini Normalize Et
            </button>
            <button
              onClick={handleAiSuggest}
              disabled={aiLoading}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-40 rounded-lg text-white text-sm transition-colors"
            >
              <Sparkles className={`w-4 h-4 ${aiLoading ? "animate-pulse" : ""}`} />
              AI ile Grupla
            </button>
            <button
              onClick={() => setShowNewForm(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600/80 hover:bg-green-500 rounded-lg text-white text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni Grup
            </button>
          </div>
        </div>

        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Önerileri ({aiSuggestions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiSuggestions.map((s, i) => (
                <AiSuggestionCard
                  key={i}
                  group={s}
                  onAccept={() => acceptAiSuggestion(s)}
                  onDismiss={() => setAiSuggestions(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </div>
        )}

        {/* New group form */}
        {showNewForm && (
          <div className="bg-slate-800/60 rounded-xl border border-green-500/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-green-400">Yeni Etiket Grubu</h3>
            <div className="space-y-2">
              <input
                value={newCanonical}
                onChange={e => setNewCanonical(e.target.value)}
                placeholder="Ana etiket adı (canonical name)…"
                className="w-full bg-slate-700/60 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-green-500/50"
              />
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {newSynonyms.map(s => (
                  <SynonymBadge key={s} tag={s} onRemove={() => setNewSynonyms(prev => prev.filter(x => x !== s))} />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSynonymInput}
                  onChange={e => setNewSynonymInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addNewSynonym()}
                  placeholder="Eş anlamlı etiket ekle (Enter)…"
                  className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-green-500/50"
                />
                <button
                  onClick={addNewSynonym}
                  className="px-3 py-2 bg-slate-700/60 hover:bg-slate-600/60 rounded-lg text-slate-300 text-sm transition-colors border border-slate-600/40"
                >
                  Ekle
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={!newCanonical.trim() || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600/80 hover:bg-green-500 disabled:opacity-40 rounded-lg text-white text-sm transition-colors"
              >
                <Check className="w-4 h-4" /> Oluştur
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewCanonical(""); setNewSynonyms([]); setNewSynonymInput(""); }}
                className="px-4 py-2 bg-slate-700/60 hover:bg-slate-600/60 rounded-lg text-slate-400 hover:text-white text-sm transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Tag counts collapsible */}
        <TagCountsPanel groups={groups} />

        {/* Search */}
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Grup ara…"
            className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg px-4 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Groups grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">Yükleniyor…</div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
            <Tags className="w-8 h-8 opacity-30" />
            <p className="text-sm">
              {search ? "Arama sonucu bulunamadı." : "Henüz etiket grubu yok. \"AI ile Grupla\" veya \"Yeni Grup\" ile başlayın."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                allGroups={groups}
                onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                onDelete={(id) => deleteMutation.mutate(id)}
                onMergeIntoThis={(targetId, sourceId) => mergeMutation.mutate({ targetId, sourceId })}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
