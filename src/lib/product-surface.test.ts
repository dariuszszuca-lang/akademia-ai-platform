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
    expect(source).not.toMatch(
      /Akademia AI|Platforma szkoleniowa|O Akademii/,
    )
  })
})
