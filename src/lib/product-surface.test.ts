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
  'src/app/(dashboard)/settings/page.tsx',
  'src/app/(dashboard)/settings/subscription/page.tsx',
  'src/app/(dashboard)/pricing/page.tsx',
  'src/app/api/account/export/route.ts',
  'src/components/Navbar.tsx',
  'src/components/CommandPalette.tsx',
  'src/lib/agent/prompts.ts',
  'src/lib/billing/plans.ts',
]

describe('public product surfaces', () => {
  it.each(publicShells)('%s does not expose the Academy brand', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(source).not.toMatch(
      /Akademia AI|Platforma szkoleniowa|O Akademii/,
    )
  })

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
})
