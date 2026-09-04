import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RegisterStudentInput,
  RegistrarDeskQueueFilters,
  getRegistrarDeskApplications,
  getRegistrarDeskCounts,
  getRegistrationDetail,
  registerStudent,
} from '@/lib/api/admission/registrarDesk'
import { getRegistrationTypes } from '@/lib/api/admission/registrationType'

const REGISTRAR_QUEUE_KEY = ['registrar-desk-queue']
const REGISTRAR_COUNTS_KEY = ['registrar-desk-counts']
const REGISTRAR_DETAIL_KEY = ['registrar-desk-detail']
const REGISTRATION_TYPES_KEY = ['registration-types']

export function useRegistrarDeskApplications(page: number, pageSize: number, filters?: RegistrarDeskQueueFilters) {
  return useQuery({
    queryKey: [...REGISTRAR_QUEUE_KEY, page, pageSize, filters?.studentName ?? '', filters?.intakeGuid ?? '', filters?.status ?? null],
    queryFn: () => getRegistrarDeskApplications(page, pageSize, filters),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Summary tile counts — independent of whatever filters are applied to the
// search grid, per registrar-desk-api-docs.html.
export function useRegistrarDeskCounts() {
  return useQuery({
    queryKey: REGISTRAR_COUNTS_KEY,
    queryFn: () => getRegistrarDeskCounts(),
  })
}

// Fetches full registration detail (fee lines, readiness flags) for one
// application. Only enabled while the Complete Registration modal is
// actually open with a guid, same fetch-by-guid convention as the rest of
// the app's real Edit/Review modals.
export function useRegistrationDetail(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REGISTRAR_DETAIL_KEY, applicationGuid],
    queryFn: () => getRegistrationDetail(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

// Dropdown source for registrationTypeId — small, static-ish lookup, same
// staleTime:Infinity convention as the app's other little master lists.
export function useRegistrationTypes() {
  return useQuery({
    queryKey: REGISTRATION_TYPES_KEY,
    queryFn: () => getRegistrationTypes(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// On success the application flips to Registered server-side — invalidate
// the queue (it drops out of the RegistrarVetted-only list) and the counts
// tile alongside this one application's own detail cache.
export function useRegisterStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationGuid, input }: { applicationGuid: string; input: RegisterStudentInput }) =>
      registerStudent(applicationGuid, input),
    onSuccess: (_data, { applicationGuid }) => {
      queryClient.invalidateQueries({ queryKey: REGISTRAR_QUEUE_KEY })
      queryClient.invalidateQueries({ queryKey: REGISTRAR_COUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: [...REGISTRAR_DETAIL_KEY, applicationGuid] })
    },
  })
}

export type {
  RegistrarDeskQueueItem,
  RegistrarDeskQueueFilters,
  RegistrarDeskCounts,
  RegistrationDetail,
  RegistrationFeeLine,
  RegisterStudentInput,
  RegisterStudentResponse,
} from '@/lib/api/admission/registrarDesk'
export type { RegistrationType } from '@/lib/api/admission/registrationType'
