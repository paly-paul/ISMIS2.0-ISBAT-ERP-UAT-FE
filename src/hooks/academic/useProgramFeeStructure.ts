import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

const PROGRAM_FEE_STRUCTURES_KEY = ['programFeeStructures']

// Backs the standalone /academic/fee-structure page's main table — real now
// (see the note on getProgramFeeStructures). Loaded at a large pageSize and
// paginated/searched client-side, same "load it all once" convention as
// batch-management/employee-master, rather than a second server round-trip
// per page click.
export function useProgramFeeStructures(pageNumber = 1, pageSize = 1000, programGuid?: string) {
  return useQuery({
    queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, pageNumber, pageSize, programGuid ?? null],
    queryFn: () => getProgramFeeStructures(pageNumber, pageSize, programGuid),
  })
}

// Server-side search for Fee Structure's search box — hits the same list
// endpoint with the backend's own ?search= param instead of filtering the
// already-fetched full list client-side. Kept as its own hook/query key so
// useProgramFeeStructures() above still stays the plain unfiltered, cached
// list — only enabled while the search box actually has a query in it, at
// which point the page falls back to that shared unfiltered list instead of
// issuing a redundant identical request. Not confirmed against a spec (see
// the note on getProgramFeeStructures), so the caller re-filters client-side
// too.
export function useProgramFeeStructureSearch(search: string, pageSize: number) {
  const q = search.trim()
  return useQuery({
    queryKey: [...PROGRAM_FEE_STRUCTURES_KEY, 'search', q],
    queryFn: () => getProgramFeeStructures(1, pageSize, undefined, q),
    enabled: q.length > 0,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_FEE_STRUCTURES_KEY }),
  })
}

export function useUpdateProgramFeeStructureComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ feeHdGuid, input }: { feeHdGuid: string; input: ProgramFeeStructureUpdateInput }) => updateProgramFeeStructureComplete(feeHdGuid, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_FEE_STRUCTURES_KEY }),
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
