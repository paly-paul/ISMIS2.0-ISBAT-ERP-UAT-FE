import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getGraduateTranscriptPending,
  generateGraduateTranscripts,
  getHecIntakesDropdown,
  getHecProgramsDropdown,
  getProgramGroupsDropdown,
  getGraduateTranscriptPdf,
  GraduateTranscriptGenerateRequest,
  searchGraduateTranscriptCollection,
  recordGraduateTranscriptCollection,
  RecordCollectionRequest
} from '@/lib/api/assessment/graduateTranscript'

export function useHecIntakesDropdown() {
  return useQuery({
    queryKey: ['hec-intakes-dropdown'],
    queryFn: getHecIntakesDropdown,
    staleTime: Infinity
  })
}

export function useHecProgramsDropdown() {
  return useQuery({
    queryKey: ['hec-programs-dropdown'],
    queryFn: getHecProgramsDropdown,
    staleTime: Infinity
  })
}

export function useProgramGroupsDropdown() {
  return useQuery({
    queryKey: ['program-groups-dropdown'],
    queryFn: getProgramGroupsDropdown,
    staleTime: Infinity
  })
}

export function useGraduateTranscriptPending(academicIntakeGuid: string | null, programGuid?: string | null) {
  return useQuery({
    queryKey: ['graduate-transcript-pending', academicIntakeGuid, programGuid],
    queryFn: () => getGraduateTranscriptPending(academicIntakeGuid!, programGuid || undefined),
    enabled: !!academicIntakeGuid,
    staleTime: 1000 * 60 * 5 // 5 minutes
  })
}

export function useGenerateGraduateTranscripts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: GraduateTranscriptGenerateRequest) => generateGraduateTranscripts(req),
    onSuccess: (data, variables) => {
      // Invalidate the pending list so generated students disappear
      queryClient.invalidateQueries({ queryKey: ['graduate-transcript-pending', variables.academicIntakeGuid] })
    }
  })
}

export function useGraduateTranscriptCollectionSearch(searchTerm: string) {
  return useQuery({
    queryKey: ['graduate-transcript-collection-search', searchTerm],
    queryFn: () => searchGraduateTranscriptCollection(searchTerm),
    enabled: !!searchTerm && searchTerm.length > 2,
  })
}

export function useDownloadGraduateTranscriptPdf() {
  return useMutation({ mutationFn: (transcriptGuid: string) => getGraduateTranscriptPdf(transcriptGuid) })
}

export function useRecordGraduateTranscriptCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: RecordCollectionRequest) => recordGraduateTranscriptCollection(req),
    onSuccess: () => {
      // Invalidate the search results to reflect the updated collection status
      queryClient.invalidateQueries({ queryKey: ['graduate-transcript-collection-search'] })
    }
  })
}
