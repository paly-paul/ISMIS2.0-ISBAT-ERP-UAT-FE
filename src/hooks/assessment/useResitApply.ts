import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getResitEligibleStudents,
  getResitDropdownUnits,
  getResitCheckboxState,
  getResitAppliedUnits,
  submitResitApplication,
  getResitApplicationForEdit,
  deleteResitApplication,
  SubmitResitApplicationCommand
} from '@/lib/api/assessment/resitApply'

export function useResitEligibleStudents(params?: { page?: number; pageSize?: number; search?: string }) {
  return useQuery({
    queryKey: ['resit-eligible-students', params],
    queryFn: () => getResitEligibleStudents(params)
  })
}

export function useResitDropdownUnits(studentGuid: string | null) {
  return useQuery({
    queryKey: ['resit-dropdown', studentGuid],
    queryFn: () => getResitDropdownUnits(studentGuid!),
    enabled: !!studentGuid
  })
}

export function useResitCheckboxState(studentGuid: string | null, courseUnitGuid: string | null) {
  return useQuery({
    queryKey: ['resit-checkbox-state', studentGuid, courseUnitGuid],
    queryFn: () => getResitCheckboxState(studentGuid!, courseUnitGuid!),
    enabled: !!studentGuid && !!courseUnitGuid
  })
}

export function useResitAppliedUnits(studentGuid: string | null) {
  return useQuery({
    queryKey: ['resit-applied-units', studentGuid],
    queryFn: () => getResitAppliedUnits(studentGuid!),
    enabled: !!studentGuid
  })
}

export function useResitApplicationForEdit(resitApplicationGuid: string | null) {
  return useQuery({
    queryKey: ['resit-app-edit', resitApplicationGuid],
    queryFn: () => getResitApplicationForEdit(resitApplicationGuid!),
    enabled: !!resitApplicationGuid
  })
}

export function useSubmitResitApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, data }: { studentGuid: string; data: SubmitResitApplicationCommand }) => submitResitApplication(studentGuid, data),
    onSuccess: (_, { studentGuid }) => {
      qc.invalidateQueries({ queryKey: ['resit-applied-units', studentGuid] })
      qc.invalidateQueries({ queryKey: ['resit-dropdown', studentGuid] })
    }
  })
}

// Always 200 — `deleted: false` also means the grid is stale (already deleted
// or paid meanwhile), so both outcomes reload the grid; a real delete also
// puts the unit back in the dropdown.
export function useDeleteResitApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ resitApplicationGuid }: { resitApplicationGuid: string; studentGuid: string }) => deleteResitApplication(resitApplicationGuid),
    onSuccess: (res, { studentGuid }) => {
      qc.invalidateQueries({ queryKey: ['resit-applied-units', studentGuid] })
      if (res.deleted) qc.invalidateQueries({ queryKey: ['resit-dropdown', studentGuid] })
    }
  })
}
