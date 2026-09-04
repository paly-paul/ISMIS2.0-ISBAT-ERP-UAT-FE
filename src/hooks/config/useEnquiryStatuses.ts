import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEnquiryStatus, deleteEnquiryStatus, EnquiryStatus, EnquiryStatusInput, getEnquiryStatusById, getEnquiryStatuses, updateEnquiryStatus } from '@/lib/api/academic/enquiryStatus'

const ENQUIRY_STATUSES_KEY = ['enquiry-statuses']

export function useEnquiryStatuses() {
  return useQuery({
    queryKey: ENQUIRY_STATUSES_KEY,
    queryFn: () => getEnquiryStatuses(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateEnquiryStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EnquiryStatusInput) => createEnquiryStatus(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENQUIRY_STATUSES_KEY }),
  })
}

// Fetches a single enquiry status for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the enquiry status table.
export function useEnquiryStatus(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ENQUIRY_STATUSES_KEY, guid],
    queryFn: () => getEnquiryStatusById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateEnquiryStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: EnquiryStatusInput }) => updateEnquiryStatus(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: ENQUIRY_STATUSES_KEY })
      queryClient.invalidateQueries({ queryKey: [...ENQUIRY_STATUSES_KEY, guid] })
    },
  })
}

export function useDeleteEnquiryStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteEnquiryStatus(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENQUIRY_STATUSES_KEY }),
  })
}

export type { EnquiryStatus, EnquiryStatusInput }
