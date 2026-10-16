import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getResitSchedules,
  getResitScheduleCourseUnits,
  createResitSchedule,
  getResitSchedule,
  updateResitSchedule,
  getResitCwSchedule,
  updateResitCwSchedule,
  getResitCtSchedule,
  updateResitCtSchedule,
  ResitScheduleSaveCommand,
  ResitCwScheduleSaveCommand,
  ResitCtScheduleSaveCommand,
  ResitCtScheduleResponse,
  ResitCwScheduleResponse,
} from '@/lib/api/assessment/resitScheduling'

export const RESIT_SCHEDULING_KEYS = {
  all: ['assessment-attendance-service', 'assessment', 'resit-scheduling'] as const,
  exams: () => [...RESIT_SCHEDULING_KEYS.all, 'exams'] as const,
  examList: (params: { page: number; pageSize: number; search: string }) => [...RESIT_SCHEDULING_KEYS.exams(), 'list', params] as const,
  exam: (guid: string) => [...RESIT_SCHEDULING_KEYS.exams(), 'detail', guid] as const,
  courseUnits: () => [...RESIT_SCHEDULING_KEYS.all, 'course-units'] as const,
  ct: () => [...RESIT_SCHEDULING_KEYS.all, 'ct'] as const,
  cw: () => [...RESIT_SCHEDULING_KEYS.all, 'cw'] as const,
}

export function useResitSchedules(params: { page: number; pageSize: number; search: string }) {
  return useQuery({
    queryKey: RESIT_SCHEDULING_KEYS.examList(params),
    queryFn: () => getResitSchedules({ ...params, search: params.search || undefined }),
    placeholderData: keepPreviousData,
  })
}

// Loaded after the first paint (units pending on the card) and cached for
// the Add drawer.
export function useResitScheduleCourseUnits(enabled = true) {
  return useQuery({
    queryKey: RESIT_SCHEDULING_KEYS.courseUnits(),
    queryFn: getResitScheduleCourseUnits,
    enabled,
  })
}

export function useResitSchedule(resitScheduleGuid: string | null) {
  return useQuery({
    queryKey: RESIT_SCHEDULING_KEYS.exam(resitScheduleGuid ?? ''),
    queryFn: () => getResitSchedule(resitScheduleGuid as string),
    enabled: !!resitScheduleGuid,
    staleTime: 0,
  })
}

export function useCreateResitSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ResitScheduleSaveCommand) => createResitSchedule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.exams() })
      qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.courseUnits() })
    },
  })
}

export function useUpdateResitSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: ResitScheduleSaveCommand }) => updateResitSchedule(guid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.exams() }),
  })
}

export function useResitCtSchedule() {
  return useQuery({ queryKey: RESIT_SCHEDULING_KEYS.ct(), queryFn: getResitCtSchedule })
}

// Refill the form and the card from the response, then reload for the
// lock state.
export function useUpdateResitCtSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ResitCtScheduleSaveCommand) => updateResitCtSchedule(data),
    onSuccess: schedule => {
      qc.setQueryData<ResitCtScheduleResponse>(RESIT_SCHEDULING_KEYS.ct(), prev => prev && { ...prev, schedule })
      qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.ct() })
    },
  })
}

export function useResitCwSchedule() {
  return useQuery({ queryKey: RESIT_SCHEDULING_KEYS.cw(), queryFn: getResitCwSchedule })
}

export function useUpdateResitCwSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ResitCwScheduleSaveCommand) => updateResitCwSchedule(data),
    onSuccess: schedule => {
      qc.setQueryData<ResitCwScheduleResponse>(RESIT_SCHEDULING_KEYS.cw(), prev => prev && { ...prev, schedule })
      qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.cw() })
    },
  })
}
