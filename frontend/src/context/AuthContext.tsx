"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface TacticalUser {
  email: string;
  full_name: string;
  role: "admin" | "analyst" | "eoc" | string;
  station_id: string;
}

interface AuthContextType {
  user: TacticalUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAnalyst: boolean;
  isEoc: boolean;
  canTriage: boolean;
  canDispatch: boolean;
  login: (userData: TacticalUser, token: string) => void;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getStoredAuth(): { user: TacticalUser | null; token: string | null } {
  if (typeof window === "undefined") {
    return { user: null, token: null };
  }
  const token = localStorage.getItem("skytrace_token");
  const userStr = localStorage.getItem("skytrace_user");
  let user: TacticalUser | null = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      user = null;
    }
  }
  return { user, token };
}

export function getAuthHeaders(): Record<string, string> {
  const { token } = getStoredAuth();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<TacticalUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const syncAuth = useCallback(() => {
    const { user: storedUser, token: storedToken } = getStoredAuth();
    setUser(storedUser);
    setToken(storedToken);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    syncAuth();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "skytrace_token" || e.key === "skytrace_user") {
        syncAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("skytrace_auth_changed", syncAuth);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("skytrace_auth_changed", syncAuth);
    };
  }, [syncAuth]);

  const login = (userData: TacticalUser, accessToken: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("skytrace_token", accessToken);
      localStorage.setItem("skytrace_user", JSON.stringify(userData));
      window.dispatchEvent(new Event("skytrace_auth_changed"));
    }
    setUser(userData);
    setToken(accessToken);
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("skytrace_token");
      localStorage.removeItem("skytrace_user");
      window.dispatchEvent(new Event("skytrace_auth_changed"));
    }
    setUser(null);
    setToken(null);
    router.push("/login");
  };

  const role = user?.role?.toLowerCase() || "";
  const isAuthenticated = Boolean(user && token);
  const isAdmin = role === "admin";
  const isAnalyst = role === "analyst";
  const isEoc = role === "eoc";
  const canTriage = isAdmin || isAnalyst || isEoc;
  const canDispatch = isAdmin;

  const getHeaders = (): Record<string, string> => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        isAnalyst,
        isEoc,
        canTriage,
        canDispatch,
        login,
        logout,
        getAuthHeaders: getHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    // Graceful fallback reading directly from localStorage if outside AuthProvider
    const { user, token } = getStoredAuth();
    const role = user?.role?.toLowerCase() || "";
    return {
      user,
      token,
      isLoading: false,
      isAuthenticated: Boolean(user && token),
      isAdmin: role === "admin",
      isAnalyst: role === "analyst",
      isEoc: role === "eoc",
      canTriage: ["admin", "analyst", "eoc"].includes(role),
      canDispatch: role === "admin",
      login: () => {},
      logout: () => {},
      getAuthHeaders,
    };
  }
  return context;
};
