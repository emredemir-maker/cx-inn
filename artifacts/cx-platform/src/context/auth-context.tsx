import { createContext, useContext } from "react";
import { useRolePreview } from "./role-preview-context";
import type { AppUser, TenantInfo, TenantRole } from "@/hooks/use-firebase-auth";

export interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  /** All tenants the user has access to */
  tenants: TenantInfo[];
  /** Currently active tenant ID (null if not yet selected) */
  currentTenantId: string | null;
  /** User's role within the active tenant */
  currentTenantRole: TenantRole | null;
  /** True when user belongs to >1 tenant and must choose */
  requiresTenantPicker: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  getIdToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  tenants: [],
  currentTenantId: null,
  currentTenantRole: null,
  requiresTenantPicker: false,
  login: async () => {},
  logout: async () => {},
  switchTenant: async () => false,
  refreshSession: async () => false,
  getIdToken: async () => null,
});

export function useAppAuth() {
  const ctx = useContext(AuthContext);
  const { previewRole } = useRolePreview();

  const realRole = ctx.user?.role;
  const isPreviewMode = !!(previewRole && realRole === "superadmin");

  if (isPreviewMode && ctx.user) {
    return {
      ...ctx,
      user: { ...ctx.user, role: previewRole! },
      realRole,
      isPreviewMode: true as const,
    };
  }

  return {
    ...ctx,
    realRole,
    isPreviewMode: false as const,
  };
}
