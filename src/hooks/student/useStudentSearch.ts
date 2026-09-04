import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { StudentSearchFilters, searchStudentsAdvanced } from '@/lib/api/student/studentSearch'

const STUDENT_SEARCH_KEY = ['student-search']

// Only enabled while at least one advanced filter (beyond paging) is set —
// callers should fall back to the plain useStudents()/GET-students query
// otherwise, since that's the documented "thin single-term variant" for the
// common case.
export function useStudentSearchAdvanced(filters: StudentSearchFilters, enabled: boolean) {
  return useQuery({
    queryKey: [...STUDENT_SEARCH_KEY, filters],
    queryFn: () => searchStudentsAdvanced(filters),
    enabled,
  })
}

export function useStudentSearchAdvancedInfinite(filters: StudentSearchFilters, pageSize: number) {
  return useInfiniteQuery({
    queryKey: [...STUDENT_SEARCH_KEY, 'infinite', pageSize, filters],
    queryFn: ({ pageParam }) => searchStudentsAdvanced({ ...filters, pageNumber: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.items.length, 0)
      return fetched < lastPage.totalCount ? allPages.length + 1 : undefined
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export type { StudentSearchFilters } from '@/lib/api/student/studentSearch'
