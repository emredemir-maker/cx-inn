import { useState, useEffect, useCallback } from "react";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export type UserRole = "superadmin" | "cx_manager" | "cx_user";

export interface AppUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
}

interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "") || "";

async function exchangeToken(idToken: string): Promise<AppUser | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/firebase-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AppUser };
    return data.user;
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

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // First check if there's an existing session on the backend
      const sessionUser = await fetchCurrentUser();
      if (sessionUser) {
        if (!cancelled) {
          setUser(sessionUser);
          setIsLoading(false);
        }
        return;
      }

      // Check if we're coming back from a Google redirect
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const idToken = await result.user.getIdToken();
          const appUser = await exchangeToken(idToken);
          if (!cancelled) {
            setUser(appUser);
          }
        }
      } catch (err) {
        console.error("Redirect result error:", err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    await signInWithRedirect(auth, provider);
    // Page will redirect — nothing after this runs
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
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
