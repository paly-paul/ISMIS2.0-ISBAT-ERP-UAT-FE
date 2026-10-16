import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPermissionGroup, PermissionGroup, PermissionGroupInput, getPermissionGroups, updatePermissionGroup } from '@/lib/api/academic/permissionGroup'
import { MENU_KEY } from '@/hooks/users/useMenu'

const PERMISSION_GROUPS_KEY = ['permissionGroups']

export function usePermissionGroups() {
  return useQuery({
    queryKey: PERMISSION_GROUPS_KEY,
    queryFn: () => getPermissionGroups(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreatePermissionGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PermissionGroupInput) => createPermissionGroup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERMISSION_GROUPS_KEY }),
  })
}

export function useUpdatePermissionGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PermissionGroupInput }) => updatePermissionGroup(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERMISSION_GROUPS_KEY })
      // The logged-in user may be in this group — refetch /me/menu so the
      // sidebar and each page's usePagePermissions() pick up the change
      // without a full page reload (useMenu caches for the whole session).
      queryClient.invalidateQueries({ queryKey: MENU_KEY })
    },
  })
}

export type { PermissionGroup, PermissionGroupInput }
