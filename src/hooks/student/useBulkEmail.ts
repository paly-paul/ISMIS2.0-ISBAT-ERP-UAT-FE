import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BulkEmailListParams,
  BulkEmailRecipientParams,
  SendBulkEmailInput,
  getBulkEmail,
  getBulkEmailRecipients,
  getBulkEmails,
  isJobActive,
  searchBulkEmailStudents,
  sendBulkEmail,
} from '@/lib/api/student/bulkEmail'
import { StudentSearchFilters } from '@/lib/api/student/studentSearch'

const BULK_EMAIL_KEY = ['bulk-email']

// Re-fetch every 5 s while a job is still running. react-query's default
// refetchIntervalInBackground: false already pauses this while the browser
// tab is hidden, and the query stops polling when the page unmounts. Any
// failed poll (403, 404, 5xx) stops it for good — state.data still holds
// the last "running" snapshot after an error, so checking data alone would
// keep re-sending a request the server already refused.
export const BULK_EMAIL_POLL_MS = 5000

// List: polls while any visible row is Draft/Resolving/Processing. Rows are
// updated in place (previous data is kept between fetches, so no loader
// flash when a filter or page changes).
export function useBulkEmails(params: BulkEmailListParams) {
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, 'list', params],
    queryFn: () => getBulkEmails(params),
    placeholderData: keepPreviousData,
    refetchInterval: query => (query.state.status !== 'error' && query.state.data?.items.some(j => isJobActive(j.status)) ? BULK_EMAIL_POLL_MS : false),
  })
}

export function useBulkEmail(jobGuid: string | null) {
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, 'detail', jobGuid],
    queryFn: () => getBulkEmail(jobGuid as string),
    enabled: !!jobGuid,
    refetchInterval: query => (query.state.status !== 'error' && isJobActive(query.state.data?.status) ? BULK_EMAIL_POLL_MS : false),
  })
}

// Recipients poll on the same cadence as their job — the caller passes
// whether the job is still running.
export function useBulkEmailRecipients(jobGuid: string | null, params: BulkEmailRecipientParams, jobActive: boolean) {
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, 'recipients', jobGuid, params],
    queryFn: () => getBulkEmailRecipients(jobGuid as string, params),
    enabled: !!jobGuid,
    placeholderData: keepPreviousData,
    refetchInterval: query => (jobActive && query.state.status !== 'error' ? BULK_EMAIL_POLL_MS : false),
  })
}

export function useSendBulkEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SendBulkEmailInput) => sendBulkEmail(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...BULK_EMAIL_KEY, 'list'] }),
  })
}

// Invalidate one job's recipients — used for the final fetch once the job
// reaches a terminal status, so the table matches the final counters.
export function useRefreshBulkEmailRecipients() {
  const queryClient = useQueryClient()
  return (jobGuid: string) => queryClient.invalidateQueries({ queryKey: [...BULK_EMAIL_KEY, 'recipients', jobGuid] })
}

export function useBulkEmailStudentSearch(filters: StudentSearchFilters, enabled = true) {
  return useQuery({
    queryKey: [...BULK_EMAIL_KEY, 'students', filters],
    queryFn: () => searchBulkEmailStudents(filters),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export {
  JOB_STATUSES,
  RECIPIENT_STATUSES,
  MAX_RECIPIENTS,
  MAX_SUBJECT_LENGTH,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MIME_TYPES,
  isJobActive,
  searchBulkEmailStudents,
} from '@/lib/api/student/bulkEmail'
export type {
  BulkEmailJobStatus,
  BulkEmailRecipientStatus,
  BulkEmailJobDto,
  BulkEmailJobDetailDto,
  BulkEmailRecipientDto,
  BulkEmailListParams,
  StudentSearchResultDto,
} from '@/lib/api/student/bulkEmail'
