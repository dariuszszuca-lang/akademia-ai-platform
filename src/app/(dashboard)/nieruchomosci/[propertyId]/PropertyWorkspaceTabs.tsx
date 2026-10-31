import Link from 'next/link'

type PropertyWorkspaceTabsProps = {
  propertyId: string
  active: 'facts' | 'sources' | 'issues' | 'history'
}

export default function PropertyWorkspaceTabs({
  propertyId,
  active,
}: PropertyWorkspaceTabsProps) {
  const links = [
    {
      id: 'facts' as const,
      label: 'Fakty',
      href: `/nieruchomosci/${propertyId}`,
    },
    {
      id: 'sources' as const,
      label: 'Źródła',
      href: `/nieruchomosci/${propertyId}/zrodla`,
    },
    {
      id: 'issues' as const,
      label: 'Braki',
      href: `/nieruchomosci/${propertyId}/braki`,
    },
    {
      id: 'history' as const,
      label: 'Historia',
      href: `/nieruchomosci/${propertyId}/historia`,
    },
  ]

  return (
    <nav
      aria-label="Sekcje teczki"
      className="flex gap-1 overflow-x-auto rounded-full border border-border bg-[color:var(--card-strong)] p-1.5 text-sm"
    >
      {links.map((item) => {
        const isActive = item.id === active
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
              isActive
                ? 'bg-[color:var(--card-strong)] font-semibold text-foreground'
                : 'text-foreground/60 hover:bg-background hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        )
      })}

      {['Materiały'].map((item) => (
        <span
          key={item}
          aria-disabled="true"
          title="Ten moduł powstaje w następnym etapie"
          className="inline-flex min-h-11 cursor-not-allowed items-center whitespace-nowrap rounded-full px-4 py-2.5 text-accent"
        >
          {item}
        </span>
      ))}
    </nav>
  )
}
