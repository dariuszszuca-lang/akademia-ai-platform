import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  inspectPropertySourceBytes,
  preparePropertySourceBytes,
} from './document-preparation'

describe('property source document preparation', () => {
  it('inspects PDF page count and splits ordered parts at twenty pages', async () => {
    const pdf = await PDFDocument.create()
    for (let page = 0; page < 41; page += 1) {
      pdf.addPage([595, 842])
    }
    const bytes = await pdf.save()

    const metadata = await inspectPropertySourceBytes(
      'application/pdf',
      bytes,
    )
    const prepared = await preparePropertySourceBytes({
      mediaType: 'application/pdf',
      bytes,
      route: {
        kind: 'document',
        strategy: 'split_pdf',
        bedrockDocumentName: 'property-source',
        pageCount: 41,
        maximumPagesPerPart: 20,
        maximumParts: 5,
      },
    })

    expect(metadata).toEqual({
      pdf: { encrypted: false, pageCount: 41 },
    })
    expect(prepared).toHaveLength(3)
    expect(
      prepared.map((part) =>
        part.kind === 'document' ? part.pageOffset : -1,
      ),
    ).toEqual([0, 20, 40])
    await Promise.all(
      prepared.map(async (part, index) => {
        expect(part.kind).toBe('document')
        expect(part.format).toBe('pdf')
        expect(part.bytes.byteLength).toBeLessThanOrEqual(4_500_000)
        const split = await PDFDocument.load(part.bytes)
        expect(split.getPageCount()).toBe([20, 20, 1][index])
      }),
    )
  })

  it('extracts DOCX paragraphs and tables without embedded objects', async () => {
    const bytes = zipSync({
      '[Content_Types].xml': new TextEncoder().encode(
        '<Types></Types>',
      ),
      'word/document.xml': new TextEncoder().encode(`
        <?xml version="1.0"?>
        <w:document>
          <w:body>
            <w:p><w:r><w:t>Dom w Poznaniu</w:t></w:r></w:p>
            <w:tbl><w:tr>
              <w:tc><w:p><w:r><w:t>Powierzchnia</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>120 m2</w:t></w:r></w:p></w:tc>
            </w:tr></w:tbl>
            <w:object><w:t>NIE WYKONUJ</w:t></w:object>
          </w:body>
        </w:document>
      `),
      'word/embeddings/oleObject1.bin': new Uint8Array([1, 2, 3]),
    })

    const metadata = await inspectPropertySourceBytes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes,
    )
    const parts = await preparePropertySourceBytes({
      mediaType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes,
      route: {
        kind: 'document',
        strategy: 'extract_text',
        bedrockDocumentName: 'property-source',
      },
    })

    expect(metadata.archiveEntries).toContain('word/document.xml')
    const text = new TextDecoder().decode(parts[0].bytes)
    expect(text).toContain('Dom w Poznaniu')
    expect(text).toContain('Powierzchnia')
    expect(text).toContain('120 m2')
    expect(text).not.toContain('NIE WYKONUJ')
    expect(text).not.toContain('oleObject')
  })

  it('extracts visible XLSX cell values with sheet locators and never evaluates formulas', async () => {
    const bytes = xlsxFixture()
    const parts = await preparePropertySourceBytes({
      mediaType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes,
      route: {
        kind: 'document',
        strategy: 'extract_values',
        bedrockDocumentName: 'property-source',
      },
    })

    const text = new TextDecoder().decode(parts[0].bytes)
    expect(parts[0].kind).toBe('document')
    if (parts[0].kind !== 'document') throw new Error('expected document')
    expect(text).toContain('A1\tCena')
    expect(text).toContain('B2\t750000')
    expect(text).not.toContain('Hidden')
    expect(text).not.toContain('SUM(')
    expect(parts[0].locatorMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: 'Oferta',
          row: 2,
          column: 'B',
        }),
      ]),
    )
  })

  it('parses quoted CSV values and records cell coordinates', async () => {
    const bytes = new TextEncoder().encode(
      'miasto,cena\n"Poznań, Jeżyce",750000\n',
    )
    const parts = await preparePropertySourceBytes({
      mediaType: 'text/csv',
      bytes,
      route: {
        kind: 'document',
        strategy: 'extract_values',
        bedrockDocumentName: 'property-source',
      },
    })

    const text = new TextDecoder().decode(parts[0].bytes)
    expect(parts[0].kind).toBe('document')
    if (parts[0].kind !== 'document') throw new Error('expected document')
    expect(text).toContain('A2\tPoznań, Jeżyce')
    expect(parts[0].locatorMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: 'CSV',
          row: 2,
          column: 'A',
        }),
      ]),
    )
  })

  it('detects semicolon-delimited Polish CSV exports', async () => {
    const bytes = new TextEncoder().encode(
      'miasto;cena;opis\nPoznań;750000;"Jeżyce, balkon"\n',
    )
    const parts = await preparePropertySourceBytes({
      mediaType: 'text/csv',
      bytes,
      route: {
        kind: 'document',
        strategy: 'extract_values',
        bedrockDocumentName: 'property-source',
      },
    })

    expect(parts[0].kind).toBe('document')
    if (parts[0].kind !== 'document') throw new Error('expected document')
    const text = new TextDecoder().decode(parts[0].bytes)
    expect(text).toContain('B2\t750000')
    expect(text).toContain('C2\tJeżyce, balkon')
    expect(parts[0].locatorMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: 'CSV',
          row: 2,
          column: 'C',
        }),
      ]),
    )
  })

  it('inspects and normalizes an oversized image under Bedrock limits', async () => {
    const bytes = await sharp({
      create: {
        width: 9000,
        height: 2,
        channels: 3,
        background: '#ffffff',
      },
    })
      .jpeg()
      .toBuffer()
    const metadata = await inspectPropertySourceBytes('image/jpeg', bytes)
    const parts = await preparePropertySourceBytes({
      mediaType: 'image/jpeg',
      bytes,
      route: {
        kind: 'image',
        strategy: 'normalize',
        maximumOutputBytes: 3_750_000,
        maximumOutputDimension: 8000,
      },
    })
    const outputMetadata = await sharp(parts[0].bytes).metadata()

    expect(metadata).toEqual({
      image: { width: 9000, height: 2 },
    })
    expect(parts[0]).toMatchObject({
      kind: 'image',
      format: 'webp',
    })
    expect(parts[0].bytes.byteLength).toBeLessThanOrEqual(3_750_000)
    expect(outputMetadata.width).toBeLessThanOrEqual(8000)
  })

  it('rejects XML documents with a doctype or oversized expanded archive', async () => {
    const malicious = zipSync({
      'word/document.xml': new TextEncoder().encode(
        '<!DOCTYPE x [<!ENTITY y "boom">]><w:document>&y;</w:document>',
      ),
    })

    await expect(
      preparePropertySourceBytes({
        mediaType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        bytes: malicious,
        route: {
          kind: 'document',
          strategy: 'extract_text',
          bedrockDocumentName: 'property-source',
        },
      }),
    ).rejects.toThrow('UNSAFE_XML')
  })
})

function xlsxFixture() {
  return zipSync({
    '[Content_Types].xml': new TextEncoder().encode(
      '<Types></Types>',
    ),
    'xl/workbook.xml': new TextEncoder().encode(`
      <workbook xmlns:r="relationships">
        <sheets>
          <sheet name="Oferta" sheetId="1" r:id="rId1"/>
          <sheet name="Hidden" sheetId="2" state="hidden" r:id="rId2"/>
        </sheets>
      </workbook>
    `),
    'xl/_rels/workbook.xml.rels': new TextEncoder().encode(`
      <Relationships>
        <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Target="worksheets/sheet2.xml"/>
      </Relationships>
    `),
    'xl/sharedStrings.xml': new TextEncoder().encode(`
      <sst><si><t>Cena</t></si><si><t>Nie pokazuj</t></si></sst>
    `),
    'xl/worksheets/sheet1.xml': new TextEncoder().encode(`
      <worksheet><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c></row>
        <row r="2"><c r="B2"><f>SUM(B3:B4)</f><v>750000</v></c></row>
      </sheetData></worksheet>
    `),
    'xl/worksheets/sheet2.xml': new TextEncoder().encode(`
      <worksheet><sheetData>
        <row r="1"><c r="A1" t="s"><v>1</v></c></row>
      </sheetData></worksheet>
    `),
  })
}
