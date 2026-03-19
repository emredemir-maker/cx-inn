import { useState, useEffect, useCallback } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
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
      // Check if there's an existing session on the backend
      const sessionUser = await fetchCurrentUser();
      if (sessionUser) {
        if (!cancelled) {
          setUser(sessionUser);
          setIsLoading(false);
        }
        return;
      }
      if (!cancelled) setIsLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const appUser = await exchangeToken(idToken);
      setUser(appUser);
    } catch (err) {
      console.error("[Auth] Popup sign-in error:", err);
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
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
