import { useGetSegments } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSegmentsList() {
  return useGetSegments();
}

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

export function useSegmentMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/segments"] });

  const create = useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      criteria: string;
      sourceTags?: string[];
      aiGenerated?: boolean;
    }) => apiFetch("/segments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; description: string; criteria: string; sourceTags: string[] }> }) =>
      apiFetch(`/segments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/segments/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const refresh = useMutation({
    mutationFn: (id: number) => apiFetch(`/segments/${id}/refresh`, { method: "POST" }),
    onSuccess: invalidate,
  });

  return { create, update, remove, refresh };
}

export async function fetchAiSegmentSuggestions(): Promise<{
  suggestions: Array<{
    name: string;
    description: string;
    criteria: string;
    sourceTags: string[];
    actionRecommendation: string;
    estimatedSize: string;
    estimatedCustomerCount: number;
    isDuplicate: boolean;
    existingMatchName?: string;
  }>;
}> {
  return apiFetch("/segments/ai-suggest", { method: "POST" });
}

export interface SegmentTransition {
  customerId: number;
  customerName: string;
  fromSegment: { id: number; name: string };
  toSegment: { id: number; name: string };
}

export async function fetchSegmentTransitions(): Promise<{ transitions: SegmentTransition[] }> {
  return apiFetch("/segments/customer-transitions", { method: "GET" });
}
