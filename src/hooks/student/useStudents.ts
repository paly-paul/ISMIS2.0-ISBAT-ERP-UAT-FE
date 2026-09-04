import { useMemo } from 'react'
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { StudentDto, StudentListFilters, StudentColumnFilters, getStudentByGuid, getStudents, getStudentsFilter } from '@/lib/api/student/student'

const STUDENTS_LIST_KEY = ['students-list']
const STUDENT_DETAIL_KEY = ['student-detail']

export function useStudents(page: number, pageSize: number, filters?: StudentListFilters) {
  return useQuery({
    queryKey: [...STUDENTS_LIST_KEY, page, pageSize, filters?.searchTerm ?? ''],
    queryFn: () => getStudents(page, pageSize, filters),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Backs Student Master's Programme/Semester/Batch column filters (GET
// /api/v1/students/filter, get-students-filter.md) — a separate query from
// useStudents above since it hits a different endpoint with a different
// filter shape (guids, not just free text), rather than overloading one
// hook to cover both. `enabled` lets the page skip this one entirely while
// useStudentsFilterMulti below is the active path instead.
export function useStudentsFilter(page: number, pageSize: number, filters: StudentColumnFilters, enabled = true) {
  return useQuery({
    queryKey: [...STUDENTS_LIST_KEY, 'filter', page, pageSize, filters.programGuid ?? '', filters.semesterGuid ?? '', filters.batchGuid ?? '', filters.searchTerm ?? ''],
    queryFn: () => getStudentsFilter(page, pageSize, filters),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Multi-select column filters, layered on top of the single-guid-per-field
// endpoint above — get-students-filter.md's programGuid/semesterGuid/
// batchGuid params each take exactly one guid, no array/comma-list support
// documented. To let a column filter still check off "Programme A AND
// Programme B" the way FilterTh's own multi-select columns do elsewhere,
// each *combination* of the selected guids (one per dimension, all
// dimensions ANDed, values within a dimension ORed) is fetched as its own
// request — GetStudentsFilterCombinations below builds that list — and the
// results are merged by studentGuid (dedup) and paginated client-side.
// This necessarily gives up real server-side pagination the moment more
// than one combination is in play: pageSize is forced high per request so
// each combination's *full* result set is in hand before merging, which
// only stays cheap because Student Master's own filter dimensions
// (Programme/Semester/Batch) are narrow, hand-picked slices, not "no
// filters at all". The page falls back to plain useStudentsFilter above
// (real server pagination) whenever there's only a single combination —
// no filter, or exactly one value picked per dimension — which covers the
// common case.
const MULTI_FETCH_PAGE_SIZE = 1000

export function getStudentsFilterCombinations(colFilters: { programGuid: string[]; semesterGuid: string[]; batchGuid: string[] }, searchTerm?: string): StudentColumnFilters[] {
  const programs = colFilters.programGuid.length ? colFilters.programGuid : [undefined]
  const semesters = colFilters.semesterGuid.length ? colFilters.semesterGuid : [undefined]
  const batches = colFilters.batchGuid.length ? colFilters.batchGuid : [undefined]
  const combos: StudentColumnFilters[] = []
  for (const programGuid of programs) {
    for (const semesterGuid of semesters) {
      for (const batchGuid of batches) {
        combos.push({ programGuid, semesterGuid, batchGuid, searchTerm })
      }
    }
  }
  return combos
}

export function useStudentsFilterMulti(combos: StudentColumnFilters[], enabled: boolean) {
  const results = useQueries({
    queries: combos.map(f => ({
      queryKey: [...STUDENTS_LIST_KEY, 'filter-multi', f.programGuid ?? '', f.semesterGuid ?? '', f.batchGuid ?? '', f.searchTerm ?? ''],
      queryFn: () => getStudentsFilter(1, MULTI_FETCH_PAGE_SIZE, f),
      enabled,
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })

  return useMemo(() => {
    const merged = new Map<string, StudentDto>()
    for (const r of results) r.data?.items.forEach(item => merged.set(item.studentGuid, item))
    return {
      items: Array.from(merged.values()),
      isLoading: results.some(r => r.isLoading),
      isError: results.some(r => r.isError),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])
}

// Infinite-scroll variant for a search dropdown — each additional page is
// appended rather than replacing the list, and getNextPageParam stops
// offering a next page once pageNumber*pageSize has reached totalCount.
// Kept as its own hook rather than a mode on useStudents above since a
// paginated table (page/setPage, Pagination component) and an
// append-as-you-scroll dropdown want fundamentally different query shapes.
export function useStudentsInfinite(searchTerm: string, pageSize: number) {
  return useInfiniteQuery({
    queryKey: [...STUDENTS_LIST_KEY, 'infinite', pageSize, searchTerm],
    queryFn: ({ pageParam }) => getStudents(pageParam, pageSize, { searchTerm: searchTerm || undefined }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.items.length, 0)
      return fetched < lastPage.totalCount ? allPages.length + 1 : undefined
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Fetch-by-guid, same convention as the rest of the app's real View modals —
// only enabled while the profile modal is actually open with a guid.
export function useStudent(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...STUDENT_DETAIL_KEY, studentGuid],
    queryFn: () => getStudentByGuid(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export type { StudentDto, StudentDetailDto, StudentListFilters, StudentColumnFilters, PagedResult } from '@/lib/api/student/student'
