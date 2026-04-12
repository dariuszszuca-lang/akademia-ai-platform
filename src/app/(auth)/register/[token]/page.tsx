"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const VALID_TOKEN = "akademia-ai-2026-edycja1";

export default function InviteRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const isValidToken = token === VALID_TOKEN;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [step, setStep] = useState<"register" | "confirm" | "done">("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { signUp } = await import("@/lib/cognito");
      await signUp(email, password, name);
      setStep("confirm");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("UsernameExistsException")) {
        setError("Konto z tym adresem email już istnieje");
      } else if (msg.includes("InvalidPasswordException")) {
        setError("Hasło musi mieć min. 8 znaków, wielką literę, cyfrę i znak specjalny");
      } else {
        setError(msg || "Błąd rejestracji. Spróbuj ponownie.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { confirmSignUp } = await import("@/lib/cognito");
      await confirmSignUp(email, confirmCode);
      setStep("done");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("CodeMismatchException")) {
        setError("Nieprawidłowy kod weryfikacyjny");
      } else if (msg.includes("ExpiredCodeException")) {
        setError("Kod wygasł. Poproś o nowy.");
      } else {
        setError("Błąd weryfikacji. Spróbuj ponownie.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2.5 mb-10">
            <div className="w-10 h-10 flex items-center justify-center" style={{ borderLeft: "3px solid #C9A030" }}>
              <span className="text-foreground font-heading font-bold text-lg pl-2">AI</span>
            </div>
            <span className="font-heading text-sm font-semibold text-foreground tracking-[0.15em] uppercase">
              Akademia AI
            </span>
          </div>

          <div className="bg-card border border-border p-8" style={{ borderRadius: "0" }}>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground tracking-wide">
                Link nieprawidłowy
              </h2>
              <p className="text-sm text-foreground/40 mt-3 leading-relaxed font-light">
                Link zaproszeniowy wygasł lub jest nieprawidłowy.
                Skontaktuj się z organizatorem aby otrzymać nowy link.
              </p>
            </div>

            <div className="w-full h-px bg-border my-6" />

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-gold hover:text-gold/80 transition-colors font-medium"
              >
                Masz już konto? Zaloguj się
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 flex items-center justify-center" style={{ borderLeft: "3px solid #C9A030" }}>
            <span className="text-foreground font-heading font-bold text-lg pl-2">AI</span>
          </div>
          <span className="font-heading text-sm font-semibold text-foreground tracking-[0.15em] uppercase">
            Akademia AI
          </span>
        </div>

        <div className="bg-card border border-border p-8" style={{ borderRadius: "0" }}>
          {step === "register" && (
            <>
              <div className="text-center mb-8">
                <h2 className="font-heading text-xl font-bold text-foreground tracking-wide">
                  Utwórz konto
                </h2>
                <p className="text-sm text-foreground/40 mt-2 font-light">
                  Akademia AI — Edycja #1
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 text-sm text-red-400 border border-red-400/20 bg-red-400/5" style={{ borderRadius: "0" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-foreground/40 uppercase tracking-wider font-semibold mb-2">
                    Imię i nazwisko
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-slate-light px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/30 border border-transparent hover:border-border transition-all"
                    style={{ borderRadius: "0" }}
                    placeholder="Jan Kowalski"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-foreground/40 uppercase tracking-wider font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-light px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/30 border border-transparent hover:border-border transition-all"
                    style={{ borderRadius: "0" }}
                    placeholder="jan@example.com"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-foreground/40 uppercase tracking-wider font-semibold mb-2">
                    Hasło
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-slate-light px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/30 border border-transparent hover:border-border transition-all"
                    style={{ borderRadius: "0" }}
                    placeholder="Min. 8 znaków"
                  />
                  <p className="text-[10px] text-foreground/25 mt-1.5">
                    Min. 8 znaków, wielka litera, cyfra, znak specjalny
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 text-sm font-semibold uppercase tracking-wider transition-all duration-200 disabled:opacity-50"
                  style={{
                    background: "#C9A030",
                    color: "white",
                    borderRadius: "0",
                  }}
                >
                  {loading ? "Rejestracja..." : "Zarejestruj się"}
                </button>
              </form>

              <div className="w-full h-px bg-border my-6" />

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-gold hover:text-gold/80 transition-colors font-medium"
                >
                  Masz już konto? Zaloguj się
                </Link>
              </div>
            </>
          )}

          {step === "confirm" && (
            <>
              <div className="text-center mb-8">
                <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(201, 160, 48, 0.1)" }}>
                  <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground tracking-wide">
                  Sprawdź email
                </h2>
                <p className="text-sm text-foreground/40 mt-2 font-light">
                  Wysłaliśmy kod weryfikacyjny na <span className="text-foreground font-medium">{email}</span>
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 text-sm text-red-400 border border-red-400/20 bg-red-400/5" style={{ borderRadius: "0" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleConfirm} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-foreground/40 uppercase tracking-wider font-semibold mb-2">
                    Kod weryfikacyjny
                  </label>
                  <input
                    type="text"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    required
                    className="w-full bg-slate-light px-4 py-3 text-sm text-foreground text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-1 focus:ring-gold/30 border border-transparent hover:border-border transition-all"
                    style={{ borderRadius: "0" }}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 text-sm font-semibold uppercase tracking-wider transition-all duration-200 disabled:opacity-50"
                  style={{
                    background: "#C9A030",
                    color: "white",
                    borderRadius: "0",
                  }}
                >
                  {loading ? "Weryfikacja..." : "Potwierdź"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(16, 185, 129, 0.1)" }}>
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground tracking-wide">
                Konto utworzone!
              </h2>
              <p className="text-sm text-foreground/40 mt-2 font-light">
                Możesz teraz zalogować się do platformy.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="mt-6 px-8 py-3 text-sm font-semibold uppercase tracking-wider transition-all duration-200"
                style={{
                  background: "#C9A030",
                  color: "white",
                  borderRadius: "0",
                }}
              >
                Zaloguj się
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
