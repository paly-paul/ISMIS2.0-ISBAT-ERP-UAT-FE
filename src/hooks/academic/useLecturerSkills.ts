import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreateLecturerSkillInput, LecturerSkill, createSkill, deleteSkill, getSkillById, getSkills, updateSkill } from '@/lib/api/users/skills'

const LECTURER_SKILLS_KEY = ['lecturer-skills']

export function useLecturerSkills() {
  return useQuery({
    queryKey: LECTURER_SKILLS_KEY,
    queryFn: () => getSkills(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-side search for Skill Master's search box — hits the same list
// endpoint with the backend's own ?search= param instead of filtering the
// already-fetched full list client-side. Kept as its own hook/query key so
// useLecturerSkills() above still stays the plain unfiltered, cached list —
// only enabled while the search box actually has a query in it, at which
// point the page falls back to that shared unfiltered list instead of
// issuing a redundant identical request.
export function useLecturerSkillSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...LECTURER_SKILLS_KEY, 'search', q],
    queryFn: () => getSkills(q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Fetch-by-guid query for the Edit modal — only enabled while the modal is
// actually open with a guid, same convention as the other real domains.
export function useLecturerSkill(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...LECTURER_SKILLS_KEY, guid],
    queryFn: () => getSkillById(guid as string),
    enabled: enabled && !!guid,
  })
}

// mutationFn resolves to an array — one call now creates a skill entry per
// guid in input.skillGuids (see CreateLecturerSkillInput).
export function useCreateLecturerSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLecturerSkillInput) => createSkill(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LECTURER_SKILLS_KEY }),
  })
}

export function useUpdateLecturerSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: CreateLecturerSkillInput }) => updateSkill(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: LECTURER_SKILLS_KEY })
      queryClient.invalidateQueries({ queryKey: [...LECTURER_SKILLS_KEY, guid] })
    },
  })
}

export function useDeleteLecturerSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteSkill(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LECTURER_SKILLS_KEY }),
  })
}

export type { LecturerSkill, CreateLecturerSkillInput }
