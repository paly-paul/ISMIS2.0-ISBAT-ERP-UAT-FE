import { useQuery } from '@tanstack/react-query'
import { getStudentStatement, searchStudentStatement, StudentStatementSearchFilters, getStudentFeeSummary } from '@/lib/api/student/studentStatement'

// Search-as-you-type box, same "browse all on an empty box" behavior as the
// Finance Payment Console's own student search (PaymentConsoleStudentSearch
// .bru's "omit searchTerm to browse all", confirmed the same way here per
// students/student-statement/search-student-statement.md — all filters are
// optional and an empty studentName sends no filter at all, see
// searchStudentStatement). Always enabled (no minChars gate on the query
// itself) so clicking into the empty box — TableSearch's minChars={0} below
// — opens the dropdown with a result list already in it, rather than an
// empty state until the first keystroke.
import { useInfiniteQuery } from '@tanstack/react-query'

export function useStudentStatementSearch(term: string) {
  const trimmed = term.trim()
  return useInfiniteQuery({
    queryKey: ['student-statement-search', trimmed],
    queryFn: ({ pageParam = 1 }) => searchStudentStatement({ studentName: trimmed }, pageParam, 15),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize
      return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined
    },
  })
}

export function useStudentStatement(studentGuid: string | null) {
  return useQuery({
    queryKey: ['student-statement', studentGuid],
    queryFn: () => getStudentStatement(studentGuid as string),
    enabled: !!studentGuid,
    retry: false,
  })
}

export function useStudentFeeSummary(studentGuid: string | null) {
  return useQuery({
    queryKey: ['student-fee-summary', studentGuid],
    queryFn: () => getStudentFeeSummary(studentGuid as string),
    enabled: !!studentGuid,
    retry: false,
  })
}

export type { StudentStatementSearchFilters }
export type {
  StudentStatementDto,
  StudentStatementHeaderDto,
  StudentStatementPaymentDto,
  StudentStatementOutstandingDto,
  StudentStatementSearchResultDto,
} from '@/lib/api/student/studentStatement'
