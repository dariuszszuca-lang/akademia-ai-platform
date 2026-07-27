import { getTableColumns, getTableName } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import {
  organizationMemberships,
  organizations,
  propertyAuditEvents,
  propertyFacts,
  propertyProjects,
} from './schema'

describe('property truth database schema', () => {
  it('uses stable table names', () => {
    expect(getTableName(organizations)).toBe('organizations')
    expect(getTableName(organizationMemberships)).toBe(
      'organization_memberships',
    )
    expect(getTableName(propertyProjects)).toBe('property_projects')
    expect(getTableName(propertyFacts)).toBe('property_facts')
    expect(getTableName(propertyAuditEvents)).toBe('property_audit_events')
  })

  it('stores tenant ownership on every mutable aggregate', () => {
    expect(getTableColumns(propertyProjects)).toHaveProperty('organizationId')
    expect(getTableColumns(propertyAuditEvents)).toHaveProperty('organizationId')
    expect(getTableColumns(propertyFacts)).toHaveProperty('propertyProjectId')
  })

  it('stores fact provenance, review state and version', () => {
    const columns = getTableColumns(propertyFacts)

    expect(columns).toHaveProperty('status')
    expect(columns).toHaveProperty('visibility')
    expect(columns).toHaveProperty('sourceIds')
    expect(columns).toHaveProperty('createdByType')
    expect(columns).toHaveProperty('confirmedByUserId')
    expect(columns).toHaveProperty('version')
  })

  it('stores before and after values in the audit trail', () => {
    const columns = getTableColumns(propertyAuditEvents)

    expect(columns).toHaveProperty('before')
    expect(columns).toHaveProperty('after')
    expect(columns).toHaveProperty('actorId')
  })
})
