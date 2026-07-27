import { describe, expect, it } from 'vitest'
import {
  createAttachmentContentDisposition,
  createPropertySourceStorageKey,
} from './object-store'

describe('property source object-store helpers', () => {
  it('creates an opaque source key without the original filename', () => {
    const key = createPropertySourceStorageKey({
      organizationId: '11111111-1111-4111-8111-111111111111',
      propertyProjectId: '22222222-2222-4222-8222-222222222222',
      sourceId: '33333333-3333-4333-8333-333333333333',
    })

    expect(key).toBe(
      'originals/organizations/11111111-1111-4111-8111-111111111111/properties/22222222-2222-4222-8222-222222222222/sources/33333333-3333-4333-8333-333333333333/original',
    )
    expect(key).not.toContain('.pdf')
  })

  it('prevents header injection through the download filename', () => {
    const disposition = createAttachmentContentDisposition(
      'operat"\r\nX-Injected: yes.pdf',
    )

    expect(disposition).toMatch(/^attachment; filename="/)
    expect(disposition).not.toMatch(/[\r\n]/)
    expect(disposition.match(/"/g)).toHaveLength(2)
    expect(disposition).not.toContain('X-Injected: yes.pdf')
  })
})
