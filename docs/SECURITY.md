# Bezpieczeństwo Akademia AI

Dokument opisuje warstwy zabezpieczeń platformy Akademia AI dla agentów nieruchomości.

Stan: **2026-04-26** (wersja MVP po Fazie 2)

## Spis warstw

1. [Autentykacja i sesja](#autentykacja)
2. [Izolacja użytkowników (multi-tenancy)](#izolacja)
3. [Przechowywanie danych](#dane)
4. [API security](#api)
5. [Headery HTTP](#headery)
6. [Rate limiting](#rate-limit)
7. [Płatności (Stripe)](#stripe)
8. [Klucze API i secrets](#secrets)
9. [Logging i obserwowalność](#logi)
10. [GDPR / RODO](#rodo)
11. [Co NIE jest jeszcze zrobione](#todo)

## Autentykacja {#autentykacja}

- **AWS Cognito** zarządza userami (rejestracja, login, hasła, weryfikacja email)
- **Hasła** trzymane przez Cognito (PBKDF2, salt) — my nie mamy do nich dostępu
- **Wymóg hasła**: 8+ znaków, wielka litera, cyfra, znak specjalny
- **Rejestracja**: tylko z linkiem zaproszeniowym (`/register/<token>`) — nie publiczna
- **Sesja serwerowa**: httpOnly cookie `px-session` z user.sub (Cognito UUID) podpisanym HMAC-SHA256
  - `httpOnly` — JavaScript nie ma dostępu (chroni przed XSS-stealem)
  - `secure` w produkcji — tylko HTTPS
  - `sameSite=lax` — chroni przed większością ataków CSRF
  - 30 dni ważności
- **Logout**: czyści cookie + Cognito signOut

## Izolacja użytkowników (multi-tenancy) {#izolacja}

- Każdy user ma własny **Cognito sub** (UUID v4)
- Wszystkie dane w KV są pod kluczem `user:<sub>:*`:
  - `user:<sub>:profil` — markdown profilu agenta
  - `user:<sub>:persona-buyer` — markdown persony kupującego
  - `user:<sub>:persona-seller` — markdown persony sprzedającego
  - `user:<sub>:onboarding` — stan wizardów i odpowiedzi
  - `user:<sub>:subscription` — plan + Stripe customer/subscription IDs
- **Server-side enforcement**: każde API i każdy server component pobiera userId WYŁĄCZNIE z cookie (`getServerUserId()`), nigdy z body requestu
- **Brak IDOR**: nie ma endpointu który przyjmuje `userId` z body. User może czytać/pisać tylko swoje dane.

## Przechowywanie danych {#dane}

- **Vercel KV** (Upstash Redis) — szyfrowanie at-rest po stronie infra Vercel/Upstash
- Brak SQL — niemożliwy SQL injection
- **Profile / persony**: zwykły markdown (treść biznesowa, nie szczególnie wrażliwa, ale prywatna per user)
- **Pinecone** (vector DB dla RAG prawnego): zawiera publiczny tekst Kodeksu cywilnego — brak danych userów
- **Anthropic API logs**: Anthropic loguje promptу do 30 dni dla bezpieczeństwa (zgodnie z ich SOC 2). Promptу zawierają profil + persony usera. Można poprosić o opt-out dla wrażliwych branż, ale dla MVP akceptujemy.

### Co JEST w prompt do Anthropic
Przy każdym wywołaniu agenta:
- profil.md (kim jesteś)
- persona-kupujacy.md i persona-sprzedajacy.md
- Treść narzędzia
- Kontekst i cel od usera

### Co NIE jest w prompt
- Email, hasło, telefon, dane Cognito
- Klucze API
- Dane innych userów

## API security {#api}

- **Wszystkie state-changing endpoints**: cookie session check
- **Admin endpoints** (`/api/admin/*`, `/api/onboarding/reset`): osobny Bearer `ADMIN_PASSWORD`
- **Stripe webhook**: signature verification (`stripe-signature` header)
- **Walidacja**: zod-style typeof checks na input. Nie używamy `eval`, `Function()`, `dangerouslySetInnerHTML`.
- **CORS**: domyślne Vercel (same-origin only) — żadne zewnętrzne strony nie mogą wywoływać API

## Headery HTTP {#headery}

W `next.config.mjs` na każdym responsie:

| Header | Wartość | Po co |
|--------|---------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Wymusza HTTPS (2 lata) |
| `X-Frame-Options` | `DENY` | Anty-clickjacking (nikt nie może embedować strony w iframe) |
| `X-Content-Type-Options` | `nosniff` | Anty MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Nie wysyła pełnego URL na zewnętrzne strony |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Zablokowane sensory |
| `X-DNS-Prefetch-Control` | `on` | Performance (DNS prefetch) |

Plus `poweredByHeader: false` — nie ujawniamy że to Next.js.

## Rate limiting {#rate-limit}

W `lib/rate-limit.ts`. Limit per user (po userId z cookie) lub IP jeśli niezalogowany.

| Endpoint | Limit |
|----------|-------|
| `/api/agents/run` | 30 / minutę |
| `/api/onboarding/generate-profil` | 5 / minutę |
| `/api/onboarding/persona/generate` | 5 / minutę |
| `/api/onboarding/persona/types` | 10 / minutę |
| `/api/auth/session` | 20 / minutę |
| `/api/stripe/checkout` | 5 / minutę |

Po przekroczeniu: 429 Too Many Requests + `Retry-After`.

## Płatności (Stripe) {#stripe}

- Stripe **PCI DSS compliant** — my nie mamy dostępu do numerów kart, CVV
- Płatność dzieje się NA STRONIE Stripe (`checkout.stripe.com`), klient wraca po sukcesie
- Webhook: signature verification z `STRIPE_WEBHOOK_SECRET`
- Customer ID i Subscription ID przechowywane w naszym KV
- Anulowanie / zmiana karty / faktury: Stripe Customer Portal (zarządzane przez Stripe)
- **Stan obecny**: gates są **bypassed** dopóki `STRIPE_SECRET_KEY` nie jest ustawione (faza testowa)

## Klucze API i secrets {#secrets}

- Wszystkie w **Vercel Environment Variables** (encrypted at rest)
- **Marked as Sensitive** w Vercel UI = nie pokazują się w logach ani CLI pull
- Klucze: `ANTHROPIC_API_KEY`, `PINECONE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_PASSWORD`, `SESSION_SECRET`
- **Brak hardcoded** kluczy w repo (sprawdzone `git history`)
- **Pre-commit hook** w 29 repo blokuje accidentalne commit kluczy (sk_live_, sk-ant-, AKIA, ghp_, AIzaSy, whsec_)

## Logging {#logi}

- `console.error` używamy do błędów infrastrukturalnych (KV failure, Stripe webhook fail)
- **Nie logujemy** treści profilu, person, odpowiedzi agenta
- **Auth-context** loguje tylko `error.message` od Cognito (np. "User does not exist") — nie hasło, nie email w plain text
- Vercel logs retain 7 dni dla Pro plan, 30 dni dla Enterprise

## GDPR / RODO {#rodo}

- **Right of access** (Art. 15 RODO): `GET /api/account/export` zwraca pełny JSON wszystkich danych usera
- **Right to erasure** (Art. 17 RODO): `POST /api/account/delete` z `{ confirm: "DELETE" }` usuwa wszystkie klucze `user:<sub>:*` z KV i czyści cookie
- **Right to rectification** (Art. 16): user edytuje profil/persony przez UI, regeneruje przez button
- **Data minimization**: zbieramy tylko to co potrzebne (email, imię, profil agenta — bez PESEL, adresu, telefonu)
- **Polityka prywatności / regulamin**: TODO — Wojtek powinien sporządzić z prawnikiem przed publicznym uruchomieniem
- **Retencja**: dane usera trzymamy dopóki konto istnieje. Po usunięciu konta — natychmiast wyczyszczone z KV. Stripe trzyma faktury 7 lat (wymóg podatkowy).

## Co NIE jest jeszcze zrobione {#todo}

| Item | Priorytet | Notatka |
|------|-----------|---------|
| Content Security Policy (CSP) | Średni | Wymaga rozważenia (Next.js inline scripts, Stripe checkout iframe) |
| WAF / DDoS protection | Niski | Vercel ma podstawowy DDoS, ale dla większego ruchu warto Cloudflare przed |
| Audit logs (kto co kiedy zmienił) | Średni | Przy multi-user (Agency tier) konieczne |
| 2FA / MFA | Średni | Cognito to wspiera, trzeba włączyć w pool |
| Backup KV | Niski | Vercel KV ma snapshoty (Upstash) |
| Penetration test | Niski | Przed publicznym uruchomieniem warto |
| Polityka prywatności + regulamin | **WYSOKI** | Prawne — przed pierwszym płacącym klientem |
| Bug bounty / responsible disclosure | Niski | Po skali |

## Kontakt w sprawach bezpieczeństwa

Każde podejrzenie naruszenia: hello@akademia-ai.pl (TODO — ustawić mailbox)
