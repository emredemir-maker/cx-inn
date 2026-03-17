import { createContext, useContext } from "react";
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
  return useContext(AuthContext);
}
