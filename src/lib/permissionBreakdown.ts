import { PermissionGroup } from '@/hooks/config/usePermissionGroups'
import { CatalogModule } from '@/hooks/users/usePermissionCatalog'

export interface CatalogPermRef {
  name: string
  granted: boolean
}

export interface GroupPageBreakdown {
  page: string
  permissions: CatalogPermRef[]
}

export interface GroupModuleBreakdown {
  module: string
  pages: GroupPageBreakdown[]
  grantedCount: number
  totalCount: number
}

// Walks the FULL catalog (not just groupsSubset's own permission lists) so
// every permission shows up, tagged granted/not-granted — granted if ANY
// group in the subset includes it. A group's own reported permission ids can
// drift from the catalog's ids for the "same" permission (see
// PermissionGroup's comment in permissionGroup.ts), so match by name.
// Shared by AssignEmployeePermissionsModal and EditEmployeePermissionsModal —
// two separate entry points onto the same view-then-edit flow.
export function buildBreakdown(groupsSubset: PermissionGroup[], catalog: CatalogModule[]): GroupModuleBreakdown[] {
  if (groupsSubset.length === 0) return []
  const grantedNames = new Set(groupsSubset.flatMap(g => g.permissions.map(p => p.permissionName)))
  const catalogNames = new Set<string>()

  const fromCatalog: GroupModuleBreakdown[] = catalog.map(m => {
    const pages: GroupPageBreakdown[] = []
    for (const sm of m.subModules ?? []) {
      for (const pg of sm.pages ?? []) {
        const permissions = (pg.permissions ?? []).map(p => {
          catalogNames.add(p.permissionName)
          return { name: p.permissionName, granted: grantedNames.has(p.permissionName) }
        })
        if (permissions.length > 0) pages.push({ page: pg.page, permissions })
      }
    }
    const totalCount = pages.reduce((n, pg) => n + pg.permissions.length, 0)
    const grantedCount = pages.reduce((n, pg) => n + pg.permissions.filter(p => p.granted).length, 0)
    return { module: m.mainModule, pages, grantedCount, totalCount }
  }).filter(b => b.totalCount > 0)

  // Permissions the subset reports that the catalog doesn't recognize (id/name
  // drift between the two endpoints) still need to surface as granted.
  const leftoverNames = [...grantedNames].filter(n => !catalogNames.has(n))
  if (leftoverNames.length > 0) {
    fromCatalog.push({
      module: 'Other',
      pages: [{ page: 'Other', permissions: leftoverNames.map(name => ({ name, granted: true })) }],
      grantedCount: leftoverNames.length,
      totalCount: leftoverNames.length,
    })
  }

  return fromCatalog
}
