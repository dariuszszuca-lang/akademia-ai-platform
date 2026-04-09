export default function AboutPage() {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-navy mb-2">O Akademii AI</h2>
      <p className="text-gray-500 mb-8">Praktyczne warsztaty AI dla agentów nieruchomości</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <h3 className="font-heading text-lg font-semibold text-navy mb-4">Czym są warsztaty?</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Akademia AI to intensywny, 4-dniowy program szkoleniowy dla agentów nieruchomości.
            Uczymy jak wykorzystać sztuczną inteligencję w codziennej pracy — od automatyzacji
            ofert, przez tworzenie treści marketingowych, po budowę osobistego asystenta AI.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <h3 className="font-heading text-lg font-semibold text-navy mb-4">Format</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="text-gold font-semibold">ŚR</span>
              <span>Online wstępne (9:00)</span>
            </div>
            <div className="flex gap-3">
              <span className="text-gold font-semibold">CZ</span>
              <span>Warsztat stacjonarny (9:00–15:00)</span>
            </div>
            <div className="flex gap-3">
              <span className="text-gold font-semibold">PT</span>
              <span>Warsztat stacjonarny (9:00–15:00)</span>
            </div>
            <div className="flex gap-3">
              <span className="text-gold font-semibold">SO</span>
              <span>Online Q&A (9:00)</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <h3 className="font-heading text-lg font-semibold text-navy mb-4">Instruktorzy</h3>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center text-gold font-heading font-bold text-xl">
              D
            </div>
            <div>
              <p className="font-semibold text-navy">Dariusz Szuca</p>
              <p className="text-sm text-gray-500">Specjalista AI &amp; Marketing</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <h3 className="font-heading text-lg font-semibold text-navy mb-4">Kontakt</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Masz pytania? Napisz na forum w zakładce Społeczność lub skontaktuj się bezpośrednio z instruktorem.
          </p>
        </div>
      </div>
    </div>
  );
}
