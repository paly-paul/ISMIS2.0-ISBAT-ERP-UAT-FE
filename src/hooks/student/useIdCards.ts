import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getIdCardDetails,
  issueOrRenewIdCard,
  IssueOrRenewIdCardRequest,
  updateIdCardDates,
  UpdateIdCardDatesRequest,
} from '@/lib/api/student/idCards'

const ID_CARD_KEY = ['id-card']

// Only enabled once a student is actually loaded, same convention as
// useStudent's profile-modal gating.
export function useIdCard(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ID_CARD_KEY, studentGuid],
    queryFn: () => getIdCardDetails(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useIssueOrRenewIdCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: IssueOrRenewIdCardRequest) => issueOrRenewIdCard(payload),
    onSuccess: (_data, payload) => queryClient.invalidateQueries({ queryKey: [...ID_CARD_KEY, payload.studentGuid] }),
  })
}

export function useUpdateIdCardDates(studentGuid: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cardIssueId, payload }: { cardIssueId: string; payload: UpdateIdCardDatesRequest }) =>
      updateIdCardDates(cardIssueId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ID_CARD_KEY, studentGuid] }),
  })
}

export { getIdCardQrImageUrl, currentCardIssue } from '@/lib/api/student/idCards'
export type { IdCardDetailsDto, IdCardHistoryEntry, IssueOrRenewIdCardRequest, UpdateIdCardDatesRequest } from '@/lib/api/student/idCards'
