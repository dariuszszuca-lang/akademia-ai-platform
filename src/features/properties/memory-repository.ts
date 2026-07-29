import crypto from 'node:crypto'
import type {
  CreatePropertyFactInput,
  CreatePropertyInput,
  PropertyFact,
  PropertyProject,
  UpdatePropertyFactInput,
  UpdatePropertyInput,
} from './domain'
import type { AuditRecord, PropertyRepository } from './repository'
import { PropertyFactConflictError } from './errors'
import { createPropertyFactSemanticKey } from './fact-identity'

export class MemoryPropertyRepository implements PropertyRepository {
  private organizations = new Map<string, string>()
  private projects: PropertyProject[] = []
  private facts: PropertyFact[] = []
  private audit: AuditRecord[] = []

  async getOrCreatePersonalOrganization(userId: string) {
    const existing = this.organizations.get(userId)
    if (existing) return existing

    const organizationId = crypto.randomUUID()
    this.organizations.set(userId, organizationId)
    return organizationId
  }

  async listProjects(userId: string) {
    const organizationId = this.organizations.get(userId)
    if (!organizationId) return []

    return clone(
      this.projects.filter(
        (project) => project.organizationId === organizationId,
      ),
    )
  }

  async getProject(userId: string, projectId: string) {
    const organizationId = this.organizations.get(userId)
    const project = this.projects.find(
      (candidate) =>
        candidate.id === projectId &&
        candidate.organizationId === organizationId,
    )

    return project ? clone(project) : null
  }

  async createProject(
    userId: string,
    organizationId: string,
    input: CreatePropertyInput,
  ) {
    const now = new Date()
    const project: PropertyProject = {
      ...input,
      id: crypto.randomUUID(),
      organizationId,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }

    this.projects.push(project)
    return clone(project)
  }

  async updateProject(
    userId: string,
    projectId: string,
    input: UpdatePropertyInput,
  ) {
    const organizationId = this.organizations.get(userId)
    const project = this.projects.find(
      (candidate) =>
        candidate.id === projectId &&
        candidate.organizationId === organizationId,
    )
    if (!project) return null

    Object.assign(project, input, { updatedAt: new Date() })
    return clone(project)
  }

  async listFacts(userId: string, projectId: string) {
    if (!(await this.getProject(userId, projectId))) return []

    return clone(
      this.facts.filter((fact) => fact.propertyProjectId === projectId),
    )
  }

  async getFact(userId: string, projectId: string, factId: string) {
    if (!(await this.getProject(userId, projectId))) return null

    const fact = this.facts.find(
      (candidate) =>
        candidate.propertyProjectId === projectId && candidate.id === factId,
    )
    return fact ? clone(fact) : null
  }

  async createFact(
    userId: string,
    projectId: string,
    input: CreatePropertyFactInput,
  ) {
    if (!(await this.getProject(userId, projectId))) return null
    this.assertSemanticKeyAvailable(projectId, input)

    const now = new Date()
    const fact: PropertyFact = {
      ...input,
      id: crypto.randomUUID(),
      propertyProjectId: projectId,
      createdByType: 'user',
      createdById: userId,
      confirmedAt: input.status === 'confirmed' ? now : null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }

    this.facts.push(fact)
    return clone(fact)
  }

  async updateFact(
    userId: string,
    projectId: string,
    factId: string,
    input: UpdatePropertyFactInput,
  ) {
    if (!(await this.getProject(userId, projectId))) return null

    const fact = this.facts.find(
      (candidate) =>
        candidate.propertyProjectId === projectId && candidate.id === factId,
    )
    if (!fact) return null

    const { actorType: _actorType, ...changes } = input
    void _actorType
    this.assertSemanticKeyAvailable(
      projectId,
      { ...fact, ...changes },
      fact.id,
    )
    Object.assign(fact, changes, {
      version: fact.version + 1,
      updatedAt: new Date(),
    })

    if (changes.status === 'confirmed') {
      fact.confirmedAt = new Date()
    } else if (changes.status) {
      fact.confirmedAt = null
      fact.confirmedByUserId = undefined
    }

    return clone(fact)
  }

  private assertSemanticKeyAvailable(
    projectId: string,
    input: { key: string; label: string },
    excludedFactId?: string,
  ) {
    const semanticKey = createPropertyFactSemanticKey(input)
    const duplicate = this.facts.some(
      (fact) =>
        fact.propertyProjectId === projectId &&
        fact.id !== excludedFactId &&
        (fact.key === input.key ||
          createPropertyFactSemanticKey(fact) === semanticKey),
    )

    if (duplicate) throw new PropertyFactConflictError()
  }

  async appendAudit(record: Omit<AuditRecord, 'id' | 'createdAt'>) {
    this.audit.push({
      ...clone(record),
      id: crypto.randomUUID(),
      createdAt: new Date(),
    })
  }

  async listAudit(userId: string, projectId: string) {
    if (!(await this.getProject(userId, projectId))) return []

    return clone(
      this.audit
        .filter((event) => event.propertyProjectId === projectId)
        .reverse(),
    )
  }

  async exportForUser(userId: string) {
    const projects = await this.listProjects(userId)
    const projectIds = new Set(projects.map((project) => project.id))
    const organizationIds = new Set(
      projects.map((project) => project.organizationId),
    )

    return clone({
      projects,
      facts: this.facts.filter((fact) =>
        projectIds.has(fact.propertyProjectId),
      ),
      audit: this.audit.filter((event) =>
        organizationIds.has(event.organizationId),
      ),
    })
  }

  async deleteForUser(userId: string) {
    const organizationId = this.organizations.get(userId)
    if (!organizationId) return

    const projectIds = new Set(
      this.projects
        .filter((project) => project.organizationId === organizationId)
        .map((project) => project.id),
    )

    this.facts = this.facts.filter(
      (fact) => !projectIds.has(fact.propertyProjectId),
    )
    this.audit = this.audit.filter(
      (event) => event.organizationId !== organizationId,
    )
    this.projects = this.projects.filter(
      (project) => project.organizationId !== organizationId,
    )
    this.organizations.delete(userId)
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
