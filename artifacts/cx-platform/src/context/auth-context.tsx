import { createContext, useContext } from "react";
import { useRolePreview } from "./role-preview-context";
import type { AppUser } from "@/hooks/use-firebase-auth";

export interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  logout: async () => {},
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
