"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, name: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  register: async () => ({}),
  logout: () => {},
});

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("foodclaw_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem("foodclaw_user");
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const loading = false; // synchronous init from localStorage, no async loading needed

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Login failed" };

    const u = data.user;
    setUser(u);
    localStorage.setItem("foodclaw_user", JSON.stringify(u));
    localStorage.setItem("foodclaw_user_id", u.id);
    return {};
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Registration failed" };

    const u = data.user;
    setUser(u);
    localStorage.setItem("foodclaw_user", JSON.stringify(u));
    localStorage.setItem("foodclaw_user_id", u.id);
    return {};
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("foodclaw_user");
    localStorage.removeItem("foodclaw_user_id");
    document.cookie = "token=; Path=/; Max-Age=0";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
