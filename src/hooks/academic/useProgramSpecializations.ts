import { useQuery } from '@tanstack/react-query'
import { getSpecializationsForProgram, Stream } from '@/lib/api/academic/stream'

// Scoped to one programme — backs Programme Master's Home Page
// "Specialization" three-dot action (see Program_Master_Change_Requests_Final.md).
// Only enabled while that modal is actually open with a guid.
export function useProgramSpecializations(programGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['programSpecializations', programGuid],
    queryFn: () => getSpecializationsForProgram(programGuid as string),
    enabled: enabled && !!programGuid,
  })
}

export type { Stream }
