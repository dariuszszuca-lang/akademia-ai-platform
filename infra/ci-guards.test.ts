// Warsztat Next Level S15, Zadanie 5 (fala B) - BRAMKI CI (testy negatywne).
// CI ma pozostac TYLKO-KONTROLE (lint, typecheck, testy). Te testy czytaja workflowy
// GitHub Actions oraz liste plikow sledzonych w gicie i padaja, gdy:
//   1. ktorys workflow zawiera krok wdrozenia (Actions nie moze byc druga droga deployu
//      obok Vercel Git integration i recznego CDK),
//   2. workflow CI nie uruchamia wymaganych krokow kontroli (pominiecie = nie sukces),
//   3. w repo jest sledzony plik sekretu (.env, klucze, credentials, service-account, token),
//   4. w tresci sledzonego pliku jest wartosc sekretu (wypisujemy nazwe wzorca i plik, NIGDY wartosc),
//   5. sledzony plik lezy poza dozwolonym zakresem repo (niedozwolona lokalizacja),
//   6. .gitignore nie blokuje wzorcow sekretow.
// Wdrozenie = Vercel (Git integration, osobny kontrakt) i CDK z profilu MFA po OK wlasciciela.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const WF_DIR = path.join(ROOT, '.github', 'workflows')

const REQUIRED_STEPS = ['npm run lint', 'npm run typecheck', 'npm test']

// Realne komendy wdrozenia. Skladane tak, zeby sam plik testu nie byl mylony z komenda.
const DEPLOY_PATTERNS: RegExp[] = [
  /vercel\s+(deploy|--prod|pull|build)/i,
  /\bnpx\s+vercel\b/i,
  /cdk\s+(deploy|destroy|bootstrap)/i,
  /npm\s+run\s+infra:(cdk|baseline:cdk)/i,
  /npm\s+run\s+db:migrate/i,
  /serverless\s+deploy/i,
  /\bsls\s+deploy/i,
  /amplify\s+(push|publish)/i,
  /aws\s+lambda\s+update-function-(code|configuration)/i,
  /aws\s+cloudformation\s+(deploy|create-stack|update-stack)/i,
  /aws\s+s3\s+(sync|cp)\b/i,
  /aws\s+cloudfront\s+create-invalidation/i,
]

// Nazwy plikow, ktore nigdy nie moga byc sledzone (szablon .env.example jest dozwolony).
const SECRET_FILE_PATTERNS: RegExp[] = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/,
  /\.pem$/,
  /\.key$/,
  /(^|\/)credentials$/,
  /(^|\/)service-account[^/]*\.json$/,
  /(^|\/)[^/]*token[^/]*\.json$/,
  /(^|\/)client_secret[^/]*\.json$/,
]

// Wzorce WARTOSCI sekretow (R1). Prefiksy skladane z fragmentow, zeby plik testu nie wygladal
// jak wyciek dla skanerow, a wzorzec i tak lapal prawdziwa wartosc.
const p = (parts: string[], tail: string) => new RegExp(parts.join('') + tail)
const SECRET_VALUE_PATTERNS: Record<string, RegExp> = {
  'AWS access key': p(['AK', 'IA'], '[0-9A-Z]{16}'),
  'Stripe live key': p(['sk_', 'live_'], '[0-9A-Za-z]{10,}'),
  'Anthropic key': p(['sk-', 'ant-'], '[0-9A-Za-z_-]{20,}'),
  'GitHub PAT': p(['gh', 'p_'], '[0-9A-Za-z]{30,}'),
  'Google API key': p(['AIza', 'Sy'], '[0-9A-Za-z_-]{20,}'),
  'Stripe webhook secret': p(['wh', 'sec_'], '[0-9A-Za-z]{20,}'),
  'OpenAI project key': p(['sk-', 'proj-'], '[0-9A-Za-z_-]{20,}'),
  'Vercel token': p(['vc', 'p_'], '[0-9A-Za-z]{20,}'),
}

// Dozwolony zakres repo. Wszystko inne = niedozwolona lokalizacja.
const ALLOWED_DIRS = new Set([
  '.github',
  'docs',
  'drizzle',
  'e2e',
  'infra',
  'public',
  'scripts',
  'src',
])
const ALLOWED_ROOT_FILES = new Set([
  '.env.example',
  '.gitignore',
  'drizzle.config.ts',
  'eslint.config.mjs',
  'next.config.mjs',
  'package.json',
  'package-lock.json',
  'playwright.config.ts',
  'postcss.config.mjs',
  'tailwind.config.ts',
  'tsconfig.json',
  'vitest.config.ts',
])
const ALLOWED_ROOT_FILE_PATTERN = /^[A-Z0-9-]+\.md$/ // README.md, DESIGN-*.md, LAYOUT-*.md

// Wzorce, ktore .gitignore MUSI blokowac.
const MUST_BE_IGNORED = ['.env', '.env.local', 'x.pem', 'x.key', 'credentials', 'service-account.json']

const git = (...args: string[]) =>
  execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' })

const isIgnored = (name: string) => {
  try {
    execFileSync('git', ['-C', ROOT, 'check-ignore', '-q', name])
    return true
  } catch {
    return false
  }
}

const trackedFiles = () => git('ls-files').split('\n').filter(Boolean)

const workflowFiles = () =>
  existsSync(WF_DIR)
    ? readdirSync(WF_DIR)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort()
        .map((f) => path.join(WF_DIR, f))
    : []

// Tresc workflow bez linii-komentarzy YAML (liczy sie realny krok, nie opis).
const effectiveYaml = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')

describe('bramki CI: workflow', () => {
  it('istnieje workflow CI', () => {
    expect(workflowFiles().length).toBeGreaterThan(0)
  })

  it('zaden workflow nie zawiera kroku wdrozenia (CI tylko-kontrole)', () => {
    for (const file of workflowFiles()) {
      const content = effectiveYaml(file)
      for (const pattern of DEPLOY_PATTERNS) {
        expect(
          pattern.test(content),
          `Workflow ${path.basename(file)} zawiera komende wdrozenia (${pattern}). ` +
            'CI ma byc tylko-kontrole; deploy = Vercel Git integration albo CDK po OK wlasciciela.',
        ).toBe(false)
      }
    }
  })

  it('workflow CI uruchamia wszystkie wymagane kroki kontroli', () => {
    const combined = workflowFiles().map(effectiveYaml).join('\n')
    for (const step of REQUIRED_STEPS) {
      expect(
        combined.includes(step),
        `Zaden workflow nie uruchamia '${step}'. Pominiecie wymaganego kroku nie moze byc sukcesem.`,
      ).toBe(true)
    }
  })

  it('workflow ma minimalne uprawnienia (contents: read, zero write)', () => {
    for (const file of workflowFiles()) {
      const content = effectiveYaml(file)
      expect(content, `${path.basename(file)} bez 'contents: read'`).toContain('contents: read')
      expect(
        /(contents|id-token|deployments|packages):\s*write/.test(content),
        `${path.basename(file)} zada uprawnien write; CI tylko-kontrole ich nie potrzebuje.`,
      ).toBe(false)
    }
  })
})

describe('bramki CI: pliki sledzone w gicie', () => {
  it('brak sledzonych plikow sekretow', () => {
    const offenders = trackedFiles().filter((f) => SECRET_FILE_PATTERNS.some((re) => re.test(f)))
    expect(offenders, 'Sledzone pliki sekretow (usun z indeksu, dodaj do .gitignore)').toEqual([])
  })

  it('brak wartosci sekretow w tresci sledzonych plikow', () => {
    const hits: string[] = []
    for (const rel of trackedFiles()) {
      const abs = path.join(ROOT, rel)
      if (!existsSync(abs) || !statSync(abs).isFile()) continue
      if (rel === 'package-lock.json') continue // hashe integrity, brak sekretow, duzy plik
      let text: string
      try {
        text = readFileSync(abs, 'utf8')
      } catch {
        continue // plik binarny albo nieczytelny
      }
      for (const [name, re] of Object.entries(SECRET_VALUE_PATTERNS)) {
        if (re.test(text)) hits.push(`${rel} [${name}]`)
      }
    }
    expect(hits, 'Wartosci sekretow w repo (R1: rotuj i usun)').toEqual([])
  })

  it('sledzone pliki leza w dozwolonym zakresie repo', () => {
    const outside = trackedFiles().filter((rel) => {
      const top = rel.split('/')[0]
      if (rel.includes('/')) return !ALLOWED_DIRS.has(top)
      return !ALLOWED_ROOT_FILES.has(rel) && !ALLOWED_ROOT_FILE_PATTERN.test(rel)
    })
    expect(
      outside,
      `Pliki poza dozwolonym zakresem (niedozwolona lokalizacja). Dozwolone katalogi: ${[...ALLOWED_DIRS].join(', ')}`,
    ).toEqual([])
  })

  it('.gitignore blokuje wzorce sekretow, a .env.example zostaje sledzony', () => {
    const notIgnored = MUST_BE_IGNORED.filter((name) => !isIgnored(name))
    expect(notIgnored, '.gitignore nie blokuje wzorcow sekretow').toEqual([])
    expect(isIgnored('.env.example'), '.env.example to szablon bez wartosci').toBe(false)
  })
})
