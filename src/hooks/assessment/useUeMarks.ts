import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getUeDetailedMarks,
  getUeDetailedMarksUnits,
  saveStudentUeMark,
  verifyUeMarks,
  UeDetailedMarksGridDto,
  UeMarkValues,
} from '@/lib/api/assessment/ueMarks'
import { getUeAttendanceInit, getUeAttendanceSemesters, getUeAttendanceUnits } from '@/lib/api/assessment/ueAttendance'

const KEY = ['ue-detailed-marks']

export function useUeDetailedMarks(universityExamGuid: string | null) {
  return useQuery({
    queryKey: [...KEY, 'grid', universityExamGuid],
    queryFn: () => getUeDetailedMarks(universityExamGuid!),
    enabled: !!universityExamGuid,
  })
}

// Form dropdowns shared by the entry and verify screens (ue-attendance/*).
export function useUeMarkFormInit() {
  return useQuery({ queryKey: [...KEY, 'init'], queryFn: getUeAttendanceInit, staleTime: Infinity })
}

export function useUeMarkFormSemesters(programGuid: string, intakeGuid: string) {
  return useQuery({
    queryKey: [...KEY, 'semesters', programGuid, intakeGuid],
    queryFn: () => getUeAttendanceSemesters(programGuid, intakeGuid || undefined),
    enabled: !!programGuid,
  })
}

// Entry screen: lecturer-scoped list. Verify screen: every unit.
export function useUeMarkFormUnits(programGuid: string, semesterGuid: string, scope: 'entry' | 'verify') {
  return useQuery({
    queryKey: [...KEY, 'units', scope, programGuid, semesterGuid],
    queryFn: () => scope === 'entry'
      ? getUeDetailedMarksUnits(programGuid, semesterGuid)
      : getUeAttendanceUnits(programGuid, semesterGuid),
    enabled: !!programGuid && !!semesterGuid,
  })
}

// One student per PUT. The response row (with the server-computed total) is
// written straight into the cached grid — no refetch of the whole sheet.
export function useSaveUeMark(universityExamGuid: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, marks }: { studentGuid: string, marks: UeMarkValues }) =>
      saveStudentUeMark(universityExamGuid!, studentGuid, marks),
    onSuccess: saved => {
      queryClient.setQueryData<UeDetailedMarksGridDto | undefined>(
        [...KEY, 'grid', universityExamGuid],
        old => old && {
          ...old,
          rows: old.rows.map(r => r.studentGuid === saved.studentGuid ? { ...r, ...saved, isAbsent: r.isAbsent } : r),
        },
      )
    },
  })
}

export function useVerifyUeMarks(universityExamGuid: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => verifyUeMarks(universityExamGuid!),
    onSuccess: data => {
      queryClient.setQueryData<UeDetailedMarksGridDto | undefined>(
        [...KEY, 'grid', universityExamGuid],
        old => old && { ...old, isVerified: data.isVerified },
      )
    },
  })
}
