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
    title: "Witamy w Akademii AI!",
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
    <div className="flex gap-8 animate-fade-in">
      {/* Left column — posts */}
      <div className="flex-1 min-w-0">
        {/* Write something */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-6 flex items-center gap-4 gold-shimmer">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center text-gold font-semibold text-sm flex-shrink-0 ring-2 ring-gold/20">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <input
            type="text"
            placeholder="Podziel się czymś ze społecznością..."
            className="flex-1 bg-slate-light rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all cursor-pointer text-foreground/50 placeholder:text-foreground/30"
            readOnly
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {categories.map((cat, i) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                i === 0
                  ? "bg-gold text-white shadow-sm"
                  : "bg-card text-foreground/50 border border-border hover:border-gold/30 hover:text-foreground"
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
              className="bg-card rounded-2xl border border-border p-6 card-hover cursor-pointer group relative overflow-hidden"
            >
              {/* Subtle left accent for pinned */}
              {post.pinned && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gold to-gold/30" />
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/25 to-gold/10 flex items-center justify-center text-gold font-semibold text-sm">
                      {post.avatar}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-gold to-gold-dark rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
                      {post.level}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{post.author}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-foreground/30">{post.time}</span>
                      <span className="w-1 h-1 rounded-full bg-foreground/20" />
                      <span className="text-xs text-gold/70 font-medium">{post.category}</span>
                    </div>
                  </div>
                </div>
                {post.pinned && (
                  <span className="text-[10px] text-gold/60 flex items-center gap-1 bg-gold/5 px-2 py-1 rounded-lg font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7.5 2a1 1 0 0 0-1 1v2.293L4.854 6.94a1 1 0 0 0-.354.707V9.5a1 1 0 0 0 1 1h4v6.5a.5.5 0 0 0 1 0V10.5h4a1 1 0 0 0 1-1V7.647a1 1 0 0 0-.354-.707L13.5 5.293V3a1 1 0 0 0-1-1h-5Z"/>
                    </svg>
                    Przypięty
                  </span>
                )}
              </div>

              {/* Content */}
              <h3 className="font-semibold text-foreground mb-2 text-[15px] group-hover:text-gold-dark transition-colors">
                {post.title}
              </h3>
              <p className="text-sm text-foreground/60 leading-relaxed">{post.excerpt}</p>

              {/* Footer */}
              <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/60">
                <button className="flex items-center gap-2 text-foreground/30 hover:text-gold transition-colors text-sm group/btn">
                  <svg className="w-[18px] h-[18px] group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                  </svg>
                  <span className="font-medium">{post.likes}</span>
                </button>
                <button className="flex items-center gap-2 text-foreground/30 hover:text-foreground/70 transition-colors text-sm group/btn">
                  <svg className="w-[18px] h-[18px] group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
                  </svg>
                  <span className="font-medium">{post.comments}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Right column — info panel */}
      <div className="w-80 flex-shrink-0 hidden lg:block space-y-5">
        {/* Group info */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="h-28 bg-gradient-to-br from-navy via-navy-light to-navy relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gold/10" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-gold/5" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <h2 className="font-heading text-xl text-gold font-bold tracking-wider">Akademia AI</h2>
                <div className="w-12 h-px bg-gold/40 mx-auto mt-2" />
              </div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs text-foreground/40 uppercase tracking-wider font-medium mb-2">Platforma szkoleniowa</p>
            <p className="text-sm text-foreground/60 leading-relaxed mb-5">
              Praktyczne warsztaty AI dla agentów nieruchomości. Kursy, materiały, społeczność.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-light rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">1</p>
                <p className="text-[10px] text-foreground/40 uppercase tracking-wider">Członków</p>
              </div>
              <div className="bg-slate-light rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">1</p>
                <p className="text-[10px] text-foreground/40 uppercase tracking-wider">Online</p>
              </div>
              <div className="bg-slate-light rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">1</p>
                <p className="text-[10px] text-foreground/40 uppercase tracking-wider">Adminów</p>
              </div>
            </div>

            <button className="w-full bg-gradient-to-r from-navy to-navy-light hover:from-navy-light hover:to-navy text-white text-xs font-semibold py-3 rounded-xl transition-all duration-300 uppercase tracking-wider">
              Zaproś osoby
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-foreground text-sm">Ranking</h3>
            <span className="text-[10px] text-foreground/30 uppercase tracking-wider">30 dni</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-gold/5">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-white font-bold text-[10px]">1</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold/25 to-gold/10 flex items-center justify-center text-gold font-semibold text-xs">D</div>
              <span className="text-sm font-medium text-foreground flex-1">Dariusz Szuca</span>
              <span className="text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-lg">+10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
