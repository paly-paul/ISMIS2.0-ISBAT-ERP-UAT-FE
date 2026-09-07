import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteQualification,
  exportApplicationsCsv,
  getApplications,
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
// behavior as the rest of this hook file.
export function useApplications(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...FILING_KEY, 'list', page, pageSize],
    queryFn: () => getApplications(page, pageSize),
  })
}

export function useFilingCountries() {
  return useQuery({
    queryKey: [...FILING_KEY, 'countries'],
    queryFn: () => getFilingCountries(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// intakeCode scopes the fetch to one intake (see the note on
// searchApplicationsForFiling) — pass the current academic intake's code so
// this doesn't pull every intake's applications at once.
export function useSearchApplicationsForFiling(searchTerm: string, pageNumber: number, pageSize: number, enabled: boolean, intakeCode?: number | string) {
  return useQuery({
    queryKey: [...FILING_KEY, 'search', searchTerm, pageNumber, pageSize, intakeCode ?? ''],
    queryFn: () => searchApplicationsForFiling(searchTerm, pageNumber, pageSize, intakeCode),
    enabled,
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
