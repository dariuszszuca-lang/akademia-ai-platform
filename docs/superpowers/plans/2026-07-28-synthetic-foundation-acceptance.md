# Synthetic Foundation Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zweryfikować fundament Property Intelligence Studio na deterministycznym korpusie 5 syntetycznych teczek, uruchomić brakujące widoki i bezpieczną telemetrię, a następnie wykonać kontrolowany benchmark produkcyjny z limitem 3 USD i pełnym sprzątaniem.

**Architecture:** Korpus, scorer i runner operatorski tworzą osobny moduł `synthetic-acceptance`, niezależny od kodu domenowego Studio. Widoki „Braki” i „Historia” są projekcjami istniejących faktów, propozycji i audytu, a zdarzenia produktu trafiają do addytywnej tabeli tenant-scoped. Przebieg produkcyjny używa istniejącego GuardDuty → Step Functions → Bedrock i jest izolowany świeżym użytkownikiem, organizacją, rejestrem `run-id` oraz dokładnym prefiksem organizacji w obowiązującym kontrakcie S3.

**Tech Stack:** TypeScript 5, Next.js 16, React 19, Zod 4, Drizzle ORM, PostgreSQL/PGlite, Vitest, AWS SDK/CLI, Cognito, S3, GuardDuty, Step Functions, Bedrock Sonnet 4.6, `pdf-lib`, `sharp`, `fflate`.

---

## Rozstrzygnięcia implementacyjne

1. Nie powstaje drugi model braków ani historii. `OpenIssue` łączy istniejące
   `PropertyFact` i `PropertyFactProposal`, a historia prezentuje
   `property_audit_events`.
2. Nie powstaje publiczne API do dowolnych zdarzeń analitycznych. Zdarzenia
   emituje wyłącznie kod serwerowy po udanej operacji domenowej.
3. Obecny klucz obiektu ma chroniony format
   `originals/organizations/<organization-id>/properties/...`. Produkcyjny
   przebieg tworzy świeżą organizację na każdy `run-id`, zapisuje jej dokładny
   prefiks w rejestrze sprzątania i nie dodaje alternatywnego klucza, który
   mógłby ominąć istniejący plan GuardDuty.
4. `account.deleted` jest emitowane przed kaskadowym usunięciem organizacji.
   Zdarzenie uczestniczy w transakcji i jest następnie usuwane razem z danymi
   użytkownika zgodnie z RODO; nie zachowujemy śladu pozwalającego odtworzyć
   usunięte konto.
5. Operacja usunięcia wersji S3 dostaje osobny interfejs oraz ścisłą sesyjną
   politykę do jednego prefiksu organizacji. Nie rozszerzamy uploadu ani
   downloadu o możliwość kasowania.
6. „Materiały” pozostają nieaktywne. Ten widok należy do późniejszego Offer
   Launch Lab i nie jest częścią odbioru M0–M3.
7. Każdy etap chmurowy ma osobną bramkę: świeży odczyt zasad COSTSEC,
   `sts get-caller-identity`, kontrola regionu i kosztu, `cdk diff`, a dopiero
   potem zapis na produkcji.

## Mapa plików

### Korpus i benchmark

- Create `src/features/synthetic-acceptance/domain.ts` — kontrakt manifestu,
  przypadków, materiałów i oczekiwanych faktów.
- Create `src/features/synthetic-acceptance/domain.test.ts` — walidacja liczb,
  formatów, danych zabronionych i `run-id`.
- Create `src/features/synthetic-acceptance/manifest.ts` — 5 teczek, 20
  materiałów, minimum 50 faktów i dokładnie 5 kontrolowanych konfliktów.
- Create `src/features/synthetic-acceptance/manifest.test.ts` — liczebność,
  unikalność, limity i zgodność z katalogiem faktów.
- Create `src/features/synthetic-acceptance/generator.ts` — deterministyczne
  PDF, PNG/JPEG, DOCX, XLSX, CSV i TXT.
- Create `src/features/synthetic-acceptance/generator.test.ts` — sygnatury,
  MIME, rozmiary i powtarzalność.
- Create `src/features/synthetic-acceptance/scorer.ts` — precyzja, locatory,
  konflikty, duplikaty, czas i koszt.
- Create `src/features/synthetic-acceptance/scorer.test.ts` — progi i
  równoważność wartości.
- Create `src/features/synthetic-acceptance/report.ts` — raport bez PII i
  treści dokumentów.
- Create `src/features/synthetic-acceptance/report.test.ts` — allowlista pól
  raportu.
- Create `scripts/studio-synthetic-acceptance.ts` — komendy `local` oraz
  `production-synthetic`.
- Modify `package.json` — skrypty benchmarku.
- Modify `.gitignore` — wygenerowane pliki i robocze rejestry przebiegów.

### Braki i historia

- Create `src/features/properties/open-issues.ts` — projekcja faktów i
  propozycji do wspólnej listy problemów.
- Create `src/features/properties/open-issues.test.ts` — deduplikacja,
  priorytet i tenant-safe dane.
- Create `src/features/properties/audit-presentation.ts` — bezpieczne etykiety
  i skróty zmian.
- Create `src/features/properties/audit-presentation.test.ts` — brak pełnych
  wartości i sekretów.
- Create
  `src/app/(dashboard)/nieruchomosci/[propertyId]/braki/OpenIssuesBoard.tsx` —
  UI braków i konfliktów.
- Create
  `src/app/(dashboard)/nieruchomosci/[propertyId]/braki/OpenIssuesBoard.test.tsx`.
- Create `src/app/(dashboard)/nieruchomosci/[propertyId]/braki/page.tsx`.
- Create
  `src/app/(dashboard)/nieruchomosci/[propertyId]/historia/PropertyHistory.tsx`
  — oś zmian.
- Create
  `src/app/(dashboard)/nieruchomosci/[propertyId]/historia/PropertyHistory.test.tsx`.
- Create `src/app/(dashboard)/nieruchomosci/[propertyId]/historia/page.tsx`.
- Modify
  `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.tsx`.
- Modify
  `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.tsx`.

### Zdarzenia produktu i dane konta

- Create `src/features/studio-events/domain.ts` — zamknięty katalog zdarzeń i
  bezpieczne metadane.
- Create `src/features/studio-events/domain.test.ts`.
- Create `src/features/studio-events/schema.ts` — tabela
  `studio_product_events`.
- Create `src/features/studio-events/repository.ts` — interfejs zapisu,
  eksportu i tenant-scoped odczytu testowego.
- Create `src/features/studio-events/postgres-repository.ts`.
- Create `src/features/studio-events/postgres-repository.test.ts`.
- Create `src/features/studio-events/memory-repository.ts`.
- Create `src/features/studio-events/service.ts`.
- Create `src/features/studio-events/service.test.ts`.
- Create `src/features/studio-events/server-repository.ts`.
- Modify `drizzle.config.ts` — dołączenie schematu zdarzeń.
- Generate `drizzle/0006_studio_product_events.sql` i odpowiadający snapshot
  Drizzle.
- Modify `src/features/properties/service.ts` i testy — zdarzenia projektu oraz
  faktów.
- Modify `src/features/property-sources/service.ts`,
  `callback-service.ts` i testy — źródła, review-ready i decyzje.
- Modify `src/features/properties/account-data.ts` i testy — eksport oraz
  usunięcie zdarzeń.
- Modify `src/app/api/account/export/route.ts`.
- Modify `src/app/api/account/delete/route.ts`.
- Modify `src/features/properties/server-repository.ts`.
- Modify `src/features/property-sources/server-repository.ts`.

### Czyszczenie S3 i produkcyjny runner

- Create `src/features/property-sources/object-purge.ts` — interfejs usuwania
  wszystkich wersji dokładnych kluczy.
- Create `src/features/property-sources/aws-object-purge.ts` — listowanie i
  kasowanie wersji z exact-prefix session policy.
- Create `src/features/property-sources/aws-object-purge.test.ts`.
- Modify `src/features/property-sources/repository.ts` — lista źródeł
  użytkownika przed usunięciem bazy.
- Modify `src/features/property-sources/postgres-repository.ts` i testy.
- Modify `infra/property-source-storage-stack.ts` — osobna rola kasowania z
  OIDC, ograniczona do `originals/organizations/*`.
- Modify `infra/property-source-storage-stack.test.ts`.
- Create `src/features/synthetic-acceptance/production-runner.ts` —
  orkiestracja HTTP/AWS i `finally`.
- Create `src/features/synthetic-acceptance/production-runner.test.ts`.
- Create `src/features/synthetic-acceptance/cleanup-registry.ts` — ścisły
  rejestr zasobów bieżącego przebiegu.
- Create `src/features/synthetic-acceptance/cleanup-registry.test.ts`.

### Dokumentacja odbioru

- Modify `docs/ROADMAP.md`.
- Modify `docs/pilot/M0-PILOT-START.md`.
- Create `docs/operations/synthetic-foundation-acceptance.md`.
- Create `docs/acceptance/synthetic-foundation-acceptance-report.md`.
- Modify
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md`.
- Modify
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md`.
- Modify `DATA/api-inventory.md` tylko wtedy, gdy live query potwierdzi nowy
  identyfikator zasobu.

### Task 1: Kontrakt i manifest korpusu

**Files:**
- Create: `src/features/synthetic-acceptance/domain.test.ts`
- Create: `src/features/synthetic-acceptance/domain.ts`
- Create: `src/features/synthetic-acceptance/manifest.test.ts`
- Create: `src/features/synthetic-acceptance/manifest.ts`

- [ ] **Step 1: Napisz test odrzucający niepoprawny manifest**

Test ma używać publicznego `syntheticCorpusSchema` i potwierdzić:

```ts
expect(() =>
  syntheticCorpusSchema.parse({
    version: 'synthetic-v1',
    cases: [],
  }),
).toThrow()

expect(() =>
  assertSyntheticDataPolicy(`Osoba Testowa, PESEL ${'9'.repeat(11)}`),
).toThrow('SYNTHETIC_DATA_POLICY_VIOLATION')
```

Polityka odrzuca co najmniej: PESEL (`11` cyfr), e-mail, polski numer telefonu,
numer KW pasujący do wzorca `AAAA/00000000/0`, `AKIA`, `sk_live_`,
`sk-ant-`, klucze PEM oraz pola o nazwach `password`, `secret`, `token`.

- [ ] **Step 2: Uruchom test i potwierdź RED**

Run:

```bash
npx vitest run src/features/synthetic-acceptance/domain.test.ts
```

Expected: FAIL z powodu braku `./domain`.

- [ ] **Step 3: Dodaj zamknięte typy manifestu**

Implementacja ma eksportować:

```ts
export const syntheticCaseCodes = [
  'SYN-M-01',
  'SYN-M-02',
  'SYN-D-01',
  'SYN-P-01',
  'SYN-P-02',
] as const

export const syntheticMaterialKinds = [
  'pdf',
  'jpeg',
  'png',
  'docx',
  'xlsx',
  'csv',
  'txt',
] as const

export const expectedFactSchema = z.object({
  factKey: z.string().min(1),
  valueType: propertyFactValueTypeSchema,
  value: z.json(),
  unit: z.string().max(30).optional(),
  locator: evidenceLocatorSchema,
  evidenceId: z.string().regex(/^EVID-[A-Z0-9-]+$/),
  conflict: z.boolean().default(false),
  acceptedVariants: z.array(z.json()).default([]),
})

export const syntheticMaterialSchema = z.object({
  id: z.string().regex(/^SYN-[A-Z0-9-]+$/),
  caseCode: z.enum(syntheticCaseCodes),
  kind: z.enum(syntheticMaterialKinds),
  fileName: z.string().max(120),
  mediaType: z.enum(supportedSourceMediaTypes),
  expectedOutcome: z.enum([
    'review_ready',
    'needs_manual_review',
    'controlled_failure',
  ]),
  facts: z.array(expectedFactSchema),
})
```

`syntheticCorpusSchema` ma wymuszać dokładnie 5 przypadków i 20 materiałów,
unikalne identyfikatory, limity 5 MB/plik oraz 100 MB/korpus po wygenerowaniu,
minimum 50 faktów i dokładnie 5 wpisów z `conflict: true`.

Po schematach wyeksportuj typy używane przez generator i scorer:

```ts
export type SyntheticCaseCode = (typeof syntheticCaseCodes)[number]
export type SyntheticCorpus = z.infer<typeof syntheticCorpusSchema>
export type SyntheticMaterial = z.infer<typeof syntheticMaterialSchema>
export type SupportedSourceMediaType =
  (typeof supportedSourceMediaTypes)[number]
```

- [ ] **Step 4: Napisz test liczebności i zgodności z katalogiem**

```ts
const parsed = syntheticCorpusSchema.parse(syntheticCorpus)
const materials = parsed.cases.flatMap((item) => item.materials)
const facts = materials.flatMap((item) => item.facts)
const countKinds = (items: typeof materials) =>
  Object.fromEntries(
    syntheticMaterialKinds.map((kind) => [
      kind,
      items.filter((item) => item.kind === kind).length,
    ]),
  )

expect(parsed.cases.map((item) => item.code)).toEqual(syntheticCaseCodes)
expect(materials).toHaveLength(20)
expect(facts.length).toBeGreaterThanOrEqual(50)
expect(facts.filter((fact) => fact.conflict)).toHaveLength(5)
expect(countKinds(materials)).toEqual({
  pdf: 5,
  jpeg: 2,
  png: 1,
  docx: 3,
  xlsx: 3,
  csv: 3,
  txt: 3,
})

for (const fact of facts) {
  expect(propertyFactCatalog.some((item) => item.key === fact.factKey)).toBe(
    true,
  )
}
```

- [ ] **Step 5: Zapisz pełny manifest**

Każdy z pięciu przypadków ma cztery materiały. Rozkład:

```ts
const materialPlan = {
  'SYN-M-01': ['pdf', 'jpeg', 'docx', 'csv'],
  'SYN-M-02': ['pdf', 'png', 'xlsx', 'txt'],
  'SYN-D-01': ['pdf', 'jpeg', 'docx', 'xlsx'],
  'SYN-P-01': ['pdf', 'docx', 'csv', 'txt'],
  'SYN-P-02': ['pdf', 'xlsx', 'csv', 'txt'],
} as const
```

Kontrolowane konflikty:

```ts
export const controlledConflicts = [
  ['SYN-M-02', 'area.usable'],
  ['SYN-M-02', 'building.yearBuilt'],
  ['SYN-P-02', 'plot.area'],
  ['SYN-P-02', 'plot.identifier'],
  ['SYN-P-02', 'plot.accessRoad'],
] as const
```

Adresy mają być jawnie fikcyjne, np. miasto `Testowo`, dzielnica
`Dzielnica Północna`, a numery KW `SYNTHETIC-NOT-A-LAND-REGISTER`.

- [ ] **Step 6: Uruchom testy modułu i pełne testy aplikacji**

Run:

```bash
npx vitest run \
  src/features/synthetic-acceptance/domain.test.ts \
  src/features/synthetic-acceptance/manifest.test.ts
npm test
```

Expected: testy modułu PASS; pełny pakiet PASS bez regresji.

- [ ] **Step 7: Commit**

```bash
git add src/features/synthetic-acceptance/domain.ts \
  src/features/synthetic-acceptance/domain.test.ts \
  src/features/synthetic-acceptance/manifest.ts \
  src/features/synthetic-acceptance/manifest.test.ts
git commit -m "test: define synthetic studio corpus"
```

### Task 2: Deterministyczny generator plików

**Files:**
- Create: `src/features/synthetic-acceptance/generator.test.ts`
- Create: `src/features/synthetic-acceptance/generator.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Napisz test dokładnie 20 plików**

```ts
const first = await generateSyntheticCorpus(syntheticCorpus)
const second = await generateSyntheticCorpus(syntheticCorpus)

expect(first).toHaveLength(20)
expect(first.map((file) => file.materialId)).toEqual(
  second.map((file) => file.materialId),
)
expect(first.reduce((sum, file) => sum + file.bytes.byteLength, 0)).toBeLessThan(
  100 * 1024 * 1024,
)
for (const file of first) {
  expect(file.bytes.byteLength).toBeGreaterThan(0)
  expect(file.bytes.byteLength).toBeLessThanOrEqual(5 * 1024 * 1024)
}
```

Test dodatkowo sprawdza magic bytes: `%PDF`, PNG, JPEG oraz `PK` dla DOCX/XLSX.

- [ ] **Step 2: Uruchom test i potwierdź RED**

Run:

```bash
npx vitest run src/features/synthetic-acceptance/generator.test.ts
```

Expected: FAIL z powodu braku `./generator`.

- [ ] **Step 3: Zaimplementuj wspólny kontrakt generatora**

```ts
export type GeneratedSyntheticMaterial = {
  caseCode: SyntheticCaseCode
  materialId: string
  fileName: string
  mediaType: SupportedSourceMediaType
  bytes: Uint8Array
  checksumSha256: string
}

export async function generateSyntheticCorpus(
  corpus: SyntheticCorpus,
): Promise<GeneratedSyntheticMaterial[]> {
  const parsed = syntheticCorpusSchema.parse(corpus)
  const generated: GeneratedSyntheticMaterial[] = []

  for (const item of parsed.cases) {
    for (const material of item.materials) {
      const bytes = await generateMaterial(item, material)
      generated.push({
        caseCode: item.code,
        materialId: material.id,
        fileName: material.fileName,
        mediaType: material.mediaType,
        bytes,
        checksumSha256: createHash('sha256').update(bytes).digest('hex'),
      })
    }
  }

  assertGeneratedCorpusLimits(generated)
  return generated
}
```

- [ ] **Step 4: Dodaj generatory formatów bez nowych zależności**

Implementacja używa:

- `pdf-lib` do pięciu jednostronicowych lub dwustronicowych PDF;
- `sharp` do obrazów z deterministycznym SVG jako wejściem;
- `fflate.zipSync` do minimalnych, poprawnych pakietów OpenXML DOCX/XLSX;
- `TextEncoder` do CSV/TXT.

Tekst każdego materiału powstaje wyłącznie z manifestu. Dwa materiały z
`controlled_failure` mają poprawny kontener, ale treść bez dowodu możliwego do
odczytu; nie generujemy uszkodzonego archiwum ani malware.

- [ ] **Step 5: Zablokuj artefakty robocze w Git**

Dodaj:

```gitignore
Temp/synthetic-acceptance/
reports/synthetic-acceptance/*.json
reports/synthetic-acceptance/*.run.json
```

Anonimizowany raport Markdown będzie commitowany osobno; pliki i rejestry
przebiegów nie.

- [ ] **Step 6: Zweryfikuj generator**

Run:

```bash
npx vitest run src/features/synthetic-acceptance/generator.test.ts
npm run typecheck
git diff --check
```

Expected: PASS; TypeScript i diff bez błędów.

- [ ] **Step 7: Commit**

```bash
git add .gitignore \
  src/features/synthetic-acceptance/generator.ts \
  src/features/synthetic-acceptance/generator.test.ts
git commit -m "feat: generate deterministic synthetic property files"
```

### Task 3: Scorer, limit kosztu i raport lokalny

**Files:**
- Create: `src/features/synthetic-acceptance/scorer.test.ts`
- Create: `src/features/synthetic-acceptance/scorer.ts`
- Create: `src/features/synthetic-acceptance/report.test.ts`
- Create: `src/features/synthetic-acceptance/report.ts`
- Create: `scripts/studio-synthetic-acceptance.ts`
- Modify: `package.json`

- [ ] **Step 1: Napisz test równoważności i konfliktów**

```ts
const observed = (
  caseCode: SyntheticCaseCode,
  factKey: string,
  value: JsonValue,
  evidenceLocator: EvidenceLocator,
): SyntheticObservation => ({
  caseCode,
  materialId: `${caseCode}-OBS`,
  factKey,
  value,
  evidenceLocator,
  sourceId: '00000000-0000-4000-8000-000000000001',
  proposalStatus: 'pending',
})

const score = scoreSyntheticRun({
  manifest: syntheticCorpus,
  observations: [
    observed('SYN-M-01', 'area.usable', 83.4, { type: 'page', page: 1 }),
    observed('SYN-M-01', 'price.asking', '750 000', {
      type: 'page',
      page: 1,
    }),
  ],
  jobs: [],
})

expect(score.referenceFactsMatched).toBe(2)
expect(score.locatorCoverage).toBe(1)
expect(score.confirmedProposalCount).toBe(0)
```

Dodaj osobne przypadki dla `83,40`, `83.4`, `83.40 m²`, uporządkowania JSON,
pięciu konfliktów oraz fałszywego konfliktu.

- [ ] **Step 2: Napisz test bramki kosztowej**

```ts
const budget = createCostGate({
  stopBeforeUsd: 2.5,
  hardLimitUsd: 3,
})

budget.recordJobCost(2.49)
expect(budget.canStartNextUpload(0.02)).toBe(false)
expect(() => budget.recordJobCost(0.52)).toThrow(
  'SYNTHETIC_COST_LIMIT_EXCEEDED',
)
```

- [ ] **Step 3: Uruchom testy i potwierdź RED**

Run:

```bash
npx vitest run \
  src/features/synthetic-acceptance/scorer.test.ts \
  src/features/synthetic-acceptance/report.test.ts
```

Expected: FAIL z powodu brakujących modułów.

- [ ] **Step 4: Zaimplementuj wynik i kryteria odbioru**

```ts
export type SyntheticAcceptanceScore = {
  referenceFactsTotal: number
  referenceFactsMatched: number
  precision: number
  locatorCoverage: number
  conflictsExpected: number
  conflictsDetected: number
  falseConflicts: number
  confirmedProposalCount: number
  duplicateWorkflowCount: number
  duplicateProposalCount: number
  durationMs: number
  providerCostUsd: number
  errorsByCode: Record<string, number>
  accepted: boolean
}

export const syntheticAcceptanceScoreSchema = z.object({
  referenceFactsTotal: z.number().int().nonnegative(),
  referenceFactsMatched: z.number().int().nonnegative(),
  precision: z.number().min(0).max(1),
  locatorCoverage: z.number().min(0).max(1),
  conflictsExpected: z.number().int().nonnegative(),
  conflictsDetected: z.number().int().nonnegative(),
  falseConflicts: z.number().int().nonnegative(),
  confirmedProposalCount: z.number().int().nonnegative(),
  duplicateWorkflowCount: z.number().int().nonnegative(),
  duplicateProposalCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  providerCostUsd: z.number().nonnegative(),
  errorsByCode: z.record(z.string(), z.number().int().nonnegative()),
  accepted: z.boolean(),
})

export function isAccepted(score: SyntheticAcceptanceScore): boolean {
  return (
    score.precision >= 0.9 &&
    score.locatorCoverage === 1 &&
    score.confirmedProposalCount === 0 &&
    score.conflictsDetected === 5 &&
    score.falseConflicts === 0 &&
    score.duplicateWorkflowCount === 0 &&
    score.duplicateProposalCount === 0 &&
    score.providerCostUsd <= 3
  )
}
```

`normalizeComparableValue` może normalizować separator tysięcy, przecinek
dziesiętny, jednostkę zgodną z definicją oraz kolejność kluczy JSON, ale nie
może stosować rozmytego dopasowania tekstu.

- [ ] **Step 5: Dodaj allowlistowany raport**

Raport JSON/Markdown może zawierać tylko:

```ts
const safeReportSchema = z.object({
  contractVersion: z.literal('synthetic-acceptance-v1'),
  runId: z.string().regex(/^syn-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$/),
  mode: z.enum(['local', 'production-synthetic']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  caseCodes: z.array(z.enum(syntheticCaseCodes)),
  score: syntheticAcceptanceScoreSchema,
  modelIds: z.array(z.string().max(240)),
  cleanup: z.object({
    databaseEmpty: z.boolean(),
    cognitoUserAbsent: z.boolean(),
    s3VersionsRemaining: z.number().int().nonnegative(),
    dlqMessagesVisible: z.number().int().nonnegative(),
    alarmsNotOk: z.number().int().nonnegative(),
  }),
})
```

Test skanuje serializowany raport i potwierdza brak nazw plików, tekstów
dowodów, adresów, e-maili, tokenów i pól `before`/`after`.

- [ ] **Step 6: Dodaj lokalną komendę**

`scripts/studio-synthetic-acceptance.ts local`:

1. parsuje manifest;
2. generuje pliki do `Temp/synthetic-acceptance/<run-id>`;
3. waliduje sygnatury i limity;
4. uruchamia scorer na oczekiwanym zestawie lokalnym;
5. zapisuje bezpieczny raport;
6. usuwa wygenerowane pliki w `finally`.

Dodaj skrypty:

```json
"studio:acceptance:local": "tsx scripts/studio-synthetic-acceptance.ts local",
"studio:acceptance:prod": "tsx scripts/studio-synthetic-acceptance.ts production-synthetic"
```

- [ ] **Step 7: Uruchom lokalny benchmark**

Run:

```bash
npm run studio:acceptance:local
npm test
npm run typecheck
```

Expected: raport `accepted: true`, 5 przypadków, 20 materiałów, minimum 50
faktów i brak plików w katalogu roboczym po zakończeniu.

- [ ] **Step 8: Commit**

```bash
git add package.json \
  scripts/studio-synthetic-acceptance.ts \
  src/features/synthetic-acceptance/scorer.ts \
  src/features/synthetic-acceptance/scorer.test.ts \
  src/features/synthetic-acceptance/report.ts \
  src/features/synthetic-acceptance/report.test.ts
git commit -m "feat: add local synthetic acceptance benchmark"
```

### Task 4: Projekcja i widok „Braki i konflikty”

**Files:**
- Create: `src/features/properties/open-issues.test.ts`
- Create: `src/features/properties/open-issues.ts`
- Create:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/braki/OpenIssuesBoard.test.tsx`
- Create:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/braki/OpenIssuesBoard.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/braki/page.tsx`
- Modify:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.tsx`
- Modify:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.tsx`

- [ ] **Step 1: Przed kodem zatwierdź jeden z trzech kierunków UI**

Kierunki są opisane w handoffie planu. Wybrany wariant ma zachować istniejące
tokeny koloru, fonty i responsywność Studio; nie zmienia nawigacji całego
produktu.

- [ ] **Step 2: Napisz test projekcji bez duplikatów**

```ts
const issues = buildOpenIssues({
  facts: [missingFact, conflictingFact],
  proposals: [
    conflictProposalForConflictingFact,
    needsReviewProposal,
  ],
  sources: [sourceA, sourceB],
})

expect(issues.map((issue) => issue.kind)).toEqual([
  'conflict',
  'needs_review',
  'missing',
])
expect(issues.filter((issue) => issue.factKey === 'area.usable')).toHaveLength(1)
expect(JSON.stringify(issues)).not.toContain(sourceA.fileName)
```

- [ ] **Step 3: Uruchom test i potwierdź RED**

Run:

```bash
npx vitest run src/features/properties/open-issues.test.ts
```

Expected: FAIL z powodu braku `./open-issues`.

- [ ] **Step 4: Dodaj zamknięty model prezentacyjny**

```ts
export type OpenIssue = {
  id: string
  factKey: string
  label: string
  category: string
  kind: 'missing' | 'conflict' | 'needs_review'
  priority: 1 | 2 | 3
  factId: string | null
  proposalId: string | null
  sourceId: string | null
  evidenceLocator: EvidenceLocator | null
  action:
    | 'complete_fact'
    | 'open_source'
    | 'decide_proposal'
}
```

Deduplikacja używa `factKey`; konflikt propozycji ma wyższy priorytet niż fakt
`conflicting`, a `needs_review` wyższy niż `missing`. Funkcja nie przyjmuje
`userId`, bo tenant scope jest egzekwowany wcześniej przez oba serwisy.

- [ ] **Step 5: Napisz test dostępności komponentu**

Test `renderToStaticMarkup` sprawdza:

```ts
expect(html).toContain('Braki i konflikty')
expect(html).toContain('aria-label="Filtry otwartych kwestii"')
expect(html).toContain('Rozstrzygnij propozycję')
expect(html).toContain('Otwórz źródło')
expect(html).not.toContain('undefined')
```

Przy pustej liście komunikat brzmi „Brak otwartych kwestii”.

- [ ] **Step 6: Dodaj stronę tenant-scoped**

Strona pobiera równolegle:

```ts
const [project, facts, sources, proposals] = await Promise.all([
  propertyService.getProject(userId, propertyId),
  propertyService.listFacts(userId, propertyId),
  sourceService.listSources(userId, propertyId),
  sourceService.listProposals(userId, propertyId, {
    statuses: ['conflict', 'needs_review'],
  }),
])
```

`PROPERTY_NOT_FOUND` mapuje na `notFound()`. CTA kierują tylko do istniejących
tras faktów i źródeł; nie powstaje mutujący endpoint.

- [ ] **Step 7: Aktywuj zakładkę Braki**

Typ `active` przyjmuje `'facts' | 'sources' | 'issues' | 'history'`.
`Braki` linkuje do `/nieruchomosci/<id>/braki`; `Historia` zostanie aktywowana
w Task 5; `Materiały` pozostają `aria-disabled`.

- [ ] **Step 8: Zweryfikuj moduł**

Run:

```bash
npx vitest run \
  src/features/properties/open-issues.test.ts \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/braki/OpenIssuesBoard.test.tsx' \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.tsx'
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/properties/open-issues.ts \
  src/features/properties/open-issues.test.ts \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/braki' \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.tsx' \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.tsx'
git commit -m "feat: add property issues desk"
```

### Task 5: Bezpieczna historia zmian

**Files:**
- Create: `src/features/properties/audit-presentation.test.ts`
- Create: `src/features/properties/audit-presentation.ts`
- Create:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/historia/PropertyHistory.test.tsx`
- Create:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/historia/PropertyHistory.tsx`
- Create: `src/app/(dashboard)/nieruchomosci/[propertyId]/historia/page.tsx`
- Modify:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.tsx`
- Modify:
  `src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.tsx`

- [ ] **Step 1: Napisz test redakcji audytu**

```ts
const item = presentAuditRecord({
  ...auditRecord,
  action: 'fact.updated',
  before: { value: 'tajna pełna wartość', status: 'declared' },
  after: { value: 'inna tajna wartość', status: 'confirmed' },
})

expect(item).toMatchObject({
  label: 'Zmieniono fakt',
  change: 'Status: Z deklaracji → Potwierdzone',
})
expect(JSON.stringify(item)).not.toContain('tajna pełna wartość')
expect(JSON.stringify(item)).not.toContain('inna tajna wartość')
```

Nieznana akcja dostaje etykietę „Zdarzenie systemowe”, bez serializacji
`before` i `after`.

- [ ] **Step 2: Uruchom test i potwierdź RED**

Run:

```bash
npx vitest run src/features/properties/audit-presentation.test.ts
```

Expected: FAIL z powodu braku modułu.

- [ ] **Step 3: Dodaj allowlistę akcji**

Allowlista obejmuje:

```ts
const actionLabels = {
  'property.created': 'Utworzono teczkę',
  'property.updated': 'Zmieniono teczkę',
  'fact.created': 'Dodano fakt',
  'fact.updated': 'Zmieniono fakt',
  'source.registered': 'Zarejestrowano źródło',
  'proposal.created': 'AI przygotowało propozycję',
  'proposal.decided': 'Rozstrzygnięto propozycję',
} as const
```

`presentAuditRecord` odczytuje tylko bezpieczne pola `status`, `category`,
`stage` oraz typ aktora. Nie kopiuje `value`, `address`, `fileName`,
`evidenceText`, locatora ani identyfikatora użytkownika.

- [ ] **Step 4: Dodaj oś historii i stronę**

Komponent grupuje wpisy po dniu, ma semantyczne `<ol>` i `<time>`, etykietę
aktora oraz link:

- `property_fact` → zakładka Fakty;
- `property_source` i `property_fact_proposal` → zakładka Źródła;
- inne typy → bez linku.

Strona używa `propertyService.listAudit(userId, propertyId)` i mapuje obcy
projekt na 404.

- [ ] **Step 5: Aktywuj zakładkę Historia**

`Historia` linkuje do `/nieruchomosci/<id>/historia`. Test potwierdza dokładnie
jedno `aria-current="page"` dla wszystkich czterech aktywnych zakładek.

- [ ] **Step 6: Zweryfikuj moduł i regresję UI**

Run:

```bash
npx vitest run \
  src/features/properties/audit-presentation.test.ts \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/historia/PropertyHistory.test.tsx' \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.tsx'
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/properties/audit-presentation.ts \
  src/features/properties/audit-presentation.test.ts \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/historia' \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.tsx' \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/PropertyWorkspaceTabs.test.tsx'
git commit -m "feat: add tenant scoped property history"
```

### Task 6: Append-only zdarzenia produktu i migracja

**Files:**
- Create: `src/features/studio-events/domain.test.ts`
- Create: `src/features/studio-events/domain.ts`
- Create: `src/features/studio-events/schema.ts`
- Create: `src/features/studio-events/repository.ts`
- Create: `src/features/studio-events/memory-repository.ts`
- Create: `src/features/studio-events/postgres-repository.test.ts`
- Create: `src/features/studio-events/postgres-repository.ts`
- Create: `src/features/studio-events/service.test.ts`
- Create: `src/features/studio-events/service.ts`
- Create: `src/features/studio-events/server-repository.ts`
- Modify: `drizzle.config.ts`
- Generate: `drizzle/0006_studio_product_events.sql`
- Generate: `drizzle/meta/0006_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

- [ ] **Step 1: Napisz test zamkniętego katalogu i metadanych**

```ts
expect(studioEventNameSchema.safeParse('arbitrary.client.event').success).toBe(
  false,
)
expect(() =>
  studioEventInputSchema.parse({
    organizationId,
    userId: 'user-a',
    name: 'fact.updated',
    contractVersion: 'studio-events-v1',
    metadata: { address: 'ul. Prywatna 1' },
  }),
).toThrow('STUDIO_EVENT_METADATA_NOT_ALLOWED')
```

Dozwolone klucze metadanych:

```ts
export const allowedMetadataKeys = [
  'propertyType',
  'transactionType',
  'stage',
  'factStatus',
  'sourceStatus',
  'proposalStatus',
  'decisionAction',
  'count',
  'durationMs',
  'providerCostMicrounits',
  'pipelineVersion',
  'modelFamily',
] as const
```

Wartość musi być `string | number | boolean | null`; obiekty i tablice są
odrzucane.

- [ ] **Step 2: Uruchom test i potwierdź RED**

Run:

```bash
npx vitest run src/features/studio-events/domain.test.ts
```

Expected: FAIL z powodu braku modułu.

- [ ] **Step 3: Dodaj domenę i interfejs repozytorium**

```ts
export const studioEventNames = [
  'studio.session_started',
  'property.created',
  'property.opened',
  'fact.created',
  'fact.updated',
  'source.registered',
  'source.review_ready',
  'proposal.decided',
  'property.ready_reached',
  'account.exported',
  'account.deleted',
] as const

export interface StudioEventRepository {
  append(input: StudioEventInput): Promise<StudioProductEvent>
  listForProject(
    userId: string,
    propertyProjectId: string,
  ): Promise<StudioProductEvent[]>
  exportForUser(userId: string): Promise<StudioProductEvent[]>
}
```

Nie dodawaj metod update/delete eventu; usunięcie odbywa się wyłącznie przez
kaskadę organizacji w istniejącym procesie RODO.

- [ ] **Step 4: Dodaj schemat tabeli**

```ts
export const studioProductEvents = pgTable(
  'studio_product_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    propertyProjectId: uuid('property_project_id').references(
      () => propertyProjects.id,
      { onDelete: 'cascade' },
    ),
    name: text('name').notNull(),
    contractVersion: text('contract_version').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('studio_events_org_created_idx').on(
      table.organizationId,
      table.createdAt,
    ),
    index('studio_events_project_created_idx').on(
      table.propertyProjectId,
      table.createdAt,
    ),
  ],
)
```

- [ ] **Step 5: Napisz test PGlite izolacji i eksportu**

Test tworzy dwóch użytkowników i potwierdza:

```ts
expect(await repository.listForProject('user-a', projectA.id)).toHaveLength(1)
expect(await repository.listForProject('user-b', projectA.id)).toEqual([])
expect(await repository.exportForUser('user-a')).toHaveLength(1)
```

Próba zapisu eventu z `organizationId` innym niż organizacja projektu ma
zwrócić `STUDIO_EVENT_CONTEXT_MISMATCH`.

- [ ] **Step 6: Dodaj repozytoria i serwis**

`StudioEventService.record` zawsze ponownie parsuje input. Repozytorium
Postgres sprawdza membership i zgodność projektu przed insertem. Wersja
pamięciowa zachowuje te same reguły do testów domenowych.

- [ ] **Step 7: Wygeneruj migrację Drizzle**

Najpierw dołącz schemat:

```ts
schema: [
  './src/features/properties/schema.ts',
  './src/features/property-sources/schema.ts',
  './src/features/studio-events/schema.ts',
],
```

Run:

```bash
npm run db:generate
```

Expected: jedna addytywna migracja tworząca tabelę i dwa indeksy; bez zmian
w istniejących tabelach i enumach.

- [ ] **Step 8: Zweryfikuj migrację i moduł**

Run:

```bash
npx vitest run \
  src/features/studio-events/domain.test.ts \
  src/features/studio-events/service.test.ts \
  src/features/studio-events/postgres-repository.test.ts
npm test
npm run typecheck
git diff --check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add drizzle drizzle.config.ts src/features/studio-events
git commit -m "feat: add privacy safe studio product events"
```

### Task 7: Emisja zdarzeń po udanych operacjach

**Files:**
- Modify: `src/features/properties/service.test.ts`
- Modify: `src/features/properties/service.ts`
- Modify: `src/features/properties/server-repository.ts`
- Modify: `src/features/property-sources/service.test.ts`
- Modify: `src/features/property-sources/service.ts`
- Modify: `src/features/property-sources/callback-service.test.ts`
- Modify: `src/features/property-sources/callback-service.ts`
- Modify: `src/features/property-sources/server-repository.ts`
- Modify: `src/app/(dashboard)/start/page.tsx`
- Modify: `src/app/(dashboard)/nieruchomosci/[propertyId]/page.tsx`

- [ ] **Step 1: Napisz test dokładnie jednego eventu na operację**

Do harnessów serwisów wstrzyknij `MemoryStudioEventRepository` i sprawdź:

```ts
await service.createProject('user-a', apartmentInput)
expect(await events.exportForUser('user-a')).toMatchObject([
  { name: 'property.created' },
])

await sourceService.registerSource('user-a', project.id, sourceInput)
expect(
  (await events.exportForUser('user-a')).filter(
    (event) => event.name === 'source.registered',
  ),
).toHaveLength(1)
```

Powtórzona decyzja z tym samym fingerprintem nie emituje drugiego
`proposal.decided`.

- [ ] **Step 2: Uruchom testy i potwierdź RED**

Run:

```bash
npx vitest run \
  src/features/properties/service.test.ts \
  src/features/property-sources/service.test.ts \
  src/features/property-sources/callback-service.test.ts
```

Expected: FAIL na brakujących eventach.

- [ ] **Step 3: Wstrzyknij serwis z bezpiecznym domyślnym sinkiem**

Konstruktory przyjmują:

```ts
constructor(
  private readonly repository: PropertyRepository,
  private readonly events: StudioEventSink = noopStudioEventSink,
) {}
```

`StudioEventSink` eksportuje wyłącznie `record(input): Promise<void>`.
Produkcyjny `server-repository.ts` podaje `getStudioEventService()`, a testy
niezwiązane z telemetrią mogą użyć no-op bez zmiany semantyki.

- [ ] **Step 4: Emituj event dopiero po sukcesie domenowym**

Mapowanie:

- create project → `property.created`;
- get/open workspace → jawna metoda `recordPropertyOpened`, wywoływana przez
  stronę po udanym `getProject`;
- create/update fact → `fact.created` / `fact.updated`;
- update stage z wartości innej niż `ready` na `ready` →
  `property.ready_reached`;
- register source → `source.registered`;
- callback zmienia źródło na `review_ready` → `source.review_ready`;
- pierwsza skuteczna decyzja → `proposal.decided`;
- `/start` → `studio.session_started`.

Metadane zawierają wyłącznie pola z allowlisty. Event failure ma przerwać
operację użytkownika tylko wtedy, gdy zapis domenowy nie został jeszcze
wykonany. Po udanym zapisie domenowym błąd telemetrii jest logowany wyłącznie
jako bezpieczny typ `studio_event_write_failed` i nie zmienia wyniku callbacku
ani nie prowokuje ponownego wykonania źródła. Testy normalnej ścieżki wymagają
dokładnie jednego eventu; test awarii wymaga zachowania sukcesu domenowego.

- [ ] **Step 5: Dodaj ochronę przed podwójną decyzją**

`ProposalDecisionResult` otrzymuje pole `decisionCreated: boolean`.
Repozytorium Postgres zwraca `false`, jeśli fingerprint już istnieje.
Serwis emituje `proposal.decided` tylko przy `decisionCreated: true`.

- [ ] **Step 6: Zweryfikuj wszystkie eventy**

Run:

```bash
npx vitest run \
  src/features/properties/service.test.ts \
  src/features/property-sources/service.test.ts \
  src/features/property-sources/callback-service.test.ts \
  src/features/property-sources/postgres-repository.test.ts
npm test
npm run typecheck
```

Expected: PASS; żadna operacja nie emituje dwóch eventów.

- [ ] **Step 7: Commit**

```bash
git add src/features/properties/service.ts \
  src/features/properties/service.test.ts \
  src/features/properties/server-repository.ts \
  src/features/property-sources/service.ts \
  src/features/property-sources/service.test.ts \
  src/features/property-sources/callback-service.ts \
  src/features/property-sources/callback-service.test.ts \
  src/features/property-sources/server-repository.ts \
  'src/app/(dashboard)/start/page.tsx' \
  'src/app/(dashboard)/nieruchomosci/[propertyId]/page.tsx'
git commit -m "feat: instrument studio domain outcomes"
```

### Task 8: Eksport, usuwanie danych i wersji S3

**Files:**
- Modify: `src/features/property-sources/repository.ts`
- Modify: `src/features/property-sources/postgres-repository.ts`
- Modify: `src/features/property-sources/postgres-repository.test.ts`
- Create: `src/features/property-sources/object-purge.ts`
- Create: `src/features/property-sources/aws-object-purge.test.ts`
- Create: `src/features/property-sources/aws-object-purge.ts`
- Modify: `src/features/properties/account-data.test.ts`
- Modify: `src/features/properties/account-data.ts`
- Modify: `src/app/api/account/export/route.ts`
- Modify: `src/app/api/account/delete/route.ts`
- Modify: `infra/property-source-storage-stack.test.ts`
- Modify: `infra/property-source-storage-stack.ts`

- [ ] **Step 1: Napisz test kolejności bezpiecznego usunięcia**

```ts
const operations: string[] = []

await deleteAccountData('user-a', {
  listSourcesForUser: async () => [sourceA],
  recordAccountDeleted: async () => operations.push('event'),
  purgeSourceObjects: async () => operations.push('s3'),
  deletePropertiesForUser: async () => operations.push('postgres'),
  deleteValue: async () => operations.push('kv'),
})

expect(operations).toEqual([
  'event',
  's3',
  'postgres',
  'kv',
  'kv',
  'kv',
  'kv',
  'kv',
])
```

Jeśli S3 purge zawiedzie, baza i KV pozostają. Jeśli Postgres zawiedzie po
udanym purge, endpoint zwraca błąd i niczego nie ukrywa; ponowienie jest
idempotentne.

- [ ] **Step 2: Dodaj tenant-scoped listę źródeł użytkownika**

Repozytorium eksportuje:

```ts
listSourcesForUser(userId: string): Promise<PropertySource[]>
```

Zapytanie łączy `property_sources` z `organization_memberships`, nie filtruje
wyłącznie po `createdByUserId`, dzięki czemu obejmuje wszystkie źródła
organizacji użytkownika.

- [ ] **Step 3: Napisz test wszystkich wersji exact key**

Mock S3 zwraca dwie strony:

```ts
{
  Versions: [{ Key: source.storageKey, VersionId: 'v2' }],
  DeleteMarkers: [{ Key: source.storageKey, VersionId: 'd1' }],
  IsTruncated: true,
  NextKeyMarker: source.storageKey,
  NextVersionIdMarker: 'v2',
}
```

Druga strona zwraca `v1`. Test wymaga jednego `DeleteObjectsCommand` z
`v2`, `d1`, `v1`, a końcowy odczyt ma zwrócić zero wersji.

- [ ] **Step 4: Zaimplementuj ścisły purger**

```ts
export interface PropertySourceObjectPurger {
  purgeSources(sources: PropertySource[]): Promise<{
    deletedVersions: number
  }>
}
```

`AwsPropertySourceObjectPurger`:

1. uruchamia `assertExpectedPropertySourceStorageKey` dla każdego źródła;
2. odrzuca pustą albo mieszaną listę organizacji;
3. tworzy sesję `source-delete-<organization-token>`;
4. ogranicza session policy do exact keys i dokładnego wspólnego prefiksu
   `originals/organizations/<organization-id>/`;
5. paginuje `ListObjectVersions`;
6. usuwa wyłącznie wpisy, których `Key` jest w wejściowym zbiorze;
7. ponawia listę i rzuca `SOURCE_OBJECT_PURGE_INCOMPLETE`, jeśli coś zostało.

- [ ] **Step 5: Dodaj osobną rolę OIDC do kasowania**

Nowa rola ma:

```ts
new iam.PolicyStatement({
  actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
  resources: [this.bucket.arnForObjects('originals/organizations/*')],
})

new iam.PolicyStatement({
  actions: ['s3:ListBucketVersions'],
  resources: [this.bucket.bucketArn],
  conditions: {
    StringLike: {
      's3:prefix': 'originals/organizations/*',
    },
  },
})
```

Trust policy używa tych samych exact Vercel production subjects co signer,
bez `StringLike` w `sub`. Rola nie ma `PutObject`, `GetObject`, KMS,
GuardDuty, Bedrock, Step Functions ani `Resource: "*"`. Stack eksportuje
nie-sekretny `PropertySourceDeletionRoleArn`, a aplikacja dostaje zmienną
`PROPERTY_SOURCE_DELETION_ROLE_ARN`.

- [ ] **Step 6: Rozszerz eksport i usunięcie konta**

Eksport dodaje:

```ts
propertyStudio: {
  ...propertyTruth,
  ...propertySources,
  productEvents,
}
```

Przed eksportem zapisz `account.exported`, aby bieżące zdarzenie znalazło się
w pobranym pliku. Przed kasowaniem:

1. znajdź źródła;
2. zapisz `account.deleted`;
3. usuń wszystkie wersje obiektów;
4. usuń organizację i dane kaskadowe;
5. usuń KV;
6. wyczyść cookie.

Odpowiedź HTTP zawiera tylko liczby: `sourceObjects`, `propertyStudio`,
`accountKeys`.

- [ ] **Step 7: Zweryfikuj kod i szablon CloudFormation**

Run:

```bash
npx vitest run \
  src/features/property-sources/aws-object-purge.test.ts \
  src/features/property-sources/postgres-repository.test.ts \
  src/features/properties/account-data.test.ts \
  infra/property-source-storage-stack.test.ts
npm run infra:test
npm run typecheck
```

Expected: PASS; test IAM potwierdza brak `Resource: "*"` i brak uprawnień
niezwiązanych z kasowaniem.

- [ ] **Step 8: Commit**

```bash
git add src/features/property-sources/repository.ts \
  src/features/property-sources/postgres-repository.ts \
  src/features/property-sources/postgres-repository.test.ts \
  src/features/property-sources/object-purge.ts \
  src/features/property-sources/aws-object-purge.ts \
  src/features/property-sources/aws-object-purge.test.ts \
  src/features/properties/account-data.ts \
  src/features/properties/account-data.test.ts \
  src/app/api/account/export/route.ts \
  src/app/api/account/delete/route.ts \
  infra/property-source-storage-stack.ts \
  infra/property-source-storage-stack.test.ts
git commit -m "feat: erase studio data and source versions"
```

### Task 9: Guardowany runner produkcyjny i rejestr sprzątania

**Files:**
- Create: `src/features/synthetic-acceptance/cleanup-registry.test.ts`
- Create: `src/features/synthetic-acceptance/cleanup-registry.ts`
- Create: `src/features/synthetic-acceptance/production-runner.test.ts`
- Create: `src/features/synthetic-acceptance/production-runner.ts`
- Modify: `scripts/studio-synthetic-acceptance.ts`

- [ ] **Step 1: Napisz test odrzucenia złego konta, regionu i flagi**

```ts
await expect(
  runProductionSynthetic({
    allowProductionSynthetic: false,
    profile: 'akademia-ai',
    baseUrl: 'https://akademia-ai-platform.vercel.app',
    maxCostUsd: 3,
  }, dependencies),
).rejects.toThrow('PRODUCTION_SYNTHETIC_NOT_ALLOWED')

dependencies.aws.getCallerIdentity.mockResolvedValue({
  Account: '021655150975',
  Arn: 'arn:aws:iam::021655150975:user/wrong',
})

await expect(run()).rejects.toThrow('REFUSING_AWS_ACCOUNT')
expect(dependencies.http.calls).toEqual([])
```

Oczekiwane konto, region, profil i produkcyjny URL są stałymi modułu. Caller
nie może ich zastąpić opcją ani zmienną środowiskową.

- [ ] **Step 2: Napisz test `finally` i zakresu cleanup**

Po błędzie przy materiale 7 test ma potwierdzić kolejność:

```ts
expect(cleanupCalls).toEqual([
  ['delete-account', run.userId],
  ['delete-cognito-user', run.username],
  ['verify-s3-empty', run.organizationPrefix],
  ['check-dlq'],
  ['check-alarms'],
])
```

Rejestr ma odrzucić prefix bez dokładnego
`originals/organizations/<uuid>/` oraz usera bez `synthetic-acceptance-<run-id>`.

- [ ] **Step 3: Uruchom testy i potwierdź RED**

Run:

```bash
npx vitest run \
  src/features/synthetic-acceptance/cleanup-registry.test.ts \
  src/features/synthetic-acceptance/production-runner.test.ts
```

Expected: FAIL z powodu brakujących modułów.

- [ ] **Step 4: Dodaj rejestr tylko bieżącego przebiegu**

```ts
export type SyntheticCleanupRegistry = {
  runId: string
  username: string
  cognitoSub: string | null
  organizationId: string | null
  organizationPrefix: string | null
  projectIds: string[]
  sourceIds: string[]
  storageKeys: string[]
  startedAt: string
}
```

Rejestr jest zapisywany atomowo do
`reports/synthetic-acceptance/<run-id>.run.json` z prawami `0600`. Nie zawiera
hasła, tokenu Cognito, cookie, callback secretu, nazw plików ani treści.

- [ ] **Step 5: Zaimplementuj guardy preflight**

Runner przed dowolnym zapisem sprawdza:

1. dokładną flagę `--allow-production-synthetic`;
2. `AWS_PROFILE=akademia-ai`;
3. region `eu-central-1`;
4. `sts get-caller-identity` z kontem `261965598943`;
5. ARN użytkownika kończący się
   `user/akademia-wojtka-admin-darek`;
6. działającą sesję przez read-only STS;
7. bazowy URL równy
   `https://akademia-ai-platform.vercel.app`;
8. limit kosztu dokładnie `3`, bez możliwości podniesienia flagą;
9. brak alarmów w stanie `ALARM` i pustą DLQ przed startem.

AWS CLI jest uruchamiane przez `execFileSync('aws', args)`, nigdy przez shell.
Logi pokazują tylko account, region, run-id i bezpieczne liczniki.

- [ ] **Step 6: Zaimplementuj syntetyczną sesję HTTP**

Runner:

1. generuje username
   `synthetic-acceptance-<run-id>@example.invalid`;
2. generuje silne hasło wyłącznie w pamięci;
3. przez AWS CLI tworzy i potwierdza tymczasowego usera Cognito;
4. przez Cognito `InitiateAuth` pobiera ID token;
5. POST `/api/auth/session` zamienia token na cookie;
6. tworzy pięć projektów i seeduje pięć faktów konfliktowych;
7. rejestruje źródło przez istniejące API;
8. wysyła dokładny plik przez presigned POST;
9. czeka z bounded polling do 10 minut na źródło;
10. przy koszcie prognozowanym `>= 2.50` nie zaczyna kolejnego uploadu;
11. ponawia jeden kontrolowany event/poll w celu potwierdzenia idempotencji;
12. pobiera fakty, źródła, propozycje i joby do scorera.

Cookie, token, hasło i pełne odpowiedzi AWS nie są logowane ani zapisywane.

- [ ] **Step 7: Zaimplementuj zawsze wykonywane sprzątanie**

W `finally`:

1. POST `/api/account/delete` z `confirm: "DELETE"`;
2. `admin-delete-user` dla dokładnego username;
3. read-only `list-object-versions` dla dokładnego prefiksu organizacji;
4. jeśli endpoint konta nie domknął S3, runner usuwa wyłącznie wersje z
   rejestru i ponownie weryfikuje zero;
5. sprawdza bazę przez tenant API — konto ma zwracać 401/404;
6. sprawdza DLQ i cztery alarmy;
7. usuwa lokalny plik `.run.json` dopiero po pełnym sukcesie;
8. zapisuje bezpieczny raport.

Każdy błąd cleanup ustawia exit code `1` i wypisuje wyłącznie `run-id`,
syntetyczny username, organizationId, sourceIds i liczbę pozostałych wersji.

- [ ] **Step 8: Dodaj jawny interfejs CLI**

Dozwolona komenda:

```bash
AWS_PROFILE=akademia-ai \
npm run studio:acceptance:prod -- \
  --allow-production-synthetic \
  --base-url https://akademia-ai-platform.vercel.app \
  --max-cost-usd 3
```

`--max-cost-usd` przyjmuje wyłącznie `3`; mniejsza wartość może zostać użyta
w teście, większa kończy się `INVALID_SYNTHETIC_COST_LIMIT`.

- [ ] **Step 9: Zweryfikuj runner bez chmury**

Run:

```bash
npx vitest run \
  src/features/synthetic-acceptance/cleanup-registry.test.ts \
  src/features/synthetic-acceptance/production-runner.test.ts
npm run studio:acceptance:local
npm test
npm run typecheck
npm run lint
```

Expected: PASS; testy używają wyłącznie fake AWS/HTTP i nie wykonują requestów
produkcyjnych.

- [ ] **Step 10: Commit**

```bash
git add scripts/studio-synthetic-acceptance.ts \
  src/features/synthetic-acceptance/cleanup-registry.ts \
  src/features/synthetic-acceptance/cleanup-registry.test.ts \
  src/features/synthetic-acceptance/production-runner.ts \
  src/features/synthetic-acceptance/production-runner.test.ts
git commit -m "feat: add guarded production synthetic runner"
```

### Task 10: Pełne bramy lokalne i przegląd kodu

**Files:**
- Modify only if a gate finds a defect in files from Tasks 1–9.

- [ ] **Step 1: Sprawdź stan gałęzi i zakres zmian**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: tylko pliki tego etapu; brak niecommitowanych zmian.

- [ ] **Step 2: Uruchom pełne bramy**

Run:

```bash
npm test
npm run infra:test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npm run studio:acceptance:local
```

Expected: wszystkie komendy exit `0`; benchmark lokalny `accepted: true`.

- [ ] **Step 3: Uruchom skan sekretów i danych zabronionych**

Run:

```bash
git diff origin/main...HEAD -- . \
  ':!package-lock.json' |
  rg -n 'AKIA|sk_live_|sk-ant-|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|[0-9]{11}|[A-Z]{2}[0-9A-Z]{2}/[0-9]{8}/[0-9]'
```

Expected: brak trafień w dodanej treści poza nazwami wzorców w testach
polityki; każde trafienie testowe musi być jawnie syntetyczne i nie może być
działającym sekretem ani realnym identyfikatorem.

- [ ] **Step 4: Wykonaj review względem specyfikacji**

Review potwierdza:

- 5/20/50/5;
- dwa widoki z 404 tenant isolation;
- brak automatycznego potwierdzania AI;
- eventy bez PII;
- eksport i usunięcie eventów;
- usunięcie wszystkich wersji S3;
- stały limit 3 USD;
- `finally` cleanup;
- brak nowego stacka dev;
- brak Transcribe wildcard;
- brak zmian M4–M7.

- [ ] **Step 5: Commit poprawek review, jeśli powstały**

```bash
git add -p
git commit -m "fix: harden synthetic acceptance workflow"
```

Jeśli review nie wymaga zmian, nie twórz pustego commita.

### Task 11: Migracja i kontrolowany deploy produkcyjny

**Files:**
- Modify after successful deployment:
  `docs/operations/synthetic-foundation-acceptance.md`

- [ ] **Step 1: Odczytaj obowiązkowe zasady przed cloud**

Przeczytaj w całości:

```text
.claude/rules/cloud_safety.md
.claude/rules/credential-protection.md
PROJEKTY/AUTOFIRMA/COSTSEC/docs/CLOUD_SAFETY.md
PROJEKTY/AUTOFIRMA/COSTSEC/docs/ZASADY.md
PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md
PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md
DATA/api-inventory.md
```

Jeżeli pliku brakuje albo jego treść jest niedostępna, STOP.

- [ ] **Step 2: Potwierdź produkcyjny preflight read-only**

Run:

```bash
aws sts get-caller-identity \
  --profile akademia-ai \
  --region eu-central-1 \
  --query '{Account:Account,Arn:Arn}' \
  --output json
aws iam get-account-summary \
  --profile akademia-ai \
  --region eu-central-1 \
  --query 'SummaryMap.{RootMFA:AccountMFAEnabled,RootKeys:AccountAccessKeysPresent}' \
  --output json
```

Expected: konto `261965598943`, użytkownik
`akademia-wojtka-admin-darek`, RootMFA `1`, RootKeys `0`.

- [ ] **Step 3: Pokaż Darekowi plan zmian i koszt**

Przed zapisem pokaż:

- addytywną migrację jednej tabeli;
- nową rolę OIDC wyłącznie do usuwania wersji z `originals/organizations/*`;
- nową zmienną Vercel z ARN roli, bez wartości sekretnej;
- brak nowego bucketa, KMS, GuardDuty, modelu i stacka;
- koszt stały infrastruktury bez istotnego wzrostu;
- benchmark osobno do maksymalnie 3 USD;
- rollback aplikacji: commit sprzed etapu;
- rollback migracji: tabela pozostaje nieużywana;
- rollback IAM: `git revert` + CDK deploy po osobnej zgodzie.

Wymagane jest jawne potwierdzenie deployu produkcyjnego.

- [ ] **Step 4: Wykonaj backup i migrację**

Użyj istniejącej, udokumentowanej procedury backupu Neon bez wyświetlania URL
ani danych. Następnie:

```bash
npm run db:migrate
```

Expected: `0006_studio_product_events` zastosowana; ponowne uruchomienie nie
wykonuje drugiej zmiany.

- [ ] **Step 5: Wykonaj i oceń CDK diff**

Z tymi samymi zatwierdzonymi zmiennymi produkcyjnymi co obecny stack:

```bash
npm run infra:cdk -- diff PropertySourceStorage-prod \
  --profile akademia-ai
```

Expected: wyłącznie nowa rola/polityka deletion i output. STOP, jeśli diff
zmienia bucket, KMS, GuardDuty, Lambdy, Step Functions, budżet albo trust
subject istniejącej roli.

- [ ] **Step 6: Wdróż stack i zweryfikuj rolę**

```bash
npm run infra:cdk -- deploy PropertySourceStorage-prod \
  --profile akademia-ai \
  --require-approval never
```

Po deployu read-only query potwierdza exact OIDC subjects, dwa dozwolone
zestawy S3 actions i brak innych polityk.

- [ ] **Step 7: Dodaj identyfikator roli do Vercel**

Pobierz ARN z outputu CloudFormation i przekaż przez stdin do
`vercel env add PROPERTY_SOURCE_DELETION_ROLE_ARN production --sensitive`.
Nie drukuj ARN, jeśli lokalna polityka klasyfikuje go jako wrażliwy
identyfikator. Usuń plik tymczasowy z outputami.

- [ ] **Step 8: Push i smoke test**

Po czystym statusie:

```bash
git push origin main
```

Poczekaj na Vercel `READY`, następnie sprawdź:

- `/start`;
- login;
- cztery zakładki teczki;
- 404 cudzej teczki;
- brak publicznego dostępu do S3;
- alarmy `OK`;
- DLQ `0`.

### Task 12: Produkcyjny benchmark syntetyczny

**Files:**
- Create after the run:
  `docs/acceptance/synthetic-foundation-acceptance-report.md`
- Modify:
  `docs/operations/synthetic-foundation-acceptance.md`

- [ ] **Step 1: Ponów cloud safety gate i preflight**

Ponownie odczytaj pliki z Task 11 Step 1 i wykonaj `sts
get-caller-identity`. Sprawdź bieżące wydatki Studio oraz pozostały limit
GuardDuty; jeśli danych o bezpłatnym limicie nie da się potwierdzić, raport
ma oznaczyć koszt GuardDuty jako nierozstrzygnięty przed startem.

- [ ] **Step 2: Uzyskaj osobne potwierdzenie przebiegu do 3 USD**

Pokaż:

- 20 uploadów, maksymalnie 100 MB;
- Bedrock Sonnet 4.6;
- stop przy prognozie 2,50 USD;
- hard stop 3 USD;
- dokładny syntetyczny user/run-id;
- automatyczny cleanup;
- rollback i procedurę ręcznego dokończenia cleanup.

Nie uruchamiaj bez jawnego potwierdzenia.

- [ ] **Step 3: Uruchom benchmark**

```bash
AWS_PROFILE=akademia-ai \
npm run studio:acceptance:prod -- \
  --allow-production-synthetic \
  --base-url https://akademia-ai-platform.vercel.app \
  --max-cost-usd 3
```

Expected: 5 przypadków, 20 materiałów, minimum 90% precyzji, locatory 100%,
konflikty 5/5, zero automatycznie potwierdzonych propozycji, zero duplikatów,
koszt `<= 3`.

- [ ] **Step 4: Zweryfikuj cleanup niezależnymi odczytami**

Potwierdź:

- syntetyczny user Cognito nie istnieje;
- organizacja, membership, projekty, fakty, źródła, joby, propozycje, audyt i
  eventy mają zero rekordów;
- dokładny prefiks organizacji ma zero `Versions` i `DeleteMarkers`;
- DLQ ma zero widocznych wiadomości;
- wszystkie cztery alarmy są `OK`;
- nie powstał drugi workflow ani druga propozycja po replay.

- [ ] **Step 5: Zapisz anonimowy raport**

Raport Markdown zawiera:

- commit i deployment URL;
- `run-id`;
- kody pięciu przypadków;
- zbiorcze wyniki 5/20/50/5;
- precision, locator coverage, conflicts, duplicates, czas i koszt;
- kody kontrolowanych błędów;
- wyniki cleanup;
- alarmy i DLQ;
- odchylenia od progu.

Nie zawiera username, Cognito sub, organizationId, sourceId, storageKey, nazw
plików, treści dokumentów, tokenów ani secretów.

- [ ] **Step 6: Commit raportu i runbooka**

```bash
git add docs/acceptance/synthetic-foundation-acceptance-report.md \
  docs/operations/synthetic-foundation-acceptance.md
git commit -m "docs: record synthetic foundation acceptance"
```

### Task 13: Roadmapa, COSTSEC i status „gotowy do M3”

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/pilot/M0-PILOT-START.md`
- Modify:
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md`
- Modify:
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md`
- Modify: `DATA/api-inventory.md` only if verified live identifiers changed

- [ ] **Step 1: Ustal status wyłącznie z raportu**

Fundament może dostać „gotowy do M3” tylko gdy wszystkie warunki są prawdziwe:

```ts
const readyForM3 =
  report.score.accepted &&
  report.cleanup.databaseEmpty &&
  report.cleanup.cognitoUserAbsent &&
  report.cleanup.s3VersionsRemaining === 0 &&
  report.cleanup.dlqMessagesVisible === 0 &&
  report.cleanup.alarmsNotOk === 0
```

Jeśli którykolwiek warunek jest fałszywy, roadmapa pokazuje „blokada M3” i
konkretną metrykę, bez zaokrąglania wyniku.

- [ ] **Step 2: Zaktualizuj roadmapę produktu**

Zapisz:

- M1/M2 — wdrożone;
- odbiór syntetyczny M0–M3 — wynik z raportu;
- M3 — nadal wymaga prawdziwych agentów i realnego baseline;
- M4–M7 — nierozpoczęte;
- danych syntetycznych nie używamy jako dowodu retencji, czasu ani wartości
  biznesowej.

- [ ] **Step 3: Zaktualizuj COSTSEC**

`SYSTEMY.md` i `CHANGELOG.md` mają zawierać:

- nazwę stacka i nowy output bez sekretów;
- zakres deletion role;
- wersję migracji;
- wynik pełnych bram;
- koszt benchmarku;
- wynik cleanup;
- commit produkcyjny i rollback;
- potwierdzenie alarmów/DLQ.

- [ ] **Step 4: Sprawdź diff i sekrety**

Run:

```bash
git diff --check
git diff -- docs/ROADMAP.md docs/pilot/M0-PILOT-START.md \
  PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md \
  PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md \
  DATA/api-inventory.md
```

Expected: wyłącznie zweryfikowane identyfikatory i liczby; zero sekretów i
danych syntetycznego konta technicznego.

- [ ] **Step 5: Commit dokumentacji**

```bash
git add docs/ROADMAP.md docs/pilot/M0-PILOT-START.md \
  PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md \
  PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md \
  DATA/api-inventory.md
git commit -m "docs: mark studio foundation ready for M3"
```

Nie dodawaj `DATA/api-inventory.md`, jeśli plik nie został zmieniony.

- [ ] **Step 6: Końcowa weryfikacja i push**

Run:

```bash
npm test
npm run infra:test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
git diff --check
git status --short --branch
```

Po wyniku PASS pokaż Darekowi commity, wyniki, koszt, rollback i poproś o
osobne potwierdzenie pushu dokumentacji, zgodnie z regułą CTO dla COSTSEC.
