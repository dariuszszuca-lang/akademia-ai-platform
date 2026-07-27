# Next.js 16 Production Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usunąć aktywne podatności Next.js 14, przenieść całą platformę na
Next.js 16.2.12 i React 19.2.8 bez zmiany obecnego designu, a następnie
bezpiecznie wdrożyć Property Intelligence Studio.

**Architecture:** Migracja pozostaje na izolowanej gałęzi
`feature/property-truth-engine`. Najpierw aktualizujemy toolchain i
konfigurację lintowania, potem migrujemy wszystkie asynchroniczne API requestu,
uruchamiamy testy regresyjne oraz build. Dopiero czysty audyt produkcyjnych
zależności pozwala scalić gałąź do `main`, wypchnąć ją do GitHub i zweryfikować
automatyczny deploy Vercel.

**Tech Stack:** Next.js 16.2.12, React 19.2.8, TypeScript 5, ESLint Flat Config,
Vitest, Drizzle ORM, PostgreSQL, Vercel.

---

### Task 1: Zamrożenie zakresu i baseline

**Files:**
- Create: `docs/superpowers/plans/2026-07-27-next-16-production-migration.md`

- [ ] Potwierdź czystą gałąź i Node.js `>=20.9.0`.
- [ ] Zapisz wyniki `npm test`, `npm run lint`, `npm run build` i
  `npm audit --omit=dev`.
- [ ] Zinwentaryzuj `params`, `searchParams`, `cookies()`, `headers()` oraz
  istniejącą konfigurację ESLint.
- [ ] Commit:

```bash
git add docs/superpowers/plans/2026-07-27-next-16-production-migration.md
git commit -m "docs: plan next 16 production migration"
```

### Task 2: Aktualizacja runtime i toolchainu

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `eslint.config.mjs`
- Delete: `.eslintrc.json` lub inny legacy config, jeżeli istnieje

- [ ] Ustaw:

```json
{
  "engines": { "node": ">=20.9.0" },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] Zainstaluj dokładne wersje:

```bash
npm install next@16.2.12 react@19.2.8 react-dom@19.2.8
npm install --save-dev eslint-config-next@16.2.12 @types/react@latest @types/react-dom@latest
```

- [ ] Skonfiguruj ESLint Flat Config z regułami
  `core-web-vitals` i `typescript`, ignorując `.next`, `node_modules`,
  `coverage`, `drizzle/meta` i pliki generowane.
- [ ] Uruchom `npm install`, `npm run typecheck` i `npm run lint`.
- [ ] Commit:

```bash
git add package.json package-lock.json eslint.config.mjs
git commit -m "chore: migrate platform toolchain to next 16"
```

### Task 3: Migracja asynchronicznych API requestu

**Files:**
- Modify: `src/lib/admin-auth.ts`
- Modify: dynamiczne `page.tsx` w `src/app/**/[param]/`
- Modify: `src/features/properties/http.ts`
- Modify: `src/features/properties/http.test.ts`
- Modify: trasy API korzystające z dynamicznych parametrów

- [ ] Zmień `cookies()` na `await cookies()` i dostosuj wywołania funkcji.
- [ ] Zmień typy stron serwerowych:

```ts
type PageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}
```

- [ ] Odczytuj parametry przez `const { id } = await params`.
- [ ] Zmień kontekst dynamicznych tras API na `params: Promise<...>`.
- [ ] Zaktualizuj testy HTTP, aby przekazywały `Promise.resolve(params)`.
- [ ] Uruchom `npm test`, `npm run typecheck` i `npm run lint`.
- [ ] Commit:

```bash
git add src
git commit -m "refactor: migrate request APIs for next 16"
```

### Task 4: Kompatybilność React 19 bez zmiany designu

**Files:**
- Modify only files reported by TypeScript, ESLint or production build
- Preserve: `src/app/globals.css`
- Preserve: layout, palette, typography and component structure

- [ ] Uruchom testy komponentów na React 19.
- [ ] Napraw wyłącznie problemy kompatybilności: typy refów, nowe typy JSX,
  zależności hooków i nieaktualne API React.
- [ ] Nie zmieniaj klas Tailwind, palety, fontów, spacingu ani copy poza
  komunikatami technicznymi.
- [ ] Uruchom `npm test`, `npm run typecheck` i `npm run lint`.
- [ ] Commit:

```bash
git add src
git commit -m "fix: preserve platform behavior on react 19"
```

### Task 5: Bramka bezpieczeństwa i produkcyjny build

**Files:**
- Modify only files required by failing checks
- Update: `docs/SECURITY.md` if the final runtime requirements change

- [ ] Uruchom:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
```

- [ ] Wymagany wynik: zero nieudanych testów, zero błędów typów, zero błędów
  lint, build exit `0`, zero podatności `high` lub `critical`.
- [ ] Sprawdź `git diff --check` i skan nazw sekretów bez ujawniania wartości.
- [ ] Commit ewentualnych poprawek:

```bash
git add .
git commit -m "chore: pass next 16 production gates"
```

### Task 6: Integracja i deploy

**Files:**
- No new product files

- [ ] Pobierz stan `origin` i upewnij się, że `main` nie ma nieoczekiwanych
  zmian.
- [ ] Scal `feature/property-truth-engine` do lokalnego `main`.
- [ ] Powtórz testy i build na scalonym `main`.
- [ ] Wypchnij `main` do `origin`; istniejąca integracja Vercel wykona deploy.
- [ ] Sprawdź produkcyjnie:
  - `/start`,
  - `/nieruchomosci`,
  - nagłówki bezpieczeństwa,
  - brak błędów HTTP 5xx,
  - nowy numer/build poprzez stan deploymentu lub odpowiedź aplikacji.
- [ ] Nie uruchamiaj migracji produkcyjnej PostgreSQL, dopóki `DATABASE_URL`,
  backup i cel bazy nie zostaną zweryfikowane. Jeśli baza nie istnieje, deploy
  kodu może zostać wykonany, ale Studio pozostaje nieaktywne do czasu
  bezpiecznej migracji danych.
