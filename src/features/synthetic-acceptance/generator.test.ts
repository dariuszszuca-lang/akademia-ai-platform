import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { preparePropertySourceBytes } from '../property-sources/pipeline/document-preparation'
import { generateSyntheticCorpus } from './generator'
import { syntheticCorpus } from './manifest'

const signatures = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  docx: [0x50, 0x4b, 0x03, 0x04],
  xlsx: [0x50, 0x4b, 0x03, 0x04],
} as const

describe('synthetic corpus generator', () => {
  it('creates exactly twenty bounded files with valid container signatures', async () => {
    const generated = await generateSyntheticCorpus(syntheticCorpus)

    expect(generated).toHaveLength(20)
    expect(
      new Set(generated.map((item) => item.materialId)).size,
    ).toBe(20)
    expect(
      generated.reduce((total, item) => total + item.bytes.byteLength, 0),
    ).toBeLessThan(100 * 1024 * 1024)

    for (const item of generated) {
      expect(item.bytes.byteLength).toBeGreaterThan(0)
      expect(item.bytes.byteLength).toBeLessThanOrEqual(5 * 1024 * 1024)
      expect(item.checksumSha256).toBe(
        createHash('sha256').update(item.bytes).digest('hex'),
      )

      if (item.kind in signatures) {
        const signature =
          signatures[item.kind as keyof typeof signatures]
        expect(Array.from(item.bytes.slice(0, signature.length))).toEqual(
          signature,
        )
      }
    }
  })

  it('produces the same bytes and checksums on repeated runs', async () => {
    const first = await generateSyntheticCorpus(syntheticCorpus)
    const second = await generateSyntheticCorpus(syntheticCorpus)

    expect(
      first.map((item) => ({
        materialId: item.materialId,
        checksumSha256: item.checksumSha256,
        bytes: Buffer.from(item.bytes).toString('base64'),
      })),
    ).toEqual(
      second.map((item) => ({
        materialId: item.materialId,
        checksumSha256: item.checksumSha256,
        bytes: Buffer.from(item.bytes).toString('base64'),
      })),
    )
  })

  it('keeps generated metadata aligned with the manifest', async () => {
    const generated = await generateSyntheticCorpus(syntheticCorpus)
    const materials = syntheticCorpus.cases.flatMap((item) =>
      item.materials.map((material) => ({
        caseCode: item.code,
        materialId: material.id,
        fileName: material.fileName,
        kind: material.kind,
        mediaType: material.mediaType,
      })),
    )

    expect(
      generated.map(
        ({
          caseCode,
          materialId,
          fileName,
          kind,
          mediaType,
        }) => ({
          caseCode,
          materialId,
          fileName,
          kind,
          mediaType,
        }),
      ),
    ).toEqual(materials)
  })

  it('keeps TXT and DOCX locators aligned with production text extraction', async () => {
    const generated = await generateSyntheticCorpus(syntheticCorpus)

    for (const item of syntheticCorpus.cases) {
      for (const material of item.materials.filter(
        (candidate) =>
          candidate.kind === 'txt' || candidate.kind === 'docx',
      )) {
        const file = generated.find(
          (candidate) => candidate.materialId === material.id,
        )
        expect(file).toBeDefined()

        const [prepared] = await preparePropertySourceBytes({
          mediaType: material.mediaType,
          bytes: file!.bytes,
          route: {
            kind: 'document',
            strategy: 'extract_text',
            bedrockDocumentName: material.id.toLowerCase(),
          },
        })
        expect(prepared.kind).toBe('document')
        const text = new TextDecoder().decode(prepared.bytes)

        for (const fact of material.facts) {
          expect(fact.locator.type).toBe('text')
          if (fact.locator.type !== 'text') continue
          const located = text.slice(
            fact.locator.start,
            fact.locator.end,
          )
          const expectedValue =
            typeof fact.value === 'string'
              ? fact.value
              : JSON.stringify(fact.value)
          expect(located).toContain(expectedValue)
        }
      }
    }
  })

  it('keeps XLSX and CSV locators aligned with production value extraction', async () => {
    const generated = await generateSyntheticCorpus(syntheticCorpus)

    for (const item of syntheticCorpus.cases) {
      for (const material of item.materials.filter(
        (candidate) =>
          candidate.kind === 'xlsx' || candidate.kind === 'csv',
      )) {
        const file = generated.find(
          (candidate) => candidate.materialId === material.id,
        )
        expect(file).toBeDefined()

        const prepared = await preparePropertySourceBytes({
          mediaType: material.mediaType,
          bytes: file!.bytes,
          route: {
            kind: 'document',
            strategy: 'extract_values',
            bedrockDocumentName: material.id.toLowerCase(),
          },
        })

        for (const fact of material.facts) {
          expect(fact.locator.type).toBe('sheet')
          if (fact.locator.type !== 'sheet') continue
          const locator = fact.locator

          const located = prepared
            .flatMap((part) =>
              part.kind === 'document'
                ? (part.locatorMap ?? []).map((range) => ({
                    range,
                    text: new TextDecoder()
                      .decode(part.bytes)
                      .slice(range.start, range.end),
                  }))
                : [],
            )
            .find(
              ({ range }) =>
                range.sheet === locator.sheet &&
                range.row === locator.row &&
                range.column === locator.column,
            )
          const expectedValue =
            typeof fact.value === 'string'
              ? fact.value
              : JSON.stringify(fact.value)

          expect(located?.text).toContain(expectedValue)
        }
      }
    }
  })
})
