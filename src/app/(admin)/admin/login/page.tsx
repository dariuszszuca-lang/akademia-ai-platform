"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Niepoprawne hasło");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Nie udało się połączyć z serwerem");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-[color:var(--card)] p-8 shadow-[var(--shadow-soft)]">
        <div className="mb-8">
          <p className="eyebrow">Admin</p>
          <h1 className="mt-3 font-display text-3xl text-foreground">Panel Akademii AI</h1>
          <p className="mt-2 text-sm text-foreground/60">Zaloguj się żeby zarządzać modułami.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-foreground/60">
              Hasło administratora
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-foreground outline-none transition focus:border-accent"
              required
              minLength={1}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Sprawdzam..." : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}
