import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEnquirySourceMaster, deleteEnquirySourceMaster, EnquirySourceMaster, EnquirySourceMasterInput, getEnquirySourceMasterById, getEnquirySourceMasters, updateEnquirySourceMaster } from '@/lib/api/admission/enquirySourceMaster'

const ENQUIRY_SOURCE_MASTERS_KEY = ['enquiry-source-masters']

export function useEnquirySourceMasters() {
  return useQuery({
    queryKey: ENQUIRY_SOURCE_MASTERS_KEY,
    queryFn: () => getEnquirySourceMasters(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateEnquirySourceMaster() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EnquirySourceMasterInput) => createEnquirySourceMaster(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENQUIRY_SOURCE_MASTERS_KEY }),
  })
}

// Fetches a single enquiry source for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the enquiry source table.
export function useEnquirySourceMaster(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ENQUIRY_SOURCE_MASTERS_KEY, guid],
    queryFn: () => getEnquirySourceMasterById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateEnquirySourceMaster() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: EnquirySourceMasterInput }) => updateEnquirySourceMaster(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: ENQUIRY_SOURCE_MASTERS_KEY })
      queryClient.invalidateQueries({ queryKey: [...ENQUIRY_SOURCE_MASTERS_KEY, guid] })
    },
  })
}

export function useDeleteEnquirySourceMaster() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteEnquirySourceMaster(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENQUIRY_SOURCE_MASTERS_KEY }),
  })
}

export type { EnquirySourceMaster, EnquirySourceMasterInput }
