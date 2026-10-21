import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setToken, setUnauthorizedHandler } from "@/lib/api";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  /** login + persist the JWT returned by the auth endpoints */
  authedLogin: (data: AuthUser & { token: string }) => void;
  logout: () => void;
  isLoggedIn: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem("ef_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  // A 401 from any API call clears the session and redirects to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      localStorage.removeItem("ef_user");
      setToken(null);
      if (window.location.pathname !== "/login") {
        window.location.assign("/login?expired=1");
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const persist = (u: AuthUser | null, token?: string | null) => {
    setUser(u);
    if (u) localStorage.setItem("ef_user", JSON.stringify(u));
    else localStorage.removeItem("ef_user");
    setToken(token ?? null);
  };

  const login = (u: AuthUser) => persist(u); // demo/static preview (no JWT)
  const authedLogin = (data: AuthUser & { token: string }) => persist(data, data.token);
  const logout = () => persist(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        authedLogin,
        logout,
        isLoggedIn: !!user,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
