"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@/data/modules";

type ApiResponse = {
  modules: Course[];
  resources: Course[];
  kv: { configured: boolean };
};

export default function AdminDashboard({ kv }: { kv: { configured: boolean } }) {
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/modules", { cache: "no-store" });
      if (!res.ok) throw new Error("Nie udało się pobrać danych");
      const json: ApiResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(id: string, next: boolean) {
    setUpdating(id);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: next }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Aktualizacja nie powiodła się");
      }

      setData((prev) => {
        if (!prev) return prev;
        const mapItem = (item: Course) => (item.id === id ? { ...item, enabled: next } : item);
        return {
          ...prev,
          modules: prev.modules.map(mapItem),
          resources: prev.resources.map(mapItem),
        };
      });
      setSuccess(`Zapisano: ${id} = ${next ? "włączony" : "wyłączony"}`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setUpdating(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="mt-3 font-display text-4xl text-foreground">Zarządzanie modułami</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Włącz lub wyłącz widoczność modułów dla uczestników. Zmiana działa natychmiast.
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm text-foreground/70 transition hover:text-foreground"
        >
          Wyloguj
        </button>
      </div>

      {!kv.configured && (
        <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-800 dark:text-amber-200">
          <strong>Vercel KV nie jest włączony.</strong> Edycja flag nie zadziała dopóki nie utworzysz KV w Vercel dashboard (Storage → Create Database → KV). Po włączeniu zmienne środowiskowe wczytają się automatycznie.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {loading && <div className="text-sm text-foreground/50">Ładowanie...</div>}

      {data && (
        <div className="space-y-10">
          <Section
            title="Warsztaty"
            description="Moduły warsztatowe — włączaj w odpowiednim momencie."
            items={data.modules}
            updatingId={updating}
            onToggle={toggle}
          />
          <Section
            title="Skarbiec"
            description="Zasoby i narzędzia dodatkowe."
            items={data.resources}
            updatingId={updating}
            onToggle={toggle}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  items,
  updatingId,
  onToggle,
}: {
  title: string;
  description: string;
  items: Course[];
  updatingId: string | null;
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-2xl text-foreground">{title}</h2>
        <p className="text-sm text-foreground/55">{description}</p>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const isUpdating = updatingId === item.id;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/55 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold"
                    style={{ background: `${item.accentColor}18`, color: item.accentColor }}
                  >
                    {item.icon}
                  </span>
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/50">
                    {item.category}
                  </span>
                </div>
                <p className="mt-1 truncate pl-11 text-xs text-foreground/50">{item.description}</p>
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    item.enabled ? "text-emerald-600" : "text-foreground/40"
                  }`}
                >
                  {item.enabled ? "Włączony" : "Ukryty"}
                </span>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={isUpdating}
                  onChange={(e) => onToggle(item.id, e.target.checked)}
                  className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-foreground/20 transition-all checked:bg-emerald-500 before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-[18px]"
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
