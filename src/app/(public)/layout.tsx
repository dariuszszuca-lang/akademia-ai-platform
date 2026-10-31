import Link from 'next/link'
import { PLATFORM_NAME } from '@/lib/product'

export default function PublicToolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link href="/produkty" className="flex items-center gap-3 font-semibold text-foreground">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-mono text-sm font-bold text-white">
            PN
          </span>
          <span className="hidden sm:inline">{PLATFORM_NAME}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/login" className="text-foreground/70 hover:text-accent">Zaloguj się</Link>
          <Link href="/register" className="rounded-full bg-accent px-4 py-2 text-white">Załóż konto</Link>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-foreground/50 sm:px-6">
        Narzędzia pomagają, ale nie zastępują notariusza ani prawnika. To nie jest porada prawna.
      </footer>
    </div>
  )
}
