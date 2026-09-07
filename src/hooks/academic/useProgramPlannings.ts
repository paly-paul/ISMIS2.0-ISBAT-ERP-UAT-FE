import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProgramPlanning,
  deleteProgramPlanning,
  getProgramPlanningById,
  getProgramPlannings,
  updateProgramPlanning,
  ProgramPlanningDto,
  ProgramPlanningInput,
  ProgramPlanningListParams,
} from '@/lib/api/academic/programPlanning'

const PROGRAM_PLANNINGS_KEY = ['program-plannings']

// No pagination on this endpoint (confirmed via get-program-plannings.md —
// "No pagination", full list every time) — filters are optional and purely
// server-side scoping, not a page cursor. Backs Course Allocation's own
// list/search, which stays client-side over whatever this returns.
export function useProgramPlannings(params: ProgramPlanningListParams = {}) {
  return useQuery({
    queryKey: [...PROGRAM_PLANNINGS_KEY, params],
    queryFn: () => getProgramPlannings(params),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useProgramPlanning(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_PLANNINGS_KEY, guid],
    queryFn: () => getProgramPlanningById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateProgramPlanning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramPlanningInput) => createProgramPlanning(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_PLANNINGS_KEY }),
  })
}

export function useUpdateProgramPlanning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: ProgramPlanningInput }) => updateProgramPlanning(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: PROGRAM_PLANNINGS_KEY })
      queryClient.invalidateQueries({ queryKey: [...PROGRAM_PLANNINGS_KEY, guid] })
    },
  })
}

export function useDeleteProgramPlanning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteProgramPlanning(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_PLANNINGS_KEY }),
  })
}

export type { ProgramPlanningDto, ProgramPlanningInput, ProgramPlanningListParams }
