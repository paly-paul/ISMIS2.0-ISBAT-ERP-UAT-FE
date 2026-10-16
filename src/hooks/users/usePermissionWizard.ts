import { useMemo, useState } from 'react'
import { usePermissionCatalog, CatalogModule, CatalogPermission } from './usePermissionCatalog'
import { catalogSections } from '@/components/permissions/PermissionMatrix'

// Stable fallback so `catalog` keeps the same reference across renders while
// the query is loading/disabled — a fresh `[]` literal in the destructuring
// default below would otherwise be a NEW array every render, which cascades
// through the useMemos keyed on `catalog`'s identity and gave
// PermissionFormModal's seed effect a new `moduleByPermissionId` reference
// every render, re-firing it in a loop until React threw "Maximum update
// depth exceeded".
const EMPTY_CATALOG: CatalogModule[] = []

export interface ModuleSelection {
  module: string
  permissions: number[]
}

// Shared state for the permission-group picker used in create and edit flows.
// Every catalog module is always listed (no "add module" step); a module
// takes part in the group as soon as one of its permissions is ticked.
// `enabled` is threaded through to the catalog fetch so the modal — always
// mounted, only visible once `isOpen` — doesn't fire the catalog request
// while closed (see the client.ts refresh/401 race notes).
export function usePermissionWizard(enabled = true) {
  const { data: catalog = EMPTY_CATALOG } = usePermissionCatalog(enabled)

  // Modules in catalog order and module → sidebar section → pages,
  // mirroring the app's own menu tree.
  const { modules, sectionsByModule } = useMemo(() => catalogSections(catalog), [catalog])

  const permissionsByModule = useMemo(() => {
    const map: Record<string, CatalogPermission[]> = {}
    for (const [module, sections] of Object.entries(sectionsByModule)) {
      map[module] = sections.flatMap(s => s.pages.flatMap(pg => pg.permissions))
    }
    return map
  }, [sectionsByModule])

  const permissionNameById = useMemo(
    () => Object.fromEntries(Object.values(permissionsByModule).flat().map(p => [p.intPermission, p.permissionName])) as Record<number, string>,
    [permissionsByModule],
  )

  const moduleByPermissionId = useMemo(() => {
    const map: Record<number, string> = {}
    for (const [module, perms] of Object.entries(permissionsByModule)) {
      for (const p of perms) map[p.intPermission] = module
    }
    return map
  }, [permissionsByModule])

  // Match permissions by name when the saved group and catalog use different IDs.
  const catalogIdByName = useMemo(() => {
    const map: Record<string, number> = {}
    for (const perms of Object.values(permissionsByModule)) {
      for (const p of perms) map[p.permissionName] = p.intPermission
    }
    return map
  }, [permissionsByModule])

  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [activeModule, setActiveModule] = useState('')
  const [search, setSearch] = useState('')
  // A Set for O(1) membership — permission ids are unique across modules.
  const [selected, setSelected] = useState<Set<number>>(() => new Set())

  const currentModule = activeModule && modules.includes(activeModule) ? activeModule : modules[0] ?? ''

  function setMany(ids: number[], on: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const id of ids) { if (on) next.add(id); else next.delete(id) }
      return next
    })
  }

  function togglePermission(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Tri-state helper for a set of ids: ticks them all, or clears them all
  // when every one is already ticked.
  function toggleGroup(ids: number[]) {
    setMany(ids, !ids.every(id => selected.has(id)))
  }

  // Seeds from a saved group's permissions ({intPermission, permissionName}
  // pairs from GET /permission-groups). Each is matched against the catalog
  // by permissionName — the two endpoints don't always share ids — and falls
  // back to its own id when the catalog doesn't know it, so nothing the
  // group reports silently disappears.
  function seedFromGroupPermissions(name: string, groupPermissions: { intPermission: number; permissionName: string }[]) {
    setGroupName(name)
    const ids = groupPermissions.map(p => catalogIdByName[p.permissionName] ?? p.intPermission)
    setSelected(new Set(ids))
    setActiveModule(modules.find(m => (permissionsByModule[m] ?? []).some(p => ids.includes(p.intPermission))) ?? '')
  }

  function resetWizard() {
    setSaved(false)
    setConfirming(false)
    setGroupName('')
    setActiveModule('')
    setSearch('')
    setSelected(new Set())
  }

  // Grouped by module in catalog order. Ids the catalog doesn't recognize
  // (only possible when editing an older group) are kept under 'Other' so a
  // save never drops them.
  const selections = useMemo<ModuleSelection[]>(() => {
    const out: ModuleSelection[] = modules
      .map(module => ({ module, permissions: (permissionsByModule[module] ?? []).filter(p => selected.has(p.intPermission)).map(p => p.intPermission) }))
      .filter(s => s.permissions.length > 0)
    const unknown = Array.from(selected).filter(id => !(id in moduleByPermissionId))
    if (unknown.length > 0) out.push({ module: 'Other', permissions: unknown })
    return out
  }, [modules, permissionsByModule, moduleByPermissionId, selected])

  const selectedCount = selected.size
  const canSubmit = groupName.trim().length > 0 && selectedCount > 0

  return {
    catalogLoaded: catalog.length > 0,
    modules, sectionsByModule, permissionsByModule, permissionNameById, moduleByPermissionId,
    saved, setSaved, confirming, setConfirming,
    groupName, setGroupName,
    currentModule, setActiveModule,
    search, setSearch,
    selected, selections, selectedCount, canSubmit,
    togglePermission, toggleGroup, setMany,
    seedFromGroupPermissions, resetWizard,
  }
}
