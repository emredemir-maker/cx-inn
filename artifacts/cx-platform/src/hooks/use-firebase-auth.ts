import { useState, useEffect, useCallback, useRef } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export type UserRole = "superadmin" | "cx_manager" | "cx_user";
export type TenantRole = "tenant_admin" | "cx_manager" | "cx_user";

export interface AppUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  role: TenantRole;
}

interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** All tenants the user has access to */
  tenants: TenantInfo[];
  /** Currently active tenant ID */
  currentTenantId: string | null;
  /** Currently active tenant role */
  currentTenantRole: TenantRole | null;
  /** True when user belongs to multiple tenants and must pick one */
  requiresTenantPicker: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  /** Switch the active tenant context */
  switchTenant: (tenantId: string) => Promise<boolean>;
  /** Re-establish backend session using current Firebase token (call on 401) */
  refreshSession: () => Promise<boolean>;
  /** Get a fresh Firebase ID token for Bearer auth (returns null if not signed in) */
  getIdToken: () => Promise<string | null>;
}

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "") || "";

interface LoginResponse {
  user: AppUser;
  tenants: TenantInfo[];
  requiresTenantPicker: boolean;
  currentTenantId: string | null;
}

async function exchangeToken(idToken: string): Promise<LoginResponse | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/firebase-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LoginResponse;
    return data;
  } catch {
    return null;
  }
}

async function fetchCurrentUser(): Promise<AppUser | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/user`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AppUser | null };
    return data.user;
  } catch {
    return null;
  }
}

export function useFirebaseAuth(): AuthState {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [currentTenantRole, setCurrentTenantRole] = useState<TenantRole | null>(null);
  const [requiresTenantPicker, setRequiresTenantPicker] = useState(false);

  // Keep a stable ref to the latest Firebase user so refreshSession can
  // access it without depending on auth.currentUser (which may be null
  // before the first onAuthStateChanged callback fires).
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  /** Apply a LoginResponse to all tenant + user state slices */
  const applyLoginResponse = useCallback((resp: LoginResponse) => {
    setUser(resp.user);
    setTenants(resp.tenants ?? []);
    setCurrentTenantId(resp.currentTenantId ?? null);
    setRequiresTenantPicker(resp.requiresTenantPicker ?? false);
    // Derive currentTenantRole from the tenants list
    const activeTenant = (resp.tenants ?? []).find((t) => t.id === resp.currentTenantId);
    setCurrentTenantRole(activeTenant?.role ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;

      firebaseUserRef.current = firebaseUser;

      if (!firebaseUser) {
        setUser(null);
        setTenants([]);
        setCurrentTenantId(null);
        setCurrentTenantRole(null);
        setRequiresTenantPicker(false);
        setIsLoading(false);
        return;
      }

      // Firebase user is active — check if backend session is still alive.
      const sessionUser = await fetchCurrentUser();
      if (!cancelled && sessionUser) {
        // Session alive — fetch tenant context separately
        setUser(sessionUser);
        try {
          const tenantRes = await fetch(`${BASE}/api/auth/tenant-info`, {
            credentials: "include",
          });
          if (tenantRes.ok) {
            const tenantData = (await tenantRes.json()) as {
              currentTenantId: string | null;
              currentTenantRole: string | null;
              tenants: TenantInfo[];
            };
            setTenants(tenantData.tenants ?? []);
            setCurrentTenantId(tenantData.currentTenantId);
            setCurrentTenantRole((tenantData.currentTenantRole as TenantRole) ?? null);
            setRequiresTenantPicker(
              tenantData.tenants.length > 1 && !tenantData.currentTenantId,
            );
          }
        } catch {
          // Non-fatal — tenant info can be fetched later
        }
        setIsLoading(false);
        return;
      }

      // Backend session expired but Firebase token is valid → silently re-login.
      try {
        const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
        const loginResp = await exchangeToken(idToken);
        if (!cancelled && loginResp) applyLoginResponse(loginResp);
        else if (!cancelled) setUser(null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyLoginResponse]);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const loginResp = await exchangeToken(idToken);
      if (loginResp) applyLoginResponse(loginResp);
    } catch (err) {
      console.error("[Auth] Popup sign-in error:", err);
    }
  }, [applyLoginResponse]);

  const switchTenant = useCallback(async (tenantId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE}/api/auth/switch-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { tenantId: string; tenantRole: TenantRole };
      setCurrentTenantId(data.tenantId);
      setCurrentTenantRole(data.tenantRole);
      setRequiresTenantPicker(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const firebaseUser = firebaseUserRef.current ?? auth.currentUser;
      if (!firebaseUser) return false;
      const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
      const loginResp = await exchangeToken(idToken);
      if (loginResp) {
        applyLoginResponse(loginResp);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [applyLoginResponse]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    try {
      const firebaseUser = firebaseUserRef.current ?? auth.currentUser;
      if (!firebaseUser) return null;
      return await firebaseUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
      await signOut(auth);
    } catch {
      // ignore
    }
    setUser(null);
    setTenants([]);
    setCurrentTenantId(null);
    setCurrentTenantRole(null);
    setRequiresTenantPicker(false);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    tenants,
    currentTenantId,
    currentTenantRole,
    requiresTenantPicker,
    login,
    logout,
    switchTenant,
    refreshSession,
    getIdToken,
  };
}
