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
  return `Kontekst:\n${c}\n\nCel:\n${g}\n\nSugerowany output:\n(narzędzie w fazie testów — pełna treść pojawi się wkrótce)`;
};

export const agents: Agent[] = [
  {
    id: "social",
    name: "Social Media",
    tagline: "Karuzele, rolki, posty i opisy.",
    description:
      "Content do social mediów w Twoim tonie. Karuzele IG, skrypty rolek, posty FB/LinkedIn, opisy ofert pod social.",
    color: "#d4006a",
    icon: "📱",
    enabled: true,
    tools: [
      {
        id: "karuzela-ig",
        title: "Karuzela IG / LinkedIn",
        description: "Temat + brief → 8-10 slajdów karuzeli.",
        result: "Karuzela: hook + 8 slajdów + CTA",
        placeholders: {
          context: "Np. temat: 5 błędów przy zakupie mieszkania na wtórnym. Do kogo: pierwszy kupujący, Trójmiasto.",
          goal: "Np. karuzela IG 10 slajdów, ton ekspercki-przyjazny, bez żargonu.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `KARUZELA IG / LINKEDIN\n\nBrief: ${c}\nCel: ${g}\n\n— SLAJDY —\n\nSlajd 1 (HOOK):\nDlaczego większość kupujących traci 20 000 zł na jednej decyzji?\n\nSlajd 2 (OBIETNICA):\nPokażę Ci 5 błędów których unikniesz. Przeczytasz w 2 min.\n\nSlajd 3-7 (PUNKTY):\n[5 konkretów z briefu]\n1. ...\n2. ...\n3. ...\n4. ...\n5. ...\n\nSlajd 8 (KLUCZOWY INSIGHT):\nCo łączy wszystkie te błędy — jedna rzecz.\n\nSlajd 9 (PROOF):\nCase / liczba / cytat klienta.\n\nSlajd 10 (CTA):\nKliknij link w BIO / Napisz [słowo] w komentarzu → dostaniesz PDF-a.\n\n— OPIS POD POSTEM —\n3 warianty caption: ekspercki / emocjonalny / konkretny.`;
        },
      },
      {
        id: "rolka",
        title: "Skrypt rolki / Reels",
        description: "Skrypt + storyboard pod nagranie 30-60 sek.",
        result: "Skrypt + storyboard + hook + CTA",
        placeholders: {
          context: "Np. pokazuję mieszkanie 65m2 w Gdyni Śródmieściu. Chcę zrobić rolkę pokazową.",
          goal: "Np. 45-sekundowy reel, hook pierwsze 3 sekundy, CTA do DM.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `SKRYPT ROLKI\n\nBrief: ${c}\nCel: ${g}\n\n— HOOK (0-3 sek) —\nWizual: [szeroki kadr, rzut oka na mieszkanie]\nTekst na ekranie: "To jest mieszkanie które sprzedam w tygodniu. Zobacz dlaczego."\nGłos: "Pokażę Ci co tu się dzieje."\n\n— BUDOWANIE (3-15 sek) —\nScena 1: [najmocniejszy detal — np. widok z okna]\nScena 2: [rozkład — szybki spacer]\nScena 3: [kuchnia / łazienka — detal]\n\n— KLUCZ (15-35 sek) —\nTekst na ekranie: konkret liczba / benefit.\nGłos: wyjaśnienie dlaczego to wyjątkowe.\n\n— DOMKNIĘCIE (35-45 sek) —\nGłos: "Zainteresowany? Napisz w DM 'MIESZKANIE' — wyślę Ci pełne dane."\nTekst na ekranie: "DM → MIESZKANIE"\n\n— MUZYKA —\nSugestia: [trending audio / spokojna elektronika / lofi]\n\n— HASHTAGI —\n#nieruchomosci #trojmiasto #gdynia #mieszkaniadosprzedania\n\n(Render Remotion w Iteracji 2 — na razie używaj skryptu w CapCut/Canva/Reels native editor.)`;
        },
      },
      {
        id: "post-ig-fb",
        title: "Post FB/IG (3 warianty)",
        description: "Jeden temat, 3 warianty tonu.",
        result: "3 wersje postu + hashtagi",
        placeholders: {
          context: "Np. sprzedałem mieszkanie w 7 dni, chcę o tym napisać.",
          goal: "Np. post FB, ton przyjazny-ekspercki, do lokalnej bazy klientów.",
        },
      },
      {
        id: "opis-pod-social",
        title: "Opis oferty pod social",
        description: "Wersja short (IG post) + long (carousel description).",
        result: "Opis short + long + CTA",
        placeholders: {
          context: "Np. 3-pokojowe 75m2 Sopot Dolny, widok na park, balkon, piętro 3/4.",
          goal: "Np. opis pod post IG i karuzelę, emocjonalny ale konkretny.",
        },
      },
      {
        id: "hashtags",
        title: "Hashtags research",
        description: "Top hashtagi dla lokalizacji i typu nieruchomości.",
        result: "Lista hashtagów: broad + niche + local",
        placeholders: {
          context: "Np. mieszkania na sprzedaż w Trójmieście, premium.",
          goal: "Np. 30 hashtagów — mix broad/niche/local dla Instagram.",
        },
      },
    ],
  },
  {
    id: "prawny",
    name: "Prawny",
    tagline: "Prawo nieruchomości i aktualizacje.",
    description:
      "Wyjaśnienia przepisów, checklisty due diligence, RODO dla agenta, wzory umów i feed zmian prawnych.",
    color: "#1e4e53",
    icon: "⚖️",
    enabled: true,
    tools: [
      {
        id: "checklist-dd",
        title: "Checklist due diligence",
        description: "Lista dokumentów i punktów do sprawdzenia przed transakcją.",
        result: "Checklist 15-20 punktów per typ nieruchomości",
        placeholders: {
          context: "Np. zakup mieszkania z rynku wtórnego, dla klienta na kredyt hipoteczny.",
          goal: "Np. pełna checklista co sprawdzić + jakie dokumenty od sprzedającego.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `CHECKLIST DUE DILIGENCE — NIERUCHOMOŚĆ\n\nKontekst: ${c}\nCel: ${g}\n\n— DOKUMENTY OD SPRZEDAJĄCEGO —\n[ ] Akt notarialny nabycia nieruchomości\n[ ] Wypis z księgi wieczystej (nie starszy niż 3 miesiące)\n[ ] Wypis z rejestru gruntów / rzut lokalu\n[ ] Zaświadczenie o niezaleganiu z opłatami do wspólnoty/spółdzielni\n[ ] Zaświadczenie z urzędu skarbowego (o niezaleganiu)\n[ ] Zaświadczenie o przeznaczeniu terenu (miejscowy plan)\n[ ] Świadectwo charakterystyki energetycznej (aktualne, obowiązek prawny)\n\n— STAN PRAWNY —\n[ ] Czy jest hipoteka? Jaka kwota, jaki bank?\n[ ] Czy są służebności wpisane do księgi?\n[ ] Czy jest roszczenie dożywocia?\n[ ] Czy ktoś jest zameldowany? Wymeldowanie przed aktem.\n[ ] Czy jest współwłasność? Czy wszyscy zgadzają się sprzedać?\n[ ] Czy sprzedający to jedyny właściciel wg księgi?\n\n— STAN TECHNICZNY —\n[ ] Ogląd techniczny (instalacje, wilgoć, okna)\n[ ] Certyfikat energetyczny — klasa, koszt roczny\n[ ] Zaświadczenie o powierzchni (z rzutu vs akt)\n\n— FINANSE —\n[ ] Oszacowanie opłat miesięcznych\n[ ] Symulacja podatku od nieruchomości\n[ ] Koszt notariusza + PCC (2% od wartości) — kto płaci?\n\n— OSTRZEŻENIA —\nUwaga na: pośpiech ze strony sprzedającego, brak dokumentów "na jutro", nietypowo niską cenę (< 15% rynkowej), niejasny stan prawny spadku.\n\n(Checklist wygenerowana — konkretne wpisy dostosuj do lokalnych specyfików.)`;
        },
      },
      {
        id: "rodo",
        title: "RODO dla agenta nieruchomości",
        description: "Co musisz mieć, jak przechowywać dane klientów.",
        result: "Checklist RODO + wzory klauzul",
        placeholders: {
          context: "Np. jednoosobowa działalność, dane klientów w Excelu i Google Drive.",
          goal: "Np. minimum RODO żebym był legalny — klauzule, zabezpieczenia, polityka.",
        },
      },
      {
        id: "ustawa",
        title: "Wyjaśnij przepis",
        description: "Cytat ustawy → wyjaśnienie językiem agenta + konsekwencje.",
        result: "Wyjaśnienie + implikacje praktyczne",
        placeholders: {
          context: "Np. ustawa o kredycie hipotecznym — nowe przepisy 2026, art. 12.",
          goal: "Np. wyjaśnij co to znaczy dla klienta który bierze kredyt.",
        },
      },
      {
        id: "wzor-rezerwacji",
        title: "Wzór umowy rezerwacyjnej",
        description: "Gotowy wzór do edycji, aktualny wg prawa 2026.",
        result: "Wzór .md + luki do uzupełnienia",
        placeholders: {
          context: "Np. sprzedaż mieszkania, kupujący na kredyt, okres oczekiwania 60 dni.",
          goal: "Np. wzór rezerwacji z zadatkiem 10% i warunkiem kredytu.",
        },
      },
    ],
  },
  {
    id: "dokumenty",
    name: "Dokumenty",
    tagline: "Oferty, umowy, pisma urzędowe.",
    description:
      "Generator gotowych dokumentów: oferty sprzedaży, umowy pośrednictwa, protokoły, pełnomocnictwa.",
    color: "#b28a52",
    icon: "📄",
    enabled: true,
    tools: [
      {
        id: "oferta-sprzedazy",
        title: "Oferta sprzedaży nieruchomości",
        description: "Profesjonalna oferta do wysłania klientom.",
        result: "Oferta .md: header + opis + dane + CTA",
        placeholders: {
          context: "Np. mieszkanie 3-pokojowe, Gdynia Redłowo, 75m2, 3 piętro, 780 000 zł.",
          goal: "Np. oferta dla klientów z bazy, email + attachment.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `OFERTA SPRZEDAŻY\n\nKontekst: ${c}\nCel: ${g}\n\n═══════════════════════════════\n\n**OFERTA WYJĄTKOWEJ NIERUCHOMOŚCI**\n\n📍 Lokalizacja: [adres]\n🏠 Typ: [mieszkanie / dom / działka]\n📐 Powierzchnia: [m²]\n🏢 Piętro: [piętro / liczba pięter]\n💰 Cena: [kwota] zł\n\n---\n\n**Co wyróżnia tę nieruchomość**\n\n[3-4 kluczowe zalety — widok, lokalizacja, stan, rozkład]\n\n**W skrócie**\n\n- Ilość pokoi: [ ]\n- Balkon / taras: [ ]\n- Rok budowy: [ ]\n- Stan: [do zamieszkania / do remontu / deweloperski]\n- Ogrzewanie: [ ]\n\n**Dodatkowe atuty**\n\n- [parking, piwnica, domofon itp.]\n\n**Lokalizacja**\n\n[2-3 zdania o okolicy — szkoły, komunikacja, wygody]\n\n---\n\n**Zainteresowany?**\n\nUmów oglądanie:\n📞 [telefon]\n✉️ [email]\n\n═══════════════════════════════\n\n(Dokument do edycji — uzupełnij miejsca w [ ] i dostosuj ton do klienta docelowego.)`;
        },
      },
      {
        id: "umowa-posrednictwa",
        title: "Umowa pośrednictwa",
        description: "Wzór umowy z klientem sprzedającym/kupującym.",
        result: "Wzór .md do edycji",
        placeholders: {
          context: "Np. pośrednictwo przy sprzedaży mieszkania, prowizja 2%.",
          goal: "Np. umowa na wyłączność, 3 miesiące, klient Kowalski.",
        },
      },
      {
        id: "protokol-odbioru",
        title: "Protokół zdawczo-odbiorczy",
        description: "Protokół przekazania kluczy i stanu nieruchomości.",
        result: "Wzór protokołu + checklist stanu",
        placeholders: {
          context: "Np. przekazanie mieszkania kupującemu po akcie notarialnym.",
          goal: "Np. protokół z listą wyposażenia, stanem liczników, kluczy.",
        },
      },
      {
        id: "pelnomocnictwo",
        title: "Wzór pełnomocnictwa",
        description: "Pełnomocnictwo do reprezentowania w transakcji.",
        result: "Wzór pełnomocnictwa notarialnego",
        placeholders: {
          context: "Np. klient za granicą, potrzebuje pełnomocnictwa dla agenta.",
          goal: "Np. pełnomocnictwo szczególne do zawarcia umowy sprzedaży.",
        },
      },
    ],
  },
  {
    id: "research",
    name: "Research",
    tagline: "Rynek, dzielnice, wyceny.",
    description:
      "Analiza rynku, profile dzielnic, wyceny porównawcze, deep dive konkurencji, kalkulatory finansowe.",
    color: "#3b7d78",
    icon: "🔍",
    enabled: true,
    tools: [
      {
        id: "profil-dzielnicy",
        title: "Profil dzielnicy",
        description: "Kompleksowy research lokalizacji dla klienta.",
        result: "Profil: komunikacja, szkoły, wady, zalety, ceny",
        placeholders: {
          context: "Np. klient pyta o Gdynię Redłowo — jak tam jest, czy warto kupić.",
          goal: "Np. briefing 1-2 strony do wysłania klientowi.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `PROFIL DZIELNICY\n\nBrief: ${c}\nCel: ${g}\n\n═══════════════════════════════\n\n🏘️ [DZIELNICA] — KOMPLEKSOWY PROFIL\n\n**Lokalizacja i charakter**\n\n[2-3 zdania — gdzie leży, czym się wyróżnia, kto tu mieszka]\n\n**Komunikacja**\n\n- Do centrum: [czas samochodem / transportem publicznym]\n- Linie SKM / autobus: [numery i częstotliwości]\n- Dostęp do obwodnicy / S6: [min]\n- Parking: [łatwy / trudny / kosztowny]\n\n**Edukacja**\n\n- Szkoły podstawowe: [nazwy, rejon]\n- Licea: [nazwy, ranking]\n- Przedszkola: [dostępność, czas oczekiwania]\n- Uczelnie w pobliżu: [min]\n\n**Codzienne życie**\n\n- Sklepy: [sieci, lokalne]\n- Kawiarnie / restauracje: [skala]\n- Rekreacja: [parki, ścieżki, tereny zielone]\n- Dostęp do morza / wody: [min]\n\n**Ceny nieruchomości (przybliżone, marzec 2026)**\n\n- Mieszkania 2-pokojowe: [XX] tys. / m²\n- Mieszkania 3-pokojowe: [XX] tys. / m²\n- Domy: [XX] tys. / m²\n- Trend: [rosną / stoją / spadają]\n\n**Dla kogo ta dzielnica**\n\n✅ [typ klienta 1]\n✅ [typ klienta 2]\n✅ [typ klienta 3]\n\n**Na co uważać**\n\n⚠️ [potencjalne minusy — hałas, inwestycje miejskie, plan miejscowy]\n\n**Perspektywa**\n\n[co się dzieje — planowane inwestycje, zmiany, trendy]\n\n═══════════════════════════════\n\n(Dane szacunkowe. Przed decyzją zakupową zweryfikuj aktualne ceny w portalach i plan miejscowy.)`;
        },
      },
      {
        id: "wycena",
        title: "Wycena porównawcza",
        description: "Oszacowanie wartości na podstawie podobnych ofert.",
        result: "Estymacja + 5-10 porównywalnych",
        placeholders: {
          context: "Np. mieszkanie 65m2 w Gdyni Śródmieściu, 2 piętro, do remontu.",
          goal: "Np. realna wycena rynkowa + widełki do negocjacji.",
        },
      },
      {
        id: "analiza-rynku",
        title: "Analiza rynku lokalnego",
        description: "Trend cen, czas sprzedaży, konkurencja w segmencie.",
        result: "Raport rynkowy: cena, czas, popyt",
        placeholders: {
          context: "Np. mieszkania 3-pokojowe w Gdańsku Wrzeszczu, ostatnie 6 mies.",
          goal: "Np. briefing dla sprzedającego żeby zrozumiał obecny rynek.",
        },
      },
      {
        id: "kalkulator-kredytu",
        title: "Kalkulator kredytu hipotecznego",
        description: "Szybka estymacja raty, zdolności, kosztów.",
        result: "Raty + koszt całkowity + wymagane dochody",
        placeholders: {
          context: "Np. kredyt 500 000 zł, wkład 20%, 25 lat.",
          goal: "Np. przybliżona rata miesięczna + wymagany dochód na zdolność.",
        },
      },
    ],
  },
  {
    id: "klient",
    name: "Klient",
    tagline: "Komunikacja i sprzedaż.",
    description:
      "Follow-upy, skrypty telefoniczne, obsługa obiekcji, maile negocjacyjne, plany spotkań.",
    color: "#b96d5d",
    icon: "🤝",
    enabled: true,
    tools: [
      {
        id: "follow-up",
        title: "Follow-up po oglądaniu",
        description: "Mail / wiadomość po prezentacji nieruchomości.",
        result: "Follow-up 2 warianty (ciepły + konkretny)",
        placeholders: {
          context: "Np. klient oglądał 2 mieszkania, oba mu się podobały, ale się nie odzywa 3 dni.",
          goal: "Np. ponowny kontakt bez nachalności, propozycja kolejnego kroku.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `FOLLOW-UP PO OGLĄDANIU\n\nBrief: ${c}\nCel: ${g}\n\n═══════════════════════════════\n\n**WARIANT 1 — CIEPŁY (relacyjny)**\n\nTemat: Tak sobie myślę o Pana/Pani wizycie w [nazwa oferty]\n\nDzień dobry,\n\nminęło kilka dni od naszego spotkania — chciałem się upewnić że wszystkie informacje o [nazwa oferty] ma Pan/Pani przemyślane.\n\nJeśli coś się pojawiło w głowie — pytanie, wątpliwość, cokolwiek — proszę napisać. Nie ma złych pytań, jestem po to żeby pomóc.\n\nGdyby chciał Pan/Pani wrócić na kolejne oglądanie (albo zobaczyć coś innego w podobnej kategorii) — daj znać, mam w tym tygodniu dwa wolne terminy.\n\nZ pozdrowieniami,\n[Imię]\n\n---\n\n**WARIANT 2 — KONKRETNY (z propozycją)**\n\nTemat: 3 rzeczy które warto wiedzieć o [nazwa oferty]\n\nDzień dobry,\n\npo naszej wizycie przygotowałem 3 rzeczy które mogą pomóc w decyzji:\n\n1. **[konkret — np. świeży wypis z KW]** — pokazałem Panu/Pani ale teraz mam kopię\n2. **[konkret — np. symulacja kredytu]** — wstępnie, dla tej ceny\n3. **[konkret — np. porównanie z 2 podobnymi]** — żeby zobaczyć czy cena jest rynkowa\n\nMogę podesłać te materiały dziś wieczorem mailem.\n\nOferta [jest / już jest] na portfelu kilku osób. Jeśli to jest ten klimat, warto żebyśmy usiedli spokojnie na 20 min — bez ciśnienia, tylko żeby rozważyć opcje.\n\nPozdrawiam,\n[Imię]\n\n═══════════════════════════════\n\n(Wybierz wariant wg relacji — warunek 1 gdy znasz klienta dobrze, wariant 2 gdy relacja biznesowa.)`;
        },
      },
      {
        id: "cold-call",
        title: "Skrypt cold call",
        description: "Scenariusz rozmowy telefonicznej do sprzedawcy/kupującego.",
        result: "Skrypt 3-5 min + obsługa obiekcji",
        placeholders: {
          context: "Np. dzwonię do sprzedającego z bazy — oferta wisi 4 miesiące.",
          goal: "Np. otworzyć rozmowę o obniżce ceny lub zmianie strategii.",
        },
      },
      {
        id: "obiekcje",
        title: "Obsługa obiekcji (top 10)",
        description: "Najczęstsze obiekcje + gotowe odpowiedzi.",
        result: "10 obiekcji × 2-3 warianty odpowiedzi",
        placeholders: {
          context: "Np. zastrzeżenia kupujących na rynku wtórnym w Trójmieście.",
          goal: "Np. ściągawka do rozmów — top 10 obiekcji + jak odpowiadać.",
        },
      },
      {
        id: "mail-negocjacyjny",
        title: "Mail negocjacyjny",
        description: "Mail przy negocjacji ceny lub warunków.",
        result: "Mail + strategia + alternatywy",
        placeholders: {
          context: "Np. klient oferuje 720 000 zł za nieruchomość wystawioną za 780 000 zł.",
          goal: "Np. kontrpropozycja 760 000 zł z dodatkowym benefitem (meble? termin?).",
        },
      },
      {
        id: "plan-spotkania",
        title: "Plan spotkania z klientem",
        description: "Agenda pierwszego / kolejnego spotkania.",
        result: "Plan 30-60 min + pytania + materiały",
        placeholders: {
          context: "Np. pierwsze spotkanie z parą która sprzedaje dom po rodzicach.",
          goal: "Np. plan spotkania + pytania do wywiadu + materiały do pokazania.",
        },
      },
    ],
  },
  {
    id: "finanse",
    name: "Finanse",
    tagline: "Kalkulatory, prowizje, rozliczenia.",
    description:
      "Kalkulacje prowizji, ROI ofert, koszty transakcyjne, rozliczenia pośrednictwa, podatki.",
    color: "#7c5d99",
    icon: "💰",
    enabled: true,
    tools: [
      {
        id: "kalkulator-prowizji",
        title: "Kalkulator prowizji",
        description: "Symulacja prowizji z transakcji + rozliczenia.",
        result: "Prowizja brutto/netto + rozliczenia",
        placeholders: {
          context: "Np. sprzedaż za 780 000 zł, prowizja 2%, podział 50/50 z drugim agentem.",
          goal: "Np. pełne rozliczenie: moja prowizja, VAT, podział, zysk netto.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `KALKULATOR PROWIZJI\n\nBrief: ${c}\nCel: ${g}\n\n═══════════════════════════════\n\n**DANE WEJŚCIOWE**\n- Cena transakcji: [KWOTA] zł\n- Stawka prowizji: [%]\n- Podział z agentem: [% mój / % drugi agent]\n- VAT: 23% (jeśli płatnik)\n\n**KALKULACJA**\n\nProwizja brutto z transakcji = [cena] × [stawka%]\n= __________ zł\n\nTwój udział (% × prowizja) = __________ zł\n\nVAT 23% (jeśli wystawiasz fakturę VAT) = __________ zł\nProwizja netto = __________ zł\n\n**KOSZTY OPERACYJNE (przybliżone)**\n- ZUS i składki: ~1 200 zł/mies (proporcjonalnie)\n- Marketing (jeśli przypisany do tej transakcji): __________ zł\n- Dojazdy, prezentacje, dokumenty: __________ zł\n\n**ZYSK NETTO PO KOSZTACH**\n__________ zł\n\n**PODATEK DOCHODOWY**\n- Liniowy 19% lub ryczałt 8,5% (w zależności od formy)\n- Kwota podatku: __________ zł\n\n**ZYSK PO PODATKU**\n__________ zł\n\n═══════════════════════════════\n\n(Uwaga: kalkulacja orientacyjna. Skonsultuj z księgową swoją formę opodatkowania i rzeczywiste koszty.)`;
        },
      },
      {
        id: "roi-oferty",
        title: "ROI kampanii ofert",
        description: "Zwrot z inwestycji w marketing oferty.",
        result: "ROI + metryki + rekomendacje",
        placeholders: {
          context: "Np. oferta wystawiona 60 dni, 800 zł w reklamy FB, 12 leadów.",
          goal: "Np. czy to się opłaca, co poprawić.",
        },
      },
      {
        id: "koszty-transakcji",
        title: "Koszty transakcji dla klienta",
        description: "Pełne koszty kupna — PCC, notariusz, bank, opłaty.",
        result: "Tabela kosztów + suma",
        placeholders: {
          context: "Np. zakup mieszkania za 780 000 zł z kredytem 80%.",
          goal: "Np. pełna tabela kosztów dla klienta, żeby wiedział ile realnie wyda.",
        },
      },
      {
        id: "podatki",
        title: "Podatki od nieruchomości",
        description: "Obowiązki podatkowe przy sprzedaży / zakupie.",
        result: "Podatki + terminy + kwoty",
        placeholders: {
          context: "Np. sprzedaż mieszkania odziedziczonego 3 lata temu.",
          goal: "Np. czy jest podatek dochodowy, jak uniknąć, terminy.",
        },
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    tagline: "Metryki, raporty, KPI.",
    description:
      "Raporty miesięczne, śledzenie leadów, metryki ofert, ROI kampanii, analiza konwersji.",
    color: "#576150",
    icon: "📊",
    enabled: true,
    tools: [
      {
        id: "raport-miesieczny",
        title: "Raport miesięczny",
        description: "Podsumowanie miesiąca: leady, oferty, transakcje.",
        result: "Raport PDF + wnioski + plan na kolejny miesiąc",
        placeholders: {
          context: "Np. kwiecień 2026: 18 leadów, 4 prezentacje, 1 transakcja, 3 nowe oferty.",
          goal: "Np. raport do przeglądu osobistego + ustalenie celów na maj.",
        },
        template: (context, goal) => {
          const c = context.trim() || "(kontekst nie podany)";
          const g = goal.trim() || "(cel nie podany)";
          return `RAPORT MIESIĘCZNY\n\nDane: ${c}\nCel: ${g}\n\n═══════════════════════════════\n\n**MIESIĄC: [miesiąc rok]**\n\n— ACTIVITY —\n- Nowe leady: [liczba]\n- Prezentacje przeprowadzone: [liczba]\n- Oferty pozyskane: [liczba]\n- Transakcje sfinalizowane: [liczba]\n\n— KONWERSJE —\n- Lead → prezentacja: __%\n- Prezentacja → oferta: __%\n- Oferta → transakcja: __%\n\n— PRZYCHODY —\n- Prowizje brutto: __________ zł\n- Prowizje netto (po VAT): __________ zł\n- Koszty (marketing + operacyjne): __________ zł\n- Zysk netto: __________ zł\n\n— TOP 3 ŹRÓDŁA LEADÓW —\n1. [źródło] — X leadów\n2. [źródło] — X leadów\n3. [źródło] — X leadów\n\n— TOP 3 WYZWANIA —\n1. [wyzwanie]\n2. [wyzwanie]\n3. [wyzwanie]\n\n— WNIOSKI —\n[3-4 zdania o tym co działało, co nie]\n\n— PLAN NA KOLEJNY MIESIĄC —\n1. [cel SMART]\n2. [cel SMART]\n3. [cel SMART]\n\n═══════════════════════════════\n\n(Aktualizuj dane w swoim systemie CRM/arkuszu. Generuj raz w miesiącu dla siebie.)`;
        },
      },
      {
        id: "lead-tracking",
        title: "System trackingu leadów",
        description: "Arkusz + procedura śledzenia leadów w pipeline.",
        result: "Szablon Google Sheet + pipeline stages",
        placeholders: {
          context: "Np. obecnie 30 leadów w bazie, nie wiem gdzie który jest.",
          goal: "Np. prosty system trackingu — stage, kontakt, next step.",
        },
      },
      {
        id: "oferta-performance",
        title: "Performance oferty",
        description: "Analiza skuteczności konkretnej oferty.",
        result: "Wyświetlenia, leady, konwersja, rekomendacje",
        placeholders: {
          context: "Np. oferta wisi 45 dni, 2400 wyświetleń, 8 zapytań, 1 prezentacja.",
          goal: "Np. co jest nie tak, co zmienić — cena, opis, zdjęcia, kanały.",
        },
      },
      {
        id: "kpi-miesiac",
        title: "KPI na nowy miesiąc",
        description: "Cele SMART dla agenta na miesiąc.",
        result: "5-7 KPI + jak mierzyć + plan działań",
        placeholders: {
          context: "Np. chcę osiągnąć 2 transakcje miesięcznie, teraz robię 0,5.",
          goal: "Np. realne KPI + plan dojścia do celu.",
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
