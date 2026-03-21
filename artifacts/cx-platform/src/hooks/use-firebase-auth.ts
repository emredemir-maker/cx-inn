import { useState, useEffect, useCallback, useRef } from "react";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
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
  /** Get a fresh Firebase ID token for Bearer auth (returns null if not signed in) */
  getIdToken: () => Promise<string | null>;
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
  // Keep a stable ref to the latest Firebase user so refreshSession can
  // access it without depending on auth.currentUser (which may be null
  // before the first onAuthStateChanged callback fires).
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    // ── Redirect result promise ─────────────────────────────────────────────
    // After signInWithRedirect the SDK needs to call getRedirectResult to
    // "consume" the pending credential.  onAuthStateChanged fires with null
    // BEFORE the redirect is processed, which would wrongly send the user back
    // to the login page.  We keep a reference to this promise so the null-user
    // branch of onAuthStateChanged can WAIT for it before clearing auth state.
    const redirectPromise = getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled || !result) return;
        // Redirect completed → exchange the fresh token immediately.
        const idToken = await result.user.getIdToken();
        const appUser = await exchangeToken(idToken);
        if (!cancelled) {
          setUser(appUser);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("[Auth] Redirect sign-in error:", err);
      });

    // ── Ongoing auth state listener ─────────────────────────────────────────
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;

      firebaseUserRef.current = firebaseUser;

      if (!firebaseUser) {
        // Wait for the redirect check to finish before deciding there is no
        // user.  Without this await, the initial null state clears the UI
        // before the redirect credential has been processed.
        await redirectPromise;
        if (cancelled) return;
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Firebase user is active — check if backend session is still alive.
      const sessionUser = await fetchCurrentUser();
      if (!cancelled && sessionUser) {
        setUser(sessionUser);
        setIsLoading(false);
        return;
      }

      // Backend session expired but Firebase token is valid → silently re-login.
      try {
        const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
        const refreshedUser = await exchangeToken(idToken);
        if (!cancelled) setUser(refreshedUser);
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
    // Full-page redirect — no popup window.
    // onAuthStateChanged fires on return and handles the token exchange.
    await signInWithRedirect(auth, provider);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      // Use the ref (kept in sync by onAuthStateChanged) rather than the
      // synchronous auth.currentUser accessor, which can be null before
      // the first auth state callback fires.
      const firebaseUser = firebaseUserRef.current ?? auth.currentUser;
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
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshSession,
    getIdToken,
  };
}
