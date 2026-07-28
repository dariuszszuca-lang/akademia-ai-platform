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
      className="flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#15252a] p-1.5 text-sm"
    >
      {links.map((item) => {
        const isActive = item.id === active
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#bd9360] ${
              isActive
                ? 'bg-[#f7f2e7] font-semibold text-[#162026]'
                : 'text-[#aebdb8] hover:bg-white/[0.06] hover:text-white'
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
          className="inline-flex min-h-11 cursor-not-allowed items-center whitespace-nowrap rounded-full px-4 py-2.5 text-[#6f827c]"
        >
          {item}
        </span>
      ))}
    </nav>
  )
}
