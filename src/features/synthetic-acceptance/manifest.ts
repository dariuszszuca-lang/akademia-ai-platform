import type { EvidenceLocator } from '../property-sources/domain'
import {
  syntheticCorpusSchema,
  type ExpectedSyntheticFact,
  type SyntheticCase,
  type SyntheticMaterial,
  type SyntheticMaterialKind,
} from './domain'

type FactSpec = Pick<
  ExpectedSyntheticFact,
  'factKey' | 'valueType' | 'value'
> & {
  unit?: string
  conflict?: boolean
  acceptedVariants?: ExpectedSyntheticFact['acceptedVariants']
}

const mediaTypes: Record<SyntheticMaterialKind, SyntheticMaterial['mediaType']> =
  {
    pdf: 'application/pdf',
    jpeg: 'image/jpeg',
    png: 'image/png',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
  }

function locatorFor(
  kind: SyntheticMaterialKind,
  index: number,
): EvidenceLocator {
  if (kind === 'pdf' || kind === 'jpeg' || kind === 'png') {
    return { type: 'page', page: 1 }
  }

  if (kind === 'xlsx' || kind === 'csv') {
    return {
      type: 'sheet',
      sheet: kind === 'csv' ? 'CSV' : 'Dane',
      row: index + 2,
      column: String.fromCharCode(66 + index),
    }
  }

  return {
    type: 'text',
    start: index * 201,
    end: index * 201 + 200,
  }
}

function material(
  input: Omit<SyntheticMaterial, 'facts' | 'mediaType'> & {
    facts: FactSpec[]
  },
): SyntheticMaterial {
  return {
    ...input,
    mediaType: mediaTypes[input.kind],
    facts: input.facts.map((fact, index) => ({
      ...fact,
      locator: locatorFor(input.kind, index),
      evidenceId: `EVID-${input.id}-${index + 1}`,
      conflict: fact.conflict ?? false,
      acceptedVariants: fact.acceptedVariants ?? [],
    })),
  }
}

const apartmentComplete: SyntheticCase = {
  code: 'SYN-M-01',
  title: 'Syntetyczne mieszkanie kompletne',
  propertyType: 'apartment',
  transactionType: 'sale',
  city: 'Testowo',
  district: 'Dzielnica Północna',
  addressMode: 'hidden',
  seedFacts: [],
  materials: [
    material({
      id: 'SYN-M-01-PDF',
      caseCode: 'SYN-M-01',
      kind: 'pdf',
      fileName: 'syn-m-01-karta.pdf',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'price.asking',
          valueType: 'money',
          value: 750000,
          unit: 'PLN',
          acceptedVariants: ['750 000', '750000 PLN'],
        },
        {
          factKey: 'area.usable',
          valueType: 'number',
          value: 83.4,
          unit: 'm²',
          acceptedVariants: ['83,40', '83.4 m²'],
        },
        {
          factKey: 'rooms.count',
          valueType: 'number',
          value: 4,
        },
      ],
    }),
    material({
      id: 'SYN-M-01-JPEG',
      caseCode: 'SYN-M-01',
      kind: 'jpeg',
      fileName: 'syn-m-01-notatka.jpg',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'condition',
          valueType: 'text',
          value: 'bardzo dobry',
        },
        {
          factKey: 'building.type',
          valueType: 'text',
          value: 'budynek wielorodzinny',
        },
        {
          factKey: 'floor.number',
          valueType: 'number',
          value: 3,
        },
      ],
    }),
    material({
      id: 'SYN-M-01-DOCX',
      caseCode: 'SYN-M-01',
      kind: 'docx',
      fileName: 'syn-m-01-stan-prawny.docx',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'legal.ownershipType',
          valueType: 'text',
          value: 'pełna własność',
        },
        {
          factKey: 'legal.landRegisterNumber',
          valueType: 'text',
          value: 'SYNTHETIC-NOT-A-LAND-REGISTER',
        },
        {
          factKey: 'legal.encumbrances',
          valueType: 'json',
          value: [],
        },
      ],
    }),
    material({
      id: 'SYN-M-01-CSV',
      caseCode: 'SYN-M-01',
      kind: 'csv',
      fileName: 'syn-m-01-budynek.csv',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'building.yearBuilt',
          valueType: 'number',
          value: 2018,
        },
        {
          factKey: 'building.floors',
          valueType: 'number',
          value: 6,
        },
        {
          factKey: 'energy.heatingType',
          valueType: 'text',
          value: 'miejskie',
        },
      ],
    }),
  ],
}

const apartmentWithConflicts: SyntheticCase = {
  code: 'SYN-M-02',
  title: 'Syntetyczne mieszkanie z brakami',
  propertyType: 'apartment',
  transactionType: 'sale',
  city: 'Testowo',
  district: 'Dzielnica Zachodnia',
  addressMode: 'hidden',
  seedFacts: [
    {
      factKey: 'area.usable',
      valueType: 'number',
      value: 61.2,
      unit: 'm²',
    },
    {
      factKey: 'building.yearBuilt',
      valueType: 'number',
      value: 2012,
    },
  ],
  materials: [
    material({
      id: 'SYN-M-02-PDF',
      caseCode: 'SYN-M-02',
      kind: 'pdf',
      fileName: 'syn-m-02-karta.pdf',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'area.usable',
          valueType: 'number',
          value: 58.7,
          unit: 'm²',
          conflict: true,
          acceptedVariants: ['58,70'],
        },
        {
          factKey: 'rooms.count',
          valueType: 'number',
          value: 3,
        },
        {
          factKey: 'price.asking',
          valueType: 'money',
          value: 620000,
          unit: 'PLN',
        },
      ],
    }),
    material({
      id: 'SYN-M-02-PNG',
      caseCode: 'SYN-M-02',
      kind: 'png',
      fileName: 'syn-m-02-nieczytelny.png',
      expectedOutcome: 'controlled_failure',
      facts: [],
    }),
    material({
      id: 'SYN-M-02-XLSX',
      caseCode: 'SYN-M-02',
      kind: 'xlsx',
      fileName: 'syn-m-02-budynek.xlsx',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'building.yearBuilt',
          valueType: 'number',
          value: 2015,
          conflict: true,
        },
        {
          factKey: 'floor.number',
          valueType: 'number',
          value: 2,
        },
        {
          factKey: 'building.floors',
          valueType: 'number',
          value: 5,
        },
      ],
    }),
    material({
      id: 'SYN-M-02-TXT',
      caseCode: 'SYN-M-02',
      kind: 'txt',
      fileName: 'syn-m-02-notatka.txt',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'legal.ownershipType',
          valueType: 'text',
          value: 'spółdzielcze własnościowe',
        },
        {
          factKey: 'condition',
          valueType: 'text',
          value: 'do odświeżenia',
        },
        {
          factKey: 'energy.heatingType',
          valueType: 'text',
          value: 'miejskie',
        },
      ],
    }),
  ],
}

const houseMixed: SyntheticCase = {
  code: 'SYN-D-01',
  title: 'Syntetyczny dom z danymi mieszanymi',
  propertyType: 'house',
  transactionType: 'sale',
  city: 'Testowo',
  district: 'Dzielnica Leśna',
  addressMode: 'hidden',
  seedFacts: [],
  materials: [
    material({
      id: 'SYN-D-01-PDF',
      caseCode: 'SYN-D-01',
      kind: 'pdf',
      fileName: 'syn-d-01-karta.pdf',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'price.asking',
          valueType: 'money',
          value: 1290000,
          unit: 'PLN',
        },
        {
          factKey: 'area.usable',
          valueType: 'number',
          value: 146.8,
          unit: 'm²',
        },
        {
          factKey: 'rooms.count',
          valueType: 'number',
          value: 6,
        },
      ],
    }),
    material({
      id: 'SYN-D-01-JPEG',
      caseCode: 'SYN-D-01',
      kind: 'jpeg',
      fileName: 'syn-d-01-notatka.jpg',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'condition',
          valueType: 'text',
          value: 'dobry',
        },
        {
          factKey: 'building.yearBuilt',
          valueType: 'number',
          value: 2009,
        },
        {
          factKey: 'building.type',
          valueType: 'text',
          value: 'wolnostojący',
        },
      ],
    }),
    material({
      id: 'SYN-D-01-DOCX',
      caseCode: 'SYN-D-01',
      kind: 'docx',
      fileName: 'syn-d-01-stan-prawny.docx',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'legal.ownershipType',
          valueType: 'text',
          value: 'pełna własność',
        },
        {
          factKey: 'legal.landRegisterNumber',
          valueType: 'text',
          value: 'SYNTHETIC-NOT-A-LAND-REGISTER',
        },
        {
          factKey: 'legal.encumbrances',
          valueType: 'json',
          value: ['syntetyczna służebność techniczna'],
        },
      ],
    }),
    material({
      id: 'SYN-D-01-XLSX',
      caseCode: 'SYN-D-01',
      kind: 'xlsx',
      fileName: 'syn-d-01-parametry.xlsx',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'plot.area',
          valueType: 'number',
          value: 820,
          unit: 'm²',
        },
        {
          factKey: 'energy.heatingType',
          valueType: 'text',
          value: 'pompa ciepła',
        },
        {
          factKey: 'building.floors',
          valueType: 'number',
          value: 2,
        },
      ],
    }),
  ],
}

const plotComplete: SyntheticCase = {
  code: 'SYN-P-01',
  title: 'Syntetyczna działka kompletna',
  propertyType: 'plot',
  transactionType: 'sale',
  city: 'Testowo',
  district: 'Dzielnica Polna',
  addressMode: 'hidden',
  seedFacts: [],
  materials: [
    material({
      id: 'SYN-P-01-PDF',
      caseCode: 'SYN-P-01',
      kind: 'pdf',
      fileName: 'syn-p-01-karta.pdf',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'price.asking',
          valueType: 'money',
          value: 410000,
          unit: 'PLN',
        },
        {
          factKey: 'plot.area',
          valueType: 'number',
          value: 980,
          unit: 'm²',
        },
        {
          factKey: 'plot.identifier',
          valueType: 'text',
          value: 'SYN-P-001',
        },
      ],
    }),
    material({
      id: 'SYN-P-01-DOCX',
      caseCode: 'SYN-P-01',
      kind: 'docx',
      fileName: 'syn-p-01-stan-prawny.docx',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'legal.ownershipType',
          valueType: 'text',
          value: 'pełna własność',
        },
        {
          factKey: 'legal.landRegisterNumber',
          valueType: 'text',
          value: 'SYNTHETIC-NOT-A-LAND-REGISTER',
        },
        {
          factKey: 'legal.encumbrances',
          valueType: 'json',
          value: [],
        },
      ],
    }),
    material({
      id: 'SYN-P-01-CSV',
      caseCode: 'SYN-P-01',
      kind: 'csv',
      fileName: 'syn-p-01-parametry.csv',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'plot.shape',
          valueType: 'text',
          value: 'prostokąt',
        },
        {
          factKey: 'plot.utilities',
          valueType: 'json',
          value: ['prąd', 'woda'],
        },
        {
          factKey: 'plot.accessRoad',
          valueType: 'text',
          value: 'droga utwardzona',
        },
      ],
    }),
    material({
      id: 'SYN-P-01-TXT',
      caseCode: 'SYN-P-01',
      kind: 'txt',
      fileName: 'syn-p-01-notatka.txt',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'price.currency',
          valueType: 'text',
          value: 'PLN',
        },
        {
          factKey: 'plot.area',
          valueType: 'number',
          value: 980,
          unit: 'm²',
        },
        {
          factKey: 'legal.ownershipType',
          valueType: 'text',
          value: 'pełna własność',
        },
      ],
    }),
  ],
}

const plotWithConflicts: SyntheticCase = {
  code: 'SYN-P-02',
  title: 'Syntetyczna działka z konfliktami',
  propertyType: 'plot',
  transactionType: 'sale',
  city: 'Testowo',
  district: 'Dzielnica Południowa',
  addressMode: 'hidden',
  seedFacts: [
    {
      factKey: 'plot.area',
      valueType: 'number',
      value: 1100,
      unit: 'm²',
    },
    {
      factKey: 'plot.identifier',
      valueType: 'text',
      value: 'SYN-P-002-A',
    },
    {
      factKey: 'plot.accessRoad',
      valueType: 'text',
      value: 'droga gruntowa',
    },
  ],
  materials: [
    material({
      id: 'SYN-P-02-PDF',
      caseCode: 'SYN-P-02',
      kind: 'pdf',
      fileName: 'syn-p-02-karta.pdf',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'plot.area',
          valueType: 'number',
          value: 1250,
          unit: 'm²',
          conflict: true,
        },
        {
          factKey: 'price.asking',
          valueType: 'money',
          value: 530000,
          unit: 'PLN',
        },
        {
          factKey: 'legal.ownershipType',
          valueType: 'text',
          value: 'pełna własność',
        },
      ],
    }),
    material({
      id: 'SYN-P-02-XLSX',
      caseCode: 'SYN-P-02',
      kind: 'xlsx',
      fileName: 'syn-p-02-parametry.xlsx',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'plot.identifier',
          valueType: 'text',
          value: 'SYN-P-002-B',
          conflict: true,
        },
        {
          factKey: 'plot.shape',
          valueType: 'text',
          value: 'trapez',
        },
        {
          factKey: 'plot.utilities',
          valueType: 'json',
          value: ['prąd'],
        },
      ],
    }),
    material({
      id: 'SYN-P-02-CSV',
      caseCode: 'SYN-P-02',
      kind: 'csv',
      fileName: 'syn-p-02-dojazd.csv',
      expectedOutcome: 'review_ready',
      facts: [
        {
          factKey: 'plot.accessRoad',
          valueType: 'text',
          value: 'droga asfaltowa',
          conflict: true,
        },
        {
          factKey: 'price.currency',
          valueType: 'text',
          value: 'PLN',
        },
        {
          factKey: 'legal.encumbrances',
          valueType: 'json',
          value: ['syntetyczna służebność przejazdu'],
        },
      ],
    }),
    material({
      id: 'SYN-P-02-TXT',
      caseCode: 'SYN-P-02',
      kind: 'txt',
      fileName: 'syn-p-02-nieczytelny.txt',
      expectedOutcome: 'controlled_failure',
      facts: [],
    }),
  ],
}

export const controlledConflicts = [
  ['SYN-M-02', 'area.usable'],
  ['SYN-M-02', 'building.yearBuilt'],
  ['SYN-P-02', 'plot.area'],
  ['SYN-P-02', 'plot.identifier'],
  ['SYN-P-02', 'plot.accessRoad'],
] as const

export const syntheticCorpus = syntheticCorpusSchema.parse({
  version: 'synthetic-v1',
  cases: [
    apartmentComplete,
    apartmentWithConflicts,
    houseMixed,
    plotComplete,
    plotWithConflicts,
  ],
})
