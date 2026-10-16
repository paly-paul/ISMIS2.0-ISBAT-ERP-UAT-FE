import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { getSemestersForProgram, getSemestersBySemCode, SemesterOption, SemesterBySemCode } from '@/lib/api/academic/semester'

// Scoped to a specific program — only enabled once a program is selected.
export function useSemestersForProgram(programGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['semesters', 'forProgram', programGuid],
    queryFn: () => getSemestersForProgram(programGuid as string),
    enabled: enabled && !!programGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// No endpoint lists which semCodes exist, so codes 1..MAX_SEM_CODE are each
// probed via by-semcode; a code with no rows is dropped from the options.
// Label comes from the rows' own semName (e.g. "Year One - Semester One").
const MAX_SEM_CODE = 10

export interface SemCodeGroup {
  semCode: string
  semName: string
  semesters: SemesterBySemCode[]
}

export function useSemesterCodeGroups(enabled = true) {
  const results = useQueries({
    queries: Array.from({ length: MAX_SEM_CODE }, (_, i) => String(i + 1)).map(semCode => ({
      queryKey: ['semesters', 'bySemCode', semCode],
      queryFn: () => getSemestersBySemCode(semCode),
      enabled,
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })

  return useMemo(() => {
    const groups: SemCodeGroup[] = []
    results.forEach((r, i) => {
      const rows = r.data ?? []
      if (rows.length > 0) groups.push({ semCode: String(i + 1), semName: rows[0].semName?.trim() || `Semester ${i + 1}`, semesters: rows })
    })
    return { groups, isLoading: results.some(r => r.isLoading) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])
}

export type { SemesterOption, SemesterBySemCode }
