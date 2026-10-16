import { useMemo } from 'react'
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { StudentDto, StudentDetailDto, StudentListFilters, StudentColumnFilters, getStudentByGuid, getStudents, getStudentsFilter } from '@/lib/api/student/student'

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
function studentsFilterKey(page: number, pageSize: number, f: StudentColumnFilters) {
  return [...STUDENTS_LIST_KEY, 'filter', page, pageSize, f.programGuid ?? '', f.semesterGuid ?? '', f.semCode ?? '', f.batchGuid ?? '', f.intakeGuid ?? '', f.academicIntake ?? '', f.regStatus ?? '', f.searchTerm ?? '']
}

export function useStudentsFilter(page: number, pageSize: number, filters: StudentColumnFilters, enabled = true) {
  return useQuery({
    queryKey: studentsFilterKey(page, pageSize, filters),
    queryFn: () => getStudentsFilter(page, pageSize, filters),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Multi-select column filters, layered on top of the single-value-per-field
// endpoint above — get-students-filter.md's programGuid/semCode/batchGuid/
// academicIntake/regStatus params each take exactly one value, no array/
// comma-list support documented. To let a column filter still check off
// "Programme A AND Programme B", each *combination* of the selected values
// (one per dimension, dimensions ANDed, values within a dimension ORed) is
// its own request — getStudentsFilterCombinations below builds that list.
// The page falls back to plain useStudentsFilter above whenever there's
// only a single combination (no filter, or one value per dimension).

export function getStudentsFilterCombinations(colFilters: { programGuid: string[]; semCode: string[]; batchGuid: string[]; intakeGuid: string[]; academicIntake: string[]; regStatus: string[] }, searchTerm?: string): StudentColumnFilters[] {
  const programs = colFilters.programGuid.length ? colFilters.programGuid : [undefined]
  const semCodes = colFilters.semCode.length ? colFilters.semCode : [undefined]
  const batches = colFilters.batchGuid.length ? colFilters.batchGuid : [undefined]
  const joinedIntakes = colFilters.intakeGuid.length ? colFilters.intakeGuid : [undefined]
  const intakes = colFilters.academicIntake.length ? colFilters.academicIntake : [undefined]
  const statuses = colFilters.regStatus.length ? colFilters.regStatus : [undefined]
  const combos: StudentColumnFilters[] = []
  for (const programGuid of programs) {
    for (const semCode of semCodes) {
      for (const batchGuid of batches) {
        for (const intakeGuid of joinedIntakes) {
          for (const academicIntake of intakes) {
            for (const regStatus of statuses) {
              combos.push({ programGuid, semCode, batchGuid, intakeGuid, academicIntake, regStatus, searchTerm })
            }
          }
        }
      }
    }
  }
  return combos
}

// Server-paged across combinations, sorted by name as one list. A student
// has exactly one programme, semester, batch, intake and status, so
// combinations never overlap. The server returns each combination sorted by
// name, so the first K rows of the merged, name-sorted list are always
// among the first K rows of each combination. For table page p (K = p ×
// pageSize): fetch each combination's first K rows (one request each),
// merge, sort by name, and take page p's slice. totalCount comes from each
// response. K is rounded up to a CHUNK so neighbouring pages reuse the same
// requests (pages 1–5 at pageSize 10 share one request per combination).
const MULTI_CHUNK = 50

function compareByName(a: StudentDto, b: StudentDto) {
  return (a.studentName ?? '').localeCompare(b.studentName ?? '', undefined, { sensitivity: 'base' })
    || a.studentGuid.localeCompare(b.studentGuid)
}

export function useStudentsFilterMulti(combos: StudentColumnFilters[], page: number, pageSize: number, enabled: boolean) {
  const needed = page * pageSize
  const fetchSize = Math.ceil(needed / MULTI_CHUNK) * MULTI_CHUNK

  const results = useQueries({
    queries: combos.map(f => ({
      queryKey: studentsFilterKey(1, fetchSize, f),
      queryFn: () => getStudentsFilter(1, fetchSize, f),
      enabled,
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })

  const ready = enabled && results.length > 0 && results.every(r => r.data)
  const totalCount = results.reduce((sum, r) => sum + (r.data?.totalCount ?? 0), 0)
  const items = ready
    ? results.flatMap(r => r.data!.items).sort(compareByName).slice((page - 1) * pageSize, needed)
    : []
  const isError = results.some(r => r.isError)
  return {
    items,
    totalCount,
    isLoading: !isError && !ready,
    isError,
  }
}

// Infinite-scroll variant for a search dropdown — each additional page is
// appended rather than replacing the list, and getNextPageParam stops
// offering a next page once pageNumber*pageSize has reached totalCount.
// Kept as its own hook rather than a mode on useStudents above since a
// paginated table (page/setPage, Pagination component) and an
// append-as-you-scroll dropdown want fundamentally different query shapes.
export function useStudentsInfinite(searchTerm: string, pageSize: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...STUDENTS_LIST_KEY, 'infinite', pageSize, searchTerm],
    queryFn: ({ pageParam }) => getStudents(pageParam, pageSize, { searchTerm: searchTerm || undefined }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.items.length, 0)
      return fetched < lastPage.totalCount ? allPages.length + 1 : undefined
    },
    enabled: enabled && Boolean(searchTerm && searchTerm.trim()),
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

// Batched studentGuid → applicationGuid resolver — same useQueries-per-guid
// convention as useIntakesByGuids (useIntakes.ts). Backs Payment Console →
// Refund's Passout/Library-Deposit and Fake-Certificate-Termination search
// tabs: both eligibility-search DTOs carry only studentGuid, but the refund
// endpoints (ledger-details-batch, POST /refund/applications/{applicationGuid},
// the bulk endpoint) all key off applicationGuid — resolved here via
// StudentDetailDto.applicationSummary.applicationGuid, since there's no
// dedicated studentGuid→applicationGuid lookup endpoint.
export function useStudentsByGuids(guids: string[], enabled = true) {
  const unique = Array.from(new Set(guids.filter(Boolean)))
  const results = useQueries({
    queries: unique.map(guid => ({
      queryKey: [...STUDENT_DETAIL_KEY, guid],
      queryFn: () => getStudentByGuid(guid),
      enabled,
      staleTime: 5 * 60 * 1000,
    })),
  })
  return useMemo(() => {
    const byGuid = new Map<string, StudentDetailDto>()
    results.forEach((r, i) => { if (r.data) byGuid.set(unique[i], r.data) })
    return {
      byGuid,
      isLoading: results.some(r => r.isLoading),
      isError: results.some(r => r.isError),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])
}

export type { StudentDto, StudentDetailDto, StudentListFilters, StudentColumnFilters, PagedResult } from '@/lib/api/student/student'
