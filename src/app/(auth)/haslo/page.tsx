"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmForgotPassword, forgotPassword } from "@/lib/cognito";
import { PLATFORM_NAME } from "@/lib/product";

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all";

function messageFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/CodeMismatch/i.test(msg)) return "Kod się nie zgadza. Sprawdź wiadomość i spróbuj jeszcze raz.";
  if (/ExpiredCode/i.test(msg)) return "Kod wygasł. Poproś o nowy.";
  if (/InvalidPassword/i.test(msg)) return "Hasło za słabe. Użyj co najmniej 8 znaków.";
  if (/LimitExceeded/i.test(msg)) return "Za dużo prób. Odczekaj kilka minut.";
  if (/UserNotFound/i.test(msg)) return "Nie znamy tego adresu. Sprawdź pisownię albo załóż konto.";
  return "Nie udało się. Spróbuj jeszcze raz za chwilę.";
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await forgotPassword(email);
      setStep("code");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await confirmForgotPassword(email, code.trim(), password);
      setStep("done");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-accent text-white font-mono font-bold text-sm flex items-center justify-center mx-auto mb-3">
            PN
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            {PLATFORM_NAME}
          </h1>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          {step === "done" ? (
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Hasło zmienione</h2>
              <p className="text-sm text-foreground/50 mt-3">Za chwilę przeniesiemy Cię do logowania.</p>
            </div>
          ) : step === "email" ? (
            <>
              <h2 className="text-xl font-bold text-foreground mb-1">Nie pamiętasz hasła?</h2>
              <p className="text-sm text-foreground/50 mb-6">Wyślemy kod na Twój e-mail.</p>
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
              )}
              <form onSubmit={sendCode} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-foreground/70 mb-1.5">
                    E-mail
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputClass}
                    placeholder="twoj@email.pl"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Wysyłam..." : "Wyślij kod"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground mb-1">Ustaw nowe hasło</h2>
              <p className="text-sm text-foreground/50 mb-6">Wpisz kod z wiadomości wysłanej na {email}.</p>
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
              )}
              <form onSubmit={setNewPassword} className="space-y-5">
                <div>
                  <label htmlFor="reset-code" className="block text-sm font-medium text-foreground/70 mb-1.5">
                    Kod z e-maila
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    autoComplete="one-time-code"
                    className={`${inputClass} font-mono tracking-[0.3em]`}
                    placeholder="123456"
                  />
                </div>
                <div>
                  <label htmlFor="reset-password" className="block text-sm font-medium text-foreground/70 mb-1.5">
                    Nowe hasło
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  {isSubmitting ? "Zapisuję..." : "Zmień hasło"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-sm text-foreground/40">
            <Link href="/login" className="text-accent font-medium hover:underline">
              Wróć do logowania
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
