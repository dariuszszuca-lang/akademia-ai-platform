import { describe, expect, it } from 'vitest'
import { resolveFactDefinition } from '../property-sources/catalog'
import { propertyFactValuesEqual } from '../property-sources/value-comparison'
import {
  syntheticCaseCodes,
  syntheticCorpusSchema,
  syntheticMaterialKinds,
} from './domain'
import {
  controlledConflicts,
  syntheticCorpus,
} from './manifest'

describe('synthetic acceptance manifest', () => {
  const parsed = syntheticCorpusSchema.parse(syntheticCorpus)
  const materials = parsed.cases.flatMap((item) => item.materials)
  const facts = materials.flatMap((item) => item.facts)

  it('contains the exact five cases and twenty materials', () => {
    expect(parsed.cases.map((item) => item.code)).toEqual(
      syntheticCaseCodes,
    )
    expect(parsed.cases.every((item) => item.materials.length === 4)).toBe(
      true,
    )
    expect(materials).toHaveLength(20)
    expect(new Set(materials.map((item) => item.id)).size).toBe(20)
  })

  it('uses the accepted material distribution', () => {
    const counts = Object.fromEntries(
      syntheticMaterialKinds.map((kind) => [
        kind,
        materials.filter((item) => item.kind === kind).length,
      ]),
    )

    expect(counts).toEqual({
      pdf: 5,
      jpeg: 2,
      png: 1,
      docx: 3,
      xlsx: 3,
      csv: 3,
      txt: 3,
    })
  })

  it('defines at least fifty catalog facts and five controlled conflicts', () => {
    expect(facts.length).toBeGreaterThanOrEqual(50)
    expect(facts.filter((fact) => fact.conflict)).toHaveLength(5)
    expect(controlledConflicts).toEqual([
      ['SYN-M-02', 'area.usable'],
      ['SYN-M-02', 'building.yearBuilt'],
      ['SYN-P-02', 'plot.area'],
      ['SYN-P-02', 'plot.identifier'],
      ['SYN-P-02', 'plot.accessRoad'],
    ])

    for (const item of parsed.cases) {
      for (const material of item.materials) {
        expect(material.caseCode).toBe(item.code)
        for (const fact of material.facts) {
          expect(
            resolveFactDefinition(fact.factKey, item.propertyType),
          ).not.toBeNull()
        }
      }
    }
  })

  it('seeds a different existing value for every controlled conflict', () => {
    for (const [caseCode, factKey] of controlledConflicts) {
      const item = parsed.cases.find(
        (candidate) => candidate.code === caseCode,
      )
      const seed = item?.seedFacts.find(
        (candidate) => candidate.factKey === factKey,
      )
      const conflict = item?.materials
        .flatMap((material) => material.facts)
        .find(
          (candidate) =>
            candidate.factKey === factKey && candidate.conflict,
        )

      expect(seed).toBeDefined()
      expect(conflict).toBeDefined()
      expect(
        propertyFactValuesEqual(seed?.value, conflict?.value),
      ).toBe(false)
    }
  })

  it('routes exactly two evidence-free materials to manual review', () => {
    expect(
      materials.filter(
        (item) => item.expectedOutcome === 'needs_manual_review',
      ),
    ).toHaveLength(2)
  })
})
