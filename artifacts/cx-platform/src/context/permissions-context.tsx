import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAppAuth } from "./auth-context";

export type AccessLevel = "full" | "readonly" | "restricted" | "approval" | "none";
export type PiiLevel = "visible" | "masked";
export type ActionLevel = "true" | "false" | "approval";
export type RoleKey = "superadmin" | "cx_manager" | "cx_user";

type PermMap = Record<string, Record<string, string>>;

const DEFAULT_PERMISSIONS: PermMap = {
  superadmin: {},
  cx_manager: {
    "module.dashboard": "full", "module.analytics": "full", "module.customers": "full",
    "module.companies": "full", "module.segments": "full", "module.interactions": "full",
    "module.anomalies": "full", "module.surveys": "full", "module.campaigns": "approval",
    "module.approvals": "full", "module.audit_logs": "readonly", "module.settings": "restricted",
    "module.user_management": "none", "module.ai_analyze_single": "full", "module.ai_analyze_bulk": "none",
    "module.manual": "full",
    "pii.email": "visible", "pii.phone": "visible",
    "action.import_customers": "true", "action.add_interaction": "true",
    "action.exclude_interaction": "true", "action.delete_interaction": "true",
    "action.manage_segments": "true", "action.create_survey": "true", "action.edit_survey": "true",
    "action.create_campaign": "true", "action.send_campaign": "approval",
    "action.trigger_survey": "true", "action.analyze_single": "true", "action.bulk_analyze": "false",
    "action.nlp_query": "true", "action.ai_personalize": "true",
    "action.invite_user": "false", "action.change_role": "false", "action.remove_user": "false",
    "action.edit_settings": "false", "action.manage_api_keys": "false",
    "action.approve": "true", "action.view_as": "false",
  },
  cx_user: {
    "module.dashboard": "full", "module.analytics": "readonly", "module.customers": "readonly",
    "module.companies": "readonly", "module.segments": "readonly", "module.interactions": "readonly",
    "module.anomalies": "readonly", "module.surveys": "readonly", "module.campaigns": "none",
    "module.approvals": "none", "module.audit_logs": "readonly", "module.settings": "restricted",
    "module.user_management": "none", "module.ai_analyze_single": "none", "module.ai_analyze_bulk": "none",
    "module.manual": "full",
    "pii.email": "masked", "pii.phone": "masked",
    "action.import_customers": "false", "action.add_interaction": "false",
    "action.exclude_interaction": "false", "action.delete_interaction": "false",
    "action.manage_segments": "false", "action.create_survey": "false", "action.edit_survey": "false",
    "action.create_campaign": "false", "action.send_campaign": "false",
    "action.trigger_survey": "false", "action.analyze_single": "false", "action.bulk_analyze": "false",
    "action.nlp_query": "false", "action.ai_personalize": "false",
    "action.invite_user": "false", "action.change_role": "false", "action.remove_user": "false",
    "action.edit_settings": "false", "action.manage_api_keys": "false",
    "action.approve": "false", "action.view_as": "false",
  },
};

const SUPERADMIN_DEFAULTS: Record<string, string> = {
  "module.dashboard": "full", "module.analytics": "full", "module.customers": "full",
  "module.companies": "full", "module.segments": "full", "module.interactions": "full",
  "module.anomalies": "full", "module.surveys": "full", "module.campaigns": "full",
  "module.approvals": "full", "module.audit_logs": "full", "module.settings": "full",
  "module.user_management": "full", "module.ai_analyze_single": "full", "module.ai_analyze_bulk": "full",
  "module.manual": "full",
  "pii.email": "visible", "pii.phone": "visible",
  "action.import_customers": "true", "action.add_interaction": "true",
  "action.exclude_interaction": "true", "action.delete_interaction": "true",
  "action.manage_segments": "true", "action.create_survey": "true", "action.edit_survey": "true",
  "action.create_campaign": "true", "action.send_campaign": "true",
  "action.trigger_survey": "true", "action.analyze_single": "true", "action.bulk_analyze": "true",
  "action.nlp_query": "true", "action.ai_personalize": "true",
  "action.invite_user": "true", "action.change_role": "true", "action.remove_user": "true",
  "action.edit_settings": "true", "action.manage_api_keys": "true",
  "action.approve": "true", "action.view_as": "true",
};

interface PermissionsContextValue {
  permissions: PermMap;
  isLoading: boolean;
  getModuleAccess: (module: string, role: RoleKey) => AccessLevel;
  getPiiLevel: (field: string, role: RoleKey) => PiiLevel;
  getActionLevel: (action: string, role: RoleKey) => ActionLevel;
  myModuleAccess: (module: string) => AccessLevel;
  myPiiLevel: (field: string) => PiiLevel;
  myActionLevel: (action: string) => ActionLevel;
  updatePermission: (role: RoleKey, key: string, value: string) => Promise<void>;
  resetPermissions: (role?: RoleKey) => Promise<void>;
  refetch: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: DEFAULT_PERMISSIONS,
  isLoading: false,
  getModuleAccess: () => "full",
  getPiiLevel: () => "visible",
  getActionLevel: () => "true",
  myModuleAccess: () => "full",
  myPiiLevel: () => "visible",
  myActionLevel: () => "true",
  updatePermission: async () => {},
  resetPermissions: async () => {},
  refetch: () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAppAuth();
  const [permissions, setPermissions] = useState<PermMap>(DEFAULT_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/permissions", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPermissions({ ...DEFAULT_PERMISSIONS, ...data });
      }
    } catch {
      // Fall back to defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchPermissions();
    else setIsLoading(false);
  }, [user, fetchPermissions]);

  const getRaw = (role: RoleKey, key: string): string | undefined => {
    if (role === "superadmin") return SUPERADMIN_DEFAULTS[key];
    return permissions[role]?.[key];
  };

  const getModuleAccess = (module: string, role: RoleKey): AccessLevel =>
    (getRaw(role, `module.${module}`) as AccessLevel) ?? "none";

  const getPiiLevel = (field: string, role: RoleKey): PiiLevel =>
    (getRaw(role, `pii.${field}`) as PiiLevel) ?? "visible";

  const getActionLevel = (action: string, role: RoleKey): ActionLevel =>
    (getRaw(role, `action.${action}`) as ActionLevel) ?? "false";

  const myRole = (user?.role as RoleKey) ?? "cx_user";

  const myModuleAccess = (module: string) => getModuleAccess(module, myRole);
  const myPiiLevel = (field: string) => getPiiLevel(field, myRole);
  const myActionLevel = (action: string) => getActionLevel(action, myRole);

  const updatePermission = async (role: RoleKey, permissionKey: string, permissionValue: string) => {
    await fetch("/api/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role, permissionKey, permissionValue }),
    });
    setPermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [permissionKey]: permissionValue },
    }));
  };

  const resetPermissions = async (role?: RoleKey) => {
    await fetch("/api/permissions/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    await fetchPermissions();
  };

  return (
    <PermissionsContext.Provider value={{
      permissions, isLoading, getModuleAccess, getPiiLevel, getActionLevel,
      myModuleAccess, myPiiLevel, myActionLevel,
      updatePermission, resetPermissions, refetch: fetchPermissions,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
