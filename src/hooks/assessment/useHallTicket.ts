import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getHallTicketEligibility,
  getHallTicketScopeStudents,
  issueBulkHallTickets,
  issueHallTicket,
  HallTicketIssueStatus,
  HallTicketScope,
  HallTicketTerm,
} from '@/lib/api/assessment/hallTicketIssue'
import { getHallTicketSearch } from '@/lib/api/student/hallTicketSearch'

const HALL_TICKET_KEY = ['hall-ticket']

// Empty term short-circuits to [] server-side, so don't even send it.
export function useHallTicketSearch(searchTerm: string, intakeGuid: string | null) {
  return useQuery({
    queryKey: [...HALL_TICKET_KEY, 'search', searchTerm, intakeGuid],
    queryFn: () => getHallTicketSearch(searchTerm, intakeGuid as string).then(d => d ?? []),
    enabled: !!intakeGuid && !!searchTerm.trim(),
    placeholderData: prev => prev,
  })
}

// staleTime 0 — clearances (fee, coursework…) move outside this page.
export function useHallTicketEligibility(studentGuid: string | null, intakeGuid: string | null, term: HallTicketTerm) {
  return useQuery({
    queryKey: [...HALL_TICKET_KEY, 'eligibility', studentGuid, intakeGuid, term],
    queryFn: () => getHallTicketEligibility(studentGuid as string, intakeGuid as string, term),
    enabled: !!studentGuid && !!intakeGuid,
    staleTime: 0,
  })
}

// GET /bulk — every student in the scope with Issued/NotIssued. Unpaged,
// can be a whole intake, so only enabled once the page asks for it.
export function useHallTicketScopeStudents(scope: HallTicketScope | null, status: HallTicketIssueStatus | null, enabled = true) {
  return useQuery({
    queryKey: [...HALL_TICKET_KEY, 'scope', scope, status],
    queryFn: () => getHallTicketScopeStudents(scope as HallTicketScope, status),
    enabled: enabled && !!scope?.intakeGuid,
    staleTime: 0,
  })
}

// Every issue changes some student's status/eligibility — invalidate the
// whole family rather than track which scope they sit in.
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [...HALL_TICKET_KEY, 'eligibility'] })
  queryClient.invalidateQueries({ queryKey: [...HALL_TICKET_KEY, 'scope'] })
}

export function useIssueHallTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: issueHallTicket,
    onSuccess: () => invalidateAll(queryClient),
  })
}

export function useBulkIssueHallTickets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: issueBulkHallTickets,
    onSuccess: () => invalidateAll(queryClient),
  })
}

export type { HallTicketEligibilityDto, HallTicketScopeStudentDto, HallTicketIssueStatus, HallTicketScope, HallTicketTerm, BulkIssueResponseDto } from '@/lib/api/assessment/hallTicketIssue'
