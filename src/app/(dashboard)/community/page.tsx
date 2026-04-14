"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

const categories = ["Wszystkie", "Ogłoszenia", "Strategie i Narzędzia", "Aktualności AI", "Zwycięstwa i Case Studies"];

const mockPosts = [
  {
    id: 1,
    author: "Dariusz Szuca",
    avatar: "D",
    level: 7,
    category: "Ogłoszenia",
    time: "1d",
    title: "Witamy w Akademii AI — Edycja #1!",
    excerpt: "Platforma jest gotowa! Tutaj znajdziesz wszystkie materiały, nagrania i zadania z warsztatów. Zacznij od sekcji START TUTAJ w Materiałach, a potem przejdź do Przygotowania (Praca domowa). Do zobaczenia 22 kwietnia na spotkaniu online!",
    likes: 5,
    comments: 2,
    pinned: true,
  },
  {
    id: 2,
    author: "Dariusz Szuca",
    avatar: "D",
    level: 7,
    category: "Ogłoszenia",
    time: "2d",
    title: "Przygotowanie do warsztatu — co zrobić przed 22 kwietnia",
    excerpt: "Zanim spotkamy się online w środę 22 kwietnia, przejdź przez moduł Przygotowanie w sekcji Materiały. Znajdziesz tam zadania: profil przedsiębiorcy, persony, ofertę i konfigurację kont AI. To pozwoli nam od razu wejść w praktykę na warsztacie.",
    likes: 8,
    comments: 3,
    pinned: false,
  },
];

const leaderboard = [
  { name: "Dariusz Szuca", points: 142 },
];

export default function CommunityPage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="animate-fade-in">
      <div className="flex gap-8">
        {/* LEFT — Posts feed */}
        <div className="flex-1 min-w-0">
          {/* Write something */}
          <div className="mb-6 flex items-center gap-3 bg-card border border-border rounded-xl p-4">
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-sm font-bold rounded-full bg-accent/15 text-accent">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <input
              type="text"
              placeholder="Napisz coś..."
              className="flex-1 bg-slate-light rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer text-foreground/50 placeholder:text-foreground/30 border border-transparent hover:border-border"
              readOnly
            />
          </div>

          {/* Category filters */}
          <div className="flex gap-1.5 mb-6 flex-wrap">
            {categories.map((cat, i) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(i)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  i === activeCategory
                    ? "bg-accent text-white"
                    : "bg-slate-light text-foreground/50 hover:text-foreground/80 hover:bg-slate-light"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Posts */}
          <div className="space-y-4 stagger-children">
            {mockPosts.map((post) => (
              <article
                key={post.id}
                className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-accent/30 transition-all group"
              >
                {/* Author row */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 flex items-center justify-center text-xs font-bold rounded-full bg-accent/15 text-accent">
                    {post.avatar}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{post.author}</span>
                    <span className="text-xs text-foreground/30">{post.time}</span>
                  </div>
                  {post.pinned && (
                    <span className="ml-auto text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Przypięty
                    </span>
                  )}
                </div>

                {/* Category */}
                <span className="text-[11px] text-accent font-medium">
                  {post.category}
                </span>

                {/* Title */}
                <h3 className="text-lg font-bold text-foreground mt-1 mb-2 group-hover:text-accent transition-colors leading-snug">
                  {post.title}
                </h3>

                {/* Excerpt */}
                <p className="text-sm text-foreground/55 leading-relaxed">
                  {post.excerpt}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border/50">
                  <button className="flex items-center gap-1.5 text-foreground/30 hover:text-accent transition-colors text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                    <span className="text-xs tabular-nums">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-foreground/30 hover:text-foreground/60 transition-colors text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
                    </svg>
                    <span className="text-xs tabular-nums">{post.comments}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* RIGHT — Group info sidebar (hidden on mobile) */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          {/* Group info card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-20">
            {/* Banner */}
            <div className="h-24 bg-gradient-to-br from-accent to-teal-600 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-1">
                  <span className="text-white font-extrabold text-lg">AI</span>
                </div>
                <h3 className="text-white font-bold text-sm">Akademia AI</h3>
              </div>
            </div>

            <div className="p-4">
              <p className="text-xs text-foreground/50 leading-relaxed mb-4">
                Praktyczne warsztaty AI dla agentów nieruchomości. Kursy, materiały, wsparcie i społeczność.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center py-2 bg-slate-light rounded-lg">
                  <span className="text-lg font-bold text-foreground block">1</span>
                  <span className="text-[10px] text-foreground/40">Członkowie</span>
                </div>
                <div className="text-center py-2 bg-slate-light rounded-lg">
                  <span className="text-lg font-bold text-accent block">1</span>
                  <span className="text-[10px] text-foreground/40">Online</span>
                </div>
                <div className="text-center py-2 bg-slate-light rounded-lg">
                  <span className="text-lg font-bold text-foreground block">1</span>
                  <span className="text-[10px] text-foreground/40">Admini</span>
                </div>
              </div>

              {/* Invite button */}
              <Link
                href="/members"
                className="block w-full text-center py-2.5 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors mb-4"
              >
                Zaproś
              </Link>

              {/* Leaderboard */}
              <div>
                <h4 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-3">
                  Ranking (30 dni)
                </h4>
                <div className="space-y-2">
                  {leaderboard.map((member, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-accent w-5">{i + 1}</span>
                      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-bold text-accent">
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-foreground flex-1 truncate">{member.name}</span>
                      <span className="text-xs text-foreground/40 tabular-nums">{member.points} pkt</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
