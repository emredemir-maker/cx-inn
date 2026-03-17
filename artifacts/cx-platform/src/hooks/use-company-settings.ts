import { useQuery } from "@tanstack/react-query";

export type CompanySettings = {
  id: number;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  email: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  updatedAt: string;
};

export function useCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/company");
      if (!res.ok) throw new Error("Ayarlar alınamadı");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
