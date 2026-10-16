import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProgramPlanning,
  deleteProgramPlanning,
  getProgramPlanningById,
  getProgramPlannings,
  updateProgramPlanning,
  ProgramPlanningDto,
  ProgramPlanningInput,
  ProgramPlanningListParams,
  ProgramPlanningListResult,
} from '@/lib/api/academic/programPlanning'

const PROGRAM_PLANNINGS_KEY = ['program-plannings']

// GET /program-plannings returns the FULL filtered list — no paging and no
// text search (get-program-plannings.md: only unitGuid / schoolGuid /
// intakeGuid / lecturerGuid). The page used to send search + page/pageSize,
// which the endpoint ignored: page 1 showed every row, every other page
// repeated them, and the search box did nothing. So this fetches the whole
// (optionally guid-filtered) list once; the page searches, sorts and pages
// it on screen. The large pageSize only matters if the API ever pages.
const FETCH_ALL_PAGE_SIZE = 10000

export function useProgramPlannings(filters: Omit<ProgramPlanningListParams, 'search'> = {}) {
  return useQuery<ProgramPlanningListResult>({
    queryKey: [...PROGRAM_PLANNINGS_KEY, filters],
    queryFn: () => getProgramPlannings(filters, 1, FETCH_ALL_PAGE_SIZE),
    placeholderData: keepPreviousData,
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
