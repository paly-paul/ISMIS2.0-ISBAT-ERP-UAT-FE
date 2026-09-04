import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Faculty, FacultyInput, createFaculty, deleteFaculty, getFaculties, updateFaculty } from '@/lib/api/academic/faculty'

const FACULTIES_KEY = ['faculties']

// Load enough rows to cover the full faculty list in one request.
const FACULTIES_PAGE_SIZE = 1000

export function useFaculties() {
  return useQuery({
    queryKey: FACULTIES_KEY,
    queryFn: () => getFaculties(1, FACULTIES_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateFaculty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FacultyInput) => createFaculty(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACULTIES_KEY }),
  })
}

export function useUpdateFaculty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FacultyInput }) => updateFaculty(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACULTIES_KEY }),
  })
}

export function useDeleteFaculty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFaculty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACULTIES_KEY }),
  })
}

export type { Faculty, FacultyInput }
