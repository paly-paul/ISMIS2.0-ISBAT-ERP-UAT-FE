import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDesignation, deleteDesignation, Designation, DesignationInput, getDesignations, updateDesignation } from '@/lib/api/academic/designation'

const DESIGNATIONS_KEY = ['designations']

// Load enough rows to cover the full designation list in one request.
const DESIGNATIONS_PAGE_SIZE = 1000

export function useDesignations() {
  return useQuery({
    queryKey: DESIGNATIONS_KEY,
    queryFn: () => getDesignations(1, DESIGNATIONS_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DesignationInput) => createDesignation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DESIGNATIONS_KEY }),
  })
}

export function useUpdateDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DesignationInput }) => updateDesignation(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DESIGNATIONS_KEY }),
  })
}

export function useDeleteDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDesignation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DESIGNATIONS_KEY }),
  })
}

export type { Designation, DesignationInput }
