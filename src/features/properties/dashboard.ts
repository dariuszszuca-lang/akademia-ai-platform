import type {
  PropertyFact,
  PropertyProject,
} from './domain'

export function buildPropertyDashboard(
  projects: PropertyProject[],
  factsByProject: Map<string, Array<Pick<PropertyFact, 'status'>>>,
) {
  const active = projects.filter((project) => project.stage !== 'archived')
  const facts = active.flatMap(
    (project) => factsByProject.get(project.id) ?? [],
  )

  return {
    activeCount: active.length,
    missingCount: facts.filter((fact) => fact.status === 'missing').length,
    conflictingCount: facts.filter((fact) => fact.status === 'conflicting')
      .length,
    recentProjects: [...active]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 3),
  }
}
