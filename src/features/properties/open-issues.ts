import type { PropertyFact } from './domain'
import type {
  EvidenceLocator,
  PropertyFactProposal,
  PropertySource,
} from '../property-sources/domain'

export type OpenIssue = {
  id: string
  factKey: string
  label: string
  category: string
  kind: 'missing' | 'conflict' | 'needs_review'
  priority: 1 | 2 | 3
  factId: string | null
  proposalId: string | null
  sourceId: string | null
  evidenceLocator: EvidenceLocator | null
  action: 'complete_fact' | 'open_source' | 'decide_proposal'
}

type RankedIssue = {
  issue: OpenIssue
  rank: number
}

export function buildOpenIssues({
  facts,
  proposals,
  sources,
}: {
  facts: PropertyFact[]
  proposals: PropertyFactProposal[]
  sources: PropertySource[]
}): OpenIssue[] {
  const sourceIds = new Set(sources.map((source) => source.id))
  const byFactKey = new Map<string, RankedIssue>()

  for (const fact of facts) {
    if (fact.status === 'conflicting') {
      keepHighestPriority(byFactKey, fact.key, {
        rank: 1,
        issue: {
          id: `fact:${fact.id}`,
          factKey: fact.key,
          label: fact.label,
          category: fact.category,
          kind: 'conflict',
          priority: 1,
          factId: fact.id,
          proposalId: null,
          sourceId: null,
          evidenceLocator: null,
          action: 'complete_fact',
        },
      })
    } else if (fact.status === 'missing') {
      keepHighestPriority(byFactKey, fact.key, {
        rank: 3,
        issue: {
          id: `fact:${fact.id}`,
          factKey: fact.key,
          label: fact.label,
          category: fact.category,
          kind: 'missing',
          priority: 3,
          factId: fact.id,
          proposalId: null,
          sourceId: null,
          evidenceLocator: null,
          action: 'complete_fact',
        },
      })
    }
  }

  for (const proposal of proposals) {
    if (proposal.status === 'conflict') {
      keepHighestPriority(byFactKey, proposal.factKey, {
        rank: 0,
        issue: {
          id: `proposal:${proposal.id}`,
          factKey: proposal.factKey,
          label: proposal.label,
          category: proposal.category,
          kind: 'conflict',
          priority: 1,
          factId: proposal.conflictsWithFactId,
          proposalId: proposal.id,
          sourceId: sourceIds.has(proposal.sourceId)
            ? proposal.sourceId
            : null,
          evidenceLocator: proposal.evidenceLocator,
          action: 'decide_proposal',
        },
      })
    } else if (proposal.status === 'needs_review') {
      keepHighestPriority(byFactKey, proposal.factKey, {
        rank: 2,
        issue: {
          id: `proposal:${proposal.id}`,
          factKey: proposal.factKey,
          label: proposal.label,
          category: proposal.category,
          kind: 'needs_review',
          priority: 2,
          factId: proposal.conflictsWithFactId,
          proposalId: proposal.id,
          sourceId: sourceIds.has(proposal.sourceId)
            ? proposal.sourceId
            : null,
          evidenceLocator: proposal.evidenceLocator,
          action: 'open_source',
        },
      })
    }
  }

  return [...byFactKey.values()]
    .sort(
      (left, right) =>
        left.issue.priority - right.issue.priority ||
        left.issue.label.localeCompare(right.issue.label, 'pl'),
    )
    .map(({ issue }) => issue)
}

function keepHighestPriority(
  issues: Map<string, RankedIssue>,
  factKey: string,
  candidate: RankedIssue,
): void {
  const current = issues.get(factKey)
  if (!current || candidate.rank < current.rank) {
    issues.set(factKey, candidate)
  }
}
