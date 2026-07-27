# Property Intelligence Studio Product Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usunąć produktową warstwę Akademii AI i pozostawić jedną, spójną platformę Property Intelligence Studio bez migracji kont, teczek i infrastruktury.

**Architecture:** Wprowadzamy jedno źródło nazwy produktu i nawigacji, przebudowujemy pulpit wokół istniejącego Property Truth Engine, upraszczamy panel administratora do zarządzania Zespołem AI, a dawne moduły zastępujemy statycznymi przekierowaniami. Dane Cognito, PostgreSQL, Stripe i wewnętrzne identyfikatory integracji pozostają bez zmian.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Drizzle ORM, PostgreSQL/Neon, AWS Cognito, Vercel.

---

## Mapa plików

### Nowe pliki

- `src/lib/product.ts` — nazwa, opis, nawigacja i aktywność tras produktu.
- `src/lib/product.test.ts` — kontrakt marki oraz nawigacji.
- `src/lib/legacy-routes.ts` — statyczna mapa przekierowań dawnych modułów.
- `src/lib/legacy-routes.test.ts` — kontrakt wszystkich przekierowań.
- `src/features/properties/dashboard.ts` — budowa metryk pulpitu na podstawie teczek i faktów.
- `src/features/properties/dashboard.test.ts` — testy metryk i kolejności teczek wymagających uwagi.
- `src/lib/product-surface.test.ts` — kontrola, że publiczna powłoka nie zawiera brandingu Akademii.
- `src/lib/agent-overrides.ts` — flagi dostępności wyłącznie dla Zespołu AI.
- `src/app/api/admin/agents/route.ts` — panelowe API flag agentów.

### Pliki modyfikowane

- `src/app/layout.tsx` — metadane Property Intelligence Studio.
- `src/app/(admin)/layout.tsx` — metadane panelu Studio.
- `src/app/(admin)/admin/page.tsx` — użycie flag agentów.
- `src/app/(admin)/admin/AdminDashboard.tsx` — panel wyłącznie dla Zespołu AI.
- `src/app/(auth)/login/page.tsx` — branding ekranu logowania.
- `src/app/(auth)/register/page.tsx` — branding rejestracji.
- `src/app/(auth)/register/[token]/page.tsx` — branding zaproszenia.
- `src/app/(onboarding)/layout.tsx` — branding onboardingu.
- `src/app/(dashboard)/layout.tsx` — komunikat ładowania Studio.
- `src/app/(dashboard)/start/page.tsx` — pulpit oparty na teczkach i faktach.
- `src/components/Navbar.tsx` — cztery docelowe pozycje nawigacji.
- `src/components/CommandPalette.tsx` — nawigacja i wyszukiwanie Studio.
- `src/lib/agent/prompts.ts` — systemowy kontekst Property Intelligence Studio.
- `src/lib/billing/plans.ts` — nazewnictwo funkcji zgodne ze Studio.
- `src/app/api/account/export/route.ts` — nazwa eksportu.
- `src/app/(dashboard)/settings/page.tsx` — nazwa pobieranego eksportu.
- `next.config.ts` — statyczne przekierowania dawnych tras.

### Pliki i katalogi usuwane

- `src/app/(dashboard)/about/`
- `src/app/(dashboard)/calendar/`
- `src/app/(dashboard)/classroom/`
- `src/app/(dashboard)/community/`
- `src/app/(dashboard)/ludzie/`
- `src/app/(dashboard)/members/`
- `src/app/(dashboard)/na-zywo/`
- `src/app/(dashboard)/o-akademii/`
- `src/app/(dashboard)/programy/`
- `src/app/(dashboard)/skarbiec/`
- `src/app/(dashboard)/spolecznosc/`
- `src/app/raporty/koszty/`
- `src/app/api/community/`
- `src/app/api/modules/`
- `src/app/api/quick-actions/`
- `src/app/api/admin/modules/`
- `src/app/api/admin/quick-actions/`
- `src/components/QuickActionsPanel.tsx`
- `src/components/Sidebar.tsx`
- `src/data/events.ts`
- `src/data/modules.ts`
- `src/data/quick-actions.ts`
- `src/data/resources.ts`
- `src/lib/community-posts.ts`
- `src/lib/module-overrides.ts`
- `src/lib/quick-actions.ts`

## Task 1: Jedno źródło marki i nawigacji

**Files:**
- Create: `src/lib/product.ts`
- Create: `src/lib/product.test.ts`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/CommandPalette.tsx`

- [ ] **Step 1: Napisać test kontraktu produktu**

```ts
import { describe, expect, it } from 'vitest'
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_NAVIGATION,
  isProductPathActive,
} from './product'

describe('Property Intelligence Studio product contract', () => {
  it('publishes the approved name and navigation', () => {
    expect(PRODUCT_NAME).toBe('Property Intelligence Studio')
    expect(PRODUCT_DESCRIPTION).toContain('nieruchomości')
    expect(PRODUCT_NAVIGATION).toEqual([
      { name: 'Pulpit', href: '/start' },
      { name: 'Portfolio', href: '/nieruchomosci' },
      { name: 'Zespół AI', href: '/agent' },
      { name: 'Profil', href: '/profil' },
    ])
  })

  it('matches nested product routes without treating start as a prefix', () => {
    expect(isProductPathActive('/start', '/start')).toBe(true)
    expect(isProductPathActive('/start-old', '/start')).toBe(false)
    expect(isProductPathActive('/nieruchomosci/abc', '/nieruchomosci')).toBe(true)
  })
})
```

- [ ] **Step 2: Uruchomić test i potwierdzić czerwony wynik**

Run: `npm test -- src/lib/product.test.ts`  
Expected: FAIL, ponieważ `src/lib/product.ts` jeszcze nie istnieje.

- [ ] **Step 3: Dodać minimalny kontrakt produktu**

```ts
export const PRODUCT_NAME = 'Property Intelligence Studio'
export const PRODUCT_SHORT_NAME = 'Property Studio'
export const PRODUCT_DESCRIPTION =
  'Prywatne studio danych, decyzji i materiałów dla agentów nieruchomości.'

export const PRODUCT_NAVIGATION = [
  { name: 'Pulpit', href: '/start' },
  { name: 'Portfolio', href: '/nieruchomosci' },
  { name: 'Zespół AI', href: '/agent' },
  { name: 'Profil', href: '/profil' },
] as const

export function isProductPathActive(pathname: string, href: string) {
  if (href === '/start') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
```

- [ ] **Step 4: Przełączyć Navbar i CommandPalette na wspólny kontrakt**

Navbar importuje `PRODUCT_NAME`, `PRODUCT_NAVIGATION` i
`isProductPathActive`, usuwa `QuickActionsPanel`, stare `navItems` oraz
`pathAliases`. CommandPalette buduje grupę Nawigacja z
`PRODUCT_NAVIGATION`, pozostawia onboarding, ustawienia i aktywnych agentów,
a w stopce wyświetla `PRODUCT_NAME`.

- [ ] **Step 5: Uruchomić test, lint i TypeScript**

Run: `npm test -- src/lib/product.test.ts && npm run typecheck && npm run lint`  
Expected: PASS, zero błędów.

- [ ] **Step 6: Commit**

```bash
git add src/lib/product.ts src/lib/product.test.ts src/components/Navbar.tsx src/components/CommandPalette.tsx
git commit -m "feat: make property studio the product shell"
```

## Task 2: Branding wszystkich publicznych powłok

**Files:**
- Create: `src/lib/product-surface.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/register/[token]/page.tsx`
- Modify: `src/app/(onboarding)/layout.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/lib/agent/prompts.ts`

- [ ] **Step 1: Napisać test zakazujący starego brandingu na powierzchniach użytkownika**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const publicShells = [
  'src/app/layout.tsx',
  'src/app/(admin)/layout.tsx',
  'src/app/(auth)/login/page.tsx',
  'src/app/(auth)/register/page.tsx',
  'src/app/(auth)/register/[token]/page.tsx',
  'src/app/(onboarding)/layout.tsx',
  'src/app/(dashboard)/layout.tsx',
  'src/components/Navbar.tsx',
  'src/components/CommandPalette.tsx',
  'src/lib/agent/prompts.ts',
]

describe('public product surfaces', () => {
  it.each(publicShells)('%s does not expose the Academy brand', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(source).not.toMatch(/Akademia AI|Platforma szkoleniowa|O Akademii/)
  })
})
```

- [ ] **Step 2: Uruchomić test i potwierdzić czerwony wynik**

Run: `npm test -- src/lib/product-surface.test.ts`  
Expected: FAIL dla aktualnych ekranów logowania, rejestracji, layoutów i promptu.

- [ ] **Step 3: Zastąpić publiczny branding**

Metadane korzystają z `PRODUCT_NAME` i `PRODUCT_DESCRIPTION`. Ekrany auth
pokazują monogram `PI`, nazwę produktu oraz opis
`Studio pracy agenta nieruchomości`. Zaproszenie ma etykietę
`Dostęp pilotażowy`. Onboarding pokazuje `Property Studio`. Prompt agenta
zaczyna się od:

```ts
return `Jesteś agentem "${agent.name}" w Property Intelligence Studio dla agentów nieruchomości.
Pracujesz na profilu użytkownika i — jeśli został podany — na zatwierdzonych danych teczki nieruchomości.
Nie przedstawiaj informacji wywnioskowanej jako potwierdzonego faktu.
```

- [ ] **Step 4: Uruchomić test kontraktowy i testy agenta**

Run: `npm test -- src/lib/product-surface.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-surface.test.ts src/app/layout.tsx src/app/\(admin\)/layout.tsx src/app/\(auth\) src/app/\(onboarding\)/layout.tsx src/app/\(dashboard\)/layout.tsx src/lib/agent/prompts.ts
git commit -m "feat: rebrand public surfaces as property studio"
```

## Task 3: Pulpit oparty na nieruchomościach

**Files:**
- Create: `src/features/properties/dashboard.ts`
- Create: `src/features/properties/dashboard.test.ts`
- Modify: `src/app/(dashboard)/start/page.tsx`

- [ ] **Step 1: Napisać test metryk pulpitu**

```ts
import { describe, expect, it } from 'vitest'
import { buildPropertyDashboard } from './dashboard'

describe('property dashboard', () => {
  it('counts active projects and unresolved facts', () => {
    const result = buildPropertyDashboard(
      [
        project('one', 'verification', new Date('2026-07-26')),
        project('two', 'ready', new Date('2026-07-27')),
        project('three', 'archived', new Date('2026-07-25')),
      ],
      new Map([
        ['one', [{ status: 'missing' }, { status: 'conflicting' }]],
        ['two', [{ status: 'confirmed' }]],
      ]),
    )

    expect(result.activeCount).toBe(2)
    expect(result.missingCount).toBe(1)
    expect(result.conflictingCount).toBe(1)
    expect(result.recentProjects.map((item) => item.id)).toEqual(['two', 'one'])
  })
})
```

W teście helpery `project()` zwracają minimalne obiekty rzutowane na
`PropertyProject`, a wartości faktów na `Pick<PropertyFact, 'status'>`.

- [ ] **Step 2: Uruchomić test i potwierdzić czerwony wynik**

Run: `npm test -- src/features/properties/dashboard.test.ts`  
Expected: FAIL, ponieważ moduł pulpitu jeszcze nie istnieje.

- [ ] **Step 3: Zaimplementować czystą funkcję agregującą**

```ts
export function buildPropertyDashboard(
  projects: PropertyProject[],
  factsByProject: Map<string, Array<Pick<PropertyFact, 'status'>>>,
) {
  const active = projects.filter((project) => project.stage !== 'archived')
  const facts = active.flatMap(
    (project) => factsByProject.get(project.id) ?? [],
  )

  return {
    activeCount: active.length,
    missingCount: facts.filter((fact) => fact.status === 'missing').length,
    conflictingCount: facts.filter((fact) => fact.status === 'conflicting')
      .length,
    recentProjects: [...active]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 3),
  }
}
```

- [ ] **Step 4: Przebudować `/start`**

Strona pobiera `userId`, przekierowuje brak sesji do `/login`, ładuje teczki
przez `getPropertyService().listProjects(userId)`, a fakty przez
`Promise.all(projects.map(project => service.listFacts(userId, project.id)))`.
Renderuje hero Studio, cztery metryki, trzy ostatnie teczki, wezwanie do
Portfolio, kartę onboardingu oraz skrót do Zespołu AI. Nie importuje modułów,
zasobów, wydarzeń ani szybkich akcji.

- [ ] **Step 5: Uruchomić testy właściwości i build**

Run: `npm test -- src/features/properties src/app/\\(dashboard\\)/nieruchomosci && npm run build`  
Expected: PASS i poprawnie wygenerowana trasa `/start`.

- [ ] **Step 6: Commit**

```bash
git add src/features/properties/dashboard.ts src/features/properties/dashboard.test.ts src/app/\(dashboard\)/start/page.tsx
git commit -m "feat: build a property-first studio dashboard"
```

## Task 4: Panel administratora wyłącznie dla Zespołu AI

**Files:**
- Create: `src/lib/agent-overrides.ts`
- Create: `src/lib/agent-overrides.test.ts`
- Create: `src/app/api/admin/agents/route.ts`
- Modify: `src/app/(admin)/admin/page.tsx`
- Modify: `src/app/(admin)/admin/AdminDashboard.tsx`
- Modify: `src/app/(dashboard)/agent/page.tsx`
- Modify: `src/app/(dashboard)/agent/[agentId]/page.tsx`
- Delete: `src/lib/module-overrides.ts`
- Delete: `src/app/api/admin/modules/route.ts`

- [ ] **Step 1: Napisać test flag agentów**

```ts
import { describe, expect, it } from 'vitest'
import { applyAgentOverrides } from './agent-overrides'

describe('agent overrides', () => {
  it('changes only the matching agent flag', () => {
    const input = [
      { id: 'ceo', enabled: true },
      { id: 'marketing', enabled: true },
    ]

    expect(
      applyAgentOverrides(input, {
        'agent:marketing': { enabled: false },
      }),
    ).toEqual([
      { id: 'ceo', enabled: true },
      { id: 'marketing', enabled: false },
    ])
  })
})
```

- [ ] **Step 2: Uruchomić test i potwierdzić czerwony wynik**

Run: `npm test -- src/lib/agent-overrides.test.ts`  
Expected: FAIL, ponieważ moduł agentów jeszcze nie istnieje.

- [ ] **Step 3: Wyodrębnić flagi agentów**

`agent-overrides.ts` zachowuje istniejący prefiks KV
`module-override:agent:` dla zgodności danych, eksportuje
`getEffectiveAgents`, `setAgentOverride`, `applyAgentOverrides` i `kvStatus`.
Nie importuje `modules` ani `resources`.

- [ ] **Step 4: Zawęzić API i panel**

`GET /api/admin/agents` zwraca `{ agents, kv }`. `PATCH` przyjmuje
`{ id: string, enabled: boolean }`, poprzedza identyfikator przez `agent:` i
zapisuje flagę. AdminDashboard pokazuje nagłówek
`Zarządzanie Zespołem AI` i jedną sekcję agentów. Strony `/agent` korzystają z
`getEffectiveAgents` z nowego modułu.

- [ ] **Step 5: Uruchomić test, TypeScript i lint**

Run: `npm test -- src/lib/agent-overrides.test.ts && npm run typecheck && npm run lint`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent-overrides.ts src/lib/agent-overrides.test.ts src/app/api/admin/agents src/app/\(admin\)/admin src/app/\(dashboard\)/agent
git rm src/lib/module-overrides.ts src/app/api/admin/modules/route.ts
git commit -m "refactor: focus admin controls on the ai team"
```

## Task 5: Przekierowania i usunięcie modułów Akademii

**Files:**
- Create: `src/lib/legacy-routes.ts`
- Create: `src/lib/legacy-routes.test.ts`
- Modify: `next.config.ts`
- Delete: wszystkie pliki wymienione w sekcji „Pliki i katalogi usuwane”, z wyjątkiem usuniętych już w Task 4.

- [ ] **Step 1: Napisać test pełnej mapy przekierowań**

```ts
import { describe, expect, it } from 'vitest'
import { LEGACY_PRODUCT_REDIRECTS } from './legacy-routes'

describe('legacy product redirects', () => {
  it('redirects every removed product area to the studio dashboard', () => {
    expect(LEGACY_PRODUCT_REDIRECTS).toEqual(
      [
        '/classroom/:path*',
        '/programy/:path*',
        '/community/:path*',
        '/spolecznosc/:path*',
        '/ludzie/:path*',
        '/members/:path*',
        '/skarbiec/:path*',
        '/calendar/:path*',
        '/na-zywo/:path*',
        '/about/:path*',
        '/o-akademii/:path*',
        '/raporty/koszty/:path*',
      ].map((source) => ({
        source,
        destination: '/start',
        permanent: false,
      })),
    )
  })
})
```

- [ ] **Step 2: Uruchomić test i potwierdzić czerwony wynik**

Run: `npm test -- src/lib/legacy-routes.test.ts`  
Expected: FAIL, ponieważ mapa jeszcze nie istnieje.

- [ ] **Step 3: Dodać mapę oraz konfigurację Next.js**

```ts
const legacySources = [
  '/classroom/:path*',
  '/programy/:path*',
  '/community/:path*',
  '/spolecznosc/:path*',
  '/ludzie/:path*',
  '/members/:path*',
  '/skarbiec/:path*',
  '/calendar/:path*',
  '/na-zywo/:path*',
  '/about/:path*',
  '/o-akademii/:path*',
  '/raporty/koszty/:path*',
] as const

export const LEGACY_PRODUCT_REDIRECTS = legacySources.map((source) => ({
  source,
  destination: '/start',
  permanent: false,
}))
```

`next.config.ts` importuje mapę i zwraca ją z `async redirects()`.

- [ ] **Step 4: Usunąć implementacje starych modułów**

Usunąć katalogi stron, dedykowane API, komponenty, dane i biblioteki wskazane
w mapie plików. Nie usuwać rekordów z Vercel KV ani produkcyjnej bazy. Po
usunięciu uruchomić:

```bash
rg -n "module-overrides|QuickActionsPanel|community-posts|data/modules|data/resources|data/events|data/quick-actions" src
```

Expected: brak wyników.

- [ ] **Step 5: Uruchomić test przekierowań i build**

Run: `npm test -- src/lib/legacy-routes.test.ts && npm run build`  
Expected: PASS, stare strony nie występują na liście tras, a konfiguracja
przekierowań kompiluje się.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts src/lib/legacy-routes.ts src/lib/legacy-routes.test.ts
git add -u src
git commit -m "refactor: remove academy product modules"
```

## Task 6: Eksporty, rozliczenia i ostatnie widoczne nazwy

**Files:**
- Modify: `src/app/api/account/export/route.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/lib/billing/plans.ts`
- Modify: `src/app/(dashboard)/pricing/page.tsx`
- Modify: `src/app/(dashboard)/settings/subscription/page.tsx`

- [ ] **Step 1: Rozszerzyć test powierzchni produktu**

Do `publicShells` w `src/lib/product-surface.test.ts` dodać oba ekrany
rozliczeń, ustawienia, eksport API i `src/lib/billing/plans.ts`. Dodać test:

```ts
it('uses the studio name for exported account data', () => {
  const api = readFileSync(
    resolve(process.cwd(), 'src/app/api/account/export/route.ts'),
    'utf8',
  )
  const settings = readFileSync(
    resolve(process.cwd(), 'src/app/(dashboard)/settings/page.tsx'),
    'utf8',
  )
  expect(api).toContain('property-studio-export-')
  expect(settings).toContain('property-studio-export-')
})
```

- [ ] **Step 2: Uruchomić test i potwierdzić czerwony wynik**

Run: `npm test -- src/lib/product-surface.test.ts`  
Expected: FAIL dla nazw plików `akademia-ai-export`.

- [ ] **Step 3: Zmienić nazwy eksportów i copy planów**

Nazwy plików zaczynają się od `property-studio-export-`. Plany opisują dostęp
do Portfolio, Zespołu AI i modułów Studio. Nie zmieniać cen, identyfikatorów
planów, Stripe metadata `akademia_user_id` ani istniejących identyfikatorów
produktów Stripe, ponieważ są wewnętrzną częścią kompatybilności rozliczeń.

- [ ] **Step 4: Uruchomić testy rozliczeń i konta**

Run: `npm test -- src/lib/product-surface.test.ts src/lib/billing src/features/properties/account-data.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-surface.test.ts src/app/api/account/export/route.ts src/app/\(dashboard\)/settings src/app/\(dashboard\)/pricing/page.tsx src/lib/billing/plans.ts
git commit -m "feat: align account surfaces with property studio"
```

## Task 7: Pełna weryfikacja i wdrożenie

**Files:**
- Modify only if verification reveals a defect within the approved scope.

- [ ] **Step 1: Sprawdzić pozostałości starego produktu**

Run:

```bash
rg -n "Akademia AI|Platforma szkoleniowa|O Akademii" src --glob '*.tsx' --glob '*.ts'
rg -n '"/(classroom|programy|community|spolecznosc|ludzie|members|skarbiec|calendar|na-zywo|about|o-akademii)' src --glob '*.tsx' --glob '*.ts'
```

Expected: brak widocznych odniesień. Dopuszczalne są wyłącznie wewnętrzne
identyfikatory zgodności wymienione w specyfikacji, które nie trafiają do UI.

- [ ] **Step 2: Uruchomić pełny zestaw kontroli**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: wszystkie testy przechodzą, zero błędów TypeScript i ESLint, build
kończy się kodem 0.

- [ ] **Step 3: Przejrzeć zakres zmian**

Run:

```bash
git status --short
git diff --check
git diff --stat HEAD~6..HEAD
```

Expected: brak przypadkowych plików środowiskowych, brak błędów whitespace,
zmiany ograniczone do specyfikacji przebudowy.

- [ ] **Step 4: Wypchnąć `main` i poczekać na Vercel**

Run:

```bash
git push origin main
vercel ls
vercel inspect https://akademia-ai-platform.vercel.app --wait
```

Expected: deployment produkcyjny ma status `Ready`, a alias
`https://akademia-ai-platform.vercel.app` wskazuje nową wersję. Zmiana domeny
jest osobnym zadaniem.

- [ ] **Step 5: Smoke test produkcji**

Run:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://akademia-ai-platform.vercel.app/login
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://akademia-ai-platform.vercel.app/classroom
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://akademia-ai-platform.vercel.app/api/auth/session -H 'content-type: application/json' --data '{"accessToken":"invalid-token"}'
```

Expected: login `200`, stara trasa `307` lub `308` do `/start`, nieprawidłowy
token `401`.

- [ ] **Step 6: Jeśli smoke test wykryje defekt, wrócić do właściwego zadania**

Nie wykonywać zbiorczej poprawki bez testu. Dodać test odtwarzający defekt do
testu właściwego modułu, przeprowadzić cykl czerwony–zielony, uruchomić pełną
weryfikację z Task 7 Step 2 i dopiero wtedy commitować dokładnie zmienione
pliki.
