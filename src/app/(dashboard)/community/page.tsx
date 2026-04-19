"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import type { CommunityPost, PostCategory } from "@/lib/community-posts";
import { categoryColors } from "@/lib/community-posts";

const categories: PostCategory[] = ["Wygrana", "Pytanie", "Materiał", "Ogłoszenie", "Dyskusja"];

export default function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState<PostCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [activeFilter, setActiveFilter] = useState<PostCategory | "Wszystkie">("Wszystkie");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/community/posts", { cache: "no-store" });
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !formOpen) return;
    setFormSaving(true);
    setFormError(null);

    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formOpen,
          title: formTitle,
          body: formBody,
          authorName: user.name,
          authorEmail: user.email,
          authorSub: user.sub,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Nie udało się opublikować");
      }

      setFormTitle("");
      setFormBody("");
      setFormOpen(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setFormSaving(false);
    }
  }

  const filtered =
    activeFilter === "Wszystkie"
      ? posts
      : posts.filter((p) => p.category === activeFilter);

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in-up">
      <header>
        <p className="eyebrow">Społeczność</p>
        <h1 className="display-title mt-3 text-4xl text-foreground sm:text-5xl">
          Co się dzieje w tej edycji.
        </h1>
      </header>

      {/* Publish buttons */}
      {user ? (
        <section className="rounded-[2rem] border border-border bg-[color:var(--card)] p-6">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-foreground/40">
            Dodaj post
          </p>
          <h2 className="mt-2 font-display text-lg text-foreground">
            Podziel się wygraną, pytaniem lub materiałem.
          </h2>

          {!formOpen ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setFormOpen(cat);
                    setFormError(null);
                  }}
                  className="rounded-full border border-border bg-background/55 px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:border-foreground/40"
                  style={{ color: categoryColors[cat] }}
                >
                  + {cat}
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full border border-border bg-background/70 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: categoryColors[formOpen] }}
                >
                  {formOpen}
                </span>
                <button
                  type="button"
                  onClick={() => setFormOpen(null)}
                  className="text-xs text-foreground/50 hover:text-foreground"
                >
                  Zmień kategorię
                </button>
              </div>

              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Tytuł posta"
                maxLength={200}
                required
                minLength={3}
                className="w-full rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
              />
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="O co chodzi?"
                rows={4}
                maxLength={5000}
                required
                minLength={5}
                className="w-full rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
              />

              {formError && (
                <p className="text-xs text-red-500">{formError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={formSaving}
                  className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {formSaving ? "Publikuję..." : "Opublikuj"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(null)}
                  className="rounded-full border border-border bg-background/55 px-5 py-2.5 text-sm font-semibold text-foreground/70"
                >
                  Anuluj
                </button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <section className="rounded-[2rem] border border-dashed border-border bg-background/35 p-6 text-center text-sm text-foreground/55">
          Zaloguj się, żeby dodawać posty.
        </section>
      )}

      {/* Filters */}
      <section className="flex flex-wrap gap-2">
        <FilterChip label="Wszystkie" active={activeFilter === "Wszystkie"} onClick={() => setActiveFilter("Wszystkie")} />
        {categories.map((cat) => (
          <FilterChip
            key={cat}
            label={cat}
            active={activeFilter === cat}
            color={categoryColors[cat]}
            onClick={() => setActiveFilter(cat)}
          />
        ))}
      </section>

      {/* Feed */}
      <section>
        {loading ? (
          <p className="text-sm text-foreground/50">Ładowanie...</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-background/35 p-8 text-center text-sm text-foreground/50">
            {activeFilter === "Wszystkie"
              ? "Jeszcze nikt nic nie napisał. Bądź pierwszy."
              : `Brak postów w kategorii ${activeFilter}.`}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
        active
          ? "bg-foreground text-background"
          : "border border-border bg-background/55 text-foreground/60 hover:text-foreground"
      }`}
      style={!active && color ? { color } : undefined}
    >
      {label}
    </button>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const date = new Date(post.createdAt);
  const ago = timeAgo(date);

  return (
    <article className="rounded-2xl border border-border bg-background/55 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
          {post.author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {post.author}
          </p>
          <p className="truncate text-xs text-foreground/45">{ago}</p>
        </div>
        <span
          className="shrink-0 rounded-full border border-border bg-background/70 px-3 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em]"
          style={{ color: categoryColors[post.category] }}
        >
          {post.category}
        </span>
      </div>

      <h3 className="mt-4 text-base font-semibold leading-snug text-foreground">
        {post.title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/65">
        {post.body}
      </p>
    </article>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "teraz";
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dni temu`;
  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
}
