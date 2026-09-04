import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUnitCategory, deleteUnitCategory, getUnitCategories, getUnitCategoryById, updateUnitCategory, UnitCategory, UnitCategoryInput } from '@/lib/api/academic/unitCategory'

const UNIT_CATEGORIES_KEY = ['unit-categories']

export function useUnitCategories() {
  return useQuery({
    queryKey: UNIT_CATEGORIES_KEY,
    queryFn: () => getUnitCategories(),
    // Keep the cached list until a mutation explicitly refreshes it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateUnitCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UnitCategoryInput) => createUnitCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: UNIT_CATEGORIES_KEY }),
  })
}

// Fetches a single unit category for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the unit category table.
export function useUnitCategory(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...UNIT_CATEGORIES_KEY, guid],
    queryFn: () => getUnitCategoryById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateUnitCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: UnitCategoryInput }) => updateUnitCategory(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: UNIT_CATEGORIES_KEY })
      queryClient.invalidateQueries({ queryKey: [...UNIT_CATEGORIES_KEY, guid] })
    },
  })
}

export function useDeleteUnitCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteUnitCategory(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: UNIT_CATEGORIES_KEY }),
  })
}

export type { UnitCategory, UnitCategoryInput }
