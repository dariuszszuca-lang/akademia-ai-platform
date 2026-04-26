import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Estymacja kosztów · Akademia AI',
  description: 'Szczegółowa analiza kosztów operacyjnych platformy z agentami AI dla 10-200 użytkowników.',
}

export default function RaportKoszty() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient bg */}
      <div
        className="fixed inset-0 pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(circle at 15% 0%, rgba(251,191,36,0.06), transparent 50%), radial-gradient(circle at 85% 100%, rgba(251,191,36,0.04), transparent 50%)',
        }}
      />

      <header className="relative z-10 px-6 sm:px-12 py-6 flex items-center justify-between border-b border-foreground/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xl font-medium tracking-tight">
            <span className="text-amber-400">Akademia</span>
            <span className="text-foreground/60 ml-1">AI</span>
          </span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-foreground/40">
          Raport · Estymacja kosztów
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 sm:px-12 py-12 sm:py-20 space-y-20">
        {/* COVER */}
        <section className="space-y-6 animate-fade-in-up">
          <div className="text-[11px] uppercase tracking-[0.3em] text-amber-400">
            01 · Estymacja v1 · 26 kwietnia 2026
          </div>
          <h1 className="text-foreground text-4xl sm:text-6xl font-medium leading-[1.05] tracking-tight">
            Ile kosztuje uruchomienie<br />i utrzymanie platformy<br />
            <span className="text-amber-400">z agentami AI.</span>
          </h1>
          <p className="text-foreground/55 text-lg leading-relaxed max-w-2xl">
            Analiza kosztów dla 10, 30, 50, 100 i 200 aktywnych użytkowników. Tokeny Anthropic,
            infrastruktura AWS, Vercel, narzędzia uzupełniające. Modele cenowe i optymalizacje.
          </p>
        </section>

        {/* TLDR */}
        <Section number="02" title="TL;DR cenowy">
          <p className="text-foreground/60 text-base leading-relaxed mb-8">
            Średni koszt na aktywnego użytkownika to <Strong>$3-5/miesiąc</Strong> (Anthropic API).
            Plus stałe koszty infrastruktury (AWS + Vercel + reszta) ~$80-130/miesiąc niezależnie od
            liczby użytkowników do ~100 osób. Cena subskrypcji minimum
            <Strong> 99-199 zł / user / miesiąc</Strong> żeby było rentowne z marżą i buforem.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <PriceCard users="10" total="$149" perUser="$14,90" />
            <PriceCard users="30" total="$217" perUser="$7,23" />
            <PriceCard users="50" total="$285" perUser="$5,70" />
            <PriceCard users="100" total="$503" perUser="$5,03" highlight />
            <PriceCard users="200" total="$892" perUser="$4,46" />
          </div>

          <p className="text-foreground/35 text-xs mt-6 leading-relaxed">
            Założenia: średni użytkownik (60% bazy), 80 wywołań agenta / miesiąc, 70% Sonnet / 30% Haiku,
            prompt caching włączony (~30% oszczędności), AWS infra w sensownych defaultach, Vercel Pro.
          </p>
        </Section>

        {/* TOKENS */}
        <Section number="03" title="Zużycie tokenów na użytkownika">
          <p className="text-foreground/60 text-base leading-relaxed mb-6">
            Token = jednostka rozliczeniowa Anthropic. 1 token ≈ 4 znaki w polskim. Profil + persony =
            ~3000 tokenów wstrzykiwanych przy każdym wywołaniu agenta. Output agenta ~2000 tokenów.
          </p>

          <SubHeading>Onboarding (jednorazowo)</SubHeading>
          <Table
            headers={['Etap', 'Tokens IN', 'Tokens OUT', 'Razem', 'Koszt']}
            rightCols={[1, 2, 3, 4]}
            rows={[
              ['Express Wizard, generowanie profil.md', '3 000', '2 000', '5 000', '$0,039'],
              ['Persona Buyer (ścieżka A: 2 calls / B: 1 call)', '5 000', '3 500', '8 500', '$0,068'],
              ['Persona Seller', '5 000', '3 500', '8 500', '$0,068'],
              ['Deep Profile (~50% userów)', '4 500', '2 500', '7 000', '$0,051'],
            ]}
            totalRow={['RAZEM (one-time)', '17 500', '11 500', '29 000', '~$0,23']}
          />

          <SubHeading className="mt-10">Codzienne użycie (per user / miesiąc)</SubHeading>
          <Table
            headers={['Profil użycia', '% bazy', 'Wywołań / mies', 'Tokens / mies', 'Koszt / mies']}
            rightCols={[1, 2, 3, 4]}
            rows={[
              ['Light user (logowanie 1-2× tydz.)', '10%', '20', '140 000', '$0,80'],
              ['Average user (regularnie)', '60%', '80', '560 000', '$3,20'],
              ['Heavy user (codziennie)', '25%', '160', '1 120 000', '$6,40'],
              ['Power user (intensywnie)', '5%', '400', '2 800 000', '$16,00'],
            ]}
            subtotalRow={['Średnia ważona po profilach', '100%', '~95', '~665 000', '$3,80']}
          />

          <Note>
            Prompt caching obniża koszt o ~30% przy długim system promptcie (profil + persony). Routing
            70% Sonnet / 30% Haiku obniża średnio o ~25%. Z oboma optymalizacjami: ~$2,50-3,50 / user / mies.
          </Note>
        </Section>

        {/* ANTHROPIC PRICING */}
        <Section number="04" title="Cennik Anthropic Claude">
          <p className="text-foreground/60 text-base leading-relaxed mb-6">
            Pay-as-you-go, brak subskrypcji ani minimum. Płacisz tylko za przepływające tokeny.
            Faktura miesięczna z konsoli console.anthropic.com.
          </p>

          <Table
            headers={['Model', 'Input ($/1M)', 'Output ($/1M)', 'Cache read', 'Cache write', 'Zastosowanie']}
            rightCols={[1, 2, 3, 4]}
            rows={[
              ['Claude Sonnet 4.6', '$3,00', '$15,00', '$0,30', '$3,75', 'Główny silnik, agenty premium'],
              ['Claude Haiku 4.5', '$1,00', '$5,00', '$0,10', '$1,25', 'Prosty content, klasyfikacje'],
              ['Claude Opus 4.7', '$15,00', '$75,00', '$1,50', '$18,75', 'Tylko trudne zadania (prawo)'],
            ]}
          />

          <SubHeading className="mt-8">Strategia routingu</SubHeading>
          <ul className="space-y-2 text-foreground/70 text-base leading-relaxed">
            <li>
              <Strong>Sonnet 4.6</Strong> dla 70% wywołań: agent prawny (research, podsumowania), CEO
              (planowanie), wycena. Wszędzie gdzie potrzebna jakość.
            </li>
            <li>
              <Strong>Haiku 4.5</Strong> dla 30% wywołań: opisy ofert (Marketing/Publikacja agent),
              klasyfikacja zapytań, krótkie odpowiedzi.
            </li>
            <li>
              <Strong>Opus 4.7</Strong> opcjonalnie dla agenta prawnego przy zapytaniu wymagającym deep
              reasoning + RAG ustawowy. Można pominąć w MVP.
            </li>
          </ul>

          <Highlight>
            <Strong>Brak subskrypcji.</Strong> Anthropic API to czysty pay-per-use. Nie ma „Plan Pro” ani
            „Enterprise” w sensie miesięcznego abonamentu. Płacisz za realne zużycie. To duży plus, ale
            wymaga monitoringu (token tracking per user) żeby nie zaskoczył nas heavy user generujący 10× normy.
          </Highlight>

          <SubHeading className="mt-8">Optymalizacje</SubHeading>
          <ul className="space-y-2 text-foreground/70 text-base leading-relaxed">
            <li>
              <Strong>Prompt caching</Strong>: system prompt + profil użytkownika = ~3000 tokenów cachowanych.
              Pierwsze wywołanie standardowa cena + 25% za cache write. Każde kolejne 90% taniej. Realna oszczędność: 30-40%.
            </li>
            <li>
              <Strong>Rate limiting per user</Strong>: limit 100 wywołań / dzień / user. Power user nie zniszczy budżetu.
            </li>
            <li>
              <Strong>Streaming</Strong>: zamiast całej odpowiedzi naraz, streaming pozwala anulować wywołanie w środku.
            </li>
            <li>
              <Strong>Kontekst RAG (legal)</Strong>: tylko relevant chunks z bazy ustaw, nie cały Kodeks cywilny.
              Vector search zwraca top 3-5 fragmentów ~500 tokens każdy.
            </li>
          </ul>
        </Section>

        {/* AWS */}
        <Section number="05" title="Infrastruktura AWS i Vercel">
          <p className="text-foreground/60 text-base leading-relaxed mb-6">
            AWS account już skonfigurowany: <Pill>261965598943</Pill>. Cognito + S3 + RDS + CloudFront gotowe.
            Vercel pełni rolę hostingu dla Next.js (frontend + API routes). RDS jest jedynym znaczącym kosztem
            stałym, reszta skaluje się z użyciem.
          </p>

          <Table
            headers={['Usługa', 'Co robi', '10 users', '50 users', '100 users', '200 users']}
            rightCols={[2, 3, 4, 5]}
            rows={[
              ['Vercel Pro', 'Hosting Next.js, edge functions, analytics', '$20', '$20', '$40', '$80'],
              ['RDS PostgreSQL', 'Profile, persony, historia agentów, RAG', '$30', '$35', '$45', '$60'],
              ['Cognito', 'Auth (free do 10k MAU)', '$0', '$0', '$0', '$0'],
              ['S3', 'Markdown, uploady, generated content', '$1', '$2', '$3', '$5'],
              ['CloudFront', 'CDN dla statycznych assetów + API cache', '$5', '$8', '$12', '$20'],
              ['Vector DB (Pinecone / pgvector)', 'RAG dla Kodeksu cywilnego, ustaw, Geoportal', '$0', '$0', '$25', '$35'],
              ['CloudWatch + Logs', 'Monitoring, błędy, traces', '$3', '$5', '$8', '$12'],
              ['Data transfer', 'Egress, API calls', '$5', '$10', '$15', '$25'],
            ]}
            subtotalRow={['Razem infra', '', '$64', '$80', '$148', '$237']}
          />

          <Note>
            Pinecone Starter darmowy do 100k wektorów (wystarczy dla 50 userów + Kodeks cywilny). Powyżej 100
            userów warto rozważyć pgvector (PostgreSQL extension) lub upgrade Pinecone do Standard.
          </Note>
        </Section>

        {/* OTHER */}
        <Section number="06" title="Pozostałe koszty">
          <Table
            headers={['Pozycja', 'Co i dlaczego', 'Miesięcznie']}
            rightCols={[2]}
            rows={[
              ['Domena', 'akademia-ai.pl + ewentualne subdomeny', '$1,25'],
              ['Email transactional (Resend)', 'Powiadomienia, reset hasła, raporty', '$20'],
              ['Stripe (subskrypcje)', '2,9% + $0,30 / transakcja. Liczone od przychodu.', '~3% MRR'],
              ['Sentry (monitoring błędów)', 'Tracking exceptions, performance, opcja', '$26'],
              ['Backupy + storage zewnętrzne', 'Snapshot RDS, S3 versioning', '$5'],
              ['Geoportal API', 'Dostęp do rejestru cen transakcyjnych', '$0-50'],
            ]}
            subtotalRow={['Razem pozostałe (bez Stripe)', '', '~$55']}
          />
        </Section>

        {/* FULL ESTIMATE */}
        <Section number="07" title="Pełna estymacja per tier">
          <Table
            headers={['Pozycja', '10 users', '30 users', '50 users', '100 users', '200 users']}
            rightCols={[1, 2, 3, 4, 5]}
            rows={[
              ['Anthropic API (avg $3-5 / user)', '$30', '$90', '$150', '$300', '$600'],
              ['AWS + Vercel infra', '$64', '$72', '$80', '$148', '$237'],
              ['Pozostałe (email, monitoring, domena)', '$55', '$55', '$55', '$55', '$55'],
            ]}
            totalRow={['Razem / miesiąc', '$149', '$217', '$285', '$503', '$892']}
          />

          <Table
            headers={['', '10 users', '30 users', '50 users', '100 users', '200 users']}
            rightCols={[1, 2, 3, 4, 5]}
            rows={[
              ['Per user / miesiąc', '$14,90', '$7,23', '$5,70', '$5,03', '$4,46'],
              ['W PLN (kurs 4,1)', '611 zł', '890 zł', '1 169 zł', '2 062 zł', '3 657 zł'],
            ]}
          />

          <Highlight>
            <Strong>Cena minimalna subskrypcji żeby było rentowne:</Strong> jeśli celujesz w marżę 70-80%
            (zdrowy SaaS), abonament powinien być <Strong>$15-29/miesiąc per user</Strong> (~60-120 zł).
            Power userzy mogą wymagać tieru „Pro” $49-99/miesiąc z wyższym limitem wywołań agentów.
          </Highlight>
        </Section>

        {/* SCENARIOS */}
        <Section number="08" title="Scenariusze cenowe i monetyzacja">
          <SubHeading>Scenariusz A: konserwatywny (ostrożny start)</SubHeading>
          <ul className="space-y-2 text-foreground/70 text-base leading-relaxed mb-8">
            <li>Cena: <Strong>49 zł / miesiąc</Strong> per user</li>
            <li>Limit: 50 wywołań agenta / dzień</li>
            <li>Marża przy 50 userach: 49 × 50 = 2 450 zł przychód, ~1 200 zł koszt → marża 51%</li>
            <li>Plus: sprzedaż one-time content (kurs, warsztat, raport) jako add-on</li>
          </ul>

          <SubHeading>Scenariusz B: premium (zalecany dla USP „asystent AI agenta nieruchomości”)</SubHeading>
          <ul className="space-y-2 text-foreground/70 text-base leading-relaxed mb-8">
            <li>Cena: <Strong>199 zł / miesiąc</Strong> per user (Pro tier)</li>
            <li>Limit: 200 wywołań / dzień + Opus dostępny dla zadań prawnych</li>
            <li>Marża przy 50 userach: 199 × 50 = 9 950 zł przychód, ~1 500 zł koszt → marża 85%</li>
            <li>Plus: dodatkowe usługi (consulting, custom agents, white-label)</li>
          </ul>

          <SubHeading>Scenariusz C: hybryda (zalecane na początek)</SubHeading>
          <ul className="space-y-2 text-foreground/70 text-base leading-relaxed mb-8">
            <li><Strong>Free / Trial</Strong>: 7 dni full + 5 wywołań / dzień po trialu (lead magnet)</li>
            <li><Strong>Starter 99 zł</Strong> / mies: 50 wywołań / dzień, Sonnet only</li>
            <li><Strong>Pro 199 zł</Strong> / mies: 200 wywołań / dzień, Sonnet + Haiku routing, baza prawna</li>
            <li><Strong>Agency 499 zł</Strong> / mies: nielimitowane, multi-user, white-label, własne agenty</li>
          </ul>

          <SubHeading>Break-even per tier</SubHeading>
          <Table
            headers={['Tier', '10 users', '30 users', '50 users', '100 users']}
            rightCols={[1, 2, 3, 4]}
            rows={[
              ['Starter (99 zł)', '990 / 611 zł = +62%', '2 970 / 890 zł = +234%', '4 950 / 1 169 zł = +323%', '9 900 / 2 062 zł = +380%'],
              ['Pro (199 zł)', '1 990 / 611 zł = +226%', '5 970 / 890 zł = +571%', '9 950 / 1 169 zł = +751%', '19 900 / 2 062 zł = +865%'],
            ]}
          />

          <Note>
            Założenie: wszyscy userzy w tym samym tieru. W rzeczywistości dystrybucja typu 60% Starter, 30%
            Pro, 10% Agency. Średnio cena ważona ~150-180 zł / user.
          </Note>
        </Section>

        {/* OPTIMIZATIONS */}
        <Section number="09" title="Optymalizacje i ryzyka">
          <SubHeading>Top 5 optymalizacji kosztowych</SubHeading>
          <ol className="space-y-3 text-foreground/70 text-base leading-relaxed mb-8 list-decimal pl-5">
            <li>
              <Strong>Prompt caching</Strong> w Anthropic API. System prompt + profil + persony to ~3000 tokenów
              cachowanych. Włączenie obniża koszt input o ~70% przy częstych wywołaniach. <Pill>priorytet 1</Pill>
            </li>
            <li>
              <Strong>Smart routing Sonnet/Haiku</Strong>. Klasyfikacja zapytania: prosty content → Haiku, research
              i reasoning → Sonnet. Oszczędność ~25% średnio. <Pill>priorytet 2</Pill>
            </li>
            <li>
              <Strong>Rate limiting per user</Strong>. Power user (5% bazy) konsumuje ~30% tokenów. Limit 100
              wywołań/dzień. <Pill>priorytet 1</Pill>
            </li>
            <li>
              <Strong>RAG z chunkami zamiast pełnych ustaw</Strong>. Top-5 chunków po 500 tokenów = 2500 tokenów
              input zamiast 50 000+. Critical dla agenta prawnego.
            </li>
            <li>
              <Strong>Batch processing nocne</Strong>. Niektóre zadania mogą lecieć przez Anthropic Message Batches
              API z 50% zniżką.
            </li>
          </ol>

          <SubHeading>Główne ryzyka kosztowe</SubHeading>
          <ul className="space-y-2 text-foreground/70 text-base leading-relaxed">
            <li><Strong>Heavy / power user</Strong>: 5% bazy może generować 30-50% kosztów. Mitygacja: rate limit + tier „Agency”.</li>
            <li><Strong>Geoportal API limit</Strong>: w skali 200+ userów może być problem. Mitygacja: cache codzienny.</li>
            <li><Strong>Vector DB scaling</Strong>: powyżej 1M wektorów Pinecone Standard $70/mies.</li>
            <li><Strong>Legalność danych prawnych</Strong>: scrape isap.sejm.gov.pl rate-limited. LEX/Lexlege ~5000 zł/mies.</li>
            <li><Strong>Anthropic outage</Strong>: brak fallback = sklep nie działa. Mitygacja: fallback na OpenAI GPT-4.</li>
            <li><Strong>RODO / GDPR</Strong>: profile to dane osobowe + biznesowe. DPIA, RODO compliance, koszt prawny one-time 2000-5000 zł.</li>
          </ul>
        </Section>

        {/* ROADMAP */}
        <Section number="10" title="Roadmap finansowy: pierwsze 6 miesięcy">
          <Table
            headers={['Mies.', 'Faza', 'Userzy', 'Koszt', 'Przychód (Pro 199 zł)', 'Wynik']}
            rightCols={[2, 3, 4, 5]}
            rows={[
              ['M1', 'Closed alpha (Wojtek + 5 testerów)', '5', '~$110 (450 zł)', '0 zł (free)', '−450 zł'],
              ['M2', 'Public beta, early adopter pricing', '15', '~$170 (700 zł)', '15 × 99 zł = 1 485 zł', '+785 zł'],
              ['M3', 'Launch + warsztat KW jako conduit', '30', '~$220 (900 zł)', '30 × 149 zł = 4 470 zł', '+3 570 zł'],
              ['M4', 'Scale, dodanie Pro tier', '50', '~$285 (1 170 zł)', '50 × 169 zł = 8 450 zł', '+7 280 zł'],
              ['M5', 'NSL community + KW oddziały', '100', '~$500 (2 050 zł)', '100 × 179 zł = 17 900 zł', '+15 850 zł'],
              ['M6', 'Stabilizacja, Agency tier', '150', '~$700 (2 870 zł)', '150 × 189 zł = 28 350 zł', '+25 480 zł'],
            ]}
            totalRow={['CUMULATIVE', '6 miesięcy', '', '~$1 985 (8 140 zł)', '~60 655 zł', '+52 515 zł']}
          />

          <Note>
            Założenia optymistyczne: dystrybucja, zero churnu, brak akwizycji płatnej. Realnie: dodać 3-5 tys.
            zł / mies marketingu i churn 5-10% / mies w pierwszych 3 miesiącach.
          </Note>
        </Section>

        {/* DECISIONS */}
        <Section number="11" title="Decyzje do podjęcia">
          <ol className="space-y-3 text-foreground/70 text-base leading-relaxed list-decimal pl-5">
            <li>
              <Strong>Hosting</Strong>: Vercel (szybki, drogi) czy AWS Amplify / ECS (taniej, dłuższy setup)?
              Rekomendacja: <Strong>Vercel</Strong> do 100 userów, potem migracja.
            </li>
            <li>
              <Strong>Vector DB</Strong>: Pinecone Starter (free) czy pgvector w RDS? Rekomendacja:{' '}
              <Strong>Pinecone</Strong> w MVP, pgvector przy 200+.
            </li>
            <li>
              <Strong>Pricing model</Strong>: 3 tiery (Starter/Pro/Agency) czy flat? Rekomendacja:{' '}
              <Strong>3 tiery</Strong>.
            </li>
            <li>
              <Strong>Free trial</Strong>: 7 czy 14 dni? Rekomendacja: <Strong>14 dni z kartą</Strong>.
            </li>
            <li>
              <Strong>Routing modelu</Strong>: Sonnet only czy smart routing od razu? Rekomendacja:{' '}
              <Strong>Sonnet only</Strong> w MVP.
            </li>
            <li>
              <Strong>Baza prawna</Strong>: scrape sejm.gov.pl czy LEX (~5k zł/mies)? Rekomendacja:{' '}
              <Strong>scrape</Strong> w MVP.
            </li>
          </ol>
        </Section>

        {/* BUDGET */}
        <Section number="12" title="Konkretny budżet operacyjny na start (M1-M3)">
          <Table
            headers={['Pozycja', 'M1 (5 users)', 'M2 (15 users)', 'M3 (30 users)']}
            rightCols={[1, 2, 3]}
            rows={[
              ['Anthropic API', '$15', '$45', '$90'],
              ['Vercel Pro', '$20', '$20', '$20'],
              ['RDS PostgreSQL', '$30', '$30', '$32'],
              ['Inne AWS (S3, CloudFront, logs)', '$10', '$15', '$22'],
              ['Email (Resend)', '$20', '$20', '$20'],
              ['Domena', '$1,25', '$1,25', '$1,25'],
              ['Sentry (monitoring)', '$0 (free)', '$26', '$26'],
              ['Pinecone (vector DB)', '$0 (free)', '$0', '$0'],
            ]}
            subtotalRow={['USD razem', '$96', '$157', '$211']}
            totalRow={['PLN (kurs 4,1)', '~395 zł', '~645 zł', '~865 zł']}
          />

          <p className="text-foreground/70 text-base leading-relaxed mt-6">
            <Strong>Bufor + niespodzianki:</Strong> dodać +30% na koszty których nie przewidujemy w pierwszych
            3 miesiącach (testy, restart środowiska, dodatkowe API). Czyli realnie ~500 zł M1, ~840 zł M2, ~1 125 zł M3.
          </p>

          <Highlight>
            <Strong>Wniosek:</Strong> w pierwszych 3 miesiącach maksymalnie ~3 tys. zł kosztów operacyjnych.
            Realnie pokrywa się to z 15-20 płacącymi użytkownikami w tieru Pro 199 zł. Break-even przy ~10-15
            płacących userach.
          </Highlight>
        </Section>

        <footer className="pt-12 mt-20 border-t border-foreground/[0.06] flex justify-between items-center text-foreground/30 text-xs">
          <span>Akademia AI · Estymacja kosztów v1</span>
          <span>26 kwietnia 2026</span>
        </footer>
      </main>
    </div>
  )
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 animate-fade-in-up">
      <div className="flex items-baseline gap-4">
        <span className="text-amber-400/70 text-[11px] uppercase tracking-[0.3em] font-medium">{number}</span>
        <h2 className="text-foreground text-2xl sm:text-3xl font-medium tracking-tight">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  )
}

function SubHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-foreground text-base font-medium mt-2 mb-3 ${className}`}>{children}</h3>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-foreground font-medium">{children}</strong>
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 text-[11px] font-medium align-middle">
      {children}
    </span>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 pl-4 border-l-2 border-foreground/10 text-foreground/45 text-sm leading-relaxed italic">
      {children}
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 p-5 rounded-xl bg-amber-400/[0.06] border border-amber-400/20 text-foreground/80 text-base leading-relaxed">
      {children}
    </div>
  )
}

function PriceCard({
  users,
  total,
  perUser,
  highlight = false,
}: {
  users: string
  total: string
  perUser: string
  highlight?: boolean
}) {
  return (
    <div
      className={
        'p-5 rounded-xl border text-center transition-all ' +
        (highlight
          ? 'bg-amber-400/[0.08] border-amber-400/40'
          : 'bg-foreground/[0.02] border-foreground/[0.08]')
      }
    >
      <div className="text-foreground/40 text-[10px] uppercase tracking-[0.2em] mb-2">{users} users</div>
      <div
        className={
          'text-3xl font-medium leading-none ' + (highlight ? 'text-amber-400' : 'text-foreground')
        }
      >
        {total}
      </div>
      <div className="text-foreground/40 text-xs mt-2">{perUser} / user</div>
    </div>
  )
}

type TableProps = {
  headers: string[]
  rows: string[][]
  rightCols?: number[]
  subtotalRow?: string[]
  totalRow?: string[]
}

function Table({ headers, rows, rightCols = [], subtotalRow, totalRow }: TableProps) {
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-foreground/15">
            {headers.map((h, i) => (
              <th
                key={i}
                className={
                  'px-3 py-2.5 text-[10px] uppercase tracking-[0.15em] text-foreground/50 font-medium ' +
                  (rightCols.includes(i) ? 'text-right' : 'text-left')
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-foreground/[0.05]">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={
                    'px-3 py-2.5 text-foreground/80 ' +
                    (rightCols.includes(ci) ? 'text-right tabular-nums' : 'text-left')
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {subtotalRow && (
            <tr className="bg-foreground/[0.02] border-b border-foreground/15">
              {subtotalRow.map((cell, ci) => (
                <td
                  key={ci}
                  className={
                    'px-3 py-3 text-foreground font-medium ' +
                    (rightCols.includes(ci) ? 'text-right tabular-nums' : 'text-left')
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          )}
          {totalRow && (
            <tr className="bg-amber-400/[0.06] border-y-2 border-amber-400/40">
              {totalRow.map((cell, ci) => (
                <td
                  key={ci}
                  className={
                    'px-3 py-3 text-amber-400 font-medium ' +
                    (rightCols.includes(ci) ? 'text-right tabular-nums' : 'text-left')
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
