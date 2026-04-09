"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"register" | "confirm">("register");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, confirmRegistration, login, error, clearError } = useAuth();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register(email, password, name);
      setStep("confirm");
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await confirmRegistration(email, code);
      await login(email, password);
      router.push("/community");
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl font-bold text-navy tracking-wide">
            Akademia <span className="text-gold">AI</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Platforma szkoleniowa</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
          {step === "register" ? (
            <>
              <h2 className="font-heading text-xl font-semibold text-navy mb-6">Utwórz konto</h2>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Imię i nazwisko</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { clearError(); setName(e.target.value); }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="Jan Kowalski"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { clearError(); setEmail(e.target.value); }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="twoj@email.pl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Hasło</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { clearError(); setPassword(e.target.value); }}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="Min. 8 znaków"
                  />
                  <p className="text-xs text-gray-400 mt-1">Wielka litera, cyfra i znak specjalny</p>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-navy hover:bg-navy-light text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Rejestracja..." : "Zarejestruj się"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-heading text-xl font-semibold text-navy mb-2">Potwierdź email</h2>
              <p className="text-sm text-gray-500 mb-6">
                Wysłaliśmy kod weryfikacyjny na <strong>{email}</strong>
              </p>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleConfirm} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kod weryfikacyjny</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { clearError(); setCode(e.target.value); }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm text-center tracking-[0.3em] text-lg focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-all"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-navy hover:bg-navy-light text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Weryfikacja..." : "Potwierdź"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            Masz już konto?{" "}
            <Link href="/login" className="text-gold-dark font-medium hover:underline">
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
