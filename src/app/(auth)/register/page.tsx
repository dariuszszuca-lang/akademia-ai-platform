"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { PLATFORM_NAME } from "@/lib/product";

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all";

function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { register, confirmRegistration, error, clearError } = useAuth();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register(email, password, name);
      setStep("code");
    } catch {
      // błąd pokazuje auth-context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await confirmRegistration(email, code.trim());
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      // błąd pokazuje auth-context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-accent text-white font-mono font-bold text-sm flex items-center justify-center mx-auto mb-3">
            PN
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            {PLATFORM_NAME}
          </h1>
          <p className="text-foreground/50 text-sm mt-1">
            Jedno konto do wszystkich narzędzi
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Konto potwierdzone</h2>
              <p className="text-sm text-foreground/50 mt-3">
                Za chwilę przeniesiemy Cię do logowania.
              </p>
            </div>
          ) : step === "form" ? (
            <>
              <h2 className="text-xl font-bold text-foreground mb-1">Załóż konto</h2>
              <p className="text-sm text-foreground/50 mb-6">
                Wyślemy kod na Twój e-mail, żeby potwierdzić adres.
              </p>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label htmlFor="register-name" className="block text-sm font-medium text-foreground/70 mb-1.5">
                    Imię
                  </label>
                  <input
                    id="register-name"
                    type="text"
                    value={name}
                    onChange={(e) => { clearError(); setName(e.target.value); }}
                    required
                    autoComplete="given-name"
                    className={inputClass}
                    placeholder="Marta"
                  />
                </div>
                <div>
                  <label htmlFor="register-email" className="block text-sm font-medium text-foreground/70 mb-1.5">
                    E-mail
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => { clearError(); setEmail(e.target.value); }}
                    required
                    autoComplete="email"
                    className={inputClass}
                    placeholder="twoj@email.pl"
                  />
                </div>
                <div>
                  <label htmlFor="register-password" className="block text-sm font-medium text-foreground/70 mb-1.5">
                    Hasło
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => { clearError(); setPassword(e.target.value); }}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={inputClass}
                    placeholder="co najmniej 8 znaków"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Zakładam konto..." : "Załóż konto"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground mb-1">Potwierdź e-mail</h2>
              <p className="text-sm text-foreground/50 mb-6">
                Wpisz kod z wiadomości wysłanej na {email}.
              </p>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleConfirm} className="space-y-5">
                <div>
                  <label htmlFor="register-code" className="block text-sm font-medium text-foreground/70 mb-1.5">
                    Kod z e-maila
                  </label>
                  <input
                    id="register-code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => { clearError(); setCode(e.target.value); }}
                    required
                    autoComplete="one-time-code"
                    className={`${inputClass} font-mono tracking-[0.3em]`}
                    placeholder="123456"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Sprawdzam..." : "Potwierdź"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-sm text-foreground/40">
            Masz już konto?{" "}
            <Link href="/login" className="text-accent font-medium hover:underline">
              Zaloguj się
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthProvider>
      <RegisterForm />
    </AuthProvider>
  );
}
