import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Campus, CampusInput, createCampus, deleteCampus, getCampusDropdown, getCampuses, updateCampus } from '@/lib/api/academic/campus'

const CAMPUSES_KEY = ['campuses']

// Load enough rows to cover the full campus list in one request.
const CAMPUSES_PAGE_SIZE = 1000

export function useCampuses() {
  return useQuery({
    queryKey: CAMPUSES_KEY,
    queryFn: () => getCampuses(1, CAMPUSES_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Small lookup for the Campus dropdown in New/EditFacultyModal (and the
// filter dropdown in the campus table). enabled defaults to true for that
// second case; New/EditFacultyModal passes enabled={isOpen} explicitly —
// this hook was previously firing the moment /config/faculty-master loaded,
// before Add/Edit Faculty was ever opened, since faculty-master/page.tsx
// itself has no use for the campus dropdown data and the modal components
// are always mounted regardless of isOpen.
export function useCampusDropdown(enabled = true) {
  return useQuery({
    queryKey: [...CAMPUSES_KEY, 'dropdown'],
    queryFn: () => getCampusDropdown(),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export function useCreateCampus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CampusInput) => createCampus(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAMPUSES_KEY }),
  })
}

export function useUpdateCampus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CampusInput }) => updateCampus(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAMPUSES_KEY }),
  })
}

export function useDeleteCampus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCampus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAMPUSES_KEY }),
  })
}

export type { Campus, CampusInput, CampusDropdownItem } from '@/lib/api/academic/campus'
