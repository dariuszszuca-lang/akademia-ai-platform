# Bezpieczeństwo Akademia AI

Dokument opisuje warstwy zabezpieczeń platformy Akademia AI dla agentów nieruchomości.

Stan: **2026-07-27** (fundament Property Intelligence Studio)

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
  - cookie powstaje dopiero po kryptograficznej weryfikacji tokenu dostępowego
    Cognito,
  - weryfikowane są podpis, pula użytkowników, `token_use=access`,
    `client_id` i czas ważności,
  - endpoint nie przyjmuje już `sub` z body jako źródła tożsamości,
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
- Dane Property Intelligence Studio są przypisane do organizacji. Dostęp do
  projektu wymaga rekordu w `organization_memberships` dla `userId` pobranego
  z sesji.
- Repozytorium PostgreSQL filtruje projekty przez członkostwo organizacji przy
  każdym odczycie i zapisie. Brak projektu oraz brak członkostwa dają ten sam
  wynik `404`, aby nie ujawniać istnienia cudzej nieruchomości.
- Identyfikatory użytkownika przesłane w body faktu są ignorowane. Serwer
  podstawia użytkownika z podpisanej sesji.

## Przechowywanie danych {#dane}

- **Vercel KV** (Upstash Redis) przechowuje profil, persony, onboarding i stan
  subskrypcji.
- **PostgreSQL** jest źródłem prawdy dla Property Intelligence Studio.
  Przechowuje organizacje, członkostwa, teczki nieruchomości, fakty i historię
  zmian.
- Dostęp do PostgreSQL odbywa się przez Drizzle ORM i zapytania
  parametryzowane. Adres bazy jest przekazywany wyłącznie przez
  `DATABASE_URL`; dokumentacja i logi nie zawierają jego wartości.
- Teczka może zawierać miasto, dzielnicę, dokładny albo przybliżony adres,
  identyfikator działki oraz metadane procesu.
- Fakt może zawierać wartość, jednostkę, status wiarygodności, widoczność,
  identyfikatory źródeł, autora potwierdzenia i numer wersji.
- `property_audit_events` zapisuje rodzaj operacji, aktora, stan przed zmianą i
  stan po zmianie. Historia jest usuwana kaskadowo razem z organizacją
  użytkownika.
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
- Fakty, adresy i dokumenty Property Intelligence Studio. Fundament M1 nie
  wysyła tych danych do modelu językowego.

## API security {#api}

- **Wszystkie state-changing endpoints**: cookie session check
- **Admin endpoints** (`/api/admin/*`, `/api/onboarding/reset`): osobny Bearer `ADMIN_PASSWORD`
- **Stripe webhook**: signature verification (`stripe-signature` header)
- **Walidacja**: endpointy Property Intelligence Studio walidują body przez
  Zod. Błędny JSON i błędne dane zwracają `400`.
- **Granica potwierdzenia**: AI nie może samodzielnie nadać faktowi statusu
  `confirmed`. Potwierdzenie wymaga źródła albo użytkownika z aktywnej sesji.
- Nie używamy `eval`, `Function()` ani `dangerouslySetInnerHTML`. Dane JSON
  faktu są renderowane jako tekst w elemencie `<pre>`.
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
- `.gitignore` obejmuje `.env`, `.env.*`, `*.pem`, `*.key`, `credentials` i
  pliki kont serwisowych; śledzony może być tylko `.env.example`.
- **Pre-commit hook** w 29 repo blokuje accidentalne commit kluczy (sk_live_, sk-ant-, AKIA, ghp_, AIzaSy, whsec_)

## Logging {#logi}

- `console.error` używamy do błędów infrastrukturalnych (KV failure, Stripe webhook fail)
- **Nie logujemy** treści profilu, person, odpowiedzi agenta
- Endpointy nieruchomości nie logują body requestu, tytułu nieruchomości,
  adresu, wartości faktu ani identyfikatorów źródeł. Przy błędzie wewnętrznym
  zapisują tylko stałą nazwę zdarzenia i typ błędu.
- **Auth-context** loguje tylko `error.message` od Cognito (np. "User does not exist") — nie hasło, nie email w plain text
- Vercel logs retain 7 dni dla Pro plan, 30 dni dla Enterprise

## GDPR / RODO {#rodo}

- **Right of access** (Art. 15 RODO): `GET /api/account/export` zwraca JSON z
  profilem, personami, onboardingiem, subskrypcją oraz sekcją
  `propertyStudio`. Sekcja zawiera projekty, fakty i audyt należące do
  organizacji użytkownika. Eksport nie zawiera sekretów dostawców ani
  podpisanych adresów plików.
- **Right to erasure** (Art. 17 RODO): `POST /api/account/delete` z
  `{ confirm: "DELETE" }` najpierw usuwa dane Property Intelligence Studio z
  PostgreSQL, następnie klucze `user:<sub>:*` z KV i na końcu czyści cookie.
- Jeśli usunięcie PostgreSQL nie powiedzie się, endpoint zwraca `500`, nie
  rozpoczyna usuwania KV i nie czyści sesji. Użytkownik nie otrzymuje
  fałszywego potwierdzenia pełnego usunięcia.
- PostgreSQL i KV nie wspierają wspólnej transakcji. Jeżeli błąd wystąpi już
  podczas czyszczenia KV, operacja wymaga ponowienia i kontroli operacyjnej.
- **Right to rectification** (Art. 16): user edytuje profil/persony przez UI, regeneruje przez button
- **Data minimization**: dokładny adres jest opcjonalny, ma osobny tryb
  prywatności i nie pojawia się na karcie portfolio. Widoczność każdego faktu
  jest jawnie oznaczona jako wewnętrzna, kliencka albo publiczna.
- **Polityka prywatności / regulamin**: TODO — Wojtek powinien sporządzić z prawnikiem przed publicznym uruchomieniem
- **Retencja**: dane użytkownika są przechowywane, dopóki konto istnieje. Po
  poprawnym wykonaniu usunięcia są kasowane z PostgreSQL i KV. Stripe trzyma
  faktury zgodnie z obowiązkami podatkowymi.

## Co NIE jest jeszcze zrobione {#todo}

| Item | Priorytet | Notatka |
|------|-----------|---------|
| Content Security Policy (CSP) | Średni | Wymaga rozważenia (Next.js inline scripts, Stripe checkout iframe) |
| WAF / DDoS protection | Niski | Vercel ma podstawowy DDoS, ale dla większego ruchu warto Cloudflare przed |
| Audyt zdarzeń administracyjnych | Średni | Audyt zmian faktów istnieje; osobny log bezpieczeństwa wymaga wdrożenia |
| Automatyczna retencja teczek | Wysoki | Ustalić okres z Wojtkiem i prawnikiem przed pilotażem |
| Kopie zapasowe PostgreSQL | Wysoki | Ustalić RPO, RTO i procedurę testowego odtworzenia przed produkcją |
| 2FA / MFA | Średni | Cognito to wspiera, trzeba włączyć w pool |
| Backup KV | Niski | Vercel KV ma snapshoty (Upstash) |
| Penetration test | Niski | Przed publicznym uruchomieniem warto |
| Polityka prywatności + regulamin | **WYSOKI** | Prawne — przed pierwszym płacącym klientem |
| Bug bounty / responsible disclosure | Niski | Po skali |

## Kontakt w sprawach bezpieczeństwa

Każde podejrzenie naruszenia: hello@akademia-ai.pl (TODO — ustawić mailbox)
