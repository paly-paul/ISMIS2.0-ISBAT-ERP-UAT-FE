import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addProgramCourseUnitsBulk,
  getProgramCourseUnits,
  ProgramCourseUnitBulkInput,
  ProgramCourseUnitBulkItem,
  ProgramCourseUnitBulkResult,
  ProgramCourseUnitDto,
} from '@/lib/api/academic/programCourseUnits'

const PROGRAM_COURSE_UNITS_KEY = ['programCourseUnits']

// Scoped to one program — only enabled once it's known (Edit mode). Drives
// ProgrammeModal Step 2's real semester list instead of a hardcoded count.
export function useProgramCourseUnits(programGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_COURSE_UNITS_KEY, programGuid],
    queryFn: () => getProgramCourseUnits(programGuid as string),
    enabled: enabled && !!programGuid,
  })
}

// Step 2 of ProgrammeModal's Add-mode wizard — see
// post-program-course-units.md. Invalidates this program's own
// useProgramCourseUnits query (harmless no-op in Add mode, where nothing has
// queried it yet) rather than the whole list, since the endpoint is scoped
// to a single program.
export function useAddProgramCourseUnitsBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramCourseUnitBulkInput) => addProgramCourseUnitsBulk(input),
    onSuccess: (_data, { programGuid }) => queryClient.invalidateQueries({ queryKey: [...PROGRAM_COURSE_UNITS_KEY, programGuid] }),
  })
}

export type { ProgramCourseUnitDto, ProgramCourseUnitBulkInput, ProgramCourseUnitBulkItem, ProgramCourseUnitBulkResult }
