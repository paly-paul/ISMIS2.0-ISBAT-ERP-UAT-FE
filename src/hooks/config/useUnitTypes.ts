import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUnitType, deleteUnitType, getUnitTypeById, getUnitTypes, updateUnitType, UnitType, UnitTypeInput } from '@/lib/api/academic/unitType'

const UNIT_TYPES_KEY = ['unit-types']

export function useUnitTypes() {
  return useQuery({
    queryKey: UNIT_TYPES_KEY,
    queryFn: () => getUnitTypes(),
    // Keep the cached list until a mutation explicitly refreshes it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateUnitType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UnitTypeInput) => createUnitType(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: UNIT_TYPES_KEY }),
  })
}

// Fetches a single unit type for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the unit type table.
export function useUnitType(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...UNIT_TYPES_KEY, guid],
    queryFn: () => getUnitTypeById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateUnitType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: UnitTypeInput }) => updateUnitType(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: UNIT_TYPES_KEY })
      queryClient.invalidateQueries({ queryKey: [...UNIT_TYPES_KEY, guid] })
    },
  })
}

export function useDeleteUnitType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteUnitType(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: UNIT_TYPES_KEY }),
  })
}

export type { UnitType, UnitTypeInput }
