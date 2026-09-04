import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignSponsorCategory,
  createSponsorCategory,
  deleteSponsorCategory,
  getSponsorCategories,
  getSponsorDetails,
  SponsorCategoryRequest,
  updateSponsorCategory,
} from '@/lib/api/student/sponsor'

const SPONSOR_CATEGORIES_KEY = ['sponsor-categories']
const SPONSOR_DETAILS_KEY = ['sponsor-details']

export function useSponsorCategories() {
  return useQuery({
    queryKey: SPONSOR_CATEGORIES_KEY,
    queryFn: () => getSponsorCategories(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateSponsorCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SponsorCategoryRequest) => createSponsorCategory(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPONSOR_CATEGORIES_KEY }),
  })
}

export function useUpdateSponsorCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, payload }: { guid: string; payload: SponsorCategoryRequest }) => updateSponsorCategory(guid, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPONSOR_CATEGORIES_KEY }),
  })
}

export function useDeleteSponsorCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteSponsorCategory(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPONSOR_CATEGORIES_KEY }),
  })
}

// Only enabled once a student is actually loaded, same convention as
// useStudent's profile-modal gating. retry: false — a real 401 here means
// "this campus isn't authorized to view this student's sponsor" (confirmed
// live 2026-08-25, despite the docs saying no fine-grained permission
// exists), which retrying won't fix; callers should check `error` to tell
// that apart from "no assignment yet" (which resolves to `data: null`, not
// an error — see getSponsorDetails).
export function useSponsorDetails(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...SPONSOR_DETAILS_KEY, studentGuid],
    queryFn: () => getSponsorDetails(studentGuid as string),
    enabled: enabled && !!studentGuid,
    retry: false,
  })
}

export function useAssignSponsorCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, sponsorCategoryGuid }: { studentGuid: string; sponsorCategoryGuid: string }) =>
      assignSponsorCategory(studentGuid, sponsorCategoryGuid),
    onSuccess: (_data, { studentGuid }) => queryClient.invalidateQueries({ queryKey: [...SPONSOR_DETAILS_KEY, studentGuid] }),
  })
}

export { isMandatoryFeeCheck } from '@/lib/api/student/sponsor'
export type { SponsorCategoryDto, SponsorDetailsDto, SponsorCategoryRequest, PagedResult } from '@/lib/api/student/sponsor'
