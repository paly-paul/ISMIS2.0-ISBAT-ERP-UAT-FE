import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTerminationReason,
  deleteTerminationReason,
  getTerminationReasonByGuid,
  getTerminationReasons,
  getTerminationReasonsDropdown,
  updateTerminationReason,
  TerminationReasonInput,
} from '@/lib/api/student/terminationReason'

const TERMINATION_REASONS_KEY = ['termination-reasons']

// Termination Reason Master's own table — real server-side pagination/search
// (get-termination-reasons.md), same keepPreviousData convention as the
// other paged master tables in this app so the page number doesn't flash
// empty between fetches.
export function useTerminationReasons(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: [...TERMINATION_REASONS_KEY, 'list', page, pageSize, search],
    queryFn: () => getTerminationReasons(page, pageSize, search),
    placeholderData: keepPreviousData,
  })
}

// Unpaged picker — backs the reason select on the Terminate Student screen,
// not this master page's own table.
export function useTerminationReasonsDropdown(search = '', enabled = true) {
  return useQuery({
    queryKey: [...TERMINATION_REASONS_KEY, 'dropdown', search],
    queryFn: () => getTerminationReasonsDropdown(search),
    staleTime: 60 * 1000,
    enabled,
  })
}

export function useTerminationReason(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...TERMINATION_REASONS_KEY, guid],
    queryFn: () => getTerminationReasonByGuid(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateTerminationReason() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TerminationReasonInput) => createTerminationReason(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TERMINATION_REASONS_KEY }),
  })
}

export function useUpdateTerminationReason() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: TerminationReasonInput }) => updateTerminationReason(guid, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TERMINATION_REASONS_KEY }),
  })
}

export function useDeleteTerminationReason() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteTerminationReason(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TERMINATION_REASONS_KEY }),
  })
}

export type { TerminationReasonDto, TerminationReasonInput, TerminationReasonListItemDto } from '@/lib/api/student/terminationReason'
