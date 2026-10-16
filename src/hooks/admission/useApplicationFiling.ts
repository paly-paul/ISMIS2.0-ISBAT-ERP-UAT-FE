import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteQualification,
  exportApplicationsCsv,
  getApplicants,
  getApplicationByGuid,
  getApplicationByPaymentGuid,
  getApplications,
  getFilingApplicationsPage,
  getFilingCountries,
  saveGeneral,
  saveQualification,
  ExportApplicationsCsvParams,
  SaveGeneralInput,
  SaveQualificationInput,
  searchApplicationsForFiling,
  submitApplication,
  uploadPhoto,
} from '@/lib/api/admission/applicationFiling'

const FILING_KEY = ['application-filing']

// Backs /admission/applicants. No staleTime override — same default-fresh
// behavior as the rest of this hook file. search is part of the query key so
// each term's page is cached separately, same convention as useEnquiries.
export function useApplications(page: number, pageSize: number, search = '') {
  return useQuery({
    queryKey: [...FILING_KEY, 'list', page, pageSize, search],
    queryFn: () => getApplications(page, pageSize, search),
  })
}

// Backs /admission/applicants since ADM-027 — every application, any status
// (get-applicants.md). Keeps the current page on screen while the next loads.
export function useApplicants(page: number, pageSize: number, search = '') {
  return useQuery({
    queryKey: [...FILING_KEY, 'applicants', page, pageSize, search],
    queryFn: () => getApplicants(page, pageSize, search),
    placeholderData: keepPreviousData,
  })
}

export function useFilingCountries(search = '') {
  return useQuery({
    queryKey: [...FILING_KEY, 'countries', search],
    queryFn: () => getFilingCountries(search),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Backed by payment-search (see searchApplicationsForFiling's own comment) —
// intentionally unscoped by intake, searches across every intake.
export function useSearchApplicationsForFiling(searchTerm: string, pageNumber: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: [...FILING_KEY, 'search', searchTerm, pageNumber, pageSize],
    queryFn: () => searchApplicationsForFiling(searchTerm, pageNumber, pageSize),
    enabled,
  })
}
// Real server-paginated, scroll-to-load-more variant for the Filing page's
// interactive applicant-search dropdown — same useInfiniteQuery +
// fetch-next-on-scroll mechanism as useSearchCourseUnitsInfinite
// (useCourseUnits.ts) and useSearchStudentsInfinite (usePaymentConsole.ts).
// Backed by GET /api/v1/admissions/application-payments/current-intake,
// which scopes to the current academic intake server-side and matches
// searchTerm against both name and AppRefNo — no client-passed intakeCode
// needed any more (see getApplicationPaymentsCurrentIntake). searchTerm is
// part of the query key, same convention as those two hooks — each typed
// term's pages are cached separately rather than re-filtered client-side.
export function useSearchApplicationsForFilingInfinite(searchTerm: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...FILING_KEY, 'search-infinite', searchTerm, pageSize],
    queryFn: ({ pageParam }) => getFilingApplicationsPage(pageParam, pageSize, searchTerm),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.items.length, 0)
      return fetched < lastPage.totalCount ? allPages.length + 1 : undefined
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Best-effort enrichment for the Filing page's Personal Info prefill — GET
// /application-filling/by-payment/{paymentGuid} only returns data for a
// genuinely COMPLETED application (see getApplicationByPaymentGuid's own
// comment), so this 400s for the common "still mid-filing" case — a
// deterministic business rule. Callers should read `isError` as "nothing
// to enrich with" rather than surfacing it as a hard failure.
export function useApplicationByPaymentGuid(paymentGuid: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...FILING_KEY, 'by-payment', paymentGuid],
    queryFn: () => getApplicationByPaymentGuid(paymentGuid as string),
    enabled: enabled && !!paymentGuid,
  })
}

// Backs All Applicants' View modal. A 400 here means "not completed yet", so
// callers keep showing the list row instead of an error screen.
export function useApplicationByGuid(applicationGuid: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...FILING_KEY, 'by-guid', applicationGuid],
    queryFn: () => getApplicationByGuid(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

export function useSaveGeneral() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveGeneralInput) => saveGeneral(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FILING_KEY }),
  })
}

export function useSaveQualification() {
  return useMutation({
    mutationFn: (input: SaveQualificationInput) => saveQualification(input),
  })
}

export function useDeleteQualification() {
  return useMutation({
    mutationFn: (intApplicationQual: number) => deleteQualification(intApplicationQual),
  })
}

export function useUploadPhoto() {
  return useMutation({
    mutationFn: ({ appRefNo, photo }: { appRefNo: string; photo: File }) => uploadPhoto(appRefNo, photo),
  })
}

export function useSubmitApplication() {
  return useMutation({
    mutationFn: ({ intApplication, appRefNo }: { intApplication: number; appRefNo: string }) => submitApplication(intApplication, appRefNo),
  })
}

// Backs /admission/applicants' Export CSV button. A one-shot file download,
// not cached data, so this is a mutation (matching useSaveQualification's
// own "action, not a query" reasoning) even though the underlying call is a
// GET.
export function useExportApplicationsCsv() {
  return useMutation({
    mutationFn: (params: ExportApplicationsCsvParams = {}) => exportApplicationsCsv(params),
  })
}

export type {
  ApplicantListItem,
  ApplicantStatus,
  ApplicationDetailDto,
  ApplicationListItem,
  CountryDropdownDto,
  ExportApplicationsCsvParams,
  FilingApplicationSearchResult,
  SaveGeneralInput,
  SaveGeneralResponse,
  SaveQualificationInput,
  SaveQualificationResponse,
  SubmitApplicationResponse,
} from '@/lib/api/admission/applicationFiling'
