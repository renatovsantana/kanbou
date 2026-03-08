/**
 * @module auth
 * Authentication context, provider, and hook for the client application.
 * Manages user session state via TanStack Query and provides `login`/`logout` helpers.
 */
import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "./queryClient";
import { useLocation } from "wouter";

/** Shape of the authenticated user object returned by the `/api/auth/me` endpoint. */
type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  clientId: number | null;
  isManager: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
};

/** Contract exposed by the authentication context to consuming components. */
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Provides authentication state to the component tree.
 * Fetches the current user on mount via `/api/auth/me` (returns `null` on 401).
 * Exposes `login` and `logout` mutations that automatically invalidate the user query.
 *
 * @param children - React child nodes to render within the provider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/login");
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Convenience hook to access the current authentication context.
 *
 * @returns The `AuthContextType` containing the current `user`, `isLoading`, `login`, and `logout`.
 * @throws {Error} If called outside of an `AuthProvider`.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
