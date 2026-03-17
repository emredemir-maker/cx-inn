import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────── Definitions ───────────────────────── */

export interface MetricDefinition {
  name: string;
  short: string;
  formula?: string;
  scale?: string;
  goodRange?: string;
  source?: string;
  note?: string;
}

export const METRIC_DEFS: Record<string, MetricDefinition> = {
  nps: {
    name: "Tahmin NPS (Bireysel Skor, 0–10)",
    short: "Gemini AI'ın bir müşterinin NPS anketinde vereceği puanı tahmin ettiği bireysel skor. 9–10: Destekleyici · 7–8: Pasif · 0–6: Eleştirmen",
    formula: "Gemini AI → etkileşim içeriği → 0–10 tahmin skoru",
    scale: "0 (en kötü) → 5 (nötr) → 10 (mükemmel)",
    goodRange: "9–10 Destekleyici · 7–8 Pasif · 0–6 Eleştirmen",
    source: "Gemini AI etkileşim analizinden tahmin edilir",
    note: "Bu değer gerçek anket ölçümü değil, AI tahminidir. Klasik kurumsal NPS (−100/+100), anket yanıtları biriktikçe AI Tahmin Doğruluğu bölümünde hesaplanır.",
  },
  csat: {
    name: "Customer Satisfaction Score (CSAT)",
    short: "Belirli bir etkileşim veya deneyimden sonra müşterinin genel memnuniyetini ölçer.",
    formula: "Memnun Yanıtlar / Toplam Yanıtlar × 5",
    scale: "1 (çok memnuniyetsiz) → 3 (orta) → 5 (çok memnun)",
    goodRange: "3.5+ kabul edilebilir · 4.0+ iyi · 4.5+ mükemmel",
    source: "Gemini AI etkileşim analizinden tahmin edilir",
    note: "Bu değer gerçek anket ölçümü değil, AI tahminidir.",
  },
  churnRisk: {
    name: "Churn Riski",
    short: "Yakın gelecekte ürün veya hizmeti terk etme olasılığı yüksek olan müşterilerin sayısı.",
    formula: "AI, negatif etkileşim yoğunluğu ve düşük NPS/CSAT kombinasyonunu analiz eder",
    scale: "Düşük · Orta · Yüksek (kritik)",
    goodRange: "Yüksek churn sayısı 0'a yakın olmalı",
    source: "Gemini AI etkileşim + skor analizi",
    note: "Churn riski yüksek müşterileri hedef alacak önleyici kampanyalar başlatın.",
  },
  totalInteractions: {
    name: "Toplam Etkileşim",
    short: "Sisteme yüklenmiş tüm müşteri etkileşimlerinin (destek talepleri, sohbetler, e-postalar, çağrılar) toplam sayısı.",
    source: "CSV içe aktarma veya API ile eklenen kayıtlar",
  },
  openTickets: {
    name: "Açık Talep",
    short: "Henüz çözüme kavuşturulmamış, bekleyen destek taleplerinin sayısı.",
    goodRange: "Düşük olması tercih edilir; yüksek değer ekip yükünü işaret eder",
    source: "Statüsü 'açık' olan etkileşim kayıtları",
  },
  analysisCount: {
    name: "AI Analiz Sayısı",
    short: "Gemini AI tarafından analiz tamamlanan etkileşim sayısı. Her etkileşim için NPS, CSAT tahmini ve duygu sınıflandırması üretilir.",
    source: "Gemini 2.5 Flash — etkileşim yüklendiğinde otomatik başlar",
    note: "Düşükse içe aktarma hâlâ devam ediyor olabilir.",
  },
  activeCampaigns: {
    name: "Aktif Kampanya",
    short: "Şu an aktif olan ve müşterilere gönderim yapılan anket veya e-posta kampanyalarının sayısı.",
    source: "Onaylanmış ve yayında olan kampanya kayıtları",
    goodRange: "Çok fazla eş zamanlı kampanya müşteri yorgunluğuna yol açabilir",
  },
  totalCustomers: {
    name: "Toplam Müşteri",
    short: "Platformdaki kayıtlı müşteri profili sayısı.",
    source: "Etkileşim içe aktarma sırasında otomatik oluşturulur",
    note: "Parantez içindeki rakam yüksek churn riski taşıyan müşterileri gösterir.",
  },
  totalResponses: {
    name: "Toplam Kampanya Yanıtı",
    short: "Tüm anket ve e-posta kampanyalarından alınan toplam geri bildirim sayısı.",
    formula: "Yanıtlanan anketler + doldurulmuş formlar",
    goodRange: "Yanıt oranı %30'un üzerinde olması hedeflenmeli",
    source: "Kampanya tıklama ve form gönderim kayıtları",
  },
  monthlyTrend: {
    name: "Aylık AI Tahmin Trendi",
    short: "Gemini AI'ın etkileşim kayıtlarından ürettiği aylık NPS ve CSAT tahminlerinin zaman içindeki değişimi.",
    scale: "NPS: 0–10 · CSAT: 1–5",
    goodRange: "NPS 8.0 üzeri · CSAT 4.0 üzeri hedeflenmeli",
    source: "Aylık gruplanan AI analiz sonuçları",
    note: "Bu grafik gerçek anket ölçümlerini değil AI tahminlerini yansıtır. Gerçek ölçüm için anket kampanyası başlatın.",
  },
  painPoints: {
    name: "Ağrı Noktaları",
    short: "Müşteri etkileşimlerinde en sık tekrar eden şikayet ve problem kategorileri.",
    formula: "AI tarafından etiketlenen şikayet konuları frekans analizi",
    source: "Gemini NLP kategori çıkarımı",
    goodRange: "Her ağrı noktası için hedefe yönelik kampanya veya süreç iyileştirmesi planlanmalı",
  },
  sentimentDist: {
    name: "Duygu Dağılımı",
    short: "Etkileşimlerin pozitif, negatif veya nötr olarak sınıflandırılma oranları.",
    formula: "Pozitif + Negatif + Nötr = %100",
    source: "Gemini sentiment analizi",
    goodRange: "Pozitif > %50 hedeflenmeli",
  },
  predictionAccuracy: {
    name: "Tahmin Doğruluğu (MAE)",
    short: "AI'ın NPS/CSAT tahminleri ile gerçek anket sonuçları arasındaki ortalama mutlak sapma.",
    formula: "Σ|Tahmin − Gerçek| / N",
    scale: "0 = mükemmel · Düşük değer daha iyi",
    goodRange: "MAE < 1.0 mükemmel · < 2.0 kabul edilebilir",
    source: "Anket yanıtları ile AI tahminleri karşılaştırılarak hesaplanır",
    note: "Daha fazla anket yanıtı toplandıkça doğruluk artar.",
  },
};

/* ──────────────────────────── Tooltip Portal ────────────────────── */

interface TooltipPos { top: number; left: number; }

function TooltipPortal({ def, pos, onEnter, onLeave }: {
  def: MetricDefinition;
  pos: TooltipPos;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const TOOLTIP_W = 300;
  const viewportW = window.innerWidth;

  // keep tooltip within viewport horizontally
  const left = Math.min(pos.left, viewportW - TOOLTIP_W - 12);

  return createPortal(
    <div
      style={{ position: "fixed", top: pos.top, left, width: TOOLTIP_W, zIndex: 9999 }}
      className="rounded-xl border border-slate-700 bg-slate-900 shadow-2xl text-left"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-xs font-bold text-white leading-snug">{def.name}</p>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <p className="text-[11px] text-slate-300 leading-relaxed">{def.short}</p>

        {def.formula && (
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-0.5">Formül</p>
            <p className="text-[10px] text-indigo-300 font-mono leading-snug">{def.formula}</p>
          </div>
        )}

        {def.scale && (
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-0.5">Ölçek</p>
            <p className="text-[10px] text-slate-300 leading-snug">{def.scale}</p>
          </div>
        )}

        {def.goodRange && (
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-0.5">İyi Aralık</p>
            <p className="text-[10px] text-emerald-400 leading-snug">{def.goodRange}</p>
          </div>
        )}

        {def.source && (
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500 mb-0.5">Kaynak</p>
            <p className="text-[10px] text-slate-400 leading-snug">{def.source}</p>
          </div>
        )}

        {def.note && (
          <div className="pt-1.5 border-t border-slate-800">
            <p className="text-[10px] text-amber-400/80 leading-relaxed italic">{def.note}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ──────────────────────────── MetricInfo ────────────────────────── */

interface MetricInfoProps {
  metricKey: keyof typeof METRIC_DEFS;
  className?: string;
  side?: "top" | "bottom";
}

export function MetricInfo({ metricKey, className, side = "bottom" }: MetricInfoProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos>({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const def = METRIC_DEFS[metricKey];
  if (!def) return null;

  const clearHide = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };

  const show = useCallback(() => {
    clearHide();
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const GAP = 8;
    if (side === "bottom") {
      setPos({ top: rect.bottom + GAP, left: rect.left });
    } else {
      setPos({ top: rect.top - GAP - 20, left: rect.left }); // rough; portal adjusts
    }
    setVisible(true);
  }, [side]);

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  useEffect(() => () => { clearHide(); }, []);

  return (
    <span
      ref={iconRef}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />

      {visible && (
        <TooltipPortal
          def={def}
          pos={pos}
          onEnter={clearHide}
          onLeave={hide}
        />
      )}
    </span>
  );
}
