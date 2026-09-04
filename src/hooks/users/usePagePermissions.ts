import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { useMenu } from './useMenu'
import { MenuNode, MenuPermissions } from '@/lib/api/users/menu'

// Fail-open default: used while the menu is loading, when the real call
// failed and MenuResult.isFallback is true, or when the current route isn't
// present in the tree at all. Hiding an action only ever changes the UI —
// real authorization is still enforced server-side per request — so
// defaulting to "show everything" avoids a flash of missing buttons on every
// page load and matches the sidebar's own existing fail-open behavior for
// isFallback rather than introducing a stricter, inconsistent standard here.
const FULL_ACCESS: MenuPermissions = { add: true, edit: true, delete: true, get: true }

// A module's railId is always its lowercased name ("Config" -> "config"),
// confirmed against RAIL_DEFS in Sidebar.tsx — duplicated here (rather than
// imported) since RAIL_DEFS is module-private and this derivation is trivial.
function resolveHref(url: string, railId: string): string {
  return url.startsWith('/') ? url : `/${railId}/${url}`
}

function findNode(nodes: MenuNode[], railId: string, pathname: string): MenuNode | null {
  for (const n of nodes) {
    if (n.url && resolveHref(n.url, railId) === pathname) return n
    if (n.children.length) {
      const found = findNode(n.children, railId, pathname)
      if (found) return found
    }
  }
  return null
}

// Looks up the current route's permissions from the real /me/menu tree, so a
// page can gate its own Add/Edit/Delete actions on what the logged-in user
// is actually allowed to do rather than always rendering every action.
// Returns FULL_ACCESS (see above) whenever real permission data isn't
// available yet or the route isn't found in the tree — never a "hide
// everything" default, since that would misrepresent uncertain state as a
// confirmed denial.
export function usePagePermissions(): MenuPermissions {
  const pathname = usePathname()
  const { data, isLoading } = useMenu()

  return useMemo(() => {
    if (isLoading || !data || data.isFallback) return FULL_ACCESS
    for (const moduleNode of data.menu) {
      const found = findNode(moduleNode.children, moduleNode.name.toLowerCase(), pathname)
      if (found) return found.permissions ?? FULL_ACCESS
    }
    return FULL_ACCESS
  }, [data, isLoading, pathname])
}
