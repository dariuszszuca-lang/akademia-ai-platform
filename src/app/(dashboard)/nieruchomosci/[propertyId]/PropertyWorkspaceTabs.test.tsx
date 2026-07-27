import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PropertyWorkspaceTabs from './PropertyWorkspaceTabs'

const propertyId = '22222222-2222-4222-8222-222222222222'

describe('PropertyWorkspaceTabs', () => {
  it('links the facts and sources sections for the current property', () => {
    const html = renderToStaticMarkup(
      <PropertyWorkspaceTabs propertyId={propertyId} active="facts" />,
    )

    expect(html).toContain(`href="/nieruchomosci/${propertyId}"`)
    expect(html).toContain(
      `href="/nieruchomosci/${propertyId}/zrodla"`,
    )
    expect(html).toContain('>Fakty</a>')
    expect(html).toContain('>Źródła</a>')
  })

  it('marks only the active tab as the current page', () => {
    const factsHtml = renderToStaticMarkup(
      <PropertyWorkspaceTabs propertyId={propertyId} active="facts" />,
    )
    const sourcesHtml = renderToStaticMarkup(
      <PropertyWorkspaceTabs propertyId={propertyId} active="sources" />,
    )

    expect(factsHtml.match(/aria-current="page"/g)).toHaveLength(1)
    expect(sourcesHtml.match(/aria-current="page"/g)).toHaveLength(1)
    expect(
      sourcesHtml.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0],
    ).toContain(
      `href="/nieruchomosci/${propertyId}/zrodla"`,
    )
  })

  it('does not expose unfinished sections as interactive controls', () => {
    const html = renderToStaticMarkup(
      <PropertyWorkspaceTabs propertyId={propertyId} active="sources" />,
    )

    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('href="#">')
  })
})
