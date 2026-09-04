import { apiPost } from '../client'
import { PagedResult, StudentDto, getStudents } from './student'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// The full 14-filter search (students/student-search/post-student-search.md)
// — every field optional, combined with AND. No response JSON sample is
// given in the doc beyond "a paged list of matching students", so this
// reuses StudentDto/PagedResult from the thin GET /students variant rather
// than inventing a distinct shape.
export interface StudentSearchFilters {
  schoolGuid?: string | null
  programGuid?: string | null
  batchGuid?: string | null
  semesterGuid?: string | null
  campusGuid?: string | null
  // Legacy integer keys, not GUIDs (per the docs) — no lookup source exists
  // in this app for either, so callers collect them as raw numbers rather
  // than through an invented dropdown.
  intCountryCode?: number | null
  intakeCode?: number | null
  sponsorCategoryGuid?: string | null
  studentRegNo?: string | null
  studentName?: string | null
  // "Status byte" per the docs, with no confirmed 0/1 meaning — treated as
  // a plain boolean and sent as 1/0, matching every other boolean-as-byte
  // field already confirmed elsewhere in this app (e.g. batch/proc-bank
  // status flags). Flagged here since this one specifically isn't confirmed.
  refugee?: boolean | null
  refugeeId?: string | null
  // Gender enum value — sent as the raw int the caller supplies. No
  // confirmed label mapping exists anywhere in this app (see the vetting
  // page's own gender/enquiryStatus ints), so this isn't translated to/from
  // Male/Female/Other here either.
  gender?: number | null
  pageNumber?: number
  pageSize?: number
}

export function searchStudentsAdvanced(filters: StudentSearchFilters): Promise<PagedResult<StudentDto>> {
  const pageNumber = filters.pageNumber ?? 1
  const pageSize = filters.pageSize ?? 25

  if (MOCK_AUTH) {
    // Mock mode has no real filter engine behind it — just apply the two
    // free-text fields against the same mock list student.ts uses, same
    // "illustrative only" convention as the rest of this app's mock paths.
    const term = `${filters.studentRegNo ?? ''} ${filters.studentName ?? ''}`.trim()
    return getStudents(pageNumber, pageSize, { searchTerm: term || undefined })
  }

  const payload = {
    schoolGuid: filters.schoolGuid ?? null,
    programGuid: filters.programGuid ?? null,
    batchGuid: filters.batchGuid ?? null,
    semesterGuid: filters.semesterGuid ?? null,
    campusGuid: filters.campusGuid ?? null,
    intCountryCode: filters.intCountryCode ?? null,
    sponsorCategoryGuid: filters.sponsorCategoryGuid ?? null,
    intakeCode: filters.intakeCode ?? null,
    studentRegNo: filters.studentRegNo ?? null,
    studentName: filters.studentName ?? null,
    refugee: filters.refugee == null ? null : (filters.refugee ? 1 : 0),
    refugeeId: filters.refugeeId ?? null,
    gender: filters.gender ?? null,
    pageNumber,
    pageSize,
  }
  // Route was moved from /api/v1/studentsearch/search to /api/v1/students/search/search
  return apiPost<PagedResult<StudentDto> | null>('/api/v1/students/search/search', payload)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}
