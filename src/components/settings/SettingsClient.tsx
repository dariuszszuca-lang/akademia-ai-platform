"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { BillingMode } from "@/lib/billing/mode";

type AccountDeletionClient = {
  readAccessToken: () => string | null;
  request: (url: string, init: RequestInit) => Promise<Response>;
  clearSession: () => void;
  redirectToLogin: () => void;
};

export async function deleteCurrentAccount(
  client: AccountDeletionClient = {
    readAccessToken: () => localStorage.getItem("accessToken"),
    request: (url, init) => fetch(url, init),
    clearSession: () => localStorage.clear(),
    redirectToLogin: () => {
      window.location.href = "/login";
    },
  },
) {
  const accessToken = client.readAccessToken();
  if (!accessToken) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  const response = await client.request("/api/account/delete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  if (!response.ok) {
    throw new Error("Usunięcie się nie powiodło");
  }

  client.clearSession();
  client.redirectToLogin();
}

export default function SettingsClient({
  billingMode,
}: {
  billingMode: BillingMode;
}) {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", { method: "GET" });
      if (!res.ok) throw new Error("Eksport się nie powiódł");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `property-studio-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd eksportu");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteCurrentAccount();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd usuwania");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-12 animate-fade-in-up">
      <header className="space-y-3">
        <p className="eyebrow">Ustawienia</p>
        <h1
          className="display-title text-foreground"
          style={{ fontSize: "clamp(32px, 5vw, 48px)" }}
        >
          Twoje <em>konto</em>.
        </h1>
        <p className="text-foreground/55 text-sm leading-relaxed max-w-lg">
          Tu zarządzasz swoim kontem, subskrypcją i danymi. Profil agenta i persony klientów edytujesz w sekcji{" "}
          <Link href="/profil" className="text-accent hover:text-accent/80 underline underline-offset-2">
            Mój profil
          </Link>
          .
        </p>
      </header>

      {/* Konto */}
      <section className="space-y-3">
        <h2 className="text-foreground/50 text-xs uppercase tracking-[0.25em]">Konto</h2>
        <div className="rounded-2xl border border-foreground/[0.08] bg-[color:var(--card)] p-6 space-y-4">
          <Field label="Imię" value={user?.name ?? "—"} />
          <Field label="Email" value={user?.email ?? "—"} />
          <Field label="ID użytkownika" value={user?.sub ? `${user.sub.slice(0, 12)}…` : "—"} mono />
          <p className="text-foreground/40 text-xs leading-relaxed pt-2 border-t border-foreground/[0.06]">
            Zmiana imienia i email wymaga kontaktu z supportem (na razie). Hasło można zresetować przez stronę{" "}
            <Link href="/login" className="text-accent hover:text-accent/80 underline underline-offset-2">
              logowania
            </Link>{" "}
            (link &quot;Zapomniałem hasła&quot;).
          </p>
        </div>
      </section>

      {/* Subskrypcja */}
      <section className="space-y-3">
        <h2 className="text-foreground/50 text-xs uppercase tracking-[0.25em]">Subskrypcja</h2>
        <Link
          href="/settings/subscription"
          className="block rounded-2xl border border-foreground/[0.08] bg-[color:var(--card)] p-6 transition-colors hover:border-accent/40"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-foreground text-base font-medium">Twój plan</p>
              <p className="text-foreground/55 text-sm mt-1">
                {billingMode === "pilot"
                  ? "Sprawdź funkcje aktywnego dostępu pilotażowego."
                  : "Zarządzaj subskrypcją, zmień plan, anuluj."}
              </p>
            </div>
            <span className="text-foreground/50 text-sm whitespace-nowrap">Otwórz →</span>
          </div>
        </Link>
      </section>

      {/* Dane */}
      <section className="space-y-3">
        <h2 className="text-foreground/50 text-xs uppercase tracking-[0.25em]">Twoje dane</h2>
        <div className="rounded-2xl border border-foreground/[0.08] bg-[color:var(--card)] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-foreground text-base font-medium">Eksport danych</p>
              <p className="text-foreground/55 text-sm mt-1">
                Pobierz wszystkie swoje dane jako plik JSON, w tym profil, persony, teczki nieruchomości, fakty i historię zmian.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-5 py-2.5 rounded-full border border-border bg-background/40 text-foreground/80 text-sm font-medium hover:bg-background/70 transition-colors disabled:opacity-50"
            >
              {exporting ? "Eksportuję…" : "Pobierz JSON"}
            </button>
          </div>

          <div className="border-t border-foreground/[0.06] pt-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-rose-300 text-base font-medium">Usuń konto</p>
              <p className="text-foreground/55 text-sm mt-1">
                Permanentnie usuwa profil, persony, odpowiedzi i konto. Nieodwracalne.
              </p>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
                confirmDelete
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
              }`}
            >
              {deleting
                ? "Usuwam…"
                : confirmDelete
                ? "Potwierdź usunięcie"
                : "Usuń konto"}
            </button>
          </div>
          {confirmDelete && !deleting && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-foreground/50 hover:text-foreground text-xs uppercase tracking-[0.25em] transition-colors"
            >
              ← Anuluj
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-foreground/50 text-sm">{label}</span>
      <span
        className={`text-foreground text-sm ${mono ? "font-mono text-xs" : ""} truncate max-w-[60%] text-right`}
      >
        {value}
      </span>
    </div>
  );
}
