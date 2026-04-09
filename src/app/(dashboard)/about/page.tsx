export default function AboutPage() {
  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-navy to-navy-light flex items-center justify-center">
          <div className="text-center">
            <h2 className="font-heading text-3xl text-gold font-bold">Akademia AI</h2>
            <p className="text-gray-300 text-sm mt-1">Praktyczne warsztaty AI dla agentów nieruchomości</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Description */}
          <div>
            <h3 className="font-semibold text-navy mb-3">O warsztatach</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Akademia AI to intensywny, 4-dniowy program szkoleniowy. Uczymy jak wykorzystać
              sztuczną inteligencję w codziennej pracy — od automatyzacji ofert, przez tworzenie
              treści marketingowych, po budowę osobistego asystenta AI.
            </p>
          </div>

          {/* Format */}
          <div>
            <h3 className="font-semibold text-navy mb-3">Format warsztatu</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-light rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Środa</p>
                <p className="font-semibold text-navy text-sm">Online wstępne</p>
                <p className="text-xs text-gray-400 mt-1">9:00</p>
              </div>
              <div className="bg-slate-light rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Czwartek</p>
                <p className="font-semibold text-navy text-sm">Warsztat</p>
                <p className="text-xs text-gray-400 mt-1">9:00–15:00</p>
              </div>
              <div className="bg-slate-light rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Piątek</p>
                <p className="font-semibold text-navy text-sm">Warsztat</p>
                <p className="text-xs text-gray-400 mt-1">9:00–15:00</p>
              </div>
              <div className="bg-slate-light rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Sobota</p>
                <p className="font-semibold text-navy text-sm">Online Q&A</p>
                <p className="text-xs text-gray-400 mt-1">9:00</p>
              </div>
            </div>
          </div>

          {/* Instructor */}
          <div>
            <h3 className="font-semibold text-navy mb-3">Instruktor</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center text-gold font-heading font-bold text-xl">
                D
              </div>
              <div>
                <p className="font-semibold text-navy">Dariusz Szuca</p>
                <p className="text-sm text-gray-400">Specjalista AI &amp; Marketing</p>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-navy mb-3">Linki</h3>
            <div className="space-y-2">
              <a href="https://ai-team.pl" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gold-dark hover:underline">
                <span>🔗</span> ai-team.pl
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
