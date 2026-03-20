import { useState, useEffect, useCallback } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
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
  /** Re-establish backend session using current Firebase token (call on 401) */
  refreshSession: () => Promise<boolean>;
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

    // Listen to Firebase Auth state changes.
    // When Firebase has a valid user but the backend session has expired
    // (e.g. after a long idle period), silently refresh the backend session
    // using the current Firebase ID token.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;

      if (!firebaseUser) {
        // Firebase user is gone — ensure backend is also cleared
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Firebase user is active — check if backend session is still alive
      const sessionUser = await fetchCurrentUser();
      if (!cancelled && sessionUser) {
        setUser(sessionUser);
        setIsLoading(false);
        return;
      }

      // Backend session expired but Firebase token is valid → silently re-login
      try {
        const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
        const refreshedUser = await exchangeToken(idToken);
        if (!cancelled) {
          setUser(refreshedUser);
        }
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

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return false;
      const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
      const refreshedUser = await exchangeToken(idToken);
      if (refreshedUser) {
        setUser(refreshedUser);
        return true;
      }
      return false;
    } catch {
      return false;
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
    refreshSession,
  };
}
