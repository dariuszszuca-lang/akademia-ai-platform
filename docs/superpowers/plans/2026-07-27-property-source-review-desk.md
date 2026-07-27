# Property Source Review Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Udostępnić agentowi kompletny ekran „Źródła”, który bezpiecznie
wysyła plik do S3, pokazuje stan przetwarzania, otwiera czysty dokument i
pozwala człowiekowi zdecydować o każdej propozycji faktu.

**Architecture:** Osobna trasa serwerowa ładuje dane ograniczone do aktualnego
użytkownika i przekazuje je do małego komponentu klienckiego. Logika uploadu,
formatowania statusów i decyzji pozostaje w czystych, testowalnych modułach.
Przeglądarka wysyła plik bezpośrednio do S3 na podstawie krótkiego formularza
POST, a następnie odświeża wyłącznie tenant-scoped API Studio.

**Tech Stack:** Next.js 16, React 19, TypeScript, Web Crypto, Tailwind CSS,
Vitest, PostgreSQL/Drizzle, Vercel OIDC i AWS S3.

---

### Task 1: Kontrakt klienta i bezpieczny upload

**Files:**
- Create: `src/features/property-sources/client.ts`
- Create: `src/features/property-sources/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Testy muszą wymagać:

```ts
expect(resolveSourceMediaType({ name: 'dane.csv', type: '' })).toBe('text/csv')
expect(formatSourceStatus('processing')).toEqual({
  label: 'Analiza źródła',
  tone: 'working',
})
expect(parseCorrectedProposalValue('number', '52,4')).toBe(52.4)
expect(parseCorrectedProposalValue('boolean', 'tak')).toBe(true)
```

Osobny test `uploadPropertySource` ma sprawdzić kolejność:

1. obliczenie SHA-256;
2. `POST /api/properties/{id}/sources` z nazwą, MIME, rozmiarem i checksumą;
3. formularz S3 zawierający wszystkie podpisane pola;
4. plik dopisany jako ostatnie pole;
5. błąd API albo S3 zamieniony na bezpieczny kod interfejsu.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npx vitest run src/features/property-sources/client.test.ts
```

Expected: FAIL, ponieważ moduł `client.ts` jeszcze nie istnieje.

- [ ] **Step 3: Implement the minimal client contract**

Moduł ma eksportować:

```ts
export type SourceStatusPresentation = {
  label: string
  tone: 'neutral' | 'working' | 'success' | 'warning' | 'danger'
}

export function resolveSourceMediaType(file: Pick<File, 'name' | 'type'>): string
export function formatSourceStatus(status: PropertySourceStatus): SourceStatusPresentation
export function formatEvidenceLocator(locator: EvidenceLocator): string
export function parseCorrectedProposalValue(
  valueType: PropertyFactValueType,
  rawValue: string,
): unknown
export async function uploadPropertySource(input: {
  propertyId: string
  file: File
  fetch?: typeof globalThis.fetch
}): Promise<PropertySourceWire>
```

`uploadPropertySource` używa `crypto.subtle.digest('SHA-256', ...)`, wysyła
metadane do API i buduje `FormData` z podpisanych pól bez modyfikowania ich
wartości. Odrzuca plik większy niż 25 MB oraz format spoza katalogu domenowego
przed wywołaniem API.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
npx vitest run src/features/property-sources/client.test.ts
```

Expected: wszystkie testy PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/property-sources/client.ts \
  src/features/property-sources/client.test.ts
git commit -m "feat: add safe property source browser client"
```

---

### Task 2: Nawigacja teczki i ekran Źródeł

**Files:**
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.ts`
- Modify: `src/app/(dashboard)/nieruchomosci/[propertyId]/page.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/page.tsx`

- [ ] **Step 1: Write the failing navigation test**

Render statyczny musi zawierać dwa prawdziwe linki:

```text
/nieruchomosci/{propertyId}
/nieruchomosci/{propertyId}/zrodla
```

oraz `aria-current="page"` tylko na aktywnej zakładce.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.ts'
```

Expected: FAIL, ponieważ współdzielona nawigacja jeszcze nie istnieje.

- [ ] **Step 3: Implement the shared navigation**

Komponent przyjmuje:

```ts
type PropertyWorkspaceTabsProps = {
  propertyId: string
  active: 'facts' | 'sources'
}
```

Zakładki nieobjęte tym slice’em pozostają czytelnymi, niedostępnymi etykietami
z `aria-disabled="true"`. Nie mogą wyglądać jak aktywne przyciski.

- [ ] **Step 4: Implement the server page**

`zrodla/page.tsx`:

1. pobiera `propertyId` i sesję;
2. przy braku sesji przekierowuje do `/login`;
3. równolegle ładuje projekt, źródła i propozycje;
4. dla obcej lub nieistniejącej teczki zwraca bezpieczne `notFound()`;
5. serializuje daty do ISO;
6. renderuje nagłówek teczki, wspólną nawigację i `PropertySourceDesk`.

- [ ] **Step 5: Replace the inactive spans on the facts page**

`page.tsx` używa `PropertyWorkspaceTabs` i usuwa zdanie
„Źródła dokumentowe dołączymy w kolejnym etapie”.

- [ ] **Step 6: Run tests, typecheck and commit**

```bash
npx vitest run \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.ts'
npm run typecheck
git add 'src/app/(dashboard)/nieruchomosci/[propertyId]'
git commit -m "feat: expose property source workspace route"
```

---

### Task 3: Stół źródeł i stan przetwarzania

**Files:**
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.test.ts`

- [ ] **Step 1: Write the failing initial-render test**

`renderToStaticMarkup` dla pustych danych ma zawierać:

```text
Dodaj pierwsze źródło
PDF, zdjęcie, DOCX, XLSX, CSV, tekst lub nagranie
AI niczego nie zatwierdzi bez Twojej decyzji
```

Render z danymi musi zawierać nazwę pliku, tekstowy status, propozycję,
lokator dowodu oraz akcje zgodne ze statusem propozycji.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.test.ts'
```

Expected: FAIL, ponieważ komponent jeszcze nie istnieje.

- [ ] **Step 3: Implement the desktop and mobile layout**

Desktop używa układu:

```text
lista źródeł | bezpieczny podgląd | propozycje i decyzje
```

Mobile układa te sekcje pionowo bez poziomego przewijania. Każdy element
interaktywny ma minimum 44 px, widoczny focus i tekstową etykietę statusu.

- [ ] **Step 4: Implement upload feedback and polling**

Komponent:

- pokazuje osobno `Liczenie sumy`, `Wysyłanie`, `Sprawdzanie pliku`,
  `Analiza źródła`, `Do weryfikacji`;
- ogłasza zmianę przez `aria-live="polite"`;
- odświeża źródła i propozycje co 4 sekundy tylko wtedy, gdy istnieje stan
  aktywny;
- zatrzymuje timer po unmount;
- po błędzie podaje przyczynę i akcję „Spróbuj ponownie”.

- [ ] **Step 5: Implement preview and download**

Dla `review_ready` lub `completed` komponent pobiera minutowy URL z API.
PDF i obrazy pokazuje w środkowej kolumnie; pozostałe typy udostępnia jako
bezpieczne pobranie. URL wygasa i nie jest zapisywany w localStorage.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.test.ts'
npm run typecheck
git add 'src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla' \
  src/features/property-sources/client.ts
git commit -m "feat: add property source review desk"
```

---

### Task 4: Decyzje człowieka

**Files:**
- Modify: `src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.tsx`
- Modify: `src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.test.ts`
- Modify: `src/features/property-sources/client.ts`
- Modify: `src/features/property-sources/client.test.ts`

- [ ] **Step 1: Write failing decision tests**

Testy wymagają mapowania:

```text
pending + zatwierdź        -> { action: "accept" }
pending + popraw           -> { action: "correct_and_accept", value, note? }
pending + odrzuć           -> { action: "reject", note? }
conflict + obecna wartość  -> { action: "keep_existing", note? }
conflict + nowa wartość    -> { action: "accept_new" }
conflict + zostaw otwarty  -> { action: "keep_open", note? }
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npx vitest run src/features/property-sources/client.test.ts \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.test.ts'
```

- [ ] **Step 3: Implement one in-flight decision per proposal**

Każda decyzja:

1. ma własny stan loading;
2. nie blokuje pozostałych propozycji;
3. po sukcesie podmienia rekord odpowiedzi API;
4. po błędzie pozostawia propozycję i pokazuje możliwość ponowienia;
5. nigdy nie przedstawia propozycji AI jako zatwierdzonej przed odpowiedzią
   serwera.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run src/features/property-sources/client.test.ts \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla/PropertySourceDesk.test.ts'
npm run typecheck
git add src/features/property-sources/client.ts \
  src/features/property-sources/client.test.ts \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/zrodla'
git commit -m "feat: add human property proposal decisions"
```

---

### Task 5: Release gates and production smoke test

**Files:**
- Modify: `PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md` in the AI-Team workspace
- Modify: `PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md` in the AI-Team workspace
- Modify: `DATA/api-inventory.md` after confirmed AWS deployment

- [ ] **Step 1: Run all local gates**

```bash
npm test
npm run infra:test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

Expected: exit `0`, no failed tests and no production high/critical
vulnerabilities.

- [ ] **Step 2: Rehearse and execute database migrations**

Use the verified Vercel production database without printing its URL. First run
all five SQL migrations inside a transaction that ends with `ROLLBACK`, then
execute `npm run db:migrate`, and finally verify the new tables, constraints
and migration journal by read-only queries. The rollback hash for application
code is `f704d605359e0d3db607701d2aa539d0a08de998`; new tables remain backward
compatible and can stay unused if the application is rolled back.

- [ ] **Step 3: Diff and deploy AWS**

Only on account `261965598943`, profile confirmed live and with valid MFA:

1. run the full first-deploy account baseline;
2. run `cdk diff`;
3. review IAM, GuardDuty, KMS, S3, budget, Step Functions, Lambda, alarms and
   retained resources;
4. deploy `dev`, upload a harmless synthetic PDF and verify the full flow;
5. run a separate `prod` diff and deploy;
6. set only secret names/outputs directly in Vercel without exposing values.

- [ ] **Step 4: Integrate and deploy Vercel**

Fast-forward local `main`, rerun all release gates, push `main`, inspect the
resulting production deployment and verify:

```text
/start
/login
/nieruchomosci
/nieruchomosci/{syntheticPropertyId}
/nieruchomosci/{syntheticPropertyId}/zrodla
```

- [ ] **Step 5: Run the authenticated synthetic flow**

Create or reuse a clearly marked synthetic property, upload a harmless PDF,
observe all statuses, preview the clean file, accept one proposal, reject one
proposal and confirm that only the accepted fact enters the passport.

- [ ] **Step 6: Record and commit the release**

Update the system card, COSTSEC changelog and API inventory with exact,
confirmed resource names and the deployed commit. Never copy credentials,
document content or client data into those files.
