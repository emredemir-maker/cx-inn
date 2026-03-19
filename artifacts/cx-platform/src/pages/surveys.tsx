import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, PageHeader, StatusBadge, Button, Input, Select, Label, Modal, LoadingScreen } from "@/components/ui-elements";
import { useSurveysList, useSurveyMutations } from "@/hooks/use-surveys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Plus, Trash2, Pause, Play, MessageSquareQuote, Mail, Copy, Check, Palette, Eye, Code2, X, Sparkles, Wand2, BarChart2, ThumbsUp, ThumbsDown, Minus, ClipboardList, GitBranch, FlaskConical, Send, ExternalLink, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { QuestionBuilder } from "@/components/question-builder";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiSuggestion {
  name: string;
  description: string;
  brandColor: string;
  bgColor: string;
  textColor: string;
  buttonStyle: "pill" | "rounded" | "square";
  headline: string;
  subheadline: string;
  footerNote: string;
}

interface EmailDesign {
  brandColor: string;
  logoUrl: string;
  companyName: string;
  headline: string;
  subheadline: string;
  footerNote: string;
  bgColor: string;
  textColor: string;
  buttonStyle: "rounded" | "pill" | "square";
  ratingStyle?: "emoji" | "stars" | "numbers" | "thumbs";
  npsStyle?: "color_numbers" | "minimal";
  blockOrder?: string[];
  hiddenBlocks?: string[];
}

const DEFAULT_BLOCK_ORDER = ["header", "headline", "subheadline", "score", "note"];

const BLOCK_META: Record<string, { label: string; icon: string; desc: (d: EmailDesign) => string }> = {
  header:      { label: "Marka Başlığı",  icon: "🏷️", desc: (d) => d.companyName || "Logo + Marka Adı" },
  headline:    { label: "Ana Başlık",     icon: "📝", desc: (d) => d.headline?.substring(0, 50) || "Başlık metni" },
  subheadline: { label: "Alt Başlık",     icon: "💬", desc: (d) => d.subheadline?.substring(0, 50) || "Alt başlık metni" },
  score:       { label: "Skor Butonları", icon: "⭐", desc: (_d) => "NPS / CSAT / CES butonları" },
  note:        { label: "Footer Notu",    icon: "📋", desc: (d) => d.footerNote?.substring(0, 50) || "Alt not" },
};

// ─── Default design per survey type ──────────────────────────────────────────

const defaultDesign = (type: string): EmailDesign => ({
  brandColor: "#3B82F6",
  logoUrl: "",
  companyName: "CX-Inn",
  headline:
    type === "NPS"
      ? "Bizi arkadaşlarınıza önerir misiniz?"
      : type === "CSAT"
      ? "Deneyiminizi nasıl değerlendirirsiniz?"
      : "Çözüm ne kadar kolaydı?",
  subheadline:
    "Geri bildiriminiz bizim için çok değerli. Yanıtlamak yalnızca birkaç saniye sürer.",
  footerNote:
    "Bu anketi almak istemiyorsanız aboneliğinizi iptal edebilirsiniz.",
  bgColor: "#0f172a",
  textColor: "#f1f5f9",
  buttonStyle: "pill",
});

// ─── Block-based HTML generators ─────────────────────────────────────────────

function logoHtml(d: EmailDesign): string {
  return d.logoUrl
    ? `<img src="${d.logoUrl}" alt="${d.companyName}" style="height:48px;max-width:200px;object-fit:contain;display:block;margin:0 auto 12px;" />`
    : `<div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;margin-bottom:4px;">${d.companyName}</div>`;
}

function blockHtml(type: string, blockId: string, d: EmailDesign): string {
  const r = d.buttonStyle === "pill" ? "50px" : d.buttonStyle === "rounded" ? "10px" : "2px";
  switch (blockId) {
    case "header":
      return `<tr><td style="background:linear-gradient(135deg,${d.brandColor}dd,${d.brandColor}88);padding:36px 40px;text-align:center;">${logoHtml(d)}<div style="width:40px;height:3px;background:rgba(255,255,255,0.5);margin:8px auto 0;border-radius:2px;"></div></td></tr>`;
    case "headline":
      return `<tr><td style="padding:32px 40px 0;text-align:center;"><p style="font-size:22px;font-weight:700;color:${d.textColor};margin:0;line-height:1.3;">${d.headline}</p></td></tr>`;
    case "subheadline":
      return `<tr><td style="padding:12px 40px 0;text-align:center;"><p style="font-size:15px;color:${d.textColor}99;margin:0;line-height:1.6;">${d.subheadline}</p></td></tr>`;
    case "score": {
      if (type === "NPS") {
        const npsStyle = (d as any).npsStyle ?? "color_numbers";
        const nums = Array.from({ length: 11 }, (_, i) => {
          const c = npsStyle === "color_numbers"
            ? (i <= 6 ? "#ef4444" : i <= 8 ? "#f59e0b" : "#22c55e")
            : d.textColor;
          const bg = npsStyle === "color_numbers" ? `${c}22` : "rgba(255,255,255,0.07)";
          const border = npsStyle === "color_numbers" ? `2px solid ${c}` : `1px solid rgba(255,255,255,0.18)`;
          return `<td style="padding:3px;"><a href="#" style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;background:${bg};color:${c};font-weight:700;font-size:15px;border:${border};border-radius:${r};text-decoration:none;">${i}</a></td>`;
        }).join("");
        return `<tr><td style="padding:28px 40px;text-align:center;"><table cellpadding="0" cellspacing="0" style="margin:0 auto 10px;"><tr>${nums}</tr></table><table cellpadding="0" cellspacing="0" style="margin:0 auto;width:390px;"><tr><td style="font-size:11px;color:#ef4444;text-align:left;">Kesinlikle önermem (0)</td><td style="font-size:11px;color:#22c55e;text-align:right;">Kesinlikle öneririm (10)</td></tr></table></td></tr>`;
      }
      if (type === "CSAT") {
        const ratingStyle = (d as any).ratingStyle ?? "emoji";
        if (ratingStyle === "stars") {
          const starColors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];
          const starCells = starColors.map((c, i) => {
            const stars = Array.from({ length: 5 }, (_, si) =>
              `<span style="color:${si <= i ? c : "rgba(255,255,255,0.15)"};font-size:22px;">★</span>`
            ).join("");
            return `<td style="padding:6px;text-align:center;"><a href="#" style="text-decoration:none;"><div style="padding:10px 8px;background:${c}10;border:2px solid ${c}30;border-radius:${r};margin-bottom:4px;">${stars}</div><div style="font-size:10px;color:${c};font-weight:600;">${i + 1} Yıldız</div></a></td>`;
          }).join("");
          return `<tr><td style="padding:28px 40px;text-align:center;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${starCells}</tr></table></td></tr>`;
        }
        if (ratingStyle === "numbers") {
          const numColors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];
          const numLabels = ["Çok Kötü", "Kötü", "Orta", "İyi", "Mükemmel"];
          const numCells = numLabels.map((lbl, i) => `<td style="padding:6px;text-align:center;"><a href="#" style="text-decoration:none;"><div style="width:60px;height:60px;line-height:60px;text-align:center;background:${numColors[i]}22;border:2px solid ${numColors[i]};border-radius:${r};font-weight:800;font-size:22px;color:${numColors[i]};margin-bottom:6px;">${i + 1}</div><div style="font-size:10px;color:${numColors[i]};font-weight:600;">${lbl}</div></a></td>`).join("");
          return `<tr><td style="padding:28px 40px;text-align:center;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${numCells}</tr></table></td></tr>`;
        }
        if (ratingStyle === "thumbs") {
          const thumbs = [
            { icon: "👎", label: "Kötü", c: "#ef4444" },
            { icon: "😐", label: "Orta", c: "#f59e0b" },
            { icon: "👍", label: "İyi", c: "#22c55e" },
          ];
          const thumbCells = thumbs.map((e) => `<td style="padding:12px;text-align:center;"><a href="#" style="text-decoration:none;"><div style="width:88px;height:88px;line-height:88px;text-align:center;background:${e.c}18;border:2px solid ${e.c}44;border-radius:${r};font-size:42px;margin-bottom:8px;">${e.icon}</div><div style="font-size:12px;color:${e.c};font-weight:700;">${e.label}</div></a></td>`).join("");
          return `<tr><td style="padding:28px 40px;text-align:center;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${thumbCells}</tr></table></td></tr>`;
        }
        // default: emoji
        const emojis = [
          { icon: "😡", label: "Çok Kötü", c: "#ef4444" }, { icon: "😕", label: "Kötü", c: "#f97316" },
          { icon: "😐", label: "Orta", c: "#f59e0b" }, { icon: "😊", label: "İyi", c: "#84cc16" },
          { icon: "😍", label: "Mükemmel", c: "#22c55e" },
        ];
        const cells = emojis.map((e) => `<td style="padding:8px;text-align:center;"><a href="#" style="text-decoration:none;"><div style="width:72px;height:72px;line-height:72px;text-align:center;background:${e.c}18;border:2px solid ${e.c}44;border-radius:${r};font-size:34px;margin-bottom:8px;">${e.icon}</div><div style="font-size:11px;color:${e.c};font-weight:600;">${e.label}</div></a></td>`).join("");
        return `<tr><td style="padding:28px 40px;text-align:center;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${cells}</tr></table></td></tr>`;
      }
      // CES
      const labels = ["Çok Zor", "Zor", "Orta", "Kolay", "Çok Kolay"];
      const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];
      const cells2 = labels.map((lbl, i) => `<td style="padding:4px;text-align:center;"><a href="#" style="text-decoration:none;"><div style="width:80px;height:48px;line-height:48px;text-align:center;background:${colors[i]}18;border:2px solid ${colors[i]}44;border-radius:${r};font-weight:800;font-size:18px;color:${colors[i]};margin-bottom:6px;">${i + 1}</div><div style="font-size:10px;color:${colors[i]};font-weight:600;">${lbl}</div></a></td>`).join("");
      return `<tr><td style="padding:28px 40px;text-align:center;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${cells2}</tr></table></td></tr>`;
    }
    case "note":
      return `<tr><td style="padding:0 40px 32px;text-align:center;"><p style="font-size:13px;color:${d.textColor}55;margin:0;">${d.footerNote}</p></td></tr>`;
    default:
      return "";
  }
}

function generateHtml(type: string, design: EmailDesign): string {
  const order = design.blockOrder ?? DEFAULT_BLOCK_ORDER;
  const hidden = new Set(design.hiddenBlocks ?? []);
  const blocks = order.filter((b) => !hidden.has(b));
  const innerRows = blocks.map((b) => blockHtml(type, b, design)).join("\n");
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#111827;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:${design.bgColor};border-radius:16px;overflow:hidden;max-width:600px;border:1px solid rgba(255,255,255,0.08);">
${innerRows}
<tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;"><p style="font-size:12px;color:${design.textColor}44;margin:0;">© 2026 ${design.companyName} — Müşteri Deneyimi Platformu</p></td></tr>
</table></td></tr></table></body></html>`;
}

// ─── Email Design Modal ───────────────────────────────────────────────────────

interface EmailDesignModalProps {
  survey: { id: number; title: string; type: string; emailDesign?: any } | null;
  onClose: () => void;
  onSave: (id: number, design: EmailDesign) => void;
}

function EmailDesignModal({ survey, onClose, onSave }: EmailDesignModalProps) {
  const [design, setDesign] = useState<EmailDesign>(defaultDesign("NPS"));
  const [leftTab, setLeftTab] = useState<"ai" | "blocks" | "manual">("blocks");
  const [dragBlockIdx, setDragBlockIdx] = useState<number | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState("profesyonel");
  const { toast } = useToast();
  const { data: companySettings } = useCompanySettings();

  useEffect(() => {
    if (survey) {
      const base = defaultDesign(survey.type);
      // Pre-populate with company settings if not already customized
      if (companySettings) {
        base.companyName = companySettings.companyName ?? base.companyName;
        base.logoUrl = companySettings.logoUrl ?? base.logoUrl;
        base.brandColor = companySettings.primaryColor ?? base.brandColor;
      }
      setDesign(
        survey.emailDesign
          ? { ...base, ...survey.emailDesign }
          : base
      );
      setAiSuggestions([]);
      setAppliedIdx(null);
    }
  }, [survey?.id, companySettings?.companyName]);

  if (!survey) return null;

  const html = generateHtml(survey.type, design);
  const set = (key: keyof EmailDesign, value: string) =>
    setDesign((prev) => ({ ...prev, [key]: value }));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "HTML kopyalandı" });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(survey.id, design);
    setSaving(false);
    toast({ title: "Tasarım kaydedildi" });
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/surveys/ai-design-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyType: survey.type,
          companyName: design.companyName,
          industry: industry || undefined,
          tone,
        }),
      });
      const data = await res.json();
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setAiSuggestions(data.suggestions);
      } else {
        toast({ title: "Öneri alınamadı", description: data.error || "Tekrar deneyin." });
      }
    } catch (e) {
      toast({ title: "Hata", description: String(e) });
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (s: AiSuggestion, idx: number) => {
    setDesign((prev) => ({
      ...prev,
      brandColor: s.brandColor,
      bgColor: s.bgColor,
      textColor: s.textColor,
      buttonStyle: s.buttonStyle,
      headline: s.headline,
      subheadline: s.subheadline,
      footerNote: s.footerNote,
    }));
    setAppliedIdx(idx);
    toast({ title: `"${s.name}" uygulandı`, description: "Önizleme güncellendi." });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col w-full h-full overflow-hidden bg-background">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">E-posta Tasarımı</h2>
              <p className="text-xs text-muted-foreground">{survey.title} · {survey.type} Anketi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleCopy} className="gap-2">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? "Kopyalandı!" : "HTML Kopyala"}
            </Button>
            <Button onClick={handleSave} isLoading={saving}>Tasarımı Kaydet</Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left Panel ── */}
          <div className="w-96 flex-shrink-0 border-r border-border/50 bg-card/50 flex flex-col overflow-hidden">

            {/* Left tab bar */}
            <div className="flex border-b border-border/50 flex-shrink-0">
              {([
                { key: "blocks" as const, label: "Bloklar", icon: <ClipboardList className="h-3.5 w-3.5" /> },
                { key: "ai" as const, label: "AI Öneriler", icon: <Sparkles className="h-3.5 w-3.5" /> },
                { key: "manual" as const, label: "Stil", icon: <Palette className="h-3.5 w-3.5" /> },
              ]).map((t) => (
                <button key={t.key} onClick={() => setLeftTab(t.key)}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors",
                    leftTab === t.key
                      ? "text-primary border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5")}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* ── Bloklar Tab ── */}
            {leftTab === "blocks" && (() => {
              const blockOrder = design.blockOrder ?? DEFAULT_BLOCK_ORDER;
              const hiddenSet = new Set(design.hiddenBlocks ?? []);

              const reorder = (fromIdx: number, toIdx: number) => {
                const newOrder = [...blockOrder];
                const [moved] = newOrder.splice(fromIdx, 1);
                newOrder.splice(toIdx, 0, moved);
                setDesign((d) => ({ ...d, blockOrder: newOrder }));
              };
              const toggleHide = (blockId: string) => {
                const hs = new Set(design.hiddenBlocks ?? []);
                if (hs.has(blockId)) hs.delete(blockId); else hs.add(blockId);
                setDesign((d) => ({ ...d, hiddenBlocks: Array.from(hs) }));
              };

              return (
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-3 mb-3">
                    <p className="text-xs text-indigo-300 font-medium">Blokları sürükleyerek sıralayın. Göz ikonuyla göster/gizle.</p>
                  </div>

                  {blockOrder.map((blockId, idx) => {
                    const meta = BLOCK_META[blockId];
                    if (!meta) return null;
                    const isHidden = hiddenSet.has(blockId);
                    const isExpanded = expandedBlock === blockId;
                    const isLocked = blockId === "header";

                    return (
                      <div key={blockId}
                        draggable={!isLocked}
                        onDragStart={(e) => { setDragBlockIdx(idx); e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={(e) => { e.preventDefault(); if (dragBlockIdx !== null && dragBlockIdx !== idx) reorder(dragBlockIdx, idx); setDragBlockIdx(null); }}
                        onDragEnd={() => setDragBlockIdx(null)}
                        className={cn("rounded-xl border transition-all",
                          dragBlockIdx === idx ? "opacity-40 scale-95" : "",
                          isHidden ? "border-border/20 bg-white/[0.01] opacity-50" : "border-border/40 bg-white/[0.03] hover:border-border/60")}>
                        {/* Block header row */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          {/* Drag handle */}
                          {!isLocked ? (
                            <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing select-none text-lg leading-none">⠿</span>
                          ) : (
                            <span className="text-muted-foreground/20 text-lg leading-none select-none">🔒</span>
                          )}
                          <span className="text-base select-none">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-semibold", isHidden ? "text-muted-foreground/50" : "text-foreground")}>{meta.label}</p>
                            <p className="text-[10px] text-muted-foreground/60 truncate">{meta.desc(design)}</p>
                          </div>
                          {/* Expand button (for editable blocks) */}
                          {!isHidden && (
                            <button type="button" onClick={() => setExpandedBlock(isExpanded ? null : blockId)}
                              className="text-muted-foreground/50 hover:text-primary transition-colors p-1 rounded"
                              title="Düzenle">
                              <Wand2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Toggle visibility */}
                          {!isLocked && (
                            <button type="button" onClick={() => toggleHide(blockId)}
                              className={cn("transition-colors p-1 rounded", isHidden ? "text-muted-foreground/30 hover:text-muted-foreground" : "text-muted-foreground/60 hover:text-destructive")}
                              title={isHidden ? "Göster" : "Gizle"}>
                              {isHidden ? <Eye className="h-3.5 w-3.5" /> : <X className="h-3 w-3" />}
                            </button>
                          )}
                        </div>

                        {/* Inline editor for expanded block */}
                        {isExpanded && !isHidden && (
                          <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-2">
                            {blockId === "header" && (
                              <>
                                <input value={design.companyName} onChange={(e) => set("companyName", e.target.value)}
                                  placeholder="Şirket adı" className="w-full h-8 px-2.5 rounded-lg bg-white/5 border border-border/50 text-foreground text-xs focus:outline-none focus:border-primary/50" />
                                <input value={design.logoUrl} onChange={(e) => set("logoUrl", e.target.value)}
                                  placeholder="Logo URL (opsiyonel)" className="w-full h-8 px-2.5 rounded-lg bg-white/5 border border-border/50 text-foreground text-xs focus:outline-none focus:border-primary/50" />
                              </>
                            )}
                            {blockId === "headline" && (
                              <textarea value={design.headline} onChange={(e) => set("headline", e.target.value)}
                                rows={2} className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-border/50 text-foreground text-xs resize-none focus:outline-none focus:border-primary/50" />
                            )}
                            {blockId === "subheadline" && (
                              <textarea value={design.subheadline} onChange={(e) => set("subheadline", e.target.value)}
                                rows={2} className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-border/50 text-foreground text-xs resize-none focus:outline-none focus:border-primary/50" />
                            )}
                            {blockId === "note" && (
                              <textarea value={design.footerNote} onChange={(e) => set("footerNote", e.target.value)}
                                rows={2} className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-border/50 text-foreground text-xs resize-none focus:outline-none focus:border-primary/50" />
                            )}
                            {blockId === "score" && survey.type === "CSAT" && (
                              <div className="space-y-2">
                                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">CSAT Puanlama Stili</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {([
                                    { value: "emoji", label: "Emoji 😍😡" },
                                    { value: "stars", label: "Yıldız ★★★★★" },
                                    { value: "numbers", label: "Sayı  1 2 3 4 5" },
                                    { value: "thumbs", label: "Thumbs 👍😐👎" },
                                  ] as const).map((opt) => (
                                    <button key={opt.value} type="button"
                                      onClick={() => setDesign((d) => ({ ...d, ratingStyle: opt.value }))}
                                      className={cn("px-2 py-1.5 rounded-lg border text-xs font-medium transition-all text-left",
                                        (design.ratingStyle ?? "emoji") === opt.value
                                          ? "border-primary bg-primary/15 text-primary"
                                          : "border-border/30 bg-white/[0.02] text-muted-foreground hover:border-border hover:text-foreground")}>
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {blockId === "score" && survey.type === "NPS" && (
                              <div className="space-y-2">
                                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">NPS Renk Şeması</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {([
                                    { value: "color_numbers", label: "🎨 Renkli (0-10)" },
                                    { value: "minimal", label: "◻ Minimal" },
                                  ] as const).map((opt) => (
                                    <button key={opt.value} type="button"
                                      onClick={() => setDesign((d) => ({ ...d, npsStyle: opt.value }))}
                                      className={cn("px-2 py-1.5 rounded-lg border text-xs font-medium transition-all text-left",
                                        (design.npsStyle ?? "color_numbers") === opt.value
                                          ? "border-primary bg-primary/15 text-primary"
                                          : "border-border/30 bg-white/[0.02] text-muted-foreground hover:border-border hover:text-foreground")}>
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground/50">Minimal: Kurumsal NPS anketleri için emoji ve renk kodlamasız sade görünüm</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground/40 text-center">Kilitli bloklar (🔒) sabit konumda kalır</p>
                  </div>
                </div>
              );
            })()}

            {/* ── AI Tab ── */}
            {leftTab === "ai" && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                    <Wand2 className="h-4 w-4" /> Gemini ile Tasarım Önerisi
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sektörünüzü ve iletişim tonunuzu belirtin. Gemini anket türüne özel 3 farklı renk paleti ve metin önerisi oluşturacak.
                  </p>
                </div>

                <div>
                  <Label>Sektörünüz (opsiyonel)</Label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Örn: Fintech, E-ticaret, SaaS, Sağlık"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label>İletişim Tonu</Label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {[
                      { value: "profesyonel", label: "Profesyonel" },
                      { value: "samimi ve sıcak", label: "Samimi & Sıcak" },
                      { value: "modern ve dinamik", label: "Modern & Dinamik" },
                      { value: "kurumsal ve güvenilir", label: "Kurumsal" },
                      { value: "minimalist", label: "Minimalist" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTone(opt.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                          tone === opt.value
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/50 bg-white/5 text-muted-foreground hover:border-border hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAiSuggest} isLoading={aiLoading} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  {aiLoading ? "Gemini analiz ediyor…" : "3 Tasarım Önerisi Oluştur"}
                </Button>

                {/* Loading skeleton */}
                {aiLoading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-xl border border-border/30 p-4 animate-pulse">
                        <div className="flex gap-2 mb-3">
                          <div className="w-5 h-5 rounded-full bg-white/10" />
                          <div className="w-5 h-5 rounded-full bg-white/10" />
                          <div className="w-5 h-5 rounded-full bg-white/10" />
                          <div className="flex-1 h-4 bg-white/10 rounded ml-2" />
                        </div>
                        <div className="h-3 bg-white/10 rounded mb-2" />
                        <div className="h-3 bg-white/10 rounded w-3/4 mb-3" />
                        <div className="h-8 bg-white/10 rounded" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestion cards */}
                {!aiLoading && aiSuggestions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">
                      Bir öneri seçip tıklayın:
                    </p>
                    {aiSuggestions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => applySuggestion(s, i)}
                        className={cn(
                          "rounded-xl border p-4 cursor-pointer transition-all",
                          appliedIdx === i
                            ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                            : "border-border/40 bg-white/[0.02] hover:border-border/60 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex gap-1">
                            <div className="w-5 h-5 rounded-full ring-2 ring-white/10" style={{ background: s.brandColor }} />
                            <div className="w-5 h-5 rounded-full ring-2 ring-white/10" style={{ background: s.bgColor }} />
                            <div className="w-5 h-5 rounded-full ring-2 ring-white/10" style={{ background: s.textColor }} />
                          </div>
                          <span className="flex-1 text-sm font-bold text-foreground">{s.name}</span>
                          {appliedIdx === i ? (
                            <span className="text-xs font-bold text-primary flex items-center gap-1">
                              <Check className="h-3 w-3" /> Uygulandı
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Uygula →</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {s.description}
                        </p>
                        <p className="text-xs text-foreground/80 italic bg-white/[0.03] rounded-lg px-3 py-2 leading-relaxed">
                          "{s.headline}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!aiLoading && aiSuggestions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Öneriler burada görünecek</p>
                    <p className="text-xs mt-1 opacity-70">Yukarıdaki butona tıklayın</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Manual Tab ── */}
            {leftTab === "manual" && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Palette className="h-3.5 w-3.5" /> Renk & Stil
                </p>

                <div>
                  <Label>Marka Rengi</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="color"
                      value={design.brandColor}
                      onChange={(e) => set("brandColor", e.target.value)}
                      className="h-10 w-14 rounded-lg border border-border/50 bg-transparent cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={design.brandColor}
                      onChange={(e) => set("brandColor", e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Arkaplan</Label>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input type="color" value={design.bgColor} onChange={(e) => set("bgColor", e.target.value)} className="h-9 w-10 rounded-lg border border-border/50 bg-transparent cursor-pointer p-0.5" />
                      <input type="text" value={design.bgColor} onChange={(e) => set("bgColor", e.target.value)} className="flex-1 min-w-0 h-9 px-2 rounded-xl bg-white/5 border border-border/50 text-foreground text-xs font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label>Metin</Label>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input type="color" value={design.textColor} onChange={(e) => set("textColor", e.target.value)} className="h-9 w-10 rounded-lg border border-border/50 bg-transparent cursor-pointer p-0.5" />
                      <input type="text" value={design.textColor} onChange={(e) => set("textColor", e.target.value)} className="flex-1 min-w-0 h-9 px-2 rounded-xl bg-white/5 border border-border/50 text-foreground text-xs font-mono" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Buton Şekli</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {(["pill", "rounded", "square"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => set("buttonStyle", style)}
                        className={cn(
                          "h-9 text-xs font-semibold border transition-colors",
                          style === "pill" ? "rounded-full" : style === "rounded" ? "rounded-lg" : "rounded-none",
                          design.buttonStyle === style
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-white/5 border-border/50 text-muted-foreground hover:border-border"
                        )}
                      >
                        {style === "pill" ? "Oval" : style === "rounded" ? "Yuvarlak" : "Kare"}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-border/30" />

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">İçerik</p>

                <div>
                  <Label>Logo URL (opsiyonel)</Label>
                  <Input value={design.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." className="mt-1.5" />
                </div>

                <div>
                  <Label>Şirket / Marka Adı</Label>
                  <Input value={design.companyName} onChange={(e) => set("companyName", e.target.value)} className="mt-1.5" />
                </div>

                <div>
                  <Label>Başlık</Label>
                  <textarea
                    value={design.headline}
                    onChange={(e) => set("headline", e.target.value)}
                    rows={2}
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm resize-none focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div>
                  <Label>Alt Başlık</Label>
                  <textarea
                    value={design.subheadline}
                    onChange={(e) => set("subheadline", e.target.value)}
                    rows={2}
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm resize-none focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div>
                  <Label>Footer Notu</Label>
                  <textarea
                    value={design.footerNote}
                    onChange={(e) => set("footerNote", e.target.value)}
                    rows={2}
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm resize-none focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Right Panel: Preview / Code ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#111827]">
            {/* Preview tab bar */}
            <div className="flex items-center gap-1 px-6 pt-4 pb-0 flex-shrink-0">
              <button
                onClick={() => setPreviewTab("preview")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors",
                  previewTab === "preview"
                    ? "bg-card border-border/50 text-foreground"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="h-4 w-4" /> Önizleme
              </button>
              <button
                onClick={() => setPreviewTab("code")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors",
                  previewTab === "code"
                    ? "bg-card border-border/50 text-foreground"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="h-4 w-4" /> HTML Kodu
              </button>
              <div className="flex-1 border-b border-border/50" />
            </div>

            {previewTab === "preview" && (
              <div className="flex-1 overflow-hidden p-6">
                <iframe
                  srcDoc={html}
                  className="w-full h-full rounded-xl border border-border/30"
                  sandbox="allow-same-origin"
                  title="E-posta Önizlemesi"
                />
              </div>
            )}

            {previewTab === "code" && (
              <div className="flex-1 overflow-hidden p-6">
                <div className="relative h-full">
                  <button
                    onClick={handleCopy}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/20 border border-primary/30 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                  <pre className="h-full overflow-auto bg-[#0a0f1a] rounded-xl border border-border/30 p-4 text-xs text-slate-300 font-mono leading-relaxed">
                    {html}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Record Response Modal ────────────────────────────────────────────────────

function RecordResponseModal({
  survey,
  onClose,
}: {
  survey: { id: number; title: string; type: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);
  const [tab, setTab] = useState<"add" | "list">("add");

  const isNps = survey.type === "NPS";
  const scores = isNps
    ? Array.from({ length: 11 }, (_, i) => i)
    : [1, 2, 3, 4, 5];

  useEffect(() => {
    fetch(`/api/survey-responses?surveyId=${survey.id}`)
      .then((r) => r.json())
      .then((d) => setResponses(d.responses ?? []));
  }, [survey.id]);

  const handleSave = async () => {
    if (score === null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/survey-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: survey.id, score, feedback }),
      });
      if (!res.ok) throw new Error("Yanıt kaydedilemedi");
      const newResp = await res.json();
      setResponses((prev) => [newResp, ...prev]);
      setScore(null);
      setFeedback("");
      qc.invalidateQueries({ queryKey: ["/api/survey-responses/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: `Yanıt kaydedildi (skor: ${score})` });
      setTab("list");
    } catch (e: any) {
      toast({ title: "Hata", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const scoreColor = (s: number) => {
    if (isNps) return s >= 9 ? "text-success" : s >= 7 ? "text-warning" : "text-destructive";
    return s >= 4 ? "text-success" : s >= 3 ? "text-warning" : "text-destructive";
  };

  const sentimentIcon = (sentiment: string) => {
    if (sentiment === "positive") return <ThumbsUp className="h-3.5 w-3.5 text-success" />;
    if (sentiment === "negative") return <ThumbsDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-warning" />;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border/50 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="font-bold text-foreground">{survey.title}</h2>
            <p className="text-xs text-muted-foreground">{survey.type} Yanıtları</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 px-5 pt-3 gap-1">
          <button
            onClick={() => setTab("add")}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors",
              tab === "add" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2"><Plus className="h-3.5 w-3.5" /> Yanıt Ekle</span>
          </button>
          <button
            onClick={() => setTab("list")}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors",
              tab === "list" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5" /> Tüm Yanıtlar ({responses.length})</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "add" && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">
                  {isNps ? "0-10 arası puan seçin" : "1-5 arası puan seçin"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {scores.map((s) => (
                    <button
                      key={s}
                      onClick={() => setScore(s)}
                      className={cn(
                        "w-10 h-10 rounded-xl border text-sm font-bold transition-all",
                        score === s
                          ? "border-primary bg-primary text-white scale-110"
                          : "border-border/50 bg-white/5 hover:border-primary/50 text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {score !== null && (
                  <p className={cn("text-sm font-semibold mt-2", scoreColor(score))}>
                    Seçili skor: {score} — {
                      isNps
                        ? score >= 9 ? "Promoter" : score >= 7 ? "Passive" : "Detractor"
                        : score >= 4 ? "Memnun" : score >= 3 ? "Nötr" : "Memnun Değil"
                    }
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">
                  Geri Bildirim (Opsiyonel)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="Müşteri yorumu veya niteliksel geri bildirim..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-border/50 text-foreground text-sm resize-none focus:outline-none focus:border-primary/50"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={score === null}
                isLoading={saving}
                className="w-full"
              >
                Yanıtı Kaydet
              </Button>
            </div>
          )}

          {tab === "list" && (
            <div className="space-y-2">
              {responses.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Henüz yanıt bulunmuyor.
                </div>
              )}
              {responses.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-border/30">
                  <div className={cn("text-xl font-bold w-10 text-center flex-shrink-0", scoreColor(r.score))}>
                    {r.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    {r.feedback && <p className="text-sm text-foreground leading-relaxed">{r.feedback}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {sentimentIcon(r.sentiment)}
                      <span className="text-xs text-muted-foreground">{r.sentiment}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.respondedAt).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Test Send Modal ──────────────────────────────────────────────────────────

type TestSend = {
  id: number;
  email: string;
  status: string;
  sentAt: string;
  viewedAt: string | null;
  completedAt: string | null;
  score: string | null;
  feedback: string | null;
  token: string;
};

function TestSendModal({ survey, onClose }: { survey: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ surveyUrl?: string; emailSent?: boolean; emailError?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: sends, refetch } = useQuery<TestSend[]>({
    queryKey: [`/api/surveys/${survey.id}/test-sends`],
    queryFn: () => fetch(`/api/surveys/${survey.id}/test-sends`).then((r) => r.json()),
    refetchInterval: 5000,
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setLastResult(data);
      setEmail("");
      refetch();
      if (data.emailSent) toast({ title: "Test e-postası gönderildi!", description: email });
    } catch {
      toast({ title: "Gönderim hatası", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusIcon = (s: string) => {
    if (s === "completed") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (s === "viewed") return <Clock className="h-4 w-4 text-amber-400" />;
    return <Send className="h-4 w-4 text-blue-400" />;
  };
  const statusLabel = (s: string) =>
    s === "completed" ? "Tamamlandı" : s === "viewed" ? "Görüntülendi" : "Gönderildi";

  const devDomain = (window as any).__REPLIT_DEV_DOMAIN;
  const baseUrl = devDomain ? `https://${devDomain}` : window.location.origin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/10">
              <FlaskConical className="h-5 w-5 text-amber-400" />
            </span>
            <div>
              <p className="font-semibold text-white">Test Gönder</p>
              <p className="text-xs text-slate-400">{survey.title} · {survey.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info banner */}
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-200/80 text-sm">
              Test yanıtları <strong className="text-amber-300">gerçek analizlere dahil edilmez</strong>.
              Anket tasarımını e-posta'da önizlemek için kullanın.
            </p>
          </div>

          {/* Send form */}
          <form onSubmit={handleSend} className="flex gap-3">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="test@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={sending || !email} className="shrink-0 gap-2">
              {sending ? (
                <><Send className="h-4 w-4 animate-pulse" /> Gönderiliyor...</>
              ) : (
                <><Send className="h-4 w-4" /> Test Gönder</>
              )}
            </Button>
          </form>

          {/* Result feedback */}
          {lastResult && (
            <div className={cn(
              "px-4 py-3 rounded-xl border text-sm space-y-2",
              lastResult.emailSent
                ? "bg-green-500/10 border-green-500/20"
                : "bg-slate-800 border-slate-700"
            )}>
              {lastResult.emailSent ? (
                <p className="text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> E-posta başarıyla gönderildi!
                </p>
              ) : (
                <p className="text-slate-400">{lastResult.emailError}</p>
              )}
              {lastResult.surveyUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={lastResult.surveyUrl.replace(/^https?:\/\/[^/]+/, baseUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 truncate"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    Anketi aç
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(lastResult.surveyUrl!.replace(/^https?:\/\/[^/]+/, baseUrl))}
                    className="text-slate-400 hover:text-slate-200 transition-colors ml-auto shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Past test sends */}
          {sends && sends.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-400 mb-3">Önceki Test Gönderimleri</p>
              <div className="space-y-2">
                {[...sends].reverse().map((s) => {
                  const respondUrl = `${baseUrl}/survey/${s.token}`;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl">
                      {statusIcon(s.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{s.email}</p>
                        <p className="text-xs text-slate-500">
                          {statusLabel(s.status)}
                          {s.score != null && <> · Skor: <span className="text-indigo-400 font-semibold">{s.score}</span></>}
                          {s.completedAt && <> · {new Date(s.completedAt).toLocaleString("tr-TR")}</>}
                        </p>
                      </div>
                      <a
                        href={respondUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-slate-200 transition-colors shrink-0"
                        title="Anketi aç"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sends && sends.length === 0 && !lastResult && (
            <p className="text-center text-slate-600 text-sm py-4">
              Henüz test gönderimi yok.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Surveys Page ────────────────────────────────────────────────────────

export default function Surveys() {
  const { data: surveys, isLoading } = useSurveysList();
  const { create, update, remove } = useSurveyMutations();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [designSurvey, setDesignSurvey] = useState<any | null>(null);
  const [responseSurvey, setResponseSurvey] = useState<any | null>(null);
  const [questionSurvey, setQuestionSurvey] = useState<any | null>(null);
  const [testSendSurvey, setTestSendSurvey] = useState<any | null>(null);

  const { data: responseSummary } = useQuery({
    queryKey: ["/api/survey-responses/summary"],
    queryFn: () => fetch("/api/survey-responses/summary").then((r) => r.json()),
    refetchInterval: 30000,
  });
  const [formData, setFormData] = useState({
    title: "",
    type: "NPS",
    channel: "email",
    triggerEvent: "",
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { data: formData as any },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setFormData({ title: "", type: "NPS", channel: "email", triggerEvent: "" });
        },
      }
    );
  };

  const handleSaveDesign = async (id: number, design: EmailDesign) => {
    await new Promise<void>((resolve) => {
      update.mutate(
        { id, data: { emailDesign: design } as any },
        { onSuccess: () => resolve(), onError: () => resolve() }
      );
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active": return "success";
      case "paused": return "warning";
      case "completed": return "default";
      case "draft": return "outline";
      default: return "default";
    }
  };

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <>
    <Layout>
      <PageHeader
        title="Anket Yönetimi"
        description="Çok kanallı CX anketlerini oluşturun, tasarlayın ve yönetin."
      >
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Yeni Anket
        </Button>
      </PageHeader>

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-white/[0.02]">
              <th className="p-4 text-sm font-semibold text-muted-foreground">Anket Adı</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Tür</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Kanal</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground">Durum</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground text-center">Yanıtlar</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground text-center">Skor</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {surveys?.map((survey) => (
              <tr
                key={survey.id}
                className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <MessageSquareQuote className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{survey.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Tetikleyici: {survey.triggerEvent || "Manuel"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <StatusBadge status={survey.type} variant="primary" />
                </td>
                <td className="p-4 capitalize text-sm">{survey.channel}</td>
                <td className="p-4">
                  <StatusBadge
                    status={
                      survey.status === "active"
                        ? "Aktif"
                        : survey.status === "paused"
                        ? "Duraklatıldı"
                        : survey.status === "draft"
                        ? "Taslak"
                        : "Tamamlandı"
                    }
                    variant={getStatusVariant(survey.status)}
                  />
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => setResponseSurvey(survey)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-primary/10 border border-border/30 hover:border-primary/30 transition-colors text-sm font-semibold text-foreground hover:text-primary"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    {responseSummary?.[survey.id]?.total ?? 0}
                  </button>
                </td>
                <td className="p-4 text-center font-mono font-bold text-primary">
                  {responseSummary?.[survey.id]?.avgScore ?? "-"}
                </td>
                <td className="p-4 text-right space-x-1">
                  <Button
                    variant="ghost"
                    className="p-2 h-auto"
                    title="Test Gönder"
                    onClick={() => setTestSendSurvey(survey)}
                  >
                    <FlaskConical className="h-4 w-4 text-amber-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="p-2 h-auto"
                    title="Soru Akışı & Skip Logic"
                    onClick={() => setQuestionSurvey(survey)}
                  >
                    <GitBranch className="h-4 w-4 text-violet-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="p-2 h-auto"
                    title="E-posta Tasarımı"
                    onClick={() => setDesignSurvey(survey)}
                  >
                    <Mail className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="p-2 h-auto"
                    onClick={() =>
                      update.mutate({
                        id: survey.id,
                        data: { status: survey.status === "active" ? "paused" : "active" },
                      })
                    }
                  >
                    {survey.status === "active" ? (
                      <Pause className="h-4 w-4 text-warning" />
                    ) : (
                      <Play className="h-4 w-4 text-success" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="p-2 h-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => remove.mutate({ id: survey.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {(!surveys || surveys.length === 0) && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Henüz anket bulunmuyor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Anket Oluştur">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Anket Adı</Label>
            <Input
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Örn: Q3 Müşteri Memnuniyeti"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Anket Türü</Label>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="NPS">NPS (Net Promoter Score)</option>
                <option value="CSAT">CSAT (Müşteri Memnuniyeti)</option>
                <option value="CES">CES (Müşteri Efor Skoru)</option>
              </Select>
            </div>
            <div>
              <Label>İletişim Kanalı</Label>
              <Select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              >
                <option value="email">E-posta</option>
                <option value="web">Web Sitesi</option>
                <option value="sms">SMS</option>
                <option value="in-app">Mobil Uygulama (In-App)</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Tetikleyici Olay (Opsiyonel)</Label>
            <Input
              value={formData.triggerEvent}
              onChange={(e) => setFormData({ ...formData, triggerEvent: e.target.value })}
              placeholder="Örn: ticket_close"
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              İptal
            </Button>
            <Button type="submit" isLoading={create.isPending}>
              Oluştur
            </Button>
          </div>
        </form>
      </Modal>

    </Layout>

    {/* Question Builder Modal */}
    {questionSurvey && (
      <QuestionBuilder
        survey={questionSurvey}
        onClose={() => setQuestionSurvey(null)}
      />
    )}

    {/* Email Design Modal — rendered outside Layout to escape stacking contexts */}
    {designSurvey && (
      <EmailDesignModal
        survey={designSurvey}
        onClose={() => setDesignSurvey(null)}
        onSave={handleSaveDesign}
      />
    )}

    {/* Record Response Modal */}
    {responseSurvey && (
      <RecordResponseModal
        survey={responseSurvey}
        onClose={() => setResponseSurvey(null)}
      />
    )}

    {/* Test Send Modal */}
    {testSendSurvey && (
      <TestSendModal
        survey={testSendSurvey}
        onClose={() => setTestSendSurvey(null)}
      />
    )}
  </>
  );
}
