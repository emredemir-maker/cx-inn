import React, { useState } from "react";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TenantInfo } from "@/hooks/use-firebase-auth";

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Tenant Admin",
  cx_manager: "CX Manager",
  cx_user: "CX Kullanıcısı",
};

const ROLE_COLORS: Record<string, string> = {
  tenant_admin: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  cx_manager: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25",
  cx_user: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
};

interface TenantPickerProps {
  tenants: TenantInfo[];
  onSelect: (tenantId: string) => Promise<boolean>;
}

export function TenantPicker({ tenants, onSelect }: TenantPickerProps) {
  const [selecting, setSelecting] = useState<string | null>(null);

  async function handleSelect(tenantId: string) {
    setSelecting(tenantId);
    try {
      await onSelect(tenantId);
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Hesap Seçin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Birden fazla hesaba erişiminiz var. Devam etmek için bir hesap seçin.
          </p>
        </div>

        {/* Tenant list */}
        <div className="px-4 pb-6 space-y-2">
          {tenants.map((tenant) => {
            const isLoading = selecting === tenant.id;
            const isDisabled = selecting !== null && !isLoading;

            return (
              <button
                key={tenant.id}
                onClick={() => handleSelect(tenant.id)}
                disabled={isDisabled}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                  "border-border hover:border-primary/40 hover:bg-primary/5",
                  isLoading && "border-primary/40 bg-primary/5",
                  isDisabled && "opacity-50 cursor-not-allowed",
                )}
              >
                {/* Logo or initials */}
                <div
                  className="h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold shadow-lg"
                  style={{
                    background: tenant.logoUrl
                      ? undefined
                      : `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.primaryColor}cc)`,
                  }}
                >
                  {tenant.logoUrl ? (
                    <img
                      src={tenant.logoUrl}
                      alt={tenant.name}
                      className="h-full w-full object-contain rounded-xl"
                    />
                  ) : (
                    tenant.name.slice(0, 2).toUpperCase()
                  )}
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{tenant.name}</p>
                  <span
                    className={cn(
                      "inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5",
                      ROLE_COLORS[tenant.role] ?? ROLE_COLORS.cx_user,
                    )}
                  >
                    {ROLE_LABELS[tenant.role] ?? tenant.role}
                  </span>
                </div>

                {/* Arrow or spinner */}
                <div className="flex-shrink-0 text-muted-foreground">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
