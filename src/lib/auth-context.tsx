"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import * as cognito from "./cognito";

type User = {
  email: string;
  name: string;
  sub: string;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const loadUser = useCallback(async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await cognito.getUser(accessToken);
      const attrs = data.UserAttributes || [];
      const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
      setUser({
        email: attrs.find((a) => a.Name === "email")?.Value || "",
        name: attrs.find((a) => a.Name === "name")?.Value || "",
        sub,
      });
      // Synchronizuj server-side cookie z Cognito sub
      if (sub) {
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sub }),
        }).catch(() => {});
      }
    } catch {
      // Token expired — try refresh
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const refreshData = await cognito.refreshSession(refreshToken);
          if (refreshData.AuthenticationResult) {
            localStorage.setItem("accessToken", refreshData.AuthenticationResult.AccessToken);
            localStorage.setItem("idToken", refreshData.AuthenticationResult.IdToken);
            const userData = await cognito.getUser(refreshData.AuthenticationResult.AccessToken);
            const attrs = userData.UserAttributes || [];
            const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
            setUser({
              email: attrs.find((a) => a.Name === "email")?.Value || "",
              name: attrs.find((a) => a.Name === "name")?.Value || "",
              sub,
            });
            if (sub) {
              fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sub }),
              }).catch(() => {});
            }
          }
        } catch {
          localStorage.clear();
        }
      } else {
        localStorage.clear();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const data = await cognito.signIn(email, password);
      if (data.AuthenticationResult) {
        localStorage.setItem("accessToken", data.AuthenticationResult.AccessToken);
        localStorage.setItem("idToken", data.AuthenticationResult.IdToken);
        localStorage.setItem("refreshToken", data.AuthenticationResult.RefreshToken);
        await loadUser();
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("NotAuthorizedException")) {
        setError("Nieprawidłowy email lub hasło");
      } else if (msg.includes("UserNotConfirmedException")) {
        setError("Konto nie zostało potwierdzone. Sprawdź email.");
      } else {
        setError("Błąd logowania. Spróbuj ponownie.");
      }
      throw e;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setError(null);
    try {
      await cognito.signUp(email, password, name);
    } catch (e) {
      const msg = (e as Error).message;
      console.error("Registration error:", msg);
      if (msg.includes("UsernameExistsException")) {
        setError("Konto z tym adresem email już istnieje");
      } else if (msg.includes("InvalidPasswordException")) {
        setError("Hasło musi mieć min. 8 znaków, wielką literę, cyfrę i znak specjalny");
      } else {
        setError(msg || "Błąd rejestracji. Spróbuj ponownie.");
      }
      throw e;
    }
  };

  const confirmRegistration = async (email: string, code: string) => {
    setError(null);
    try {
      await cognito.confirmSignUp(email, code);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("CodeMismatchException")) {
        setError("Nieprawidłowy kod weryfikacyjny");
      } else if (msg.includes("ExpiredCodeException")) {
        setError("Kod wygasł. Poproś o nowy.");
      } else {
        setError("Błąd weryfikacji. Spróbuj ponownie.");
      }
      throw e;
    }
  };

  const logout = async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      try {
        await cognito.signOut(accessToken);
      } catch {
        // Ignore errors on sign out
      }
    }
    // Wyczysc server-side cookie
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // ignore
    }
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        confirmRegistration,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
