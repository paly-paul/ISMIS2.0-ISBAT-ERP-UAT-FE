import { apiDeleteWithMessage, apiGet, apiPost, apiPut } from '@/lib/api/client'
import { writeWorkbook } from '@/lib/xlsx'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Generate Result (generate-result/*.md). Generates the exam results of an
// academic intake, shows / moderates / exports them, and publishes them to
// students. Two scopes, as in legacy:
// - whole intake: generate, publish, delete (row filters are ignored);
// - the grid's filters: list, moderation, export — all three take the same
//   filters, so they always act on exactly the rows the grid shows.

// ── Types ──────────────────────────────────────────────────────────────────

export interface GrIntake {
  intakeGuid: string
  intakeCode: number
  description: string
  currentIntake: boolean
}

export interface GrProgram {
  programGuid: string
  programCode: string
  programName: string
}

export interface GrSemester {
  semesterGuid: string
  semName: string
}

export interface GrCourseUnit {
  courseUnitGuid: string
  unitCode: string
  unitName: string
}

// GET /init
export interface GenerateResultInit {
  intakes: GrIntake[]
  programs: GrProgram[]
}

export type ResultOperator = '=' | '<>' | '<' | '<=' | '>' | '>='

export interface ResultFilters {
  intakeGuid: string
  programGuid?: string
  semesterGuid?: string
  courseUnitGuid?: string
  iaOperator?: ResultOperator
  iaValue?: number
  ueOperator?: ResultOperator
  ueValue?: number
  studentName?: string
  search?: string
}

export interface ExamResultRow {
  examResultGuid: string
  studentNum: string | null
  studentName: string | null
  programCode: string | null
  semCode: number | null
  unitCode: string | null
  unitName: string | null
  midSem: number | null // CT in the export
  cw1: number | null // CW
  cw2: number | null // CA
  iaMax: number | null
  iaMod: number | null // last moderation applied
  iaTotal: number | null
  ue: string | null // "ABS", a number like "62.00", or null
  uePractical: string | null
  ueTotal: number | null
  ueMax: number | null
  ueMod: number | null
}

export interface PagedExamResults {
  items: ExamResultRow[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// POST /generate-results — warnings are grouped by unit; the exact shape
// isn't in the doc, so the page renders strings or objects.
export type GenerateWarning = string | { unitCode?: string | null; unitName?: string | null; message?: string | null; rowCount?: number | null }

export interface GenerateResultResponse {
  intakeGuid: string
  studentCount: number
  unitCount: number
  rowsGenerated: number
  warnings: GenerateWarning[]
}

// 1 IA total · 2 UE total (ResultModerationField)
export type ModerationField = 1 | 2

export interface ModerationResponse {
  rowsMatched: number
  rowsModerated: number
  rowsSkipped: number
}

export interface PublishResponse {
  isPublished: boolean
  rowsUpdated: number
}

export interface ExportResponse {
  url: string
  expiresAtUtc: string
}

function filterQuery(f: ResultFilters, extra?: Record<string, string>) {
  const qs = new URLSearchParams({ intakeGuid: f.intakeGuid, ...extra })
  if (f.programGuid) qs.set('programGuid', f.programGuid)
  if (f.semesterGuid) qs.set('semesterGuid', f.semesterGuid)
  if (f.courseUnitGuid) qs.set('courseUnitGuid', f.courseUnitGuid)
  if (f.iaOperator && f.iaValue !== undefined) { qs.set('iaOperator', f.iaOperator); qs.set('iaValue', String(f.iaValue)) }
  if (f.ueOperator && f.ueValue !== undefined) { qs.set('ueOperator', f.ueOperator); qs.set('ueValue', String(f.ueValue)) }
  const term = (f.studentName || f.search)?.trim()
  if (term) {
    qs.set('search', term)
    qs.set('studentName', term)
  }
  return qs
}

// ── Mock store (NEXT_PUBLIC_AUTH_MOCK) ─────────────────────────────────────
// Spring 2026 starts generated; the other intakes start empty, so Generate,
// Publish and Delete can all be tried. Moderation follows the doc's rule.

const MOCK_INTAKES: GrIntake[] = [
  { intakeGuid: 'gr-intake-20222', intakeCode: 20222, description: 'Fall 2022', currentIntake: false },
  { intakeGuid: 'gr-intake-20251', intakeCode: 20251, description: 'Spring 2025', currentIntake: false },
  { intakeGuid: 'gr-intake-20252', intakeCode: 20252, description: 'Fall 2025', currentIntake: false },
  { intakeGuid: 'gr-intake-20261', intakeCode: 20261, description: 'Spring 2026', currentIntake: true },
]

interface MockProgram extends GrProgram {
  semesters: (GrSemester & { semCode: number; units: GrCourseUnit[] })[]
  students: [string, string][]
}

const MOCK_PROGRAMS: MockProgram[] = [
  {
    programGuid: 'gr-prog-bba', programCode: 'BBAIBS22', programName: 'BBA International Business - S22',
    semesters: [
      { semesterGuid: 'gr-sem-bba-1', semCode: 1, semName: 'Year One - Semester One', units: [
        { courseUnitGuid: 'gr-cu-bba1101', unitCode: 'BBA1101', unitName: 'Principles of Management' },
        { courseUnitGuid: 'gr-cu-bba1102', unitCode: 'BBA1102', unitName: 'Business Mathematics' },
      ] },
      { semesterGuid: 'gr-sem-bba-2', semCode: 2, semName: 'Year One - Semester Two', units: [
        { courseUnitGuid: 'gr-cu-bba1206', unitCode: 'BBA1206', unitName: 'Organizational Behavior' },
        { courseUnitGuid: 'gr-cu-bba1207', unitCode: 'BBA1207', unitName: 'Financial Accounting' },
      ] },
    ],
    students: [['ABDI ALI OSMAN', '012250503'], ['NAKIBUUKA HAJARAH', '012230213'], ['OKELLO JAMES', '012230541'], ['NAKATO SARAH', '012240901'], ['MUGISHA BRIAN', '012250118']],
  },
  {
    programGuid: 'gr-prog-bit', programCode: 'BIT-SEP23', programName: 'Bachelor of Information Technology',
    semesters: [
      { semesterGuid: 'gr-sem-bit-1', semCode: 1, semName: 'Year One - Semester One', units: [
        { courseUnitGuid: 'gr-cu-bit111', unitCode: 'BIT111', unitName: 'Basics of Computer and Office Application' },
        { courseUnitGuid: 'gr-cu-bit112', unitCode: 'BIT112', unitName: 'Computer Organization and Architecture' },
      ] },
      { semesterGuid: 'gr-sem-bit-3', semCode: 3, semName: 'Year Two - Semester One', units: [
        { courseUnitGuid: 'gr-cu-bit2203', unitCode: 'BIT2203', unitName: 'Database Systems' },
        { courseUnitGuid: 'gr-cu-bit2116', unitCode: 'BIT2116', unitName: 'Data Communication & Networking' },
      ] },
    ],
    students: [['ALFRED EKANYA', '012221590'], ['KATO JOSEPH', '012220626'], ['NANTUME BRIDGET', '012240133'], ['RUHINDA DAUDI KIRENZI', '012230649'], ['AYEBARE PATIENCE', '012240377'], ['SSEMPIJJA IVAN', '012240412']],
  },
  {
    programGuid: 'gr-prog-bncs', programCode: 'BSc.NCSF22', programName: 'BSc Networks and Cyber Security',
    semesters: [
      { semesterGuid: 'gr-sem-bncs-5', semCode: 5, semName: 'Year Three - Semester One', units: [
        { courseUnitGuid: 'gr-cu-bncs3234', unitCode: 'BNCS3234', unitName: 'Intellectual Property Rights' },
        { courseUnitGuid: 'gr-cu-bncs3235', unitCode: 'BNCS3235', unitName: 'Digital Transformation and Overview' },
      ] },
    ],
    students: [['BAGUMA STEPHEN', '011240168'], ['AMONG GRACE', '012230118'], ['CHAN ABRAHAM KUOL CHAN', '011230465'], ['ISAAC GIIR AKOL GIIR', '011250077']],
  },
]

interface MockRow extends ExamResultRow {
  programGuid: string
  semesterGuid: string
  courseUnitGuid: string
}

interface MockIntakeState { rows: MockRow[]; published: boolean }
const mockState = new Map<string, MockIntakeState>()

// Deterministic pseudo-random marks so a regenerated intake looks the same.
function rand(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}
const r2 = (n: number) => Math.round(n * 100) / 100

function buildRows(intakeGuid: string): MockRow[] {
  const rows: MockRow[] = []
  let seed = intakeGuid.length * 97
  for (const p of MOCK_PROGRAMS) for (const s of p.semesters) for (const u of s.units) for (const [name, num] of p.students) {
    seed++
    const ct = r2(rand(seed) * 20)
    const cw = r2(rand(seed + 1) * 20)
    const absent = rand(seed + 2) < 0.06
    const ueMark = absent ? 0 : r2(20 + rand(seed + 3) * 40)
    const hasPractical = u.unitCode.startsWith('BIT') && rand(seed + 4) < 0.5
    const uePr = hasPractical ? r2(rand(seed + 5) * 15) : null
    rows.push({
      examResultGuid: `gr-row-${intakeGuid}-${seed}`,
      programGuid: p.programGuid, semesterGuid: s.semesterGuid, courseUnitGuid: u.courseUnitGuid,
      studentNum: num, studentName: name, programCode: p.programCode, semCode: s.semCode,
      unitCode: u.unitCode, unitName: u.unitName,
      midSem: ct, cw1: cw, cw2: 0, iaMax: 40, iaMod: null, iaTotal: Math.round(ct + cw),
      ue: absent ? 'ABS' : ueMark.toFixed(2), uePractical: uePr === null ? null : uePr.toFixed(2),
      ueTotal: Math.round(ueMark + (uePr ?? 0)), ueMax: 60, ueMod: null,
    })
  }
  return rows
}

function getMockIntake(intakeGuid: string): MockIntakeState {
  let st = mockState.get(intakeGuid)
  if (!st) {
    st = { rows: intakeGuid === 'gr-intake-20261' ? buildRows(intakeGuid) : [], published: false }
    mockState.set(intakeGuid, st)
  }
  return st
}

function compare(total: number | null, op: ResultOperator, value: number) {
  if (total === null) return false // an empty total never matches, as in SQL
  switch (op) {
    case '=': return total === value
    case '<>': return total !== value
    case '<': return total < value
    case '<=': return total <= value
    case '>': return total > value
    case '>=': return total >= value
  }
}

function mockFilter(f: ResultFilters): MockRow[] {
  const q = (f.studentName || f.search)?.trim().toLowerCase()
  return getMockIntake(f.intakeGuid).rows
    .filter(r => !f.programGuid || r.programGuid === f.programGuid)
    .filter(r => !f.semesterGuid || r.semesterGuid === f.semesterGuid)
    .filter(r => !f.courseUnitGuid || r.courseUnitGuid === f.courseUnitGuid)
    .filter(r => !f.iaOperator || f.iaValue === undefined || compare(r.iaTotal, f.iaOperator, f.iaValue))
    .filter(r => !f.ueOperator || f.ueValue === undefined || compare(r.ueTotal, f.ueOperator, f.ueValue))
    .filter(r => {
      if (!q) return true
      return (
        (r.studentName?.toLowerCase().includes(q) ?? false) ||
        (r.studentNum?.toLowerCase().includes(q) ?? false) ||
        (r.programCode?.toLowerCase().includes(q) ?? false) ||
        (r.unitCode?.toLowerCase().includes(q) ?? false) ||
        (r.unitName?.toLowerCase().includes(q) ?? false)
      )
    })
    // programme code, semester code, student name, unit code
    .sort((a, b) =>
      (a.programCode ?? '').localeCompare(b.programCode ?? '') ||
      (a.semCode ?? 0) - (b.semCode ?? 0) ||
      (a.studentName ?? '').localeCompare(b.studentName ?? '') ||
      (a.unitCode ?? '').localeCompare(b.unitCode ?? ''))
}

function toRow(r: MockRow): ExamResultRow {
  const { programGuid: _p, semesterGuid: _s, courseUnitGuid: _c, ...row } = r
  return { ...row }
}

function mockError(message: string, code: string) {
  return Object.assign(new Error(message), { code })
}

const delay = <T,>(v: T, ms = 300) => new Promise<T>(r => setTimeout(() => r(v), ms))

// ── API ────────────────────────────────────────────────────────────────────

export function getGenerateResultInit(): Promise<GenerateResultInit> {
  if (MOCK_AUTH) return delay({ intakes: MOCK_INTAKES.map(i => ({ ...i })), programs: MOCK_PROGRAMS.map(({ programGuid, programCode, programName }) => ({ programGuid, programCode, programName })) })
  return apiGet<GenerateResultInit | null>('/api/v1/assessment/generate-results/init')
    .then(data => data ?? { intakes: [], programs: [] })
}

export function getGenerateResultSemesters(programGuid: string): Promise<GrSemester[]> {
  if (MOCK_AUTH) return delay((MOCK_PROGRAMS.find(p => p.programGuid === programGuid)?.semesters ?? []).map(({ semesterGuid, semName }) => ({ semesterGuid, semName })), 150)
  return apiGet<GrSemester[] | null>(`/api/v1/assessment/generate-results/programs/${programGuid}/semesters`).then(d => d ?? [])
}

export function getGenerateResultCourseUnits(programGuid: string, semesterGuid: string): Promise<GrCourseUnit[]> {
  if (MOCK_AUTH) {
    const sem = MOCK_PROGRAMS.find(p => p.programGuid === programGuid)?.semesters.find(s => s.semesterGuid === semesterGuid)
    return delay([...(sem?.units ?? [])].sort((a, b) => a.unitCode.localeCompare(b.unitCode)), 150)
  }
  return apiGet<GrCourseUnit[] | null>(`/api/v1/assessment/generate-results/programs/${programGuid}/semesters/${semesterGuid}/course-units`).then(d => d ?? [])
}

export function getGeneratedResults(filters: ResultFilters, page = 1, pageSize = 10): Promise<PagedExamResults> {
  if (MOCK_AUTH) {
    const rows = mockFilter(filters)
    return delay({ items: rows.slice((page - 1) * pageSize, page * pageSize).map(toRow), totalCount: rows.length, pageNumber: page, pageSize })
  }
  return apiGet<PagedExamResults | null>(`/api/v1/assessment/generate-results?${filterQuery(filters, { page: String(page), pageSize: String(pageSize) })}`)
    .then(d => d ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Whole intake. One-time: refused (conflict) while results exist.
export function generateResults(intakeGuid: string): Promise<GenerateResultResponse> {
  if (MOCK_AUTH) {
    const st = getMockIntake(intakeGuid)
    if (st.rows.length) return Promise.reject(mockError('The results have already been generated...!', 'conflict'))
    st.rows = buildRows(intakeGuid)
    st.published = false
    const units = new Set(st.rows.map(r => r.courseUnitGuid)).size
    const students = new Set(st.rows.map(r => r.studentNum)).size
    return delay({
      intakeGuid, studentCount: students, unitCount: units, rowsGenerated: st.rows.length,
      warnings: [{ unitCode: 'BIT2116', unitName: 'Data Communication & Networking', message: 'The CW maximum is 0, so the CW mark counted as 0.', rowCount: 6 }],
    }, 900)
  }
  return apiPost<GenerateResultResponse>('/api/v1/assessment/generate-results', { intakeGuid })
}

// Filtered rows. Cap: 50% of the max, whole-number maths (doc, Rule).
export function applyModeration(filters: ResultFilters, field: ModerationField, value: number): Promise<ModerationResponse> {
  if (MOCK_AUTH) {
    const rows = mockFilter(filters)
    if (!rows.length) return Promise.reject(mockError('Please select students for moderation before proceeding!!', 'bad_request'))
    let moderated = 0
    for (const r of rows) {
      const total = field === 1 ? r.iaTotal : r.ueTotal
      const max = field === 1 ? r.iaMax : r.ueMax
      if (total === null || max === null) continue
      const t = Math.trunc(total)
      const limit = Math.trunc(max) * 0.5
      let applied: number
      if (t + value <= limit) applied = value
      else {
        const room = Math.trunc(limit - t)
        if (room <= 0) continue
        applied = room
      }
      if (field === 1) { r.iaTotal = total + applied; r.iaMod = applied } else { r.ueTotal = total + applied; r.ueMod = applied }
      moderated++
    }
    return delay({ rowsMatched: rows.length, rowsModerated: moderated, rowsSkipped: rows.length - moderated })
  }
  return apiPost<ModerationResponse>(`/api/v1/assessment/generate-results/moderation?${filterQuery(filters)}`, { field, value })
}

// Whole intake.
export function publishResults(intakeGuid: string, publish: boolean): Promise<PublishResponse> {
  if (MOCK_AUTH) {
    const st = getMockIntake(intakeGuid)
    if (!st.rows.length) return Promise.reject(mockError('No results have been generated for this intake.', 'not_found'))
    st.published = publish
    return delay({ isPublished: publish, rowsUpdated: st.rows.length })
  }
  return apiPut<PublishResponse>(`/api/v1/assessment/generate-results/publish?${new URLSearchParams({ intakeGuid })}`, { publish })
}

// Whole intake, soft delete. Blocked once published.
export async function deleteResults(intakeGuid: string): Promise<{ rowsDeleted: number; message: string | null }> {
  if (MOCK_AUTH) {
    const st = getMockIntake(intakeGuid)
    if (!st.rows.length) throw mockError('No results have been generated for this intake.', 'not_found')
    if (st.published) throw mockError('The results have already been published.Deletion not possible..!', 'conflict')
    const n = st.rows.length
    st.rows = []
    return delay({ rowsDeleted: n, message: 'Deleted successfully......!' })
  }
  const res = await apiDeleteWithMessage<{ rowsDeleted: number } | null>(`/api/v1/assessment/generate-results?${new URLSearchParams({ intakeGuid })}`)
  return { rowsDeleted: res.data?.rowsDeleted ?? 0, message: res.message }
}

// Filtered rows, no paging. Returns a presigned link (mock: a blob URL).
export function exportResults(filters: ResultFilters): Promise<ExportResponse> {
  if (MOCK_AUTH) {
    const rows = mockFilter(filters)
    if (!rows.length) return Promise.reject(mockError('There are no results to export for the selected filters.', 'not_found'))
    const semName = (r: MockRow) => MOCK_PROGRAMS.find(p => p.programGuid === r.programGuid)?.semesters.find(s => s.semesterGuid === r.semesterGuid)?.semName ?? ''
    const header = ['Sl No', 'Student Number', 'Student Name', 'Programme', 'Semester', 'Course Unit Code', 'Course Unit Name', 'CW', 'CA', 'CT', 'IA Moderation', 'Total IA', 'Max IA', 'UE', 'UE Practical', 'UE Moderation', 'Total UE', 'Max UE']
    const body = rows.map((r, i) => [i + 1, r.studentNum, r.studentName, r.programCode, semName(r), r.unitCode, r.unitName, r.cw1, r.cw2, r.midSem, r.iaMod, r.iaTotal, r.iaMax, r.ue, r.uePractical, r.ueMod, r.ueTotal, r.ueMax])
    const url = URL.createObjectURL(writeWorkbook('Exam_Result', [header, ...body]))
    return delay({ url, expiresAtUtc: new Date(Date.now() + 15 * 60000).toISOString() })
  }
  return apiGet<ExportResponse>(`/api/v1/assessment/generate-results/export?${filterQuery(filters)}`)
}
