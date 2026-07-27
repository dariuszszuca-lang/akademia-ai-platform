import Link from 'next/link'
import { PRODUCT_SHORT_NAME } from '@/lib/product'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, var(--section-glow-b), transparent 50%), radial-gradient(circle at 80% 100%, var(--section-glow-a), transparent 50%)',
        }}
      />

      {/* Header */}
      <header className="relative z-10 px-6 sm:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-medium tracking-tight text-foreground">
            {PRODUCT_SHORT_NAME}
          </span>
        </div>
        <Link
          href="/"
          className="text-foreground/40 hover:text-foreground/70 text-xs uppercase tracking-[0.25em] transition-colors"
        >
          Wstrzymaj
        </Link>
      </header>

      {/* Content */}
      <main className="relative z-10 px-6 sm:px-10">{children}</main>
    </div>
  )
}
