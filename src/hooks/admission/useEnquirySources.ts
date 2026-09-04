import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEnquirySource, deleteEnquirySource, EnquirySource, EnquirySourceInput, getEnquirySourceById, getEnquirySources, updateEnquirySource } from '@/lib/api/admission/enquirySource'

const ENQUIRY_SOURCES_KEY = ['enquiry-sources']

export function useEnquirySources() {
  return useQuery({
    queryKey: ENQUIRY_SOURCES_KEY,
    queryFn: () => getEnquirySources(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateEnquirySource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EnquirySourceInput) => createEnquirySource(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENQUIRY_SOURCES_KEY }),
  })
}

// Fetches a single enquiry source for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the enquiry source table.
export function useEnquirySource(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ENQUIRY_SOURCES_KEY, guid],
    queryFn: () => getEnquirySourceById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateEnquirySource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: EnquirySourceInput }) => updateEnquirySource(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: ENQUIRY_SOURCES_KEY })
      queryClient.invalidateQueries({ queryKey: [...ENQUIRY_SOURCES_KEY, guid] })
    },
  })
}

export function useDeleteEnquirySource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteEnquirySource(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENQUIRY_SOURCES_KEY }),
  })
}

export type { EnquirySource, EnquirySourceInput }
