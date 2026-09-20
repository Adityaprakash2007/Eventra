import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isLoggedIn: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("ef_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (user: AuthUser) => {
    setUser(user);
    localStorage.setItem("ef_user", JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("ef_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
