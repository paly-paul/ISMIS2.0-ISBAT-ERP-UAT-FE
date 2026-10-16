import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  downloadResitUeTemplate,
  getResitUeExams,
  getResitUeStudents,
  importResitUeMarks,
  ResitUeExamsParams,
  ResitUeImportRow,
} from '@/lib/api/assessment/resitUeMarkImport'

export const RESIT_UE_MARK_IMPORT_KEYS = {
  all: ['assessment-attendance-service', 'assessment', 'resit-ue-mark-import'] as const,
  exams: (params: ResitUeExamsParams) => [...RESIT_UE_MARK_IMPORT_KEYS.all, 'exams', params] as const,
  students: (resitScheduleGuid: string) => [...RESIT_UE_MARK_IMPORT_KEYS.all, 'students', resitScheduleGuid] as const,
}

export function useResitUeExams(params: ResitUeExamsParams) {
  return useQuery({
    queryKey: RESIT_UE_MARK_IMPORT_KEYS.exams(params),
    queryFn: () => getResitUeExams(params),
    placeholderData: keepPreviousData,
  })
}

// Loaded when the import modal opens; staleTime 0 so "already imported" is
// current (another user may have imported since).
export function useResitUeStudents(resitScheduleGuid: string | null) {
  return useQuery({
    queryKey: RESIT_UE_MARK_IMPORT_KEYS.students(resitScheduleGuid ?? ''),
    queryFn: () => getResitUeStudents(resitScheduleGuid as string),
    enabled: !!resitScheduleGuid,
    staleTime: 0,
  })
}

export function useDownloadResitUeTemplate() {
  return useMutation({ mutationFn: (resitScheduleGuid: string) => downloadResitUeTemplate(resitScheduleGuid) })
}

export function useImportResitUeMarks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ resitScheduleGuid, rows }: { resitScheduleGuid: string; rows: ResitUeImportRow[] }) => importResitUeMarks(resitScheduleGuid, rows),
    // Counts/status change on success; the student list's "imported" flags
    // change on success and may be stale after a 409.
    onSettled: () => queryClient.invalidateQueries({ queryKey: RESIT_UE_MARK_IMPORT_KEYS.all }),
  })
}
