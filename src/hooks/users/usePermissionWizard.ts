import { useEffect, useMemo, useRef, useState } from 'react'
import { usePermissionCatalog, moduleLabel, CatalogModule, CatalogPage, CatalogPermission } from './usePermissionCatalog'

// Stable fallback so `catalog` keeps the same reference across renders while
// the query is loading/disabled — a fresh `[]` literal in the destructuring
// default below would otherwise be a NEW array every render, which cascades
// through permissionsByModule/moduleByPermissionId's useMemos (keyed on
// `catalog`'s identity) and gave PermissionFormModal's seed effect a new
// `moduleByPermissionId` reference every render, re-firing it in a loop
// (setGroupName/setBlocks → re-render → new [] → re-fire…) until React threw
// "Maximum update depth exceeded".
const EMPTY_CATALOG: CatalogModule[] = []

export interface ModuleBlock {
  module: string
  open: boolean
  permissions: number[]
  search: string
}

// Rebuild saved permissions into module blocks using the catalog lookup.
function blocksFromPermissionIds(permissionIds: number[], moduleByPermissionId: Record<number, string>): ModuleBlock[] {
  const byModule: Record<string, number[]> = {}
  for (const id of permissionIds) {
    const module = moduleByPermissionId[id] ?? 'Other'
    byModule[module] = [...(byModule[module] ?? []), id]
  }
  // Accordion — only the first block starts open.
  return Object.entries(byModule).map(([module, perms], i) => ({ module, open: i === 0, permissions: perms, search: '' }))
}

// Shared state and logic for the permission-group wizard used in create and edit flows.
// `enabled` (defaults to true) is threaded through to the catalog fetch so
// callers embedded in a modal — NewPermissionModal / EditPermissionModal are
// always mounted so their hooks can run, but only actually visible once
// `isOpen` — can pass `isOpen` here. Without it, both modals were firing the
// permission-catalog request the instant Permission Master's page mounted,
// even with the modal closed: two extra authenticated requests racing
// alongside the page's own permission-groups fetch, which made it more
// likely to trip the refresh/401 race documented in src/lib/api/client.ts
// and log the user out. See PROJECT_STRUCTURE.md's client.ts notes.
export function usePermissionWizard(enabled = true) {
  const { data: catalog = EMPTY_CATALOG } = usePermissionCatalog(enabled)

  // Merge permissions from catalog entries that share the same module.
  const permissionsByModule = useMemo(() => {
    const map: Record<string, CatalogPermission[]> = {}
    for (const m of catalog) {
      const perms = (m.subModules ?? []).flatMap(sm => (sm.pages ?? []).flatMap(pg => pg.permissions ?? []))
      map[m.mainModule] = [...(map[m.mainModule] ?? []), ...perms]
    }
    return map
  }, [catalog])

  // Merge page groups that belong to the same module.
  const pagesByModule = useMemo(() => {
    const map: Record<string, CatalogPage[]> = {}
    for (const m of catalog) {
      const pages = (m.subModules ?? []).flatMap(sm => sm.pages ?? [])
      map[m.mainModule] = [...(map[m.mainModule] ?? []), ...pages]
    }
    return map
  }, [catalog])

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
  const [selectedModule, setSelectedModule] = useState('')
  const [blocks, setBlocks] = useState<ModuleBlock[]>([])
  const [pendingScrollTo, setPendingScrollTo] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const blockRefs = useRef<Partial<Record<string, HTMLDivElement>>>({})

  // Recompute the module dropdown labels whenever the selected blocks change.
  const moduleOptions = useMemo(() => {
    const seen = new Set<string>()
    const addedModules = new Set(blocks.map(b => b.module))
    const options: { value: string; label: string }[] = []
    for (const m of catalog) {
      if (seen.has(m.mainModule)) continue
      seen.add(m.mainModule)
      const label = moduleLabel(m.mainModule) + (addedModules.has(m.mainModule) ? ' (Added)' : '')
      options.push({ value: m.mainModule, label })
    }
    return options
  }, [catalog, blocks])

  const globalMatches = useMemo(() => {
    const term = globalSearch.trim().toLowerCase()
    if (!term) return []
    const results: { module: string; permission: CatalogPermission }[] = []
    for (const [module, perms] of Object.entries(permissionsByModule)) {
      for (const p of perms) {
        if (p.permissionName.toLowerCase().includes(term)) results.push({ module, permission: p })
      }
    }
    return results.slice(0, 25)
  }, [permissionsByModule, globalSearch])

  useEffect(() => {
    if (!pendingScrollTo) return
    blockRefs.current[pendingScrollTo]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setPendingScrollTo(null)
  }, [pendingScrollTo])

  function handleAddModule() {
    if (!selectedModule || !groupName.trim()) return
    setBlocks(prev => {
      const exists = prev.find(b => b.module === selectedModule)
      if (exists) return prev.map(b => ({ ...b, open: b.module === selectedModule }))
      return [...prev.map(b => ({ ...b, open: false })), { module: selectedModule, open: true, permissions: [], search: '' }]
    })
    setPendingScrollTo(selectedModule)
  }

  function handleGlobalSelect(module: string, permission: CatalogPermission) {
    if (!groupName.trim()) return
    setBlocks(prev => {
      const exists = prev.find(b => b.module === module)
      if (exists) {
        if (exists.permissions.includes(permission.intPermission)) return prev.map(b => ({ ...b, open: b.module === module }))
        return prev.map(b => b.module === module ? { ...b, open: true, permissions: [...b.permissions, permission.intPermission] } : { ...b, open: false })
      }
      return [...prev.map(b => ({ ...b, open: false })), { module, open: true, permissions: [permission.intPermission], search: '' }]
    })
    setPendingScrollTo(module)
    setGlobalSearch('')
  }

  // Accordion — opening a block closes every other one.
  function toggleBlockOpen(module: string) {
    setBlocks(prev => prev.map(b => b.module === module ? { ...b, open: !b.open } : { ...b, open: false }))
  }

  function updateBlockSearch(module: string, value: string) {
    setBlocks(prev => prev.map(b => b.module === module ? { ...b, search: value } : b))
  }

  function toggleAll(module: string) {
    setBlocks(prev => prev.map(b => {
      if (b.module !== module) return b
      const all = permissionsByModule[module] ?? []
      const isAllChecked = b.permissions.length === all.length
      return { ...b, permissions: isAllChecked ? [] : all.map(p => p.intPermission) }
    }))
  }

  function togglePermission(module: string, permId: number) {
    setBlocks(prev => prev.map(b => {
      if (b.module !== module) return b
      const has = b.permissions.includes(permId)
      return { ...b, permissions: has ? b.permissions.filter(p => p !== permId) : [...b.permissions, permId] }
    }))
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setBlocks(prev => prev.filter(b => b.module !== deleteTarget))
    delete blockRefs.current[deleteTarget]
    setDeleteTarget(null)
  }

  // Seeds the wizard from a saved group's permissions ({intPermission, name}
  // pairs from GET /permission-groups). Matches each one against the cached
  // catalog (GET /permission-groups/permissions) by permissionName — only
  // permissions whose name exists in both responses get checked; anything
  // the group reports that the catalog doesn't recognize falls back to its
  // own id (grouped under 'Other') rather than silently disappearing.
  function seedFromGroupPermissions(name: string, groupPermissions: { intPermission: number; permissionName: string }[]) {
    setGroupName(name)
    const resolvedIds = groupPermissions.map(p => catalogIdByName[p.permissionName] ?? p.intPermission)
    setBlocks(blocksFromPermissionIds(resolvedIds, moduleByPermissionId))
  }

  function resetWizard() {
    setSaved(false)
    setConfirming(false)
    setGroupName('')
    setSelectedModule('')
    setBlocks([])
    setDeleteTarget(null)
    setGlobalSearch('')
  }

  const deleteTargetBlock = blocks.find(b => b.module === deleteTarget)
  const activeBlocks = blocks.filter(b => b.permissions.length > 0)
  const canSubmit = groupName.trim().length > 0 && activeBlocks.length > 0

  return {
    moduleOptions, permissionsByModule, pagesByModule, permissionNameById, moduleByPermissionId,
    saved, setSaved, confirming, setConfirming,
    groupName, setGroupName, selectedModule, setSelectedModule,
    blocks, blockRefs, deleteTarget, setDeleteTarget, deleteTargetBlock,
    globalSearch, setGlobalSearch, globalMatches,
    activeBlocks, canSubmit,
    handleAddModule, handleGlobalSelect, toggleBlockOpen, updateBlockSearch,
    toggleAll, togglePermission, confirmDelete, seedFromGroupPermissions, resetWizard,
  }
}
