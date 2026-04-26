export type AgentTool = {
  id: string;
  title: string;
  description: string;
  result: string;
  placeholders: { context: string; goal: string };
  template?: (context: string, goal: string) => string;
};

export type Agent = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  color: string;
  icon: string;
  enabled: boolean;
  tools: AgentTool[];
};

const def = (context: string, goal: string) => {
  const c = context.trim() || "Brak kontekstu.";
  const g = goal.trim() || "Brak sprecyzowanego celu.";
  return `Kontekst:\n${c}\n\nCel:\n${g}`;
};

/**
 * Agenci w nowej strukturze (wersja Wojtek 04.2026):
 * 1. CEO — zarządzanie, planowanie, decyzje
 * 2. Marketing — content social, kampanie, follow-up
 * 3. Nieruchomości — działki/mieszkania/domy, oferty, analiza rynku
 * 4. Wycena — wycena, umowy, dokumenty
 * 5. Publikacja — plan publikacji, repurposing, harmonogram
 * 6. Prawny — Kodeks cywilny, ustawy, due diligence (RAG na ustawach w kolejnym etapie)
 *
 * Każdy agent dostaje system prompt z profil.md + persony użytkownika (zob. lib/agent/prompts.ts).
 */
export const agents: Agent[] = [
  {
    id: "ceo",
    name: "CEO",
    tagline: "Zarządzanie, planowanie, decyzje strategiczne.",
    description:
      "Twój dyspozytor. Pomaga zaplanować dzień, tydzień, kwartał. Priorytetyzuje co robić, deleguje co odpuścić. Strategiczne decyzje biznesowe agenta nieruchomości.",
    color: "#1e4e53",
    icon: "🧭",
    enabled: true,
    tools: [
      {
        id: "plan-tygodnia",
        title: "Plan tygodnia",
        description: "Aktualne zobowiązania → ułożony plan 5 dni roboczych.",
        result: "Plan tygodnia z priorytetami + bloki czasowe",
        placeholders: {
          context: "Aktualne oferty (3 mieszkania w trakcie), 2 spotkania umówione, 5 leadów do follow-up, deadline na opis oferty na piątek...",
          goal: "Ułożyć tydzień tak, żeby zamknąć 1 transakcję i zostawić 2 godz dziennie na rozwój.",
        },
      },
      {
        id: "priorytety-dnia",
        title: "Priorytety dnia",
        description: "Lista zadań → top 3 co dziś zrobić, reszta odpuścić lub zlecić.",
        result: "3 priorytety + co odpuścić",
        placeholders: {
          context: "Mam 12 rzeczy do zrobienia: 3 telefony do klientów, opis oferty, follow-up po prezentacji, faktura do zapłaty, post na IG, raport miesięczny...",
          goal: "Zamknąć transakcję na Wrzeszczu w tym tygodniu.",
        },
      },
      {
        id: "brief-decyzji",
        title: "Brief pod decyzję",
        description: "Trudna decyzja → analiza za/przeciw + rekomendacja.",
        result: "3 opcje + tradeoffs + rekomendacja",
        placeholders: {
          context: "Klient chce obniżyć prowizję z 3% do 2%. Mówi że inny agent oferuje 1.5%. Mam podpisaną umowę wyłączności.",
          goal: "Decyzja: trzymać 3%, schodzić do 2%, czy zrezygnować z umowy.",
        },
      },
      {
        id: "ranking-mozliwosci",
        title: "Ranking możliwości",
        description: "Kilka opcji rozwoju → ranking pod ROI i Twoje cele.",
        result: "Ranking opcji 1-N + uzasadnienie",
        placeholders: {
          context: "Trzy możliwości rozwoju: (a) zatrudnić asystenta 3000 zł/mies, (b) wejść w nowy segment - komercyjne, (c) zrobić warsztat dla 10 agentów lokalnych.",
          goal: "Zwiększyć przychód o 50% w 12 miesięcy.",
        },
      },
      {
        id: "review-tygodnia",
        title: "Review tygodnia",
        description: "Co zrobiłem → wnioski + 3 rzeczy do poprawy w przyszłym tygodniu.",
        result: "Wnioski + lekcje + plan na następny tydzień",
        placeholders: {
          context: "W tym tygodniu: 2 prezentacje (1 sukces, 1 odpadł), 5 follow-upów, opis oferty, 3 nowe leady z IG, brak postu na FB, niedopilnowany follow-up u Pani Anny.",
          goal: "Zidentyfikować 3 największe blokery i co z nimi zrobić.",
        },
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    tagline: "Karuzele, rolki, posty, kampanie, follow-up.",
    description:
      "Generuje content pod social media w Twoim tonie. Karuzele IG/LinkedIn, skrypty rolek, posty FB/IG, opisy ofert pod social, sekwencje mailowe, follow-upy, odpowiedzi na obiekcje.",
    color: "#c0693f",
    icon: "📣",
    enabled: true,
    tools: [
      {
        id: "karuzela-ig",
        title: "Karuzela IG / LinkedIn",
        description: "Temat + brief → 8-10 slajdów z hookiem i CTA.",
        result: "Karuzela: hook + 8 slajdów + CTA + caption",
        placeholders: {
          context: "Temat: 5 błędów przy zakupie mieszkania na wtórnym. Do kogo: pierwszy kupujący, 30+, Trójmiasto.",
          goal: "Karuzela 10 slajdów IG, ton ekspercki-przyjazny, CTA do DM.",
        },
      },
      {
        id: "rolka",
        title: "Skrypt rolki / Reels",
        description: "Pomysł → skrypt 30-60 sek + storyboard + hook + CTA.",
        result: "Skrypt + storyboard + hook + CTA",
        placeholders: {
          context: "Pokazuję mieszkanie 65m² w Gdyni Śródmieściu, 749 tys. Chcę zrobić rolkę pokazową.",
          goal: "45-sek reel, hook w 3 sek, CTA do DM po szczegóły.",
        },
      },
      {
        id: "post-fb-ig",
        title: "Post FB/IG (3 warianty)",
        description: "Jeden temat → 3 warianty tonu (ekspercki / emocjonalny / konkretny).",
        result: "3 wersje postu + hashtagi",
        placeholders: {
          context: "Sprzedałem 80m² na Wrzeszczu w 7 dni, klient z polecenia. Chcę o tym napisać.",
          goal: "Post FB do lokalnej bazy, ton przyjazny-ekspercki, bez chwalenia się.",
        },
      },
      {
        id: "follow-up",
        title: "Follow-up po prezentacji / spotkaniu",
        description: "Kontekst spotkania → mail/SMS follow-up + pytanie prowadzące.",
        result: "Mail + SMS + harmonogram kolejnych follow-upów",
        placeholders: {
          context: "Prezentacja 75m² na Oliwie, klient (Anna 32) zainteresowany, ale waha się ze względu na cenę 850 tys.",
          goal: "Follow-up bez presji, podtrzymać kontakt, zaadresować obiekcję cenową.",
        },
      },
      {
        id: "odpowiedz-na-obiekcje",
        title: "Odpowiedź na obiekcje",
        description: "Konkretna obiekcja klienta → 3 sposoby odpowiedzi.",
        result: "3 ścieżki odpowiedzi: empatyczna / faktowa / pivot",
        placeholders: {
          context: "Klient sprzedający mówi: 'Sam znajdę kupca, prowizja 3% jest za wysoka'.",
          goal: "Odpowiedź która utrzyma relację i pokaże wartość, bez konfrontacji.",
        },
      },
      {
        id: "opis-pod-social",
        title: "Opis oferty pod social",
        description: "Suchy opis oferty → emocjonalny opis pod IG/FB.",
        result: "Opis 100-150 słów + 3 hooki",
        placeholders: {
          context: "Oferta: 65m², 3 pokoje, Wrzeszcz, 4. piętro, balkon, kuchnia w aneksie, 779 tys.",
          goal: "Opis który przyciągnie młode rodziny szukające mieszkania w Trójmieście.",
        },
      },
    ],
  },
  {
    id: "nieruchomosci",
    name: "Nieruchomości",
    tagline: "Działki, mieszkania, domy. Opisy, kwalifikacje, analiza rynku.",
    description:
      "Wszystko co dotyczy konkretnej nieruchomości. Opisy ofert (mieszkania / domy / działki), analiza lokalnego rynku, profil dzielnicy, kwalifikacja klienta pod ofertę, kampanię, kalkulator kredytu.",
    color: "#576150",
    icon: "🏠",
    enabled: true,
    tools: [
      {
        id: "opis-oferty",
        title: "Opis oferty (mieszkanie/dom/działka)",
        description: "Parametry → profesjonalny opis pod portal (Otodom/OLX).",
        result: "Opis 250-350 słów + tytuł + 5 hashtagów",
        placeholders: {
          context: "Mieszkanie 65m², 3 pokoje, Wrzeszcz, 4 piętro, balkon, miejsce postojowe, 779 tys, do zamieszkania, blok z 2010, czynsz 380 zł.",
          goal: "Opis pod Otodom, hook w pierwszych 2 zdaniach, target młoda rodzina.",
        },
      },
      {
        id: "profil-dzielnicy",
        title: "Profil dzielnicy",
        description: "Nazwa dzielnicy + dla kogo → opis pod ofertę / post / mail.",
        result: "Profil dzielnicy: dla kogo, plusy, minusy, ceny, infrastruktura",
        placeholders: {
          context: "Dzielnica: Wrzeszcz Górny. Dla kogo: młode rodziny szukające mieszkania 60-80m².",
          goal: "Profil pod opis ofert i posty na IG, ton ekspercki-lokalny.",
        },
      },
      {
        id: "analiza-rynku",
        title: "Analiza lokalnego rynku",
        description: "Rynek + okres → trendy cenowe, dynamika, prognoza.",
        result: "Krótki raport: ceny / dynamika / prognoza / rekomendacja",
        placeholders: {
          context: "Rynek: mieszkania wtórne 50-80m² na Wrzeszczu, ostatnie 6 miesięcy.",
          goal: "Krótka analiza dla klienta sprzedającego: czy teraz dobry moment.",
        },
      },
      {
        id: "kwalifikacja-klienta",
        title: "Kwalifikacja klienta pod ofertę",
        description: "Profil klienta + oferta → match/no-match + rekomendacja.",
        result: "Match score + uzasadnienie + 3 alternatywy",
        placeholders: {
          context: "Klient: para 30+, budżet 600-700 tys, szuka 50-65m², 2 pokoje, blisko centrum, dobry dojazd. Oferta: 78m², 3 pokoje, Wrzeszcz, 779 tys.",
          goal: "Czy ta oferta pasuje. Jeśli nie, co zaproponować zamiast.",
        },
      },
      {
        id: "kalkulator-kredytu",
        title: "Symulacja kredytu",
        description: "Cena + wkład → rata + warunki + raty wariantowe.",
        result: "Symulacja kredytu: rata, RRSO, łączny koszt, warianty",
        placeholders: {
          context: "Cena 750 tys, wkład 150 tys (20%), kredyt na 30 lat, oprocentowanie zmienne ~7.2%.",
          goal: "Pokazać klientowi miesięczną ratę + 2 warianty (krótszy okres / większy wkład).",
        },
      },
      {
        id: "checklista-ogladania",
        title: "Checklista oglądania",
        description: "Typ nieruchomości + budżet → 30-punktowa checklista dla klienta.",
        result: "Checklista PDF-ready: stan / instalacje / sąsiedztwo / dokumenty",
        placeholders: {
          context: "Klient ogląda używane mieszkania w blokach z lat 70-tych w Gdańsku, budżet do 600 tys.",
          goal: "Daj klientowi narzędzie żeby sam wykrył ukryte wady przed zakupem.",
        },
      },
    ],
  },
  {
    id: "wycena",
    name: "Wycena",
    tagline: "Wycena nieruchomości, umowy, dokumenty.",
    description:
      "Wszystko co dotyczy wartości i papierów. Wycena porównawcza, analiza wartości, umowa pośrednictwa, oferta sprzedaży, protokół odbioru, pełnomocnictwo. Łączy spojrzenie prawnika, marketera i zarządcy.",
    color: "#b28a52",
    icon: "💼",
    enabled: true,
    tools: [
      {
        id: "wycena-porownawcza",
        title: "Wycena porównawcza",
        description: "Parametry nieruchomości + 3 podobne → szacowana cena rynkowa.",
        result: "Cena szacunkowa + zakres + uzasadnienie + 3 referencje",
        placeholders: {
          context: "Mieszkanie 70m², 3 pokoje, Wrzeszcz, 5 piętro w 8, balkon, do remontu (kuchnia + łazienka). 3 podobne sprzedane: 695 tys (60m² po remoncie), 750 tys (75m² do wprowadzenia), 620 tys (65m² do remontu).",
          goal: "Realny zakres cenowy + cena ofertowa do startu kampanii.",
        },
      },
      {
        id: "analiza-wartosci",
        title: "Analiza wartości — co podnosi cenę",
        description: "Stan obecny → 5 inwestycji które podniosą wartość (ROI).",
        result: "5 inwestycji: koszt + przyrost wartości + ROI",
        placeholders: {
          context: "Mieszkanie 75m² Wrzeszcz, do remontu, klient ma 30 tys budżetu na podniesienie wartości przed sprzedażą. Stan: stara kuchnia, łazienka OK, podłogi do wymiany.",
          goal: "Co zrobić za 30 tys żeby uzyskać max przyrost ceny ofertowej.",
        },
      },
      {
        id: "umowa-posrednictwa",
        title: "Umowa pośrednictwa",
        description: "Strony + warunki → projekt umowy do parafrazowania.",
        result: "Projekt umowy + 3 punkty do indywidualnej negocjacji",
        placeholders: {
          context: "Sprzedający: Pan Krzysztof, mieszkanie 80m² Oliwa. Prowizja 3%, wyłączność 6 mies, cena startowa 850 tys.",
          goal: "Projekt umowy gotowy do podpisu po skonsultowaniu z prawnikiem.",
        },
      },
      {
        id: "oferta-sprzedazy",
        title: "Oferta sprzedaży (formal)",
        description: "Parametry → formalna oferta sprzedaży gotowa do wysłania.",
        result: "Oferta: parametry / cena / warunki / kontakt / załączniki",
        placeholders: {
          context: "Mieszkanie 70m² Sopot, cena 1.2 mln, sprzedaż prywatna, klient pyta o oficjalną ofertę.",
          goal: "Formalna oferta gotowa do wysłania mailem.",
        },
      },
      {
        id: "protokol-odbioru",
        title: "Protokół zdawczo-odbiorczy",
        description: "Strony + nieruchomość → szablon protokołu z punktami kontroli.",
        result: "Protokół: strony / nieruchomość / liczniki / klucze / uwagi",
        placeholders: {
          context: "Odbiór mieszkania 65m² Wrzeszcz po sprzedaży. Sprzedający przekazuje kupującemu klucze, liczniki, dokumenty.",
          goal: "Protokół gotowy do podpisu w dniu przekazania.",
        },
      },
      {
        id: "pelnomocnictwo",
        title: "Pełnomocnictwo",
        description: "Zakres + strony → szablon pełnomocnictwa do podpisu.",
        result: "Pełnomocnictwo: mocodawca / pełnomocnik / zakres / czas",
        placeholders: {
          context: "Klient za granicą, daje pełnomocnictwo agentowi do reprezentowania go w negocjacjach i podpisaniu umowy przedwstępnej.",
          goal: "Pełnomocnictwo notarialne, zakres precyzyjny, czas do końca transakcji.",
        },
      },
    ],
  },
  {
    id: "publikacja",
    name: "Publikacja",
    tagline: "Plan publikacji, repurposing, harmonogram.",
    description:
      "Twój asystent contentowy. Plan publikacji tygodniowy / miesięczny, adaptacja jednego materiału na 5 platform, harmonogram, captiony pod różne formaty (IG, FB, LinkedIn, TikTok).",
    color: "#77536f",
    icon: "📅",
    enabled: true,
    tools: [
      {
        id: "plan-publikacji",
        title: "Plan publikacji (tydzień)",
        description: "Aktualne oferty + wydarzenia → 7-dniowy plan postów na 3 platformach.",
        result: "Plan tygodniowy: dzień / platforma / temat / typ / status",
        placeholders: {
          context: "3 aktywne oferty, 1 sprzedaż w tym tygodniu, sprzedam też raport o rynku Wrzeszcza. Platformy: IG, FB, LinkedIn.",
          goal: "Plan postów na 7 dni, 1-2 posty dziennie, mix typów (oferty / merytoryka / case).",
        },
      },
      {
        id: "repurpose-1-na-5",
        title: "Repurposing 1 → 5",
        description: "Jeden materiał (post / case / wpis) → 5 wariantów na różne platformy.",
        result: "5 wariantów: IG karuzela / IG reel / FB post / LinkedIn artykuł / TikTok skrypt",
        placeholders: {
          context: "Wpis blogowy: '5 błędów przy zakupie mieszkania na wtórnym' (1500 słów).",
          goal: "Z tego jednego wpisu zrobić 5 publikacji w różnych formatach.",
        },
      },
      {
        id: "harmonogram-miesieczny",
        title: "Harmonogram miesięczny",
        description: "Cele biznesowe → kalendarz publikacji na 4 tygodnie.",
        result: "Kalendarz miesięczny: 4 tygodnie x 3 platformy + tematy",
        placeholders: {
          context: "Cele: 5 leadów/tydzień z IG, budowa marki eksperta lokalnego, dosprzedaż konsultacji 200 zł.",
          goal: "Plan content calendar na cały miesiąc, mix tematów, balans typów.",
        },
      },
      {
        id: "caption-multi-platform",
        title: "Caption multi-platform",
        description: "Treść postu → captiony pod IG, FB, LinkedIn, TikTok (różne tony).",
        result: "4 captiony zoptymalizowane pod każdą platformę",
        placeholders: {
          context: "Sprzedaż 80m² na Wrzeszczu w 7 dni, klient z polecenia. Przesłanie: 'jak szybko sprzedaję'.",
          goal: "4 captiony, każdy w tonie pasującym do platformy.",
        },
      },
      {
        id: "hashtags",
        title: "Hashtagi (geo + tematyczne)",
        description: "Lokalizacja + temat → 30 hashtagów dopasowanych.",
        result: "30 hashtagów: 10 lokalnych / 10 tematycznych / 10 brand",
        placeholders: {
          context: "Lokalizacja: Wrzeszcz / Trójmiasto. Temat: mieszkanie wtórne dla młodej rodziny.",
          goal: "Hashtagi pod IG i TikTok, mix popularnych i niszowych.",
        },
      },
    ],
  },
  {
    id: "prawny",
    name: "Prawny",
    tagline: "Kodeks cywilny, ustawy, due diligence.",
    description:
      "Doradca prawny dla agenta nieruchomości. Due diligence, RODO, sprawdzenie umów, wzory dokumentów, najnowsze ustawy o nieruchomościach. Wkrótce: RAG na Kodeksie cywilnym i ustawach z isap.sejm.gov.pl.",
    color: "#1e4e53",
    icon: "⚖️",
    enabled: true,
    tools: [
      {
        id: "checklist-dd",
        title: "Checklista due diligence",
        description: "Typ nieruchomości → 30-punktowa checklista prawna.",
        result: "Checklista: KW / hipoteka / służebność / podatki / dokumenty",
        placeholders: {
          context: "Mieszkanie wtórne na Wrzeszczu, kupujący po raz pierwszy, sprzedający odziedziczył mieszkanie 2 lata temu.",
          goal: "Checklista co sprawdzić przed umową przedwstępną, ze szczególnym naciskiem na sytuację spadkową.",
        },
      },
      {
        id: "rodo-klauzula",
        title: "Klauzula RODO",
        description: "Cel przetwarzania → klauzula RODO do umowy / formularza.",
        result: "Klauzula RODO + krótkie wyjaśnienie dla klienta",
        placeholders: {
          context: "Klient zostawia mi swój email i telefon w trakcie prezentacji mieszkania. Chcę móc go zaprosić na inne oferty i wysłać newsletter.",
          goal: "Klauzula RODO którą podpisze klient, zgodna z aktualnymi przepisami.",
        },
      },
      {
        id: "sprawdz-umowe",
        title: "Sprawdź umowę",
        description: "Wklej fragment umowy → wskazane ryzyka + sugestie zmian.",
        result: "Lista ryzyk + sugestie zmian + co konsultować z prawnikiem",
        placeholders: {
          context: "Klient pokazał mi umowę przedwstępną którą dał mu sprzedający. Wklej fragment dotyczący kar umownych...",
          goal: "Wykryć niekorzystne dla klienta zapisy.",
        },
      },
      {
        id: "wzor-rezerwacji",
        title: "Wzór umowy rezerwacyjnej",
        description: "Strony + warunki → projekt umowy rezerwacyjnej.",
        result: "Wzór umowy + 3 punkty negocjacji",
        placeholders: {
          context: "Klient chce zarezerwować mieszkanie 75m² Sopot, cena 950 tys, kaucja 10 tys, rezerwacja na 14 dni.",
          goal: "Bezpieczna umowa rezerwacyjna chroniąca obie strony.",
        },
      },
      {
        id: "pytanie-prawne",
        title: "Pytanie prawne (ogólne)",
        description: "Konkretne pytanie → analiza + odniesienie do przepisów.",
        result: "Analiza + cytaty przepisów + co konsultować z prawnikiem",
        placeholders: {
          context: "Klient sprzedaje mieszkanie 5 lat po nabyciu, pyta o podatek dochodowy od sprzedaży.",
          goal: "Wyjaśnić sytuację z PIT, ze wskazaniem przepisów (PIT-39, ulga mieszkaniowa).",
        },
      },
    ],
  },
];

export const visibleAgents = () => agents.filter((a) => a.enabled);

export function findAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id);
}

export function findTool(agentId: string, toolId: string): AgentTool | undefined {
  return findAgent(agentId)?.tools.find((t) => t.id === toolId);
}

export function runTool(tool: AgentTool, context: string, goal: string): string {
  if (tool.template) return tool.template(context, goal);
  return def(context, goal);
}
