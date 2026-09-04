import { useQuery } from '@tanstack/react-query'
import { getMenu } from '@/lib/api/users/menu'

// Exported so mutations that change what the current user can see (e.g.
// assigning permission groups) can invalidate this cache directly, rather
// than duplicating the key string and risking it drifting out of sync.
export const MENU_KEY = ['menu']

// Permissions don't change within a session, so cache indefinitely — same
// convention as useFaculties etc.
export function useMenu() {
  return useQuery({
    queryKey: MENU_KEY,
    queryFn: getMenu,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export type { MenuNode, MenuPermissions, MenuResult } from '@/lib/api/users/menu'
