import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPermissionGroup, PermissionGroup, PermissionGroupInput, getPermissionGroups, updatePermissionGroup } from '@/lib/api/academic/permissionGroup'

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERMISSION_GROUPS_KEY }),
  })
}

export type { PermissionGroup, PermissionGroupInput }
