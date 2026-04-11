export default function AboutPage() {
  return (
    <div className="max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-heading text-2xl font-semibold text-foreground tracking-wide">O Akademii</h2>
        <p className="text-sm text-foreground/40 mt-1">Praktyczne warsztaty AI dla agentów nieruchomości</p>
      </div>

      {/* Hero card */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
        <div className="h-36 bg-gradient-to-br from-navy via-navy-light to-navy relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gold/10" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-gold/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gold/[0.03]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h2 className="font-heading text-3xl text-gold font-bold tracking-widest">AKADEMIA AI</h2>
              <div className="w-16 h-px bg-gold/40 mx-auto mt-3" />
              <p className="text-white/40 text-xs mt-3 tracking-wider uppercase">Warsztaty dla profesjonalistów</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Description */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider mb-4">O warsztatach</h3>
          <p className="text-sm text-foreground/60 leading-[1.8]">
            Akademia AI to intensywny, 4-dniowy program szkoleniowy. Uczymy jak wykorzystać
            sztuczną inteligencję w codziennej pracy — od automatyzacji ofert, przez tworzenie
            treści marketingowych, po budowę osobistego asystenta AI.
          </p>
        </div>

        {/* Format */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider mb-5">Format warsztatu</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { day: "Środa", label: "Online wstępne", time: "9:00", accent: "border-blue-400/30" },
              { day: "Czwartek", label: "Warsztat", time: "9:00–15:00", accent: "border-gold/30" },
              { day: "Piątek", label: "Warsztat", time: "9:00–15:00", accent: "border-gold/30" },
              { day: "Sobota", label: "Online Q&A", time: "9:00", accent: "border-blue-400/30" },
            ].map((item) => (
              <div key={item.day} className={`bg-slate-light rounded-xl p-4 text-center border-t-2 ${item.accent}`}>
                <p className="text-[10px] text-foreground/30 uppercase tracking-wider mb-2">{item.day}</p>
                <p className="font-semibold text-foreground text-sm">{item.label}</p>
                <p className="text-[11px] text-foreground/35 mt-1.5">{item.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Instructor */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider mb-5">Instruktor</h3>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gold/25 to-gold/10 flex items-center justify-center text-gold font-heading font-bold text-2xl flex-shrink-0 ring-2 ring-gold/15">
              D
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">Dariusz Szuca</p>
              <p className="text-sm text-foreground/40 mt-0.5">Specjalista AI &amp; Marketing</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-gold" />
                <span className="text-[11px] text-gold/70 font-medium">Organizator Akademii AI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Linki</h3>
          <a
            href="https://ai-team.pl"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 text-sm text-foreground/60 hover:text-gold transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-light flex items-center justify-center group-hover:bg-gold/10 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
            </div>
            ai-team.pl
          </a>
        </div>
      </div>
    </div>
  );
}
