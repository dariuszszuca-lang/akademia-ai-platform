# Onboarding: Profil + Persona + Deep Profile

Data: 2026-04-26
Autor: Claude (Sonnet 4.6) + Darek
Stan: Draft → implementacja

## Cel

Po założeniu konta nowy user (agent nieruchomości) wypełnia ankietę. Generuje 3-4 pliki markdown które są używane jako kontekst przez WSZYSTKIE agenty na platformie. Dzięki temu agent "Prawny", "Marketing", "CEO" itp. odpowiada w realiach konkretnego agenta , jego rynku, klienta, celów.

## Flow użytkownika

```
1. Welcome (1 min) , premium intro, ustawia ton
2. Express Wizard (~20 min, 15 pyt.) → profil.md
3. Persona Chat - Kupujący (~10 min) → persona-kupujacy.md
4. Persona Chat - Sprzedający (~10 min) → persona-sprzedajacy.md
5. "Profil gotowy" (premium completion) → wejście do platformy
6. (OPCJONALNIE, kiedykolwiek) Deep Wizard 20 pyt → UPDATE profil.md
```

Pause/resume w każdym momencie. State zapisywany po każdej odpowiedzi.

## Decyzje techniczne

### Stack
- Next.js 14 app router (już w projekcie)
- Vercel KV (już w `package.json`) , storage dla state i markdown files
- Anthropic API (Claude Sonnet 4.6) dla generowania plików i chat persona
- Tailwind v3 (już) , premium dark/amber UI z `DESIGN-BLUEPRINT.md`

### Data model w KV

```
user:{userId}:profil              → string (markdown)
user:{userId}:persona-buyer       → string (markdown)
user:{userId}:persona-seller      → string (markdown)
user:{userId}:onboarding          → JSON {
                                      currentStep: 'express' | 'persona-buyer' | 'persona-seller' | 'deep' | 'complete',
                                      expressAnswers: { q1..q15: string },
                                      personaBuyer: { path: 'A'|'B', answers: {...}, chosenType?: 1|2|3 },
                                      personaSeller: { path: 'A'|'B', answers: {...}, chosenType?: 1|2|3 },
                                      deepAnswers: { q16..q35: string },
                                      completedAt: ISO date | null
                                    }
```

Userid: w MVP statyczny `'demo-user'` (no auth). Później Cognito.

### Wizard (Express + Deep)

- Route `/onboarding/express` i `/onboarding/deep`
- Jeden komponent `<WizardFlow>` parametryzowany schematem pytań
- Schemat pytań: `src/data/onboarding/express.ts`, `deep.ts` (lista question-objektów)
- Każde pytanie: `{ id, section, prompt, helper, type: 'text'|'textarea'|'select', options? }`
- Server actions zapisują odpowiedź po każdym kroku do KV (debounce 800ms na input)
- Progress bar + sekcje (Część 1: Kim jestem · 5/5)
- Animacja przejścia między pytaniami (fade + slide)
- Po ostatnim pytaniu: streaming LLM generation `profil.md`, pokazany jako "document" przed zapisem

### Chat (Persona)

- Route `/onboarding/persona/[type]` gdzie type=buyer|seller
- Komponent `<PersonaChat>` z streaming
- Start: 2 pytania (KUPUJĄCY/SPRZEDAJĄCY confirmed + Path A/B)
- Path A: server side LLM call z `profil.md` → 3 typy klienta (response strukturyzowany do kart) → user klika kartę → LLM expansja do pełnej persony
- Path B: linearne 6 pytań, AI może dopytać 1× jeśli odpowiedź <20 znaków
- Streaming odpowiedzi AI (server-sent events przez Vercel AI SDK)

### LLM (Anthropic Claude)

- Wszystkie wywołania server-side (Next.js API routes)
- Model domyślny: `claude-sonnet-4-6` (lepszy reasoning) , fallback `claude-haiku-4-5` jeśli koszty staną się problemem
- System prompt dla każdego flow w `src/lib/onboarding/prompts.ts`
- API key w `.env.local` jako `ANTHROPIC_API_KEY`
- Token tracking (proste counts) per user żeby widzieć koszty

### Generowanie plików

Express:
- Po 15 odpowiedzi → 1 LLM call → wygenerowany `profil.md` (struktura z prompta usera)
- Stream do UI, zapisz do KV
- User widzi rezultat, może kliknąć "Wygeneruj ponownie" jeśli nie pasuje

Persona:
- Path A: 2 calls (proposal + expansion)
- Path B: 1 call (after all 6 answers)

Deep:
- 1 call po wszystkich 20 → UPDATE profil.md (dopisuje sekcje DOŚWIADCZENIE, JAK PRACUJE, RYNEK, WARTOŚCI)

### Agent integration

Każdy agent w `src/data/agents.ts` ma swoje narzędzia. Aktualnie `runTool()` zwraca lokalny template. Zmienimy:

```ts
// src/lib/agent-runner.ts
export async function runAgentTool(agentId, toolId, context, goal, userId) {
  const userContext = await getUserContext(userId)  // {profil, persona-buyer, persona-seller, deep}
  const systemPrompt = buildSystemPrompt(agentId, userContext)
  const userPrompt = `${tool.template(context, goal)}`
  return await anthropic.messages.stream({ system: systemPrompt, ...})
}
```

System prompt format:
```
Jesteś agentem [Marketing/Prawny/...] na platformie Akademia AI.

KONTEKST UŻYTKOWNIKA:
[profil.md]

[persona-kupujacy.md]

[persona-sprzedajacy.md]

ZAWSZE używaj tego kontekstu. Konkretne odpowiedzi, w realiach tego konkretnego agenta.
```

### Premium UX details

- **Typografia**: Geist Sans / Inter z lekkim tracking
- **Paleta**: dark `#0a0a0b` background, `#fbbf24` (amber) accent, `#10b981` (emerald) confirmation
- **Brak spinnerów**: skeleton states + streaming text
- **Generowany dokument**: pokazany jak certyfikat, biały papier z marginesami, header z imieniem usera, animowane "podpisanie" na końcu
- **Mikrointeractions**: subtle haptic-like feedback (scale 0.97 on click), tab key navigation
- **Pause flow**: każdy ekran ma "X" w prawym górnym → modal "Zapisaliśmy postęp. Wróć kiedy chcesz." → zamyka się
- **Resume**: po wejściu w `/onboarding`, jeśli state istnieje, redirect do `currentStep` z bannerem "Wracasz do Express, pytanie 7 z 15"

## Komponenty (struktura plików)

```
src/
├── app/
│   ├── (onboarding)/
│   │   ├── onboarding/
│   │   │   ├── page.tsx                    Welcome / resume
│   │   │   ├── express/page.tsx            Wizard wrapper
│   │   │   ├── persona/[type]/page.tsx     Chat (buyer/seller)
│   │   │   ├── deep/page.tsx               Wizard
│   │   │   └── complete/page.tsx           Premium completion
│   │   └── layout.tsx                      Onboarding layout
│   ├── api/
│   │   ├── onboarding/
│   │   │   ├── save-answer/route.ts        POST: save partial answer
│   │   │   ├── generate-profil/route.ts    POST: trigger LLM gen profil.md
│   │   │   ├── persona-chat/route.ts       POST: streaming chat
│   │   │   └── persona-types/route.ts      POST: Path A , get 3 types
│   │   └── agents/
│   │       └── run/route.ts                POST: run agent tool with user context
├── components/
│   ├── onboarding/
│   │   ├── WizardFlow.tsx                  Schematized wizard
│   │   ├── WizardQuestion.tsx              Single question screen
│   │   ├── ProgressBar.tsx
│   │   ├── PersonaChat.tsx                 Streaming chat UI
│   │   ├── PersonaTypeCards.tsx            Path A: 3 type cards
│   │   ├── GeneratedDocument.tsx           Premium document display
│   │   └── ResumeBanner.tsx
│   └── ui/
│       └── ... (shadcn-style components, dark/amber theme)
├── data/
│   └── onboarding/
│       ├── express.ts                      15 questions schema
│       └── deep.ts                         20 questions schema
└── lib/
    ├── kv.ts                               Vercel KV helpers
    ├── anthropic.ts                        Anthropic client setup
    ├── onboarding/
    │   ├── prompts.ts                      System prompts dla wszystkich flow
    │   ├── generate-profil.ts              Logic: 15 answers → profil.md
    │   ├── generate-persona.ts             Logic: chat answers → persona.md
    │   └── persona-types.ts                Logic: profil.md → 3 type cards
    ├── agent-runner.ts                     Run agent tool with user context
    └── user-context.ts                     getUserContext(userId)
```

## Kolejność implementacji (MVP-first)

**Faza 1 (MVP, ~2-3 dni):** Express Wizard + generate profil.md + storage
**Faza 2 (~1-2 dni):** Persona Chat (Path B najpierw, prostszy)
**Faza 3 (~1 dzień):** Persona Path A + Persona Seller
**Faza 4 (~1 dzień):** Deep Wizard
**Faza 5 (~1 dzień):** Agent integration (wymiana stubów na real LLM z kontekstem)
**Faza 6 (~1 dzień):** Premium UX polish (animacje, dokument, transitions)

Łącznie: 7-9 dni roboczych.

## Co NIE robimy w tej iteracji (YAGNI)

- Wersjonowanie profil.md (jeśli user zmieni, nadpisuje)
- Community visibility profilu (publiczny/prywatny , zostaje prywatny)
- Matching usera z innymi userami
- Auto-update profilu na podstawie zachowania
- Email notifications po zakończeniu
- Eksport do PDF profilu
- A/B test różnych ankiet

## Otwarte pytania (do rozstrzygnięcia później)

- Czy Persona Path A pokazuje też propozycje typów dla Sprzedającego (analogicznie)? (Zakładam: tak)
- Cache generated content czy regeneruj na żądanie? (Zakładam: cache w KV, regenerate button osobny)
- Co jak Anthropic API padnie? Fallback (Zakładam: error message + retry, nie offline mode)
- Jak liczyć "pozostały czas" w wizardzie? (Zakładam: prosty estymator , pytań × 80s)
