import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Skill, SkillInput, createSkill, getSkills, updateSkill } from '@/lib/api/academic/skill'

const SKILLS_KEY = ['skills']

export function useSkills() {
  return useQuery({
    queryKey: SKILLS_KEY,
    queryFn: () => getSkills(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SkillInput) => createSkill(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILLS_KEY }),
  })
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SkillInput }) => updateSkill(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILLS_KEY }),
  })
}

export type { Skill, SkillInput }
