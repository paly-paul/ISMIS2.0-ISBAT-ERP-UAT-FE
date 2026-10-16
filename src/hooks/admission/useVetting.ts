import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  VetApplicationInput,
  VettingRejectionFilters,
  getVettingApplicationDetail,
  getVettingQueue,
  getVettingRejections,
  vetApplication,
  waitApplication,
} from '@/lib/api/admission/vetting'

const VETTING_QUEUE_KEY = ['vetting-queue']
const VETTING_DETAIL_KEY = ['vetting-detail']
const VETTING_REJECTIONS_KEY = ['vetting-rejections']

export function useVettingQueue(page: number, pageSize: number, filters?: { appRefNo?: string; studentName?: string }) {
  return useQuery({
    queryKey: [...VETTING_QUEUE_KEY, page, pageSize, filters?.appRefNo ?? '', filters?.studentName ?? ''],
    queryFn: () => getVettingQueue(page, pageSize, filters),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Rejections tab — each filter combination is cached separately.
export function useVettingRejections(page: number, pageSize: number, filters: VettingRejectionFilters, enabled = true) {
  return useQuery({
    queryKey: [...VETTING_REJECTIONS_KEY, page, pageSize, filters.search ?? '', filters.intakeGuid ?? '', filters.campusGuid ?? '', filters.programGuid ?? ''],
    queryFn: () => getVettingRejections(page, pageSize, filters),
    enabled,
  })
}

// Fetches full review detail (documents/qualifications) for one application.
// Only enabled while the review modal is actually open with a guid, same
// fetch-by-guid convention as the rest of the app.
export function useVettingApplicationDetail(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...VETTING_DETAIL_KEY, applicationGuid],
    queryFn: () => getVettingApplicationDetail(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

// Wait sets action=0, dropping the application out of the Submitted-only
// (action==1) vetting queue — invalidate both the list and this one
// application's detail cache.
export function useWaitApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationGuid, remarks }: { applicationGuid: string; remarks?: string | null }) =>
      waitApplication(applicationGuid, remarks),
    onSuccess: (_data, { applicationGuid }) => {
      queryClient.invalidateQueries({ queryKey: VETTING_QUEUE_KEY })
      queryClient.invalidateQueries({ queryKey: [...VETTING_DETAIL_KEY, applicationGuid] })
    },
  })
}

// Approve/Reject — also terminal, same invalidation as Wait, plus the
// Rejections list (a reject adds a row to it).
export function useVetApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationGuid, input }: { applicationGuid: string; input: VetApplicationInput }) =>
      vetApplication(applicationGuid, input),
    onSuccess: (_data, { applicationGuid }) => {
      queryClient.invalidateQueries({ queryKey: VETTING_QUEUE_KEY })
      queryClient.invalidateQueries({ queryKey: [...VETTING_DETAIL_KEY, applicationGuid] })
      queryClient.invalidateQueries({ queryKey: VETTING_REJECTIONS_KEY })
    },
  })
}

export type { VettingApplicationDetail, VettingDocument, VettingQualification, VettingQueueItem, VetApplicationInput, VettingRejectionItem, VettingRejectionFilters } from '@/lib/api/admission/vetting'
