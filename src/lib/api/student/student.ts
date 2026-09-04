import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via a real GET /api/v1/students response. programName/
// semesterName/batchCode come back as empty strings (not null) when unset —
// treat '' the same as missing when rendering.
export interface StudentDto {
  studentGuid: string
  studentRegNo: string
  studentNum: string
  studentName: string
  programName: string
  semesterName: string
  batchCode: string
}

// Confirmed via a real GET /api/v1/students/:guid response. Everything past
// batchCode is new versus the list DTO and largely unglossed on the wire —
// displayed raw rather than translated, same "don't invent a label mapping"
// caution used elsewhere in this app (e.g. vetting's gender/enquiryStatus
// ints). studActive reads as a real active/inactive flag (1/0) by naming
// convention only — not confirmed against docs, flagged here rather than
// silently assumed.
export interface StudentDetailDto extends StudentDto {
  regStatusName: string
  iStatus: number
  studActive: number
  regDate: string | null
  discountGuid: string | null
  calcType: string | null
  amtPer: number | null
  intSem: number | null
  discountStatus: string | null
  discountEffectiveFromSemesterGuid: string | null
  discountCancelledAtSemesterGuid: string | null
  intType: number | null
  regSemesterGuid: string | null
  currentSemesterGuid: string | null
  aptechCe: boolean | null
  // Fields confirmed on a real GET /api/v1/students/:guid response
  // (2026-08-31) that don't exist on the shape above at all — the response
  // that day carried none of the iStatus/regStatusName/discount fields
  // above, only these, under different names than the list DTO's own
  // (regNo not studentRegNo, batch not batchCode, etc.). Both sets are kept
  // — optional here rather than replacing the fields above outright, since
  // Profile and Programme Transfer already read the older fields and there
  // is no confirmation the backend won't return either shape depending on
  // route/version. The Student Profile *view modal* is the one place wired
  // to prefer these.
  regNo?: string | null
  batch?: string | null
  semester?: string | null
  programme?: string | null
  faculty?: string | null
  campus?: string | null
  email?: string | null
  phone?: string | null
  nationalityGuid?: string | null
  nationality?: string | null
  nationalityCode?: string | null
  gender?: string | null
  sponsor?: string | null
  learningMode?: string | null
  // A third live shape, confirmed against students/students/get-student-by-guid.md
  // (2026-08-17 doc) — that response has no top-level nationalityGuid at all;
  // the actual country identifier lives here instead, nested under the
  // cross-service admissions summary. Kept alongside nationalityGuid above
  // rather than replacing it, since which of the two a given live response
  // actually populates hasn't been confirmed — StudentProfileModal checks
  // both when resolving a country name.
  applicationSummary?: {
    applicationGuid?: string | null
    studentName?: string | null
    emailId?: string | null
    phone?: string | null
    gender?: number | null
    countryGuid?: string | null
  } | null
}

// GET /api/v1/students/{guid} (getStudentByGuid) can come back in the
// alternate-field-name shape described above — regNo/batch/semester/
// programme populated instead of studentRegNo/batchCode/semesterName/
// programName. Student Profile's own page compensates for this ad hoc,
// with a `student.xxx || detail?.yyy` fallback at every render site that
// needs one; any other page seeding its own `student` state straight from
// this fetch (e.g. via a ?studentGuid= deep link) doesn't get that same
// per-render safety net, so the primary fields silently end up blank —
// confirmed live (2026-09-04): Batch Transfer's own detail call takes
// studentRegNo as a request param, so an unnormalized fetch left it
// sending an empty string and nothing came back. Backfills the primary
// fields from their alternates once, at the seeding point, so a `student`
// built from this call behaves identically to one picked via StudentLookup
// (which only ever returns the primary shape) everywhere downstream.
//
// requestedGuid backfills studentGuid itself — also confirmed missing on a
// real response (2026-09-04): Student Profile's own ?studentGuid= seeding
// set `student.studentGuid` to that same undefined, and every link Profile
// builds off `student.studentGuid` (this app's whole deep-link convention)
// silently carried a literal "undefined" instead of a guid. The guid this
// was fetched *with* is always the right one regardless of what the
// response body says, so pass it in whenever it's known.
export function normalizeStudentDetail(d: StudentDetailDto, requestedGuid?: string | null): StudentDetailDto {
  return {
    ...d,
    studentGuid: d.studentGuid || requestedGuid || '',
    studentRegNo: d.studentRegNo || d.regNo || '',
    programName: d.programName || d.programme || '',
    semesterName: d.semesterName || d.semester || '',
    batchCode: d.batchCode || d.batch || '',
  }
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface StudentListFilters {
  searchTerm?: string
}

// Confirmed via get-students-filter.md (2026-09-03). Filters at the DB
// level on the student's current ProgramGuid/SemesterGuid/BatchGuid —
// unlike getStudents above (GET /api/v1/students), which only supports
// free-text search — with searchTerm still applicable on top of any guid
// filter. StudentListItemDto's fields are identical to StudentDto
// (studentGuid/studentRegNo/studentName/programName/semesterName/
// batchCode), so no separate response type is needed for it.
export interface StudentColumnFilters {
  programGuid?: string
  semesterGuid?: string
  batchGuid?: string
  searchTerm?: string
}

const mockStudents: StudentDto[] = [
  { studentGuid: 'stu-mock-1', studentNum: 'ISB/2024/BSCS/0142', studentRegNo: '011240104', studentName: 'Aisha Nakamya', programName: 'BSc. Computer Science', semesterName: 'Semester 1', batchCode: 'BSC-IT-S26-DA' },
  { studentGuid: 'stu-mock-2', studentNum: 'ISB/2024/BBA/0089', studentRegNo: '012221279', studentName: 'Okello James', programName: 'BBA Business Administration', semesterName: 'Semester 2', batchCode: 'BBA-2024-JAN-A' },
  { studentGuid: 'stu-mock-3', studentNum: 'ISB/2023/BSIT/0201', studentRegNo: '011250093', studentName: 'Grace Nampijja', programName: 'BSc. Information Technology', semesterName: 'Semester 3', batchCode: 'BSIT-2023-SEP-B' },
  { studentGuid: 'stu-mock-4', studentNum: 'ISB/2021/NUR/0034', studentRegNo: '012240747', studentName: 'Brian Ssemanda', programName: 'Diploma in Nursing', semesterName: 'Semester 4', batchCode: 'NUR-2025-MAY-A' },
]

export function getStudents(page: number, pageSize: number, filters?: StudentListFilters): Promise<PagedResult<StudentDto>> {
  if (MOCK_AUTH) {
    const term = filters?.searchTerm?.trim().toLowerCase()
    const items = term
      ? mockStudents.filter(s => `${s.studentNum} ${s.studentRegNo} ${s.studentName}`.toLowerCase().includes(term))
      : mockStudents
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams()
  if (filters?.searchTerm?.trim()) params.set('searchTerm', filters.searchTerm.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return apiGet<PagedResult<StudentDto> | null>(`/api/v1/students?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// The response's own page-number field is named `page` per get-students-
// filter.md's sample, not `pageNumber` like PagedResult declares elsewhere
// in this file — neither this function nor its one consumer (Student
// Master's column filters) reads that field back, so the mismatch is
// harmless, but worth a note in case that ever changes.
export function getStudentsFilter(page: number, pageSize: number, filters: StudentColumnFilters): Promise<PagedResult<StudentDto>> {
  if (MOCK_AUTH) {
    // The mock list's four rows carry no program/semester/batch guids at
    // all — mock mode only honors searchTerm here, same as getStudents.
    const term = filters.searchTerm?.trim().toLowerCase()
    const items = term
      ? mockStudents.filter(s => `${s.studentNum} ${s.studentRegNo} ${s.studentName}`.toLowerCase().includes(term))
      : mockStudents
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams()
  if (filters.programGuid) params.set('programGuid', filters.programGuid)
  if (filters.semesterGuid) params.set('semesterGuid', filters.semesterGuid)
  if (filters.batchGuid) params.set('batchGuid', filters.batchGuid)
  if (filters.searchTerm?.trim()) params.set('searchTerm', filters.searchTerm.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return apiGet<PagedResult<StudentDto> | null>(`/api/v1/students/filter?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function getStudentByGuid(guid: string): Promise<StudentDetailDto> {
  if (MOCK_AUTH) {
    const found = mockStudents.find(s => s.studentGuid === guid)
    if (!found) throw new Error('not_found')
    return Promise.resolve({
      ...found,
      regStatusName: '', iStatus: 0, studActive: 1, regDate: null,
      discountGuid: null, calcType: null, amtPer: null, intSem: null,
      discountStatus: null, discountEffectiveFromSemesterGuid: null, discountCancelledAtSemesterGuid: null,
      intType: 1, regSemesterGuid: null, currentSemesterGuid: null, aptechCe: null,
      regNo: found.studentRegNo, batch: found.batchCode, semester: found.semesterName, programme: found.programName,
      faculty: 'Faculty of Computing', campus: 'ISBAT University - Main Campus',
      email: 'student@example.com', phone: '+256700000000',
      nationalityGuid: null, nationality: 'Ugandan', nationalityCode: 'UG', gender: 'Female', sponsor: null, learningMode: 'Campus Mode',
    })
  }
  return apiGet<StudentDetailDto>(`/api/v1/students/${guid}`)
}
