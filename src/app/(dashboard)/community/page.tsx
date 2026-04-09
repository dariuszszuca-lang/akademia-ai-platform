"use client";

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
    title: "Witamy w Akademii AI! 🎉",
    excerpt: "To jest nasza platforma szkoleniowa. Tutaj znajdziesz materiały z warsztatów, będziesz mógł zadawać pytania i dzielić się swoimi sukcesami z AI.",
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
    excerpt: "Przygotowałem krótki poradnik jak ustawić swojego pierwszego asystenta AI do obsługi zapytań od klientów. Sprawdź w Classroom moduł 1.",
    likes: 12,
    comments: 4,
    pinned: false,
  },
];

export default function CommunityPage() {
  const { user } = useAuth();

  return (
    <div className="flex gap-6">
      {/* Left column — posts */}
      <div className="flex-1 min-w-0">
        {/* Write something */}
        <div className="bg-card rounded-xl border border-border p-4 mb-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold text-sm flex-shrink-0">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <input
            type="text"
            placeholder="Napisz coś..."
            className="flex-1 bg-slate-light rounded-full px-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all cursor-pointer text-gray-500"
            readOnly
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {categories.map((cat, i) => (
            <button
              key={cat}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                i === 0
                  ? "bg-foreground text-background"
                  : "bg-card text-gray-600 border border-border hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {mockPosts.map((post) => (
            <div key={post.id} className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold text-sm">
                      {post.avatar}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-gold rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                      {post.level}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{post.author}</p>
                    <p className="text-xs text-gray-400">{post.time} · {post.category}</p>
                  </div>
                </div>
                {post.pinned && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7.5 2a1 1 0 0 0-1 1v2.293L4.854 6.94a1 1 0 0 0-.354.707V9.5a1 1 0 0 0 1 1h4v6.5a.5.5 0 0 0 1 0V10.5h4a1 1 0 0 0 1-1V7.647a1 1 0 0 0-.354-.707L13.5 5.293V3a1 1 0 0 0-1-1h-5Z"/>
                    </svg>
                    Przypięty
                  </span>
                )}
              </div>

              {/* Content */}
              <h3 className="font-semibold text-foreground mb-1.5">{post.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{post.excerpt}</p>

              {/* Footer */}
              <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border">
                <button className="flex items-center gap-1.5 text-gray-400 hover:text-gold transition-colors text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0H16.5a2.25 2.25 0 0 1 2.25 2.25c0 .414-.168.79-.44 1.06m-7.81 0a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25m13.5 0a2.25 2.25 0 0 0-2.25 2.25m2.25-2.25h.894c.572 0 1.092.228 1.476.603" />
                  </svg>
                  {post.likes}
                </button>
                <button className="flex items-center gap-1.5 text-gray-400 hover:text-foreground transition-colors text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
                  </svg>
                  {post.comments}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column — info panel */}
      <div className="w-80 flex-shrink-0 hidden lg:block space-y-4">
        {/* Group info */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-navy to-navy-light flex items-center justify-center">
            <span className="font-heading text-2xl text-gold font-bold">Akademia AI</span>
          </div>
          <div className="p-5">
            <h3 className="font-semibold text-foreground">Akademia AI — Warsztaty</h3>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">Platforma szkoleniowa</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Praktyczne warsztaty AI dla agentów nieruchomości. Kursy, materiały, społeczność.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 border-t border-border pt-4 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">1</p>
                <p className="text-xs text-gray-400">Członków</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">1</p>
                <p className="text-xs text-gray-400">Online</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">1</p>
                <p className="text-xs text-gray-400">Adminów</p>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <button className="w-full bg-navy hover:bg-navy-light text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              ZAPROŚ OSOBY
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-semibold text-foreground text-sm mb-4">Ranking (30 dni)</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-xs">1</span>
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold text-xs">D</div>
              <span className="text-sm font-medium text-foreground flex-1">Dariusz Szuca</span>
              <span className="text-sm font-semibold text-gold">+10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
