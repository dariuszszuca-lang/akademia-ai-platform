'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { agents } from '@/data/agents'

const NAV_ITEMS: { label: string; href: string; group: string; hint?: string }[] = [
  { label: 'Start', href: '/start', group: 'Nawigacja', hint: 'Strona główna' },
  { label: 'Mój profil', href: '/profil', group: 'Nawigacja', hint: 'profil.md, persony' },
  { label: 'Agenci', href: '/agent', group: 'Nawigacja', hint: 'Lista 6 agentów AI' },
  { label: 'Warsztaty', href: '/programy', group: 'Nawigacja' },
  { label: 'Skarbiec', href: '/skarbiec', group: 'Nawigacja' },
  { label: 'Na żywo', href: '/na-zywo', group: 'Nawigacja' },
  { label: 'Społeczność', href: '/spolecznosc', group: 'Nawigacja' },
  { label: 'Ludzie', href: '/ludzie', group: 'Nawigacja' },
  { label: 'O Akademii', href: '/o-akademii', group: 'Nawigacja' },
]

const ONBOARDING_ITEMS = [
  { label: 'Express Wizard (15 pytań)', href: '/onboarding/express', hint: 'Profil agenta' },
  { label: 'Persona kupującego (chat)', href: '/onboarding/persona/buyer', hint: '6 pytań' },
  { label: 'Persona sprzedającego (chat)', href: '/onboarding/persona/seller', hint: '6 pytań' },
  { label: 'Profil pogłębiony (20 pytań)', href: '/onboarding/deep', hint: 'Deep Wizard' },
]

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Wyszukiwarka platformy"
        className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[18vh] px-4"
      >
        <div
          className="absolute inset-0 bg-black/50"
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          onClick={() => setOpen(false)}
        />
        <div
          className="relative w-full max-w-xl glass-card overflow-hidden animate-fade-in-up"
          style={{
            background: 'var(--card-strong)',
            border: '1px solid var(--border)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b border-foreground/[0.06]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-foreground/40">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <Command.Input
              placeholder="Wyszukaj agenta, narzędzie, plik..."
              className="flex-1 bg-transparent text-foreground placeholder:text-foreground/30 text-[15px] focus:outline-none"
            />
            <span className="kbd">esc</span>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-foreground/40">
              Nic nie znaleziono.
            </Command.Empty>

            <Command.Group heading="Agenci AI" className="text-[10px] uppercase tracking-[0.25em] text-foreground/35 px-3 py-2">
              {agents.filter(a => a.enabled).map(a => (
                <Command.Item
                  key={a.id}
                  value={`agent ${a.name} ${a.tagline}`}
                  onSelect={() => go(`/agent/${a.id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-foreground/80 data-[selected=true]:bg-foreground/[0.06] data-[selected=true]:text-foreground transition-colors"
                >
                  <span className="text-lg" style={{ color: a.color }}>{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-foreground/40 truncate">{a.tagline}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Onboarding / pliki" className="text-[10px] uppercase tracking-[0.25em] text-foreground/35 px-3 py-2 mt-1">
              {ONBOARDING_ITEMS.map(item => (
                <Command.Item
                  key={item.href}
                  value={item.label + ' ' + (item.hint ?? '')}
                  onSelect={() => go(item.href)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-foreground/80 data-[selected=true]:bg-foreground/[0.06] data-[selected=true]:text-foreground transition-colors"
                >
                  <span className="text-foreground/30 text-xs font-mono">md</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{item.label}</div>
                    {item.hint && <div className="text-xs text-foreground/40">{item.hint}</div>}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Nawigacja" className="text-[10px] uppercase tracking-[0.25em] text-foreground/35 px-3 py-2 mt-1">
              {NAV_ITEMS.map(item => (
                <Command.Item
                  key={item.href}
                  value={item.label + ' ' + (item.hint ?? '')}
                  onSelect={() => go(item.href)}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-foreground/80 data-[selected=true]:bg-foreground/[0.06] data-[selected=true]:text-foreground transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{item.label}</div>
                    {item.hint && <div className="text-xs text-foreground/40">{item.hint}</div>}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between px-5 py-3 border-t border-foreground/[0.06] text-[11px] text-foreground/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="kbd">↑</span>
                <span className="kbd">↓</span>
                nawigacja
              </span>
              <span className="flex items-center gap-1.5">
                <span className="kbd">↵</span>
                otwórz
              </span>
            </div>
            <span>Akademia AI</span>
          </div>
        </div>
      </Command.Dialog>
    </>
  )
}
