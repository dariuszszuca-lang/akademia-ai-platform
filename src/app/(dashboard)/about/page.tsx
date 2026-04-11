export default function AboutPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <h2 className="font-heading text-4xl font-bold text-foreground tracking-wide gold-glow-text">
          O Akademii
        </h2>
        <p className="text-sm text-foreground/35 mt-2 font-light tracking-wide">Praktyczne warsztaty AI dla agentów nieruchomości</p>
        <div className="w-24 h-px bg-gradient-to-r from-gold to-transparent mt-4" />
      </div>

      <div className="max-w-3xl">
        {/* Hero banner — editorial, not card */}
        <div className="relative mb-12 py-16 px-8" style={{
          background: "linear-gradient(135deg, #1a1a2e, #2d2d4a)",
          borderLeft: "3px solid #C9A030",
        }}>
          <div className="absolute top-0 right-0 w-64 h-64 opacity-5"
            style={{
              background: "radial-gradient(circle, #C9A030 0%, transparent 70%)",
            }}
          />
          <span className="text-[10px] text-gold/50 uppercase tracking-[0.3em] font-semibold">Platforma szkoleniowa</span>
          <h2 className="font-heading text-4xl text-white font-bold tracking-wider mt-3 gold-glow-text">
            AKADEMIA AI
          </h2>
          <div className="w-16 h-px mt-4" style={{ background: "linear-gradient(90deg, #C9A030, transparent)" }} />
          <p className="text-white/30 text-sm mt-4 font-light tracking-wide">
            Warsztaty dla profesjonalistów nieruchomości
          </p>
        </div>

        <div className="space-y-8">
          {/* Description */}
          <div style={{ borderLeft: "2px solid rgba(201, 160, 48, 0.3)", paddingLeft: "24px" }}>
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-[0.15em] mb-4">O warsztatach</h3>
            <p className="text-base text-foreground/50 leading-[1.9] font-light">
              Akademia AI to intensywny, 4-dniowy program szkoleniowy. Uczymy jak wykorzystać
              sztuczną inteligencję w codziennej pracy — od automatyzacji ofert, przez tworzenie
              treści marketingowych, po budowę osobistego asystenta AI.
            </p>
          </div>

          {/* Format */}
          <div>
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-[0.15em] mb-6">Format warsztatu</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
              {[
                { day: "Środa", label: "Online wstępne", time: "9:00", accentColor: "#60a5fa" },
                { day: "Czwartek", label: "Warsztat", time: "9:00–15:00", accentColor: "#C9A030" },
                { day: "Piątek", label: "Warsztat", time: "9:00–15:00", accentColor: "#C9A030" },
                { day: "Sobota", label: "Online Q&A", time: "9:00", accentColor: "#60a5fa" },
              ].map((item) => (
                <div
                  key={item.day}
                  className="bg-card border border-border p-5 text-center"
                  style={{ borderTop: `2px solid ${item.accentColor}`, borderRadius: "0" }}
                >
                  <p className="text-[9px] text-foreground/25 uppercase tracking-[0.2em] mb-2 font-semibold">{item.day}</p>
                  <p className="font-semibold text-foreground text-sm">{item.label}</p>
                  <p className="text-[11px] text-foreground/30 mt-2 tabular-nums">{item.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Instructor */}
          <div style={{ borderLeft: "2px solid rgba(201, 160, 48, 0.3)", paddingLeft: "24px" }}>
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-[0.15em] mb-5">Instruktor</h3>
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 flex items-center justify-center text-2xl font-heading font-bold flex-shrink-0"
                style={{
                  background: "rgba(201, 160, 48, 0.1)",
                  color: "#C9A030",
                  borderRadius: "0",
                  border: "1px solid rgba(201, 160, 48, 0.15)",
                }}
              >
                D
              </div>
              <div>
                <p className="font-semibold text-foreground text-base">Dariusz Szuca</p>
                <p className="text-sm text-foreground/35 mt-0.5 font-light">Specjalista AI & Marketing</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-1.5 h-1.5 bg-gold" style={{ borderRadius: "0" }} />
                  <span className="text-[10px] text-gold/60 font-medium uppercase tracking-wider">Organizator Akademii AI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="pt-4 border-t border-border/50">
            <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-[0.15em] mb-4">Linki</h3>
            <a
              href="https://ai-team.pl"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-sm text-foreground/40 hover:text-gold transition-colors group"
            >
              <div className="w-8 h-8 bg-slate-light flex items-center justify-center group-hover:bg-gold/10 transition-colors" style={{ borderRadius: "0" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
              </div>
              ai-team.pl
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
