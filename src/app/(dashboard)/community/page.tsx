"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const categories = ["Wszystkie", "Ogłoszenia", "Strategie i Narzędzia", "Aktualności AI", "Zwycięstwa i Case Studies"];

const mockPosts = [
  {
    id: 1,
    author: "Dariusz Szuca",
    avatar: "D",
    level: 7,
    category: "Ogłoszenia",
    time: "1d",
    title: "Witamy w Akademii AI!",
    excerpt: "To jest nasza platforma szkoleniowa. Tutaj znajdziesz materiały z warsztatów, będziesz mógł zadawać pytania i dzielić się swoimi sukcesami z AI. Zacznij od sekcji Materiały, gdzie czeka na Ciebie kurs powitalny.",
    likes: 5,
    comments: 2,
    pinned: true,
  },
  {
    id: 2,
    author: "Dariusz Szuca",
    avatar: "D",
    level: 7,
    category: "Strategie i Narzędzia",
    time: "2d",
    title: "Jak zacząć korzystać z Claude w nieruchomościach",
    excerpt: "Przygotowałem krótki poradnik jak ustawić swojego pierwszego asystenta AI do obsługi zapytań od klientów. Sprawdź w sekcji Materiały moduł 1, gdzie znajdziesz szczegółowe instrukcje krok po kroku.",
    likes: 12,
    comments: 4,
    pinned: false,
  },
];

export default function CommunityPage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-10">
        <h2 className="font-heading text-4xl font-bold text-foreground tracking-wide gold-glow-text">
          Społeczność
        </h2>
        <p className="text-sm text-foreground/35 mt-2 font-light tracking-wide">
          Dyskusje, pytania i inspiracje od uczestników Akademii
        </p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      {/* Single centered column */}
      <div className="max-w-2xl mx-auto">
        {/* Write something */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-sm font-semibold"
            style={{
              background: "rgba(201, 160, 48, 0.12)",
              color: "#C9A030",
              borderRadius: "0",
            }}
          >
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <input
            type="text"
            placeholder="Podziel się czymś ze społecznością..."
            className="flex-1 bg-slate-light px-5 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 transition-all cursor-pointer text-foreground/50 placeholder:text-foreground/25 border border-transparent hover:border-border"
            style={{ borderRadius: "0" }}
            readOnly
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-1 mb-10 flex-wrap">
          {categories.map((cat, i) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(i)}
              className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                i === activeCategory
                  ? "text-gold border-b-2 border-gold bg-transparent"
                  : "text-foreground/30 hover:text-foreground/60 border-b-2 border-transparent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="stagger-children">
          {mockPosts.map((post) => (
            <article
              key={post.id}
              className="editorial-post py-8 cursor-pointer group"
            >
              {/* Pinned badge */}
              {post.pinned && (
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="w-5 h-px bg-gold" />
                  <span className="text-[10px] text-gold/60 font-semibold uppercase tracking-[0.15em]">
                    Przypięty
                  </span>
                </div>
              )}

              {/* Category */}
              <span className="text-[10px] text-gold/70 font-semibold uppercase tracking-[0.2em]">
                {post.category}
              </span>

              {/* Title */}
              <h3 className="font-heading text-2xl font-semibold text-foreground mt-2 mb-4 group-hover:text-gold transition-colors duration-200 leading-tight">
                {post.title}
              </h3>

              {/* Excerpt */}
              <p className="text-base text-foreground/50 leading-[1.9] font-light">
                {post.excerpt}
              </p>

              {/* Author row + actions */}
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center text-xs font-semibold" style={{
                    background: "rgba(201, 160, 48, 0.12)",
                    color: "#C9A030",
                    borderRadius: "0",
                  }}>
                    {post.avatar}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{post.author}</span>
                    <span className="text-foreground/15">|</span>
                    <span className="text-xs text-foreground/25">{post.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <button className="flex items-center gap-1.5 text-foreground/20 hover:text-gold transition-colors text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                    <span className="text-xs tabular-nums">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-foreground/20 hover:text-foreground/60 transition-colors text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
                    </svg>
                    <span className="text-xs tabular-nums">{post.comments}</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
