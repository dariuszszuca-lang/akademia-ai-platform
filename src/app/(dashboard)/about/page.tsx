export default function AboutPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
          O Akademii
        </h2>
        <p className="text-sm text-foreground/50 mt-1">Praktyczne warsztaty AI dla agentów nieruchomości</p>
      </div>

      <div className="max-w-3xl">
        {/* Hero banner */}
        <div className="relative mb-10 py-14 px-8 rounded-2xl overflow-hidden bg-gradient-to-br from-teal-700 to-teal-900">
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10"
            style={{
              background: "radial-gradient(circle, white 0%, transparent 70%)",
            }}
          />
          <span className="text-[10px] text-white/50 uppercase tracking-[0.3em] font-semibold">Platforma szkoleniowa</span>
          <h2 className="text-4xl text-white font-extrabold tracking-tight mt-3">
            AKADEMIA AI
          </h2>
          <div className="w-16 h-1 rounded-full mt-4 bg-white/30" />
          <p className="text-white/50 text-sm mt-4">
            Warsztaty dla profesjonalistów nieruchomości
          </p>
        </div>

        <div className="space-y-8">
          {/* Description */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">O warsztatach</h3>
            <p className="text-base text-foreground/55 leading-relaxed">
              Akademia AI to intensywny, 4-dniowy program szkoleniowy dla agentów nieruchomości.
              Uczymy jak wykorzystać sztuczną inteligencję w codziennej pracy — od budowy osobistego
              zespołu AI, przez automatyzację procesów i tworzenie treści marketingowych, po zaawansowane
              integracje z narzędziami (mail, kalendarz, CRM). Wszystko hands-on, z konkretnymi
              wynikami od pierwszego dnia.
            </p>
          </div>

          {/* Format */}
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-5">Format warsztatu</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { day: "Środa", label: "Online przygotowanie", time: "9:00", accentColor: "#60a5fa" },
                { day: "Czwartek", label: "Stacjonarnie Trójmiasto", time: "9:00–15:00", isAccent: true },
                { day: "Piątek", label: "Stacjonarnie Trójmiasto", time: "9:00–15:00", isAccent: true },
                { day: "Sobota", label: "Online Q&A", time: "9:00", accentColor: "#60a5fa" },
              ].map((item) => (
                <div
                  key={item.day}
                  className="bg-card border border-border rounded-xl p-5 text-center"
                  style={{ borderTop: `3px solid ${item.isAccent ? "var(--accent)" : item.accentColor}` }}
                >
                  <p className="text-[9px] text-foreground/30 uppercase tracking-[0.2em] mb-2 font-semibold">{item.day}</p>
                  <p className="font-semibold text-foreground text-sm">{item.label}</p>
                  <p className="text-[11px] text-foreground/30 mt-2 tabular-nums">{item.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Instructor */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-5">Instruktor</h3>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold flex-shrink-0 bg-accent/15 text-accent border border-accent/20">
                D
              </div>
              <div>
                <p className="font-bold text-foreground text-base">Dariusz Szuca</p>
                <p className="text-sm text-foreground/40 mt-0.5">8 lat doświadczenia w marketingu, 15+ branż</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-[10px] text-accent font-medium uppercase tracking-wider">Organizator Akademii AI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Cena</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">1 499 PLN</span>
            </div>
            <p className="text-sm text-foreground/40 mt-2">
              NSL: 1 399 PLN z kodem <span className="text-accent font-bold">AI2026</span>
            </p>
            <p className="text-xs text-foreground/25 mt-2">Maks. 12 osób na edycję</p>
          </div>

          {/* Links */}
          <div className="pt-4 border-t border-border/50">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Linki</h3>
            <div className="flex flex-col gap-3">
              <a
                href="https://akademia-ai-nieruchomosci.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-sm text-foreground/40 hover:text-accent transition-colors group"
              >
                <div className="w-8 h-8 bg-slate-light rounded-lg flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                </div>
                akademia-ai-nieruchomosci.pl
              </a>
              <a
                href="https://ai-team.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-sm text-foreground/40 hover:text-accent transition-colors group"
              >
                <div className="w-8 h-8 bg-slate-light rounded-lg flex items-center justify-center group-hover:bg-accent/10 transition-colors">
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
    </div>
  );
}
