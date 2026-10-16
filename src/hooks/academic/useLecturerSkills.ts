import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { CreateLecturerSkillInput, LecturerSkill, createSkill, deleteSkill, getSkillById, getSkills, updateSkill } from '@/lib/api/users/skills'

const LECTURER_SKILLS_KEY = ['lecturer-skills']

// Real server-side pagination (2026-09-09, now that the backend supports
// it — see getSkills' own comment) — only PAGE_SIZE rows are ever requested
// for the page on screen. Replaces the old useLecturerSkills()/
// useLecturerSkillSearch() pair (full 1000-row fetch + a separate page-1-only
// search query) with one hook, same consolidation useBatches went through.
// keepPreviousData avoids a loading flash between pages/searches.
export function useLecturerSkills(page: number, pageSize: number, search = '') {
  return useQuery({
    queryKey: [...LECTURER_SKILLS_KEY, page, pageSize, search],
    queryFn: () => getSkills(page, pageSize, search),
    placeholderData: keepPreviousData,
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
  return useMutation({
    mutationFn: (input: CreateLecturerSkillInput) => createSkill(input),
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
