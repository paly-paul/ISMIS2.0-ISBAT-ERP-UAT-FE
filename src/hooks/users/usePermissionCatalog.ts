import { useQuery } from '@tanstack/react-query'
import { getPermissionCatalog, CatalogModule, CatalogPage, CatalogPermission } from '@/lib/api/users/permissionCatalog'

// `enabled` defaults to true so existing callers keep fetching eagerly;
// callers that only need this once a modal opens (e.g. the permission
// wizard) should pass `isOpen` through so the request doesn't fire while
// the modal is closed.
export function usePermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: ['permissionCatalog'],
    queryFn: getPermissionCatalog,
    enabled,
    // Static reference data with no signal for when it changes — fetch once
    // per session and never treat it as stale, instead of silently
    // refetching on every remount/window-focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Matches the 7 real app modules/rail icons in MENU_ROUTES_REFERENCE.md —
// updated alongside permissionCatalog.ts's switch away from the old
// System/Academics/Administration 3-bucket scheme.
const MODULE_ICONS: Record<string, string> = {
  Admission: 'clipboard',
  Academic: 'graduation',
  Finance: 'dollar',
  Student: 'user',
  Employee: 'briefcase',
  Config: 'cog',
  Assessment: 'pencil-alt',
}

export function moduleIcon(mainModule: string): string {
  return MODULE_ICONS[mainModule] ?? 'shield'
}

export function moduleLabel(mainModule: string): string {
  return mainModule
}

export type { CatalogModule, CatalogPage, CatalogPermission }
