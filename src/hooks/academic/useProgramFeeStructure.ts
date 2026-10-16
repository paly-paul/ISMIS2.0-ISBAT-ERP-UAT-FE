import { useInfiniteQuery, useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  getProgramFeeStructures,
  getProgramFeeLines,
  saveProgramFeeStructureComplete,
  updateProgramFeeStructureComplete,
  ProgramFeeStructureHeader,
  ProgramFeeStructureHeaderInput,
  ProgramFeeLineSaveInput,
  ProgramFeeLineDetail,
  ProgramFeeStructureSaveCompleteInput,
  ProgramFeeStructureUpdateInput,
} from '@/lib/api/academic/programFeeStructure'
import { PROGRAM_MASTERS_KEY } from './useProgramMaster'
import { getNextPageParam } from '@/lib/pagination'

const PROGRAM_FEE_STRUCTURES_KEY = ['programFeeStructures']

// Full/large-page fetch — still used by every OTHER consumer of this list
// that genuinely needs it all in memory at once (FeeStructureModal's own
// "Copy Fee Code" source list across every programme, Admission Filing/
// Payment/Payment Refund's cross-reference lookups), unlike the standalone
// /academic/fee-structure page's own table, which now uses
// useProgramFeeStructuresPaged below instead of paginating this client-side.
export function useProgramFeeStructures(pageNumber = 1, pageSize = 1000, programGuid?: string, enabled = true) {
  return useQuery({
    queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, pageNumber, pageSize, programGuid ?? null],
    queryFn: () => getProgramFeeStructures(pageNumber, pageSize, programGuid),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Real server-side pagination (2026-09-10) for the standalone
// /academic/fee-structure page's own table — replaces the
// useProgramFeeStructures(1, 1000)/useProgramFeeStructureSearch() pair (a
// full 1000-row fetch + a separate page-1-only search query, paginated
// client-side) with one hook, same consolidation Programme Master/Batches/
// Lecturer Skills already went through. getProgramFeeStructures is already
// confirmed to genuinely support pageNumber/pageSize/search together with a
// real totalCount envelope — see its own comment.
export function useProgramFeeStructuresPaged(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, 'paged', page, pageSize, search],
    queryFn: () => getProgramFeeStructures(page, pageSize, undefined, search),
    placeholderData: keepPreviousData,
  })
}

export function useSearchProgramFeeStructuresInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getProgramFeeStructures(pageParam, pageSize, undefined, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Fetch-by-guid convention, same as the rest of the app's real Edit modals —
// backs FeeStructureModal's Edit mode prefill. The header fields (feeCode,
// calcType, lef/cef/ace, intakeGuid, etc.) come from the list row the page
// already has, not from this endpoint — GET fee-lines only ever returns the
// line items themselves.
export function useProgramFeeLines(feeHdGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, 'feeLines', feeHdGuid],
    queryFn: () => getProgramFeeLines(feeHdGuid as string),
    enabled: enabled && !!feeHdGuid,
  })
}

export function useSaveProgramFeeStructureComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramFeeStructureSaveCompleteInput) => saveProgramFeeStructureComplete(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, 'paged'] })
    },
  })
}

export function useUpdateProgramFeeStructureComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ feeHdGuid, input }: { feeHdGuid: string; input: ProgramFeeStructureUpdateInput }) => updateProgramFeeStructureComplete(feeHdGuid, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, 'paged'] })
    },
  })
}

export type {
  ProgramFeeStructureHeader,
  ProgramFeeStructureHeaderInput,
  ProgramFeeLineSaveInput,
  ProgramFeeLineDetail,
  ProgramFeeStructureSaveCompleteInput,
  ProgramFeeStructureUpdateInput,
}
