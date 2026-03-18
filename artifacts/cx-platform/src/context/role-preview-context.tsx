import React, { createContext, useContext, useState } from "react";
import type { UserRole } from "@/hooks/use-firebase-auth";

interface RolePreviewContextValue {
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
}

const RolePreviewContext = createContext<RolePreviewContextValue>({
  previewRole: null,
  setPreviewRole: () => {},
});

export function RolePreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  return (
    <RolePreviewContext.Provider value={{ previewRole, setPreviewRole }}>
      {children}
    </RolePreviewContext.Provider>
  );
}

export function useRolePreview() {
  return useContext(RolePreviewContext);
}
