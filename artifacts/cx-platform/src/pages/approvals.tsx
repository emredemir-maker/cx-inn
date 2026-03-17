import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useAppAuth } from "@/context/auth-context";
import { ClipboardCheck, Check, X, Loader2, MessageSquareQuote, Send, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "") || "";

interface Survey {
  id: number;
  title: string;
  type: string;
  channel: string;
  approvalStatus: string;
  createdAt: string;
}

interface Campaign {
  id: number;
  name: string;
  channel: string;
  approvalStatus: string;
  createdAt: string;
}

interface PendingData {
  surveys: Survey[];
  campaigns: Campaign[];
}

function ApprovalCard({
  id,
  type,
  title,
  subtitle,
  channel,
  createdAt,
}: {
  id: number;
  type: "survey" | "campaign";
  title: string;
  subtitle: string;
  channel: string;
  createdAt: string;
}) {
  const queryClient = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const approve = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/approvals/${type === "survey" ? "surveys" : "campaigns"}/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error("Onaylama başarısız");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] }),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/approvals/${type === "survey" ? "surveys" : "campaigns"}/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error("Reddetme başarısız");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] }),
  });

  const isPending = approve.isPending || reject.isPending;
  const Icon = type === "survey" ? MessageSquareQuote : Send;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="flex items-start gap-4 p-5">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-slate-600">
                {new Date(createdAt).toLocaleDateString("tr-TR")}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                Onay Bekliyor
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-500">
              {type === "survey" ? "Anket" : "Kampanya"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-500">
              {channel}
            </span>
          </div>
        </div>
      </div>

      {/* Note + actions */}
      <div className="border-t border-slate-800 px-5 py-3 bg-slate-900/40 space-y-3">
        <button
          onClick={() => setNoteOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {noteOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {noteOpen ? "Notu gizle" : "Not ekle (opsiyonel)"}
        </button>

        {noteOpen && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Onay veya ret için not yazın..."
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => approve.mutate()}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25",
              isPending && "opacity-60 cursor-not-allowed",
            )}
          >
            {approve.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Onayla
          </button>

          <button
            onClick={() => reject.mutate()}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              "bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25",
              isPending && "opacity-60 cursor-not-allowed",
            )}
          >
            {reject.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            Reddet
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { user } = useAppAuth();
  const canApprove = user?.role === "cx_manager" || user?.role === "superadmin";

  const { data, isLoading } = useQuery<PendingData>({
    queryKey: ["approvals"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/approvals/pending`, { credentials: "include" });
      if (!res.ok) throw new Error("Yüklenemedi");
      return res.json();
    },
    enabled: canApprove,
    refetchInterval: 30000,
  });

  const total = (data?.surveys.length ?? 0) + (data?.campaigns.length ?? 0);

  if (!canApprove) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Bu sayfaya erişim yetkiniz yok.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Onay Kuyruğu</h1>
            {total > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">
                {total}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm ml-11">
            CX Kullanıcıları tarafından onay bekleyen içerikler
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <ClipboardCheck className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-slate-400 font-medium">Bekleyen onay yok</p>
            <p className="text-slate-600 text-sm">Tüm içerikler işlendi.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Surveys */}
            {(data?.surveys.length ?? 0) > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Anketler ({data!.surveys.length})
                </h2>
                {data!.surveys.map((s) => (
                  <ApprovalCard
                    key={`survey-${s.id}`}
                    id={s.id}
                    type="survey"
                    title={s.title}
                    subtitle={`${s.type} anket`}
                    channel={s.channel}
                    createdAt={s.createdAt}
                  />
                ))}
              </div>
            )}

            {/* Campaigns */}
            {(data?.campaigns.length ?? 0) > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Kampanyalar ({data!.campaigns.length})
                </h2>
                {data!.campaigns.map((c) => (
                  <ApprovalCard
                    key={`campaign-${c.id}`}
                    id={c.id}
                    type="campaign"
                    title={c.name}
                    subtitle={`${c.channel} kampanyası`}
                    channel={c.channel}
                    createdAt={c.createdAt}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
