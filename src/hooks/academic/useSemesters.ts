import { useQuery } from '@tanstack/react-query'
import { getSemestersForProgram, SemesterOption } from '@/lib/api/academic/semester'

// Scoped to a specific program — only enabled once a program is selected.
export function useSemestersForProgram(programGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['semesters', 'forProgram', programGuid],
    queryFn: () => getSemestersForProgram(programGuid as string),
    enabled: enabled && !!programGuid,
  })
}

export type { SemesterOption }
