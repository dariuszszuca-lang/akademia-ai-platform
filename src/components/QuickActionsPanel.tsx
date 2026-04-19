"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { defaultQuickActions, toneOptions, type QuickAction } from "@/data/quick-actions";

type FormMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; action: QuickAction };

export default function QuickActionsPanel() {
  const [actions, setActions] = useState<QuickAction[]>(defaultQuickActions);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState<FormMode>({ kind: "closed" });

  useEffect(() => {
    fetch("/api/quick-actions")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.actions) && setActions(d.actions))
      .catch(() => {});

    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.admin)))
      .catch(() => {});
  }, []);

  async function reload() {
    const res = await fetch("/api/quick-actions", { cache: "no-store" });
    const data = await res.json();
    if (Array.isArray(data.actions)) setActions(data.actions);
  }

  async function remove(id: string) {
    if (!confirm("Usunąć tę akcję?")) return;
    await fetch(`/api/admin/quick-actions?id=${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
      <div className="w-60 rounded-[28px] border border-border bg-[color:var(--card)] p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="mb-3 flex items-start justify-between px-2 pt-1">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-foreground/35">
              Centrum
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground/80">Szybka praca</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setForm({ kind: "create" })}
              title="Dodaj akcję"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background/55 text-[color:var(--muted-gold)] transition hover:bg-background/80"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M12 3.75v16.5" />
              </svg>
            </button>
          )}
        </div>

        <div className="grid gap-2">
          {actions.map((action) => (
            <ActionRow
              key={action.id}
              action={action}
              isAdmin={isAdmin}
              onEdit={() => setForm({ kind: "edit", action })}
              onDelete={() => remove(action.id)}
            />
          ))}
          {actions.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-foreground/40">
              Brak akcji.{isAdmin && " Kliknij +, żeby dodać."}
            </p>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-background/45 p-3">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--muted-gold)]">
            Dzisiaj
          </p>
          <p className="mt-1 text-sm leading-5 text-foreground/70">
            Warsztat, live i agent są pod ręką.
          </p>
        </div>
      </div>

      {form.kind !== "closed" && (
        <FormModal
          mode={form}
          onClose={() => setForm({ kind: "closed" })}
          onSaved={async () => {
            await reload();
            setForm({ kind: "closed" });
          }}
        />
      )}
    </div>
  );
}

function ActionRow({
  action,
  isAdmin,
  onEdit,
  onDelete,
}: {
  action: QuickAction;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative">
      <Link
        href={action.href}
        title={action.name}
        className="flex items-center gap-3 rounded-2xl border border-transparent p-2 transition-all hover:border-border hover:bg-background/60"
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone} text-xl text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]`}
        >
          {action.emoji}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-5 text-foreground">
            {action.name}
          </span>
          <span className="block truncate text-xs leading-5 text-foreground/45">
            {action.note}
          </span>
        </span>
      </Link>
      {isAdmin && (
        <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            title="Edytuj"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-[color:var(--card)] text-foreground/70 hover:text-foreground"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            title="Usuń"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-[color:var(--card)] text-red-500 hover:text-red-600"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function FormModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: Exclude<FormMode, { kind: "closed" }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = mode.kind === "edit" ? mode.action : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [href, setHref] = useState(initial?.href ?? "/");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "✨");
  const [tone, setTone] = useState(initial?.tone ?? toneOptions[0].value);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    try {
      const isEdit = mode.kind === "edit";
      const res = await fetch("/api/admin/quick-actions", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? mode.action.id : undefined,
          name,
          note,
          href,
          emoji,
          tone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Nie udało się zapisać");
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Błąd");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[2rem] border border-border bg-[color:var(--card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Szybka praca</p>
            <h2 className="mt-1 font-display text-xl text-foreground">
              {mode.kind === "edit" ? "Edytuj akcję" : "Nowa akcja"}
            </h2>
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/50">
              Nazwa
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              className="w-full rounded-xl border border-border bg-background/55 px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/50">
              Podtytuł
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-border bg-background/55 px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/50">
              Link (np. /agent, /classroom, https://...)
            </label>
            <input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-background/55 px-3 py-2 font-mono text-sm text-foreground focus:border-foreground/40 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/50">
                Emoji
              </label>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="w-full rounded-xl border border-border bg-background/55 px-3 py-2 text-center text-lg text-foreground focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/50">
                Gradient
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/55 px-3 py-2 text-sm text-foreground focus:border-foreground/40 focus:outline-none"
              >
                {toneOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-border bg-background/35 p-3">
            <p className="mb-2 text-[0.6rem] uppercase tracking-[0.16em] text-foreground/40">
              Podgląd
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-transparent p-2">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-xl text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.65)]`}
              >
                {emoji || "✨"}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5 text-foreground">
                  {name || "Nazwa"}
                </span>
                <span className="block truncate text-xs leading-5 text-foreground/45">
                  {note || "Podtytuł"}
                </span>
              </span>
            </div>
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Zapisuję..." : mode.kind === "edit" ? "Zapisz" : "Dodaj"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-background/55 px-4 py-2.5 text-sm font-semibold text-foreground/70"
            >
              Anuluj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
