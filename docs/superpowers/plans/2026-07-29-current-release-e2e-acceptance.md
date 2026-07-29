# Current Release E2E Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domknąć i produkcyjnie zweryfikować wszystkie funkcje obecnego release'u Property Intelligence Studio poza płatnościami Stripe.

**Architecture:** Najpierw uszczelniamy wspólne granice sesji, tryb pilotażowy, usuwanie konta, panel administratora i RAG. Następnie rozszerzamy istniejący mechanizm `production-synthetic` o jeden bezpieczny, seryjny przebieg Playwright obejmujący dwa konta użytkowników, administratora, wszystkich agentów i Studio. Produkcyjny test ma jawny przełącznik, limit 2 USD, rejestr zasobów bez sekretów oraz cleanup wykonywany także po błędzie.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest, Playwright Test, AWS Cognito/S3/Step Functions/CloudWatch, PostgreSQL, Vercel KV, Anthropic, Pinecone.

---

## File map

### Granice uwierzytelniania

- Create `src/lib/request-auth.ts`: wspólny wynik uwierzytelnienia dla API.
- Create `src/lib/request-auth.test.ts`: brak sesji, poprawna sesja i brak wycieku danych.
- Create `src/components/DashboardShell.tsx`: dotychczasowa kliencka powłoka dashboardu bez decyzji o dostępie.
- Create `src/components/onboarding/OnboardingShell.tsx`: wizualna powłoka onboardingu.
- Modify `src/app/(dashboard)/layout.tsx`: serwerowy redirect przed renderowaniem stron.
- Modify `src/app/(onboarding)/layout.tsx`: serwerowy redirect przed renderowaniem onboardingu.
- Modify `src/lib/onboarding/state.ts`: usunięcie produkcyjnego fallbacku `demo-user`.
- Modify `src/lib/billing/state.ts`: usunięcie produkcyjnego fallbacku `demo-user`.
- Modify all routes under `src/app/api/onboarding/`: jawne `401` bez sesji.
- Modify `src/app/api/agents/run/route.ts`: uwierzytelnienie przed walidacją agenta i wywołaniem modelu.

### Tryb pilotażowy

- Create `src/lib/billing/mode.ts`: zamknięty kontrakt `pilot | stripe`.
- Create `src/lib/billing/mode.test.ts`: konfiguracja pełna, częściowa i brak konfiguracji.
- Modify `src/app/(dashboard)/pricing/page.tsx`: przekazanie trybu do kart.
- Modify `src/components/billing/PricingCards.tsx`: brak checkoutu w pilocie.
- Modify `src/app/(dashboard)/settings/subscription/page.tsx`: karta aktywnego dostępu pilotażowego.
- Modify `src/app/(dashboard)/settings/page.tsx`: prawdziwy opis planu pilotażowego.
- Modify `src/components/billing/PortalButton.tsx`: render tylko w trybie Stripe.
- Modify `src/app/api/stripe/checkout/route.ts`: kontrolowane `503 billing_unavailable`.
- Modify `src/app/api/stripe/portal/route.ts`: kontrolowane `503 billing_unavailable`.
- Modify `src/app/api/stripe/webhook/route.ts`: kontrolowane `503 billing_unavailable`.
- Create `src/app/api/stripe/pilot-mode.test.ts`: endpointy nie wywołują klienta Stripe.

### Konto, administrator i RAG

- Create `src/features/account/deletion-workflow.ts`: zgodność tokenu Cognito z sesją i kolejność usuwania.
- Create `src/features/account/deletion-workflow.test.ts`: mismatch, brak tokenu, sukces i błąd Cognito.
- Modify `src/lib/cognito.ts`: `deleteUser(accessToken)`.
- Modify `src/app/api/account/delete/route.ts`: wymóg zweryfikowanego access tokenu i usunięcie tożsamości Cognito.
- Modify `src/app/(dashboard)/settings/page.tsx`: przekazanie tokenu, czyszczenie localStorage i bezpieczny stan błędu.
- Create `src/lib/admin-auth.test.ts`: HMAC, timing-safe compare i odrzucenie zmodyfikowanego cookie.
- Modify `src/lib/admin-auth.ts`: podpisany token sesji administratora.
- Modify `src/app/api/admin/auth/route.ts`: limit prób logowania.
- Modify `src/app/api/admin/agents/route.ts`: odrzucenie nieznanego identyfikatora agenta.
- Modify `src/lib/rate-limit.ts`: limit `ADMIN_AUTH`.
- Create `src/lib/legal/search.test.ts`: próg relewancji i brak wyników poniżej progu.
- Modify `src/lib/legal/search.ts`: filtrowanie wyników przed przekazaniem do promptu.

### Pełny odbiór

- Create `src/features/current-release-acceptance/domain.ts`: zamknięty katalog scenariuszy i limit kosztu.
- Create `src/features/current-release-acceptance/domain.test.ts`: polityka danych syntetycznych i limity.
- Create `src/features/current-release-acceptance/report.ts`: bezpieczny raport bez sekretów i treści.
- Create `src/features/current-release-acceptance/report.test.ts`: odrzucenie pól spoza kontraktu.
- Create `src/features/current-release-acceptance/runner.ts`: preflight, Playwright i cleanup w `finally`.
- Create `src/features/current-release-acceptance/runner.test.ts`: konto, URL, limit kosztu i cleanup po błędzie.
- Modify `src/features/synthetic-acceptance/cleanup-registry.ts`: drugi użytkownik, klucze KV i stan agenta.
- Modify `src/features/synthetic-acceptance/cleanup-registry.test.ts`: walidacja nowych identyfikatorów bez sekretów.
- Create `e2e/current-release/operator.ts`: ograniczone operacje Cognito, AWS i przywrócenie admina.
- Create `e2e/current-release/fixtures.ts`: ścisła walidacja env procesu testowego.
- Create `e2e/current-release/current-release.spec.ts`: seryjny przepływ całego produktu.
- Create `playwright.config.ts`: Chromium, jeden worker, brak trace/video i limit globalny.
- Create `scripts/current-release-acceptance.ts`: jawna komenda operatorska.
- Modify `package.json` and `package-lock.json`: Playwright oraz komendy odbiorowe.
- Modify `.gitignore`: artefakty Playwright i bezpieczne raporty bieżącego odbioru.
- Modify `docs/operations/synthetic-foundation-acceptance.md`: nowy tryb i procedura awaryjnego cleanupu.

## Task 1: Enforce the authenticated product boundary

**Files:**
- Create: `src/lib/request-auth.ts`
- Create: `src/lib/request-auth.test.ts`
- Create: `src/components/DashboardShell.tsx`
- Create: `src/components/onboarding/OnboardingShell.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(onboarding)/layout.tsx`
- Modify: `src/lib/onboarding/state.ts`
- Modify: `src/lib/billing/state.ts`

- [ ] **Step 1: Write failing tests for the API and state boundary**

Create `src/lib/request-auth.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createApiUserResolver } from './request-auth'

describe('API user boundary', () => {
  it('returns 401 when the signed session is absent', async () => {
    const resolve = createApiUserResolver(async () => null)
    const result = await resolve()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({
        error: 'unauthorized',
      })
    }
  })

  it('returns only the verified session subject', async () => {
    const resolve = createApiUserResolver(
      vi.fn(async () => 'verified-user'),
    )
    await expect(resolve()).resolves.toEqual({
      ok: true,
      userId: 'verified-user',
    })
  })
})
```

Add a focused test to `src/lib/product-surface.test.ts` asserting that both
protected layouts import `getServerUserId` and call `redirect('/login')`, and
that `src/lib/onboarding/state.ts` no longer contains `demo-user`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/lib/request-auth.test.ts src/lib/product-surface.test.ts
```

Expected: FAIL because `request-auth.ts` and the server guards do not exist.

- [ ] **Step 3: Implement the request resolver**

Create `src/lib/request-auth.ts`:

```ts
import { NextResponse } from 'next/server'
import { getServerUserId } from './session'

export type ApiUserResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

export function createApiUserResolver(
  readUserId: () => Promise<string | null>,
) {
  return async (): Promise<ApiUserResult> => {
    const userId = await readUserId()
    if (!userId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'unauthorized' },
          { status: 401 },
        ),
      }
    }
    return { ok: true, userId }
  }
}

export const resolveApiUser = createApiUserResolver(getServerUserId)
```

- [ ] **Step 4: Move the client dashboard markup into a shell**

Move the existing client code from `src/app/(dashboard)/layout.tsx` into
`src/components/DashboardShell.tsx`. Keep `AuthProvider`, `ThemeProvider`,
navbar, command palette, loading state and skip link unchanged.

Replace `src/app/(dashboard)/layout.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { getServerUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getServerUserId())) redirect('/login')
  return <DashboardShell>{children}</DashboardShell>
}
```

- [ ] **Step 5: Add the server onboarding guard**

Move the existing visual markup to
`src/components/onboarding/OnboardingShell.tsx` with a `children` prop.
Replace `src/app/(onboarding)/layout.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import { getServerUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getServerUserId())) redirect('/login')
  return <OnboardingShell>{children}</OnboardingShell>
}
```

- [ ] **Step 6: Remove the `demo-user` fallback from user state**

In `src/lib/onboarding/state.ts`, import `requireServerUserId` and replace the
private resolver with:

```ts
async function getUserId(): Promise<string> {
  return requireServerUserId()
}
```

In `src/lib/billing/state.ts`, replace both user lookups with:

```ts
const userId = await requireServerUserId()
```

Do not retain a fallback for production or tests. Tests must mock the signed
session explicitly.

- [ ] **Step 7: Run focused and full tests**

Run:

```bash
npx vitest run src/lib/request-auth.test.ts src/lib/product-surface.test.ts
npm test
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/request-auth.ts src/lib/request-auth.test.ts \
  src/lib/product-surface.test.ts src/lib/onboarding/state.ts \
  src/lib/billing/state.ts src/components/DashboardShell.tsx \
  src/components/onboarding/OnboardingShell.tsx \
  'src/app/(dashboard)/layout.tsx' 'src/app/(onboarding)/layout.tsx'
git commit -m "fix: enforce authenticated product boundary"
```

## Task 2: Protect onboarding and agent APIs

**Files:**
- Modify: `src/app/api/onboarding/complete/route.ts`
- Modify: `src/app/api/onboarding/generate-deep/route.ts`
- Modify: `src/app/api/onboarding/generate-profil/route.ts`
- Modify: `src/app/api/onboarding/reset/route.ts`
- Modify: `src/app/api/onboarding/save-answer/route.ts`
- Modify: `src/app/api/onboarding/save-deep-answer/route.ts`
- Modify: `src/app/api/onboarding/state/route.ts`
- Modify: every route in `src/app/api/onboarding/persona/`
- Modify: `src/app/api/agents/run/route.ts`
- Create: `src/app/api/onboarding/auth-boundary.test.ts`
- Create: `src/app/api/agents/run.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `src/app/api/onboarding/auth-boundary.test.ts` and mock
`@/lib/request-auth` before importing representative routes:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveApiUser = vi.fn()
vi.mock('@/lib/request-auth', () => ({ resolveApiUser }))

describe('onboarding API authentication', () => {
  beforeEach(() => {
    resolveApiUser.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: 'unauthorized' },
        { status: 401 },
      ),
    })
  })

  it('blocks state reads without a signed session', async () => {
    const { GET } = await import('./state/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('blocks expensive profile generation without a signed session', async () => {
    const { POST } = await import('./generate-profil/route')
    const response = await POST()
    expect(response.status).toBe(401)
  })
})
```

Create `src/app/api/agents/run.test.ts` asserting unauthenticated requests
return 401 before `findAgent`, Pinecone or Anthropic are called.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/app/api/onboarding/auth-boundary.test.ts \
  src/app/api/agents/run.test.ts
```

Expected: FAIL because routes do not resolve an API user first.

- [ ] **Step 3: Add the guard to every onboarding route**

At the start of every exported `GET` or `POST`, before parsing input or reading
state, add:

```ts
const auth = await resolveApiUser()
if (!auth.ok) return auth.response
```

Import:

```ts
import { resolveApiUser } from '@/lib/request-auth'
```

For `reset/route.ts`, require both the signed user and existing administrator
authorization. Replace the fallback lookup with `auth.userId`.

- [ ] **Step 4: Require authentication before agent lookup**

At the start of `POST` in `src/app/api/agents/run/route.ts`:

```ts
const auth = await resolveApiUser()
if (!auth.ok) return auth.response
const userId = auth.userId
```

Move `await req.json()`, `findAgent`, rate limiting, user context, plan lookup,
RAG and Anthropic below this guard. Remove the optional `if (userId)` branch;
all agent calls must be rate-limited by the verified subject.

- [ ] **Step 5: Verify all protected routes**

```bash
npx vitest run src/app/api/onboarding/auth-boundary.test.ts \
  src/app/api/agents/run.test.ts
npm test
npm run typecheck
```

Expected: all commands exit 0 and unauthenticated route tests return 401.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/onboarding src/app/api/agents/run/route.ts \
  src/app/api/agents/run.test.ts
git commit -m "fix: protect onboarding and agent APIs"
```

## Task 3: Make pilot billing an explicit product mode

**Files:**
- Create: `src/lib/billing/mode.ts`
- Create: `src/lib/billing/mode.test.ts`
- Create: `src/app/api/stripe/pilot-mode.test.ts`
- Modify: `src/lib/billing/state.ts`
- Modify: `src/app/(dashboard)/pricing/page.tsx`
- Modify: `src/components/billing/PricingCards.tsx`
- Modify: `src/app/(dashboard)/settings/subscription/page.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/components/billing/PortalButton.tsx`
- Modify: all routes in `src/app/api/stripe/`

- [ ] **Step 1: Write failing billing-mode tests**

Create `src/lib/billing/mode.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBillingMode } from './mode'

afterEach(() => vi.unstubAllEnvs())

describe('billing mode', () => {
  it('uses pilot mode when Stripe is absent or partial', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    expect(getBillingMode()).toBe('pilot')

    vi.stubEnv('STRIPE_SECRET_KEY', 'test-secret')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect(getBillingMode()).toBe('pilot')
  })

  it('uses Stripe only with the complete five-variable contract', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'test-secret')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'test-webhook')
    vi.stubEnv('STRIPE_PRICE_STARTER', 'price_starter')
    vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro')
    vi.stubEnv('STRIPE_PRICE_AGENCY', 'price_agency')
    expect(getBillingMode()).toBe('stripe')
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npx vitest run src/lib/billing/mode.test.ts
```

Expected: FAIL because `mode.ts` does not exist.

- [ ] **Step 3: Implement the closed mode contract**

Create `src/lib/billing/mode.ts`:

```ts
export type BillingMode = 'pilot' | 'stripe'

const REQUIRED_STRIPE_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_AGENCY',
] as const

export function getBillingMode(): BillingMode {
  return REQUIRED_STRIPE_ENV.every(
    (name) => Boolean(process.env[name]?.trim()),
  )
    ? 'stripe'
    : 'pilot'
}
```

Use `getBillingMode()` in `getEffectivePlan()`. In `pilot`, return Pro and
`active: true`; in `stripe`, keep the current subscription calculation.

- [ ] **Step 4: Disable payment actions in pilot UI**

Pass `billingMode={getBillingMode()}` from the pricing page. Extend
`PricingCards` props:

```ts
type Props = {
  plans: PlanDisplay[]
  currentPlan: PlanId
  billingMode: BillingMode
}
```

When `billingMode === 'pilot'`, replace every non-current checkout button with:

```tsx
<div className="w-full rounded-full border border-accent/25 bg-accent/[0.06] px-4 py-3 text-center text-sm text-accent">
  Płatności uruchomimy po pilotażu
</div>
```

On the subscription page, show `Dostęp pilotażowy Pro` and remove renewal,
invoice, cancel and Stripe portal copy. In settings replace
`Zarządzaj subskrypcją, zmień plan, anuluj` with
`Sprawdź funkcje aktywnego dostępu pilotażowego`.

- [ ] **Step 5: Return controlled API responses without Stripe**

At the beginning of checkout, portal and webhook handlers add:

```ts
if (getBillingMode() === 'pilot') {
  return NextResponse.json(
    { error: 'billing_unavailable', mode: 'pilot' },
    { status: 503 },
  )
}
```

Create `src/app/api/stripe/pilot-mode.test.ts` that clears all Stripe env
variables, invokes the three handlers and asserts status 503, the closed JSON
contract, and zero calls to `getStripe`.

- [ ] **Step 6: Run focused and full verification**

```bash
npx vitest run src/lib/billing/mode.test.ts \
  src/app/api/stripe/pilot-mode.test.ts
npm test
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing src/app/api/stripe \
  'src/app/(dashboard)/pricing/page.tsx' \
  'src/app/(dashboard)/settings/page.tsx' \
  'src/app/(dashboard)/settings/subscription/page.tsx' \
  src/components/billing
git commit -m "feat: expose explicit pilot access mode"
```

## Task 4: Delete the Cognito identity with account data

**Files:**
- Create: `src/features/account/deletion-workflow.ts`
- Create: `src/features/account/deletion-workflow.test.ts`
- Modify: `src/lib/cognito.ts`
- Modify: `src/app/api/account/delete/route.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Write failing workflow tests**

Create `src/features/account/deletion-workflow.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { deleteAuthenticatedAccount } from './deletion-workflow'

describe('authenticated account deletion', () => {
  it('rejects a token belonging to another subject', async () => {
    await expect(
      deleteAuthenticatedAccount({
        sessionUserId: 'user-a',
        accessToken: 'token',
        verifyToken: async () => ({ sub: 'user-b' }),
        deleteApplicationData: vi.fn(),
        deleteIdentity: vi.fn(),
      }),
    ).rejects.toThrow('ACCOUNT_DELETE_SUBJECT_MISMATCH')
  })

  it('deletes app data before the matching Cognito identity', async () => {
    const order: string[] = []
    const result = await deleteAuthenticatedAccount({
      sessionUserId: 'user-a',
      accessToken: 'token',
      verifyToken: async () => ({ sub: 'user-a' }),
      deleteApplicationData: async () => {
        order.push('application')
        return { sourceObjects: 1, propertyStudio: 1, accountKeys: 5 }
      },
      deleteIdentity: async () => {
        order.push('cognito')
      },
    })

    expect(order).toEqual(['application', 'cognito'])
    expect(result.accountKeys).toBe(5)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npx vitest run src/features/account/deletion-workflow.test.ts
```

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Implement the workflow**

Create `src/features/account/deletion-workflow.ts`:

```ts
type DeletedCounts = {
  sourceObjects: number
  propertyStudio: number
  accountKeys: number
}

export async function deleteAuthenticatedAccount(input: {
  sessionUserId: string
  accessToken: string
  verifyToken: (token: string) => Promise<{ sub: string }>
  deleteApplicationData: () => Promise<DeletedCounts>
  deleteIdentity: (token: string) => Promise<void>
}) {
  const verified = await input.verifyToken(input.accessToken)
  if (verified.sub !== input.sessionUserId) {
    throw new Error('ACCOUNT_DELETE_SUBJECT_MISMATCH')
  }
  const deleted = await input.deleteApplicationData()
  await input.deleteIdentity(input.accessToken)
  return deleted
}
```

- [ ] **Step 4: Add Cognito DeleteUser**

In `src/lib/cognito.ts` add:

```ts
export async function deleteUser(accessToken: string) {
  return cognitoRequest('DeleteUser', { AccessToken: accessToken })
}
```

In the account route, require `Authorization: Bearer <access token>`, call
`verifyCognitoAccessToken`, execute existing `deleteAccountData`, then call
`deleteUser`. Map missing/invalid token to 401, subject mismatch to 403 and
external deletion failure to the existing safe `deletion_failed` response.

- [ ] **Step 5: Send the token from settings and clear local state**

Before the fetch in `handleDelete`, read:

```ts
const accessToken = localStorage.getItem('accessToken')
if (!accessToken) throw new Error('Sesja wygasła. Zaloguj się ponownie.')
```

Add `Authorization: Bearer ${accessToken}`. After a successful response call
`localStorage.clear()` and redirect to `/login`.

- [ ] **Step 6: Verify**

```bash
npx vitest run src/features/account/deletion-workflow.test.ts \
  src/features/properties/account-data.test.ts
npm test
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/account src/lib/cognito.ts \
  src/app/api/account/delete/route.ts \
  'src/app/(dashboard)/settings/page.tsx'
git commit -m "fix: delete cognito identity with account"
```

## Task 5: Harden administrator sessions and legal RAG

**Files:**
- Create: `src/lib/admin-auth.test.ts`
- Create: `src/lib/legal/search.test.ts`
- Modify: `src/lib/admin-auth.ts`
- Modify: `src/app/api/admin/auth/route.ts`
- Modify: `src/app/api/admin/agents/route.ts`
- Modify: `src/lib/rate-limit.ts`
- Modify: `src/lib/legal/search.ts`

- [ ] **Step 1: Write failing administrator tests**

Test exported pure helpers:

```ts
it('signs an opaque HMAC token and rejects modification', () => {
  const token = createAdminSessionToken('admin-secret')
  expect(token).not.toContain(
    Buffer.from('admin:admin-secret').toString('base64'),
  )
  expect(verifyAdminSessionToken(token, 'admin-secret')).toBe(true)
  expect(verifyAdminSessionToken(`${token}x`, 'admin-secret')).toBe(false)
})
```

Add a route test asserting the sixth failed login in the same 15-minute window
returns 429, and an agent route test asserting an unknown ID returns 404
without writing KV.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/lib/admin-auth.test.ts src/app/api/admin
```

Expected: FAIL because the current token is reversible and login has no limit.

- [ ] **Step 3: Implement HMAC and timing-safe verification**

Use:

```ts
export function createAdminSessionToken(secret: string): string {
  return createHmac('sha256', secret)
    .update('admin-session-v1')
    .digest('base64url')
}

export function verifyAdminSessionToken(
  token: string,
  secret: string,
): boolean {
  const expected = createAdminSessionToken(secret)
  const actualBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}
```

Use the same timing-safe helper for password comparison. Keep the cookie
`httpOnly`, `secure`, `sameSite: 'strict'` and seven-day expiry.

- [ ] **Step 4: Add the login limit and agent-ID guard**

Add:

```ts
ADMIN_AUTH: { limit: 5, windowMinutes: 15 },
```

Resolve the identifier from the first `x-forwarded-for` value, falling back to
`unknown`, and call `rateLimit` before password verification. Return 429 with
`Retry-After`.

Before `setAgentOverride`, require:

```ts
if (!findAgent(id)) {
  return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
}
```

- [ ] **Step 5: Write the failing RAG relevance test**

Mock `getLegalIndex().searchRecords()` with scores `0.91` and `0.41`. Assert
only the first chunk is returned with the default threshold and no chunks are
returned when all scores are below it.

- [ ] **Step 6: Filter weak legal matches**

In `src/lib/legal/search.ts` add:

```ts
export const DEFAULT_LEGAL_MIN_SCORE = 0.7

export function legalMinScore(): number {
  const configured = Number(process.env.LEGAL_RAG_MIN_SCORE)
  return Number.isFinite(configured) &&
    configured >= 0 &&
    configured <= 1
    ? configured
    : DEFAULT_LEGAL_MIN_SCORE
}
```

Filter hits with `h._score >= legalMinScore()` before mapping them. The
existing prompt receives `(brak relewantnych fragmentów ustawowych)` when the
filtered list is empty.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run src/lib/admin-auth.test.ts src/lib/legal/search.test.ts \
  src/app/api/admin
npm test
npm run typecheck
npm run lint
git add src/lib/admin-auth.ts src/lib/admin-auth.test.ts \
  src/lib/legal src/lib/rate-limit.ts src/app/api/admin
git commit -m "fix: harden admin and legal retrieval boundaries"
```

Expected: all commands exit 0 and the commit succeeds.

## Task 6: Define the full-release acceptance contract

**Files:**
- Create: `src/features/current-release-acceptance/domain.ts`
- Create: `src/features/current-release-acceptance/domain.test.ts`
- Create: `src/features/current-release-acceptance/report.ts`
- Create: `src/features/current-release-acceptance/report.test.ts`
- Modify: `src/features/synthetic-acceptance/cleanup-registry.ts`
- Modify: `src/features/synthetic-acceptance/cleanup-registry.test.ts`

- [ ] **Step 1: Write failing domain and report tests**

Define the exact required scenario set in the test:

```ts
const requiredScenarios = [
  'auth.registration',
  'auth.session',
  'onboarding.express',
  'onboarding.path-a',
  'onboarding.path-b',
  'onboarding.deep',
  'agents.six',
  'agents.legal-positive',
  'agents.legal-negative',
  'studio.property',
  'studio.fact',
  'studio.source',
  'studio.proposals',
  'studio.history',
  'isolation.cross-user',
  'admin.agent-toggle',
  'account.export',
  'account.delete',
  'ui.mobile',
  'cleanup.complete',
] as const
```

Assert the report rejects extra fields named `password`, `token`, `cookie`,
`prompt`, `response`, `fileName` and `signedUrl`.

Add a cost-guard test:

```ts
const cost = createAcceptanceCostGuard({
  stopBeforeUsd: 1.5,
  maxUsd: 2,
})
cost.reserve('onboarding', 0.4)
cost.reserve('agents', 0.6)
expect(cost.totalEstimatedUsd()).toBe(1)
expect(() => cost.reserve('next-call', 0.6)).toThrow(
  'CURRENT_RELEASE_COST_STOP',
)
```

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/features/current-release-acceptance \
  src/features/synthetic-acceptance/cleanup-registry.test.ts
```

Expected: FAIL because the current-release contract does not exist.

- [ ] **Step 3: Implement the domain**

Create Zod schemas for:

```ts
export const CURRENT_RELEASE_MAX_COST_USD = 2
export const CURRENT_RELEASE_COST_STOP_USD = 1.5

export type ScenarioResult = {
  name: CurrentReleaseScenario
  status: 'passed' | 'failed'
  durationMs: number
  errorCode?: string
}
```

Reuse `runIdSchema` and `assertSyntheticDataPolicy`. The scenario list must be
exact, unique and complete; cost must be non-negative and no greater than 2.
Implement `createAcceptanceCostGuard` with private accumulated state.
`reserve(label, estimatedUsd)` rejects a non-positive estimate and rejects a
new call when the accumulated estimate would exceed 1.5 USD. A separate
`recordObservedPipelineCost(usd)` replaces the reserved pipeline estimate with
the observed source-job cost and rejects a total above 2 USD.

- [ ] **Step 4: Implement the safe report**

The strict report contains only:

```ts
{
  contractVersion: 'current-release-acceptance-v1',
  runId,
  baseUrl,
  commitSha,
  deploymentId,
  startedAt,
  completedAt,
  scenarios,
  modelIds,
  estimatedAnthropicCostUsd,
  observedPipelineCostUsd,
  providerCostUsd,
  cleanup: {
    databaseEmpty,
    cognitoUsersAbsent,
    kvKeysAbsent,
    s3VersionsRemaining,
    adminStateRestored,
    dlqMessagesVisible,
    alarmsNotOk,
  },
  accepted,
}
```

Serialize JSON and Markdown only after strict schema validation.

- [ ] **Step 5: Extend the existing cleanup registry**

Add secret-free fields with empty defaults:

```ts
releaseUsers: z.array(z.object({
  role: z.enum(['a', 'b']),
  username: z.string().max(180),
  cognitoSub: cognitoSubjectSchema.nullable(),
})).max(2),
kvKeys: z.array(z.string().max(512)).max(20),
adminAgentState: z.object({
  agentId: z.string().max(80),
  enabled: z.boolean(),
}).nullable(),
```

Validate usernames against
`synthetic-release-${runId}-a@example.invalid` and the equivalent `-b`. Validate
each KV key against one of the registered Cognito subjects. Keep the existing
single-user fields unchanged so the accepted foundation benchmark remains
backward compatible.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run src/features/current-release-acceptance \
  src/features/synthetic-acceptance/cleanup-registry.test.ts
npm test
git add src/features/current-release-acceptance \
  src/features/synthetic-acceptance/cleanup-registry.ts \
  src/features/synthetic-acceptance/cleanup-registry.test.ts
git commit -m "feat: define full release acceptance contract"
```

Expected: all tests pass and the legacy registry tests remain green.

## Task 7: Add the guarded Playwright runner

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/current-release/fixtures.ts`
- Create: `e2e/current-release/operator.ts`
- Create: `src/features/current-release-acceptance/runner.ts`
- Create: `src/features/current-release-acceptance/runner.test.ts`
- Create: `scripts/current-release-acceptance.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright Test**

Run:

```bash
npm install --save-dev @playwright/test@latest
npx playwright install chromium
```

Expected: package files change, Chromium installs outside the repository, and
`npm audit --omit=dev` still reports 0 vulnerabilities.

- [ ] **Step 2: Write failing runner preflight tests**

Test a fake executor and assert rejection of:

- missing `--allow-production`;
- a URL other than `https://akademia-ai-platform.vercel.app`;
- AWS account other than `261965598943`;
- region other than `eu-central-1`;
- caller other than `akademia-wojtka-admin-darek`;
- cost limit above 2;
- missing `ADMIN_PASSWORD`.

Also assert the cleanup dependency runs when the browser executor throws.

- [ ] **Step 3: Implement Playwright configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/current-release',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10 * 60_000,
  globalTimeout: 45 * 60_000,
  reporter: 'line',
  outputDir: 'Temp/current-release-playwright',
  use: {
    baseURL:
      process.env.CURRENT_RELEASE_BASE_URL ??
      'http://127.0.0.1:3000',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```

- [ ] **Step 4: Implement strict fixtures**

`fixtures.ts` parses these process variables with Zod:

```ts
CURRENT_RELEASE_RUN_ID
CURRENT_RELEASE_BASE_URL
CURRENT_RELEASE_USER_A
CURRENT_RELEASE_USER_A_PASSWORD
CURRENT_RELEASE_USER_B
CURRENT_RELEASE_USER_B_PASSWORD
ADMIN_PASSWORD
AWS_PROFILE
AWS_REGION
```

Export parsed values but never log or attach them. Reject a base URL or
username not matching the current run.

- [ ] **Step 5: Implement bounded operator actions**

`operator.ts` uses `execFileSync('aws', args)` with array arguments and
captured stderr. Export:

```ts
confirmUser(username)
createUser(username, password)
deleteUser(username)
getUserSubject(username)
assertCallerIdentity()
checkDlq()
checkAlarms()
verifyRunS3Empty(prefix)
```

Every mutation validates the exact account, region and current-run username
before invoking AWS. Error messages contain only stable error codes and the
run ID.

All `execFileSync` reads have a 30-second timeout and at most two attempts.
Mutations have a 30-second timeout and exactly one attempt unless the operation
is explicitly idempotent (`deleteUser` and `verifyRunS3Empty`). HTTP reads use
`AbortSignal.timeout(30_000)` and at most two attempts. Upload, signup, agent
calls, proposal decisions and admin toggles are never blindly repeated.

- [ ] **Step 6: Implement the runner**

The runner:

1. checks the explicit flag, URL, account, region, caller, empty DLQ and alarms;
2. generates two passwords with `randomBytes`;
3. creates the secret-free registry;
4. launches `npx playwright test --config playwright.config.ts --workers=1`
   with secrets only in the child process environment;
5. passes a fixed cost reservation table to the child:
   `0.06 USD` per onboarding generation, `0.08 USD` per agent call and
   `0.25 USD` for the source pipeline;
6. stops before a new model call when reserved cost would exceed 1.5 USD;
7. replaces the pipeline reservation with the observed job cost;
8. always invokes cleanup in `finally`;
9. writes the strict safe report with model IDs and separated cost fields;
10. removes the run registry only after all cleanup checks pass.

The CLI accepts:

```text
--allow-production
--base-url https://akademia-ai-platform.vercel.app
--max-cost-usd 2
```

Add package commands:

```json
"current-release:e2e": "playwright test --config playwright.config.ts",
"current-release:acceptance": "tsx scripts/current-release-acceptance.ts"
```

- [ ] **Step 7: Ignore only generated artifacts**

Add:

```gitignore
/Temp/current-release-playwright/
/reports/current-release-acceptance/*.json
/reports/current-release-acceptance/*.md
/reports/current-release-acceptance/*.run.json
```

- [ ] **Step 8: Verify and commit**

```bash
npx vitest run src/features/current-release-acceptance/runner.test.ts
npx playwright test --config playwright.config.ts --list
npm run typecheck
npm audit --omit=dev
git add package.json package-lock.json .gitignore playwright.config.ts \
  e2e/current-release src/features/current-release-acceptance/runner.ts \
  src/features/current-release-acceptance/runner.test.ts \
  scripts/current-release-acceptance.ts
git commit -m "feat: add guarded full release runner"
```

Expected: Playwright lists the suite without running production and all other
commands exit 0.

## Task 8: Cover registration, onboarding and all six agents

**Files:**
- Create: `e2e/current-release/current-release.spec.ts`
- Create: `e2e/current-release/ui-helpers.ts`
- Modify: `src/features/current-release-acceptance/runner.ts`
- Test: `src/features/current-release-acceptance/runner.test.ts`

- [ ] **Step 1: Add a failing dry-run contract test**

Add a runner test expecting the browser executor to report these completed
scenario names:

```ts
[
  'auth.registration',
  'auth.session',
  'onboarding.express',
  'onboarding.path-a',
  'onboarding.path-b',
  'onboarding.deep',
  'agents.six',
  'agents.legal-positive',
  'agents.legal-negative',
]
```

Expected: FAIL because no Playwright scenario writes results.

- [ ] **Step 2: Implement registration and session steps**

Use `test.describe.serial`. For user A:

```ts
await page.goto('/register/invalid-synthetic')
await expect(page.getByText('Link nieprawidłowy')).toBeVisible()
await expect(
  page.getByRole('button', { name: 'Zarejestruj się' }),
).toHaveCount(0)

await page.goto('/register/akademia-ai-2026-edycja1')
await page.getByLabel('Imię i nazwisko').fill(
  `Agent syntetyczny ${fixtures.runId}`,
)
await page.getByLabel('Email').fill(fixtures.userA)
await page.getByLabel('Hasło').fill(fixtures.passwordA)
await page.getByRole('button', { name: 'Zarejestruj się' }).click()
await expect(page.getByText('Sprawdź email')).toBeVisible()
await operator.confirmUser(fixtures.userA)
```

Return to `/login`, log in through the UI, assert `/start`, refresh and assert
the session remains. Open the account menu, click `Wyloguj`, assert `/login`
and a 401 from a protected API, then log in again before onboarding. Test a
wrong password in a separate browser context and assert the generic Polish
error.

- [ ] **Step 3: Complete Express and Deep through the UI**

Create a deterministic answer function:

```ts
export function syntheticAnswer(runId: string, index: number) {
  return `Syntetyczna odpowiedź ${index + 1}; znacznik ${runId}; rynek Testowo.`
}
```

Iterate through all imported `expressQuestions`, fill the visible input or
textarea, click the visible next action and wait for the save response. Start
generation, wait for the result page and assert `profil.md` is visible in
`/profil`.

Repeat for all `deepQuestions` after both personas exist. Do not store generated
markdown in the Playwright report.

- [ ] **Step 4: Cover Persona Path A and Path B**

User A selects `Dopiero zaczynam, AI niech zaproponuje`, waits for three
choices, selects the first and waits for the generated buyer and seller files.

Create user B through `operator.createUser`, log in with a second browser
context, complete Express, select `Znam swoich klientów`, answer all six buyer
and six seller questions and generate both files.

- [ ] **Step 5: Call all six agents**

For the authenticated A request context call `/api/agents/run` with:

```ts
[
  ['ceo', 'plan-tygodnia'],
  ['marketing', 'karuzela-ig'],
  ['nieruchomosci', 'opis-oferty'],
  ['wycena', 'wycena-porownawcza'],
  ['publikacja', 'plan-publikacji'],
  ['prawny', 'pytanie-prawne'],
]
```

Use a short context and goal containing the run ID. Assert status 200, nonempty
stream, no `[Błąd generowania` marker and no user-B marker.
Reserve `0.08 USD` immediately before each call. The reservation happens once
and is not repeated after a timeout.

- [ ] **Step 6: Cover positive and negative legal retrieval**

Positive prompt: ask for the form of a contract transferring ownership of a
property and require a cited article. Assert legal metadata and an article
number are present.

Negative prompt: ask for a fictional Polish statute governing transfer of
property on Mars in 2040. Assert there is no legal metadata and the answer
contains the existing no-basis wording from the legal system prompt.
Both calls use the same cost guard and record the configured model ID without
recording prompt or response content.

- [ ] **Step 7: Verify locally without production calls**

```bash
npx playwright test --config playwright.config.ts --list
npx vitest run src/features/current-release-acceptance
npm run typecheck
git add e2e/current-release src/features/current-release-acceptance
git commit -m "test: cover auth onboarding and six agents"
```

Expected: tests are discoverable, unit tests pass and no browser flow runs
without the guarded runner.

## Task 9: Cover Studio, isolation, admin, export, deletion and mobile

**Files:**
- Modify: `e2e/current-release/current-release.spec.ts`
- Modify: `e2e/current-release/ui-helpers.ts`
- Modify: `e2e/current-release/operator.ts`
- Modify: `src/features/current-release-acceptance/runner.ts`
- Test: `src/features/current-release-acceptance/runner.test.ts`

- [ ] **Step 1: Add failing expected-scenario assertions**

Extend the runner test with:

```ts
[
  'studio.property',
  'studio.fact',
  'studio.source',
  'studio.proposals',
  'studio.history',
  'isolation.cross-user',
  'admin.agent-toggle',
  'account.export',
  'account.delete',
  'ui.mobile',
  'cleanup.complete',
]
```

Expected: FAIL until the browser suite records them.

- [ ] **Step 2: Create a property and fact through UI**

For user A:

```ts
await page.goto('/nieruchomosci')
await page.getByRole('button', { name: 'Nowa teczka' }).click()
await page.getByLabel('Nazwa robocza').fill(`SYN ${fixtures.runId}`)
await page.getByLabel('Miasto').fill('Testowo')
await page.getByLabel('Dzielnica lub obszar').fill('Dzielnica Zero')
await page.getByRole('button', { name: 'Załóż teczkę' }).click()
```

Open the created teczka, click `Dodaj fakt`, add `Powierzchnia użytkowa`,
numeric value `83.4`, unit `m²`, status `Potwierdzone przeze mnie` and
visibility `Wewnętrzne`. Save the project ID and fact ID in the secret-free
registry.

- [ ] **Step 3: Upload one minimal synthetic PDF**

Generate a one-page PDF under `Temp/current-release-playwright/<run-id>/` with
the text:

```text
Syntetyczny dokument. Powierzchnia użytkowa: 83,40 m².
Cena ofertowa: 750 000 PLN. Materiał bez danych prawdziwych.
```

Open the `Źródła` tab, set the hidden file input, wait for `review_ready`, open
the proposal desk, accept one proposal and reject another. Assert the original
download returns 200, its returned `expiresAt` is no more than 65 seconds in
the future, and the signed URL is never written to the report.
Read the observed source-job provider cost from the account export and record
it as `observedPipelineCostUsd`.

- [ ] **Step 4: Verify history and cross-user isolation**

Assert `Braki i konflikty` contains the expected synthetic conflict or open
issue and `Historia zmian` contains project, fact, source and proposal events.

Using user B's request context, call:

```text
GET /api/properties/<A-project-id>
GET /api/properties/<A-project-id>/facts
GET /api/properties/<A-project-id>/sources
```

Require 404 for every call and assert response bodies do not contain A's title,
IDs or run marker.

- [ ] **Step 5: Toggle and restore one agent as administrator**

Log in at `/admin/login` with the process-only password. Read and save the
current state of agent `publikacja`, toggle it, confirm the user view changes,
then restore the original state inside `try/finally`. Save only
`{ agentId, enabled }` in the registry. Assert `/api/admin/status` is false
after admin logout.

- [ ] **Step 6: Export and delete both synthetic accounts**

Download A's export and parse it in memory. Assert it contains A's profile,
personas, project, fact, source, proposals and events, and contains none of B's
marker or identifiers.

Click the two-step account deletion confirmation for A. Assert redirect to
login, blocked reuse of the old session and Cognito user absence. Delete B
through the same authenticated API contract. The operator cleanup remains an
idempotent fallback.

- [ ] **Step 7: Verify critical mobile routes**

Before deleting A, set:

```ts
await page.setViewportSize({ width: 390, height: 844 })
```

Visit `/start`, `/profil`, `/agent`, `/nieruchomosci`, the project tabs and
`/settings`. For each route assert:

```ts
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
)
expect(overflow).toBe(false)
```

Also wait until the route no longer displays `Ładowanie Studio...`, require no
visible `[Błąd` marker or unhandled `role="alert"`, then tab to the first
interactive action and assert a visible focus indicator.

- [ ] **Step 8: Verify and commit**

```bash
npx playwright test --config playwright.config.ts --list
npx vitest run src/features/current-release-acceptance \
  src/features/synthetic-acceptance/cleanup-registry.test.ts
npm test
npm run typecheck
git add e2e/current-release src/features/current-release-acceptance \
  src/features/synthetic-acceptance
git commit -m "test: cover complete current release flow"
```

Expected: all non-production commands exit 0.

## Task 10: Run complete local release gates

**Files:**
- No source changes unless a gate exposes a reproducible defect.

- [ ] **Step 1: Run the complete suite**

```bash
npm test
npm run infra:test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npx playwright test --config playwright.config.ts --list
git diff --check
git status --short
```

Expected: all commands exit 0 and the worktree is clean.

- [ ] **Step 2: Review the change set**

Run:

```bash
git diff main...HEAD --stat
git diff main...HEAD --check
git log --oneline main..HEAD
```

Confirm no secret values, production data, generated browser artifacts or
temporary env files are tracked.

- [ ] **Step 3: Use the verification and review procedures**

Read and apply:

```text
superpowers-verification-before-completion
superpowers-requesting-code-review
```

Address only evidence-backed findings. Every correction starts with a failing
test and repeats the complete relevant gate.

## Task 11: Deploy and run the production acceptance

**Files:**
- Modify after verification: `docs/operations/synthetic-foundation-acceptance.md`
- Modify after verification: workspace COSTSEC records named in Task 12.

- [ ] **Step 1: Re-read cloud and credential rules**

Read completely:

```text
.claude/rules/cloud_safety.md
.claude/rules/credential-protection.md
PROJEKTY/AUTOFIRMA/COSTSEC/docs/CLOUD_SAFETY.md
PROJEKTY/AUTOFIRMA/COSTSEC/docs/ZASADY.md
DATA/api-inventory.md
```

Stop before any cloud write if the active instructions conflict with this
plan.

- [ ] **Step 2: Run production preflight**

```bash
git status --short --branch
git rev-parse HEAD
aws sts get-caller-identity --profile akademia-ai --region eu-central-1 \
  --query '{Account:Account,Arn:Arn}' --output json
aws iam get-account-summary --profile akademia-ai --region eu-central-1 \
  --query 'SummaryMap.{RootMFA:AccountMFAEnabled,RootKeys:AccountAccessKeysPresent}' \
  --output json
```

Expected: account `261965598943`, caller
`akademia-wojtka-admin-darek`, root MFA `1`, root keys `0`.

- [ ] **Step 3: Integrate the verified branch**

Use `superpowers-finishing-a-development-branch`. Integrate into local `main`
without rewriting history, rerun the complete release gates on `main`, then
push `main` to `origin`.

Expected: Vercel creates a deployment from the reviewed commit.

- [ ] **Step 4: Wait for Vercel READY and inspect logs**

Resolve the deployment attached to the pushed commit. Require `READY`, the
production alias `https://akademia-ai-platform.vercel.app`, zero build errors
and no new 5xx runtime errors before starting costly tests.

- [ ] **Step 5: Load production env without printing values**

Create a `mktemp -d` directory with mode 0700. Pull the Vercel production env
to a file with mode 0600, load it into the current process without printing,
run the acceptance command, then delete the temporary directory in a shell
trap. Never place the env file in the repository.

- [ ] **Step 6: Run the guarded acceptance**

```bash
AWS_PROFILE=akademia-ai \
AWS_REGION=eu-central-1 \
npm run current-release:acceptance -- \
  --allow-production \
  --base-url https://akademia-ai-platform.vercel.app \
  --max-cost-usd 2
```

Expected: every required scenario is `passed`, `accepted=true`, cost is at
most 2 USD, both Cognito users are absent, PostgreSQL/KV/S3 contain no run
residue, admin state is restored, DLQ is empty and alarms are OK.

- [ ] **Step 7: Diagnose any production failure before changing code**

If a scenario fails:

1. stop new model calls;
2. complete cleanup;
3. apply `superpowers-systematic-debugging`;
4. reproduce with the smallest non-production test;
5. add a failing regression test;
6. implement one root-cause fix;
7. repeat local gates, deploy and only the failed bounded scenario;
8. rerun the full acceptance once all bounded scenarios pass.

Do not raise the 2 USD limit without a new explicit decision from Darek.

## Task 12: Record the result and hand off phase 2

**Files:**
- Modify: `docs/operations/synthetic-foundation-acceptance.md`
- Modify: `/Users/dariu/Library/Mobile Documents/com~apple~CloudDocs/AITeam/PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md`
- Modify: `/Users/dariu/Library/Mobile Documents/com~apple~CloudDocs/AITeam/PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md`
- Modify if required by project profile: project memory/state files selected by `p-akademia`.

- [ ] **Step 1: Update the runbook**

Document:

- the exact guarded command;
- all required preflight checks;
- secret-safe env loading;
- two-user and admin cleanup behavior;
- the 2 USD limit;
- emergency cleanup using the run registry;
- Stripe remaining intentionally disabled.

- [ ] **Step 2: Record the verified deployment**

Record only:

- commit SHA;
- Vercel deployment ID and production alias;
- acceptance run ID;
- pass/fail for each scenario;
- model identifiers without prompts or responses;
- total provider cost;
- cleanup counts;
- alarm and DLQ state;
- rollback commit.

Do not record credentials, cookies, tokens, user emails, generated profile
content, prompts, answers or signed URLs.

- [ ] **Step 3: Commit and push documentation**

```bash
git add docs/operations/synthetic-foundation-acceptance.md
git commit -m "docs: record full current release acceptance"
git push origin main
```

Commit workspace COSTSEC documentation separately in its owning repository or
record the local update if that workspace is not a Git repository.

- [ ] **Step 4: Final production smoke**

Verify:

```text
/ -> redirect to /start
/login -> 200
/register -> 200 with closed-registration message
/pricing -> authenticated pilot mode, no Stripe request
/api/onboarding/state -> 401 without session
/api/agents/run -> 401 without session
/api/properties -> 401 without session
/api/account/export -> 401 without session
/api/account/delete -> 401 without session
/api/admin/status -> 200 with admin=false
```

Inspect the final Vercel deployment logs, AWS alarms, DLQ and Step Functions.
The final report must distinguish:

- current release: accepted or rejected with evidence;
- Stripe: intentionally deferred;
- phase 2 roadmap: not started;
- next action: separate design for Plot Future Lab.
