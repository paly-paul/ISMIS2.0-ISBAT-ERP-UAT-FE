import { apiGet, apiGetBlob, apiPost } from '@/lib/api/client'
import { writeWorkbook, type SheetData } from '@/lib/xlsx'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Resit UE Mark Import (resit-ue-mark-import/*.md) — import the university
// exam marks of the active resit from an Excel template. The browser reads
// the sheet and sends JSON rows; the file never leaves the browser.

// 1 To do · 2 Completed · 3 Upcoming · 4 Not scheduled. Only To do can import.
export type ResitUeExamStatus = 1 | 2 | 3 | 4

export interface ResitUeMarkColumn {
  key: string // field name in import rows' `marks`
  header: string // Excel header, e.g. SECTIONA
  label: string
  maxMark: number
}

export interface ResitUeExam {
  resitScheduleGuid: string | null // null when not scheduled
  unitCode: string
  unitName: string
  part: number // 0 Theory · 1 Practical
  layout: 'Theory' | 'Practical' | 'Project' | string
  examDate: string | null
  status: ResitUeExamStatus
  maxMark: number | null
  columns: ResitUeMarkColumn[]
  studentCount: number
  importedCount: number
}

export interface ResitUeExamsResponse {
  resit: { refCode: string } | null
  summary: { toDo: number; completed: number; upcoming: number; notScheduled: number }
  exams: { items: ResitUeExam[]; totalCount: number; pageNumber: number; pageSize: number }
}

export interface ResitUeStudent {
  studentNum: string
  studentName?: string | null
  matchingCode?: string | null
  imported: boolean
}

export interface ResitUeImportRow {
  slNo: string
  matchingCode?: string | null
  studentNum: string
  marks: Record<string, number | null>
}

export interface ResitUeImportResult {
  importedCount: number
  pendingCount: number
  message?: string | null
}

// ── Sheet → rows, and the row checks (post-resit-ue-mark-import.md#row-checks)

export interface PreviewRow extends ResitUeImportRow {
  studentName?: string | null
  matchingCode?: string | null
  // Cell text as read from the sheet, keyed by Excel header.
  raw: Record<string, string>
  // Problems keyed by column (STUDENTNUM or a mark header).
  errors: Record<string, string[]>
}

export interface ParsedSheet {
  fileErrors: string[]
  rows: PreviewRow[]
}

export const MAX_IMPORT_ROWS = 1000

function addError(row: PreviewRow, column: string, msg: string) {
  (row.errors[column] ??= []).push(msg)
}

// Excel stores 48.5 as 48.5, but computed cells can carry float noise
// (48.499999999999); 6 decimals strips that without hiding a real 3rd decimal.
function normalizeNumber(n: number) { return Math.round(n * 1e6) / 1e6 }

// Headers match ignoring case, spaces and dots ("Sl. No" = SLNO); order is
// free and extra columns are ignored (resit-ue-mark-import-page.md, ② Upload).
const normHeader = (h: string) => h.replace(/[\s.]/g, '').toUpperCase()

// Reads the template's columns by header. Rows with a blank SLNO are skipped.
export function parseSheet(sheet: SheetData, columns: ResitUeMarkColumn[]): ParsedSheet {
  const fileErrors: string[] = []
  const headerRow = sheet.rows[0] ?? []
  const idx = new Map(headerRow.map((h, i) => [normHeader(h ?? ''), i]))
  const required = ['SLNO', 'STUDENTNUM', ...columns.map(c => normHeader(c.header))]
  const missing = required.filter(h => !idx.has(h))
  if (missing.length) fileErrors.push(`The sheet is missing the column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}. Download the template again.`)

  const rows: PreviewRow[] = []
  if (!missing.length) {
    sheet.rows.slice(1).forEach(cells => {
      const cell = (h: string) => (idx.has(h) ? cells[idx.get(h)!] ?? '' : '').trim()
      if (!cell('SLNO')) return
      const matchingCode = cell('MATCHINGCODE') || cell('MATCHING_CODE') || cell('MATCHING') || cell('CODE') || ''
      const row: PreviewRow = {
        slNo: cell('SLNO'),
        matchingCode: matchingCode || null,
        studentNum: cell('STUDENTNUM'),
        studentName: cell('STUDENTNAME') || null,
        marks: {},
        raw: {},
        errors: {},
      }
      for (const col of columns) {
        const text = cell(normHeader(col.header))
        row.raw[col.header] = text
        if (text === '') { row.marks[col.key] = null; continue }
        const n = Number(text)
        row.marks[col.key] = Number.isFinite(n) ? normalizeNumber(n) : null
        if (!Number.isFinite(n)) addError(row, col.header, 'Must be a number.')
      }
      rows.push(row)
    })
    if (rows.length === 0) fileErrors.push('There is no data in the sheet.')
    if (rows.length > MAX_IMPORT_ROWS) fileErrors.push(`The sheet can have at most ${MAX_IMPORT_ROWS} students.`)
  }
  return { fileErrors, rows }
}

// The same checks the server runs. Mutates and returns `rows` with errors
// filled in; also replaces each name with the one on record.
export function validateRows(rows: PreviewRow[], columns: ResitUeMarkColumn[], students: ResitUeStudent[]): PreviewRow[] {
  const byNum = new Map(students.map(s => [s.studentNum.trim().toUpperCase(), s]))
  const slNosByNum = new Map<string, string[]>()
  for (const r of rows) {
    const k = r.studentNum.trim().toUpperCase()
    if (k) slNosByNum.set(k, [...(slNosByNum.get(k) ?? []), r.slNo])
  }
  for (const r of rows) {
    // Keep parse errors ("Must be a number."), recompute the rest.
    for (const col of Object.keys(r.errors)) {
      r.errors[col] = r.errors[col].filter(m => m === 'Must be a number.')
      if (!r.errors[col].length) delete r.errors[col]
    }
    const k = r.studentNum.trim().toUpperCase()
    const student = byNum.get(k)
    if (!k) addError(r, 'STUDENTNUM', 'Student number is required.')
    else {
      const dupes = slNosByNum.get(k) ?? []
      if (dupes.length > 1) addError(r, 'STUDENTNUM', `Appears more than once in the file (rows ${dupes.join(', ')}).`)
      if (!student) addError(r, 'STUDENTNUM', 'Has not applied for this resit exam.')
      else if (student.imported) addError(r, 'STUDENTNUM', 'Marks are already imported.')
    }
    if (student) {
      r.studentName = student.studentName
      if (student.matchingCode && !r.matchingCode) {
        r.matchingCode = student.matchingCode
      }
    }
    for (const col of columns) {
      if (r.errors[col.header]?.length) continue
      const v = r.marks[col.key]
      if (v === null || v === undefined) addError(r, col.header, 'Required.')
      else if (v < 0) addError(r, col.header, 'Cannot be negative.')
      else if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-6) addError(r, col.header, 'At most 2 decimals.')
      else if (v > col.maxMark) addError(r, col.header, `Cannot be more than ${col.maxMark}.`)
    }
  }
  return rows
}

// Server row problems come back as "Row {slNo} · {COLUMN}: {message}".
export function applyServerErrors(rows: PreviewRow[], errors: string[]): { rows: PreviewRow[]; unmatched: string[] } {
  const unmatched: string[] = []
  const next = rows.map(r => ({ ...r, errors: {} as Record<string, string[]> }))
  for (const e of errors) {
    const m = /^Row (.+?) · ([A-Z0-9_]+): (.+)$/.exec(e)
    const row = m && next.find(r => r.slNo === m[1])
    if (row && m) addError(row, m[2], m[3])
    else unmatched.push(e)
  }
  return { rows: next, unmatched }
}

// ── Mock data ──────────────────────────────────────────────────────────────

const THEORY_COLS: ResitUeMarkColumn[] = [
  { key: 'sectionA', header: 'SECTIONA', label: 'Section A', maxMark: 20 },
  { key: 'sectionB', header: 'SECTIONB', label: 'Section B', maxMark: 60 },
  { key: 'sectionC', header: 'SECTIONC', label: 'Section C', maxMark: 20 },
]
const PRACTICAL_COLS: ResitUeMarkColumn[] = [
  { key: 'record', header: 'RECORD', label: 'Record', maxMark: 10 },
  { key: 'coding', header: 'CODING', label: 'Coding', maxMark: 30 },
  { key: 'output', header: 'OUTPUT', label: 'Output', maxMark: 10 },
  { key: 'viva', header: 'VIVA', label: 'Viva', maxMark: 20 },
]
const PROJECT_COLS: ResitUeMarkColumn[] = [
  { key: 'synopsis', header: 'SYNOPSIS', label: 'Synopsis', maxMark: 15 },
  { key: 'review', header: 'REVIEW', label: 'Review', maxMark: 15 },
  { key: 'methodology', header: 'METHODOLOGY', label: 'Methodology', maxMark: 20 },
  { key: 'analysis', header: 'ANALYSIS', label: 'Analysis', maxMark: 20 },
  { key: 'report', header: 'REPORT', label: 'Report', maxMark: 15 },
  { key: 'viva', header: 'VIVA', label: 'Viva', maxMark: 15 },
]
const sum = (cols: ResitUeMarkColumn[]) => cols.reduce((n, c) => n + c.maxMark, 0)

const MOCK_NAMES = ['BAGUMA STEPHEN', 'ALFRED EKANYA', 'NANTUME BRIDGET', 'ISAAC GIIR AKOL GIIR', 'TIBALIRA MARK JONATHAN', 'NAKATO SARAH', 'OKELLO JAMES', 'AMONG GRACE']

interface MockExam { exam: ResitUeExam; students: ResitUeStudent[] }

function mockExam(guid: string | null, unitCode: string, unitName: string, part: number, layout: string, examDate: string | null, status: ResitUeExamStatus, cols: ResitUeMarkColumn[], count: number, imported: number, seed: number): MockExam {
  const students = Array.from({ length: count }, (_, i) => ({
    studentNum: `01${seed}${240100 + i * 7}`,
    studentName: MOCK_NAMES[(i + seed) % MOCK_NAMES.length],
    matchingCode: String(32440000 + (seed * 1000) + (i * 37)),
    imported: i < imported,
  }))
  return {
    exam: { resitScheduleGuid: guid, unitCode, unitName, part, layout, examDate, status, maxMark: cols.length ? sum(cols) : null, columns: cols, studentCount: count, importedCount: imported },
    students,
  }
}

const mockExams: MockExam[] = [
  mockExam('mock-rs-bit1103', 'BIT1103', 'Problem Solving Methodologies Using C - Theory', 0, 'Theory', '2026-03-11', 1, THEORY_COLS, 5, 0, 1),
  mockExam('mock-rs-bit2116-p', 'BIT2116', 'Data Communication & Networking', 1, 'Practical', '2026-03-12', 1, PRACTICAL_COLS, 4, 1, 2),
  mockExam('mock-rs-bcs3240', 'BCS3240', 'Final Year Project', 0, 'Project', '2026-03-14', 1, PROJECT_COLS, 3, 0, 3),
  mockExam('mock-rs-bnc2118', 'BNCS2118', 'Introduction to IOT', 0, 'Theory', '2026-11-20', 3, THEORY_COLS, 6, 0, 4),
  mockExam(null, 'BAF1209', 'Corporate and Business Law', 0, 'Theory', null, 4, [], 1, 0, 5),
  mockExam('mock-rs-bba2217', 'BBA2217', 'Global Financial Markets', 0, 'Theory', '2026-03-10', 2, THEORY_COLS, 2, 2, 6),
]

function refreshMockStatus(m: MockExam) {
  m.exam.importedCount = m.students.filter(s => s.imported).length
  if (m.exam.status === 1 && m.exam.importedCount >= m.exam.studentCount) m.exam.status = 2
}

function mockError(message: string, code: string, errors?: string[]) {
  return Object.assign(new Error(message), { code, errors })
}

function findMock(resitScheduleGuid: string): MockExam {
  const m = mockExams.find(x => x.exam.resitScheduleGuid === resitScheduleGuid)
  if (!m) throw mockError('Resit exam not found.', 'not_found')
  if (m.exam.status === 3) throw mockError('The resit exam has not taken place yet.', 'bad_request')
  return m
}

const STATUS_ORDER: Record<number, number> = { 1: 0, 3: 1, 4: 2, 2: 3 }
const delay = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 250))

// ── API ────────────────────────────────────────────────────────────────────

export interface ResitUeExamsParams {
  status?: ResitUeExamStatus
  search?: string
  page?: number
  pageSize?: number
}

export function getResitUeExams(params: ResitUeExamsParams): Promise<ResitUeExamsResponse> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) {
    const all = mockExams.map(m => m.exam)
    const q = params.search?.trim().toLowerCase() ?? ''
    const items = all
      .filter(e => !params.status || e.status === params.status)
      .filter(e => !q || e.unitCode.toLowerCase().includes(q) || e.unitName.toLowerCase().includes(q))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.examDate ?? '9').localeCompare(b.examDate ?? '9') || a.unitCode.localeCompare(b.unitCode) || a.part - b.part)
    const count = (s: number) => all.filter(e => e.status === s).length
    return delay({
      resit: { refCode: 'Resit Spring 2026' },
      summary: { toDo: count(1), completed: count(2), upcoming: count(3), notScheduled: count(4) },
      exams: { items: items.slice((page - 1) * pageSize, page * pageSize).map(e => ({ ...e })), totalCount: items.length, pageNumber: page, pageSize },
    })
  }
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.status) qs.set('status', String(params.status))
  if (params.search?.trim()) qs.set('search', params.search.trim().slice(0, 100))
  return apiGet<ResitUeExamsResponse | null>(`/api/v1/assessment/resit-ue-mark-import/exams?${qs}`)
    .then(data => data ?? { resit: null, summary: { toDo: 0, completed: 0, upcoming: 0, notScheduled: 0 }, exams: { items: [], totalCount: 0, pageNumber: page, pageSize } })
}

export function getResitUeStudents(resitScheduleGuid: string): Promise<ResitUeStudent[]> {
  if (MOCK_AUTH) {
    try { return delay(findMock(resitScheduleGuid).students.map(s => ({ ...s }))) } catch (e) { return Promise.reject(e) }
  }
  return apiGet<ResitUeStudent[] | null>(`/api/v1/assessment/resit-ue-mark-import/students?resitScheduleGuid=${encodeURIComponent(resitScheduleGuid)}`)
    .then(data => data ?? [])
}

// Returns the file and its server-suggested name.
export async function downloadResitUeTemplate(resitScheduleGuid: string): Promise<{ blob: Blob; filename: string | null }> {
  if (MOCK_AUTH) {
    const m = findMock(resitScheduleGuid)
    const pending = m.students.filter(s => !s.imported)
    if (!pending.length) throw mockError('Marks of all students of this resit exam are already imported.', 'bad_request')
    const header = ['SLNO', 'MATCHINGCODE', 'STUDENTNUM', ...m.exam.columns.map(c => c.header)]
    const rows = pending.map((s, i) => [i + 1, s.matchingCode ?? String(32440000 + i), s.studentNum, ...m.exam.columns.map(() => null)])
    const d = new Date()
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    return { blob: writeWorkbook(`${m.exam.layout}_Template`, [header, ...rows]), filename: `${m.exam.unitCode}_${m.exam.layout}_Resit_UE_Template_${ymd}.xlsx` }
  }
  return apiGetBlob(`/api/v1/assessment/resit-ue-mark-import/template?resitScheduleGuid=${encodeURIComponent(resitScheduleGuid)}`)
}

export async function importResitUeMarks(resitScheduleGuid: string, rows: ResitUeImportRow[]): Promise<ResitUeImportResult> {
  if (MOCK_AUTH) {
    const m = findMock(resitScheduleGuid)
    if (!rows.length) throw mockError('There are no rows to import.', 'validation_error', ['There are no rows to import.'])
    // Same checks the real server runs, reported in its message format.
    const checked = validateRows(rows.map(r => ({ ...r, studentName: null, raw: {}, errors: {} })), m.exam.columns, m.students)
    const errors = checked.flatMap(r => Object.entries(r.errors).flatMap(([col, msgs]) => msgs.map(msg => `Row ${r.slNo} · ${col}: ${msg}`)))
    if (errors.length) throw mockError(errors[0], 'validation_error', errors)
    const nums = new Set(rows.map(r => r.studentNum.trim().toUpperCase()))
    m.students.forEach(s => { if (nums.has(s.studentNum.toUpperCase())) s.imported = true })
    refreshMockStatus(m)
    const pendingCount = m.students.filter(s => !s.imported).length
    return delay({ importedCount: rows.length, pendingCount, message: `Marks of ${rows.length} students imported.` })
  }
  return apiPost<ResitUeImportResult>('/api/v1/assessment/resit-ue-mark-import/import', { resitScheduleGuid, rows })
}
