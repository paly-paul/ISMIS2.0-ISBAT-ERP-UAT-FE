import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  SkillMaster,
  SkillMasterInput,
  createSkillMaster,
  deleteSkillMaster,
  getSkillMasters,
  updateSkillMaster,
} from '@/lib/api/academic/skillMaster'

const SKILL_MASTERS_KEY = ['skillMasters']

// Fetched once at a large pageSize and paginated/searched client-side —
// same "load it all" convention as the other small Config masters
// (useStreams/useFaculties/etc.), even though this endpoint is genuinely
// server-paginated (unlike most of its Config siblings, which return a
// plain unpaginated array).
export function useSkillMasters() {
  return useQuery({
    queryKey: SKILL_MASTERS_KEY,
    queryFn: () => getSkillMasters(1, 1000),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateSkillMaster() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SkillMasterInput) => createSkillMaster(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILL_MASTERS_KEY }),
  })
}

export function useUpdateSkillMaster() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ skillGuid, input }: { skillGuid: string; input: SkillMasterInput }) => updateSkillMaster(skillGuid, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILL_MASTERS_KEY }),
  })
}

export function useDeleteSkillMaster() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (skillGuid: string) => deleteSkillMaster(skillGuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILL_MASTERS_KEY }),
  })
}

export type { SkillMaster, SkillMasterInput }
