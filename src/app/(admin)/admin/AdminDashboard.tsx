"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/data/agents";

type ApiResponse = {
  agents: Agent[];
  kv: { configured: boolean };
};

export default function AdminDashboard({
  kv,
}: {
  kv: { configured: boolean };
}) {
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetchAdminData()
      .then((json) => {
        if (!active) return;
        setData(json);
        setError(null);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Błąd");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function toggle(id: string, next: boolean) {
    setUpdating(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: next }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Aktualizacja nie powiodła się");
      }

      setData((current) =>
        current
          ? {
              ...current,
              agents: current.agents.map((agent) =>
                agent.id === id ? { ...agent, enabled: next } : agent,
              ),
            }
          : current,
      );
      setSuccess(
        `${id}: ${next ? "agent włączony" : "agent ukryty"}`,
      );
      window.setTimeout(() => setSuccess(null), 2500);
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
          <h1 className="mt-3 font-display text-4xl text-foreground">
            Zarządzanie Zespołem AI
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/60">
            Kontroluj dostępność specjalistów widocznych dla użytkowników
            Property Intelligence Studio.
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
          <strong>Magazyn flag nie jest skonfigurowany.</strong> Do czasu
          podłączenia magazynu wszyscy agenci korzystają z wartości domyślnych.
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

      {loading && (
        <div className="text-sm text-foreground/50">Ładowanie agentów...</div>
      )}

      {data && (
        <section>
          <div className="mb-4">
            <h2 className="font-display text-2xl text-foreground">
              Specjaliści Studio
            </h2>
            <p className="text-sm text-foreground/55">
              Zmiana flagi wpływa na listę Zespołu AI i stronę specjalisty.
            </p>
          </div>
          <div className="space-y-2">
            {data.agents.map((agent) => {
              const isUpdating = updating === agent.id;
              return (
                <div
                  key={agent.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/55 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold"
                        style={{
                          background: `${agent.color}18`,
                          color: agent.color,
                        }}
                      >
                        {agent.icon}
                      </span>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {agent.name}
                      </p>
                      <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/50">
                        {agent.tools.length} narzędzi
                      </span>
                    </div>
                    <p className="mt-1 truncate pl-11 text-xs text-foreground/50">
                      {agent.tagline}
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        agent.enabled
                          ? "text-emerald-600"
                          : "text-foreground/40"
                      }`}
                    >
                      {agent.enabled ? "Włączony" : "Ukryty"}
                    </span>
                    <input
                      type="checkbox"
                      checked={agent.enabled}
                      disabled={isUpdating}
                      onChange={(event) =>
                        toggle(agent.id, event.target.checked)
                      }
                      className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-foreground/20 transition-all checked:bg-emerald-500 before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-[18px]"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

async function fetchAdminData(): Promise<ApiResponse> {
  const response = await fetch("/api/admin/agents", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Nie udało się pobrać Zespołu AI");
  return response.json();
}
