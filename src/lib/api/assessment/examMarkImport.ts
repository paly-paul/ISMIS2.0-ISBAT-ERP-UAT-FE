import { apiGetBlob, apiPostForm } from '@/lib/api/client'
import { listSheetNames, readSheet, writeWorkbook } from '@/lib/xlsx'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Exam Mark Import (exam-mark-import-page.md) — final exam results (IA + UE
// per student and course unit) loaded in bulk from Excel. The file is never
// stored: the same File goes up again on sheets, preview and import.

export const EXAM_MARK_COLUMNS = ['SLNO', 'STUDENTNUM', 'STUDENTNAME', 'SEMCODE', 'ACADEMICINTAKE', 'UNITCODE', 'UNITNAME', 'IATOTAL', 'IAMAX', 'UETOTAL', 'UEMAX'] as const
export type ExamMarkColumn = typeof EXAM_MARK_COLUMNS[number]

export const EXAM_MARK_MAX_FILE_BYTES = 5 * 1024 * 1024
export const EXAM_MARK_MAX_ROWS = 2000

export type ExamMarkResult = 'Pass' | 'Fail' | 'RL'

export interface ExamMarkProblem {
  column: string | null // a template column, or null for a row-level problem
  message: string
}

export interface ExamMarkPreviewRow {
  slNo: string
  studentNum: string | null
  studentName: string | null // from the student record; the sheet's when not found
  semCode: string | null
  academicIntake: string | null
  unitCode: string | null
  unitName: string | null
  iaTotal: number | null
  iaMax: number | null
  ueTotal: number | null
  ueMax: number | null
  result: ExamMarkResult | null // null on a row with problems
  problems: ExamMarkProblem[]
}

export interface ExamMarkImportResult {
  savedCount: number
  message: string | null
}

// The API page for preview/import is not in this repo; accept the likely
// shapes (problems / errors as {column, message} or plain strings, and the
// "Row {slNo} · {COLUMN}: {message}" form used by the other mark imports).
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))

function normalizeProblems(raw: unknown): ExamMarkProblem[] {
  if (!Array.isArray(raw)) return []
  return raw.map(p => {
    if (typeof p === 'string') {
      const m = /^(?:Row .+? · )?([A-Z]+): (.+)$/.exec(p)
      return m && (EXAM_MARK_COLUMNS as readonly string[]).includes(m[1]) ? { column: m[1], message: m[2] } : { column: null, message: p }
    }
    const o = p as Record<string, unknown>
    return { column: str(o.column ?? o.field ?? o.header)?.toUpperCase() ?? null, message: String(o.message ?? o.error ?? '') }
  })
}

function normalizeRow(r: Record<string, unknown>): ExamMarkPreviewRow {
  const result = str(r.result ?? r.resultCode)
  return {
    slNo: String(r.slNo ?? r.slno ?? ''),
    studentNum: str(r.studentNum ?? r.studentNumber),
    studentName: str(r.studentName),
    semCode: str(r.semCode),
    academicIntake: str(r.academicIntake ?? r.intakeCode),
    unitCode: str(r.unitCode),
    unitName: str(r.unitName),
    iaTotal: num(r.iaTotal), iaMax: num(r.iaMax), ueTotal: num(r.ueTotal), ueMax: num(r.ueMax),
    result: result === 'Pass' || result === 'Fail' || result === 'RL' ? result : null,
    problems: normalizeProblems(r.problems ?? r.errors),
  }
}

// Save 400 with row problems: map "Row {slNo} · {COLUMN}: {message}" back to rows.
export function mapSaveErrors(errors: string[]): { bySlNo: Map<string, ExamMarkProblem[]>; unmatched: string[] } {
  const bySlNo = new Map<string, ExamMarkProblem[]>()
  const unmatched: string[] = []
  for (const e of errors) {
    const m = /^Row (.+?) · (?:([A-Z]+): )?(.+)$/.exec(e)
    if (!m) { unmatched.push(e); continue }
    bySlNo.set(m[1], [...(bySlNo.get(m[1]) ?? []), { column: m[2] ?? null, message: m[3] }])
  }
  return { bySlNo, unmatched }
}

// ── API ────────────────────────────────────────────────────────────────────

export function downloadExamMarkTemplate(): Promise<{ blob: Blob; filename: string | null }> {
  if (MOCK_AUTH) {
    const d = new Date()
    const label = `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-GB', { month: 'short' })}-${d.getFullYear()}`
    return Promise.resolve({ blob: writeWorkbook(`Exam_Template_${label}`, [[...EXAM_MARK_COLUMNS]]), filename: `Exam_Mark_Import_Template_${label}.xlsx` })
  }
  return apiGetBlob('/api/v1/assessment/exam-mark-import/template')
}

export async function getExamMarkSheets(file: File): Promise<string[]> {
  if (MOCK_AUTH) return listSheetNames(file).catch(() => { throw mockError('The file could not be read. Upload an .xlsx workbook.', 'bad_request') })
  const fd = new FormData()
  fd.append('file', file)
  return apiPostForm<string[] | null>('/api/v1/assessment/exam-mark-import/sheets', fd).then(d => d ?? [])
}

export async function previewExamMarks(file: File, sheetName: string): Promise<ExamMarkPreviewRow[]> {
  if (MOCK_AUTH) return mockPreview(file, sheetName)
  const fd = new FormData()
  fd.append('file', file)
  fd.append('sheetName', sheetName)
  return apiPostForm<unknown[] | { rows?: unknown[] } | null>('/api/v1/assessment/exam-mark-import/preview', fd)
    .then(d => (Array.isArray(d) ? d : d?.rows ?? []).map(r => normalizeRow(r as Record<string, unknown>)))
}

export async function importExamMarks(file: File, sheetName: string): Promise<ExamMarkImportResult> {
  if (MOCK_AUTH) {
    const rows = await mockPreview(file, sheetName)
    const bad = rows.filter(r => r.problems.length)
    if (bad.length) {
      const errors = bad.flatMap(r => r.problems.map(p => `Row ${r.slNo} · ${p.column ? `${p.column}: ` : ''}${p.message}`))
      throw mockError(errors[0], 'validation_error', errors)
    }
    rows.forEach(r => mockExisting.add(`${r.studentNum}|${r.semCode}|${r.unitCode}`))
    return { savedCount: rows.length, message: null }
  }
  const fd = new FormData()
  fd.append('file', file)
  fd.append('sheetName', sheetName)
  return apiPostForm<unknown>('/api/v1/assessment/exam-mark-import/import', fd).then(d => {
    const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>
    return { savedCount: Number(o.savedCount ?? o.importedCount ?? o.count ?? 0), message: str(o.message) }
  })
}

// ── Mock (NEXT_PUBLIC_AUTH_MOCK) ───────────────────────────────────────────
// Reads the sheet in the browser and runs every row check from the spec
// against a small registry, so the page can be tried end to end.

function mockError(message: string, code: string, errors?: string[]) {
  return Object.assign(new Error(message), { code, errors: errors ?? [message] })
}

const MOCK_SESSIONS = new Set(['20253', '20261'])
// Student → programme semesters (code → unit codes).
const MOCK_STUDENTS: Record<string, { name: string; sems: Record<string, string[]> }> = {
  '011260386': { name: 'ALVIN IRANKUNDA', sems: { '1': ['BFX1101-1', 'BFX1102-1', 'BFX1103'] } },
  '011260387': { name: 'MUSIIMENTA KAYLA', sems: { '1': ['BIT1101', 'BIT1102', 'BIT1103'], '2': ['BIT1201'] } },
  '011260388': { name: 'OKELLO JAMES', sems: { '1': ['BIT1101', 'BIT1102', 'BIT1103'] } },
  '011260389': { name: 'NAKATO SARAH', sems: { '1': ['BBA1101', 'BBA1102'] } },
}
const MOCK_UNIT_NAMES: Record<string, string> = {
  'BFX1101-1': 'Compositing Techniques', 'BFX1102-1': 'Principles of Drawing and Design', BFX1103: 'History of Animation',
  BIT1101: 'Computer Applications', BIT1102: 'Computer Organization and Architecture', BIT1103: 'Problem Solving Methodologies Using C',
  BIT1201: 'Database Systems', BBA1101: 'Principles of Management', BBA1102: 'Principles of Accounting',
}
const mockExisting = new Set<string>(['011260389|1|BBA1101'])

async function mockPreview(file: File, sheetName: string): Promise<ExamMarkPreviewRow[]> {
  let sheet
  try { sheet = await readSheet(file, sheetName) } catch { throw mockError('The file could not be read. Upload an .xlsx workbook.', 'bad_request') }
  const norm = (h: string) => (h ?? '').replace(/[\s.]/g, '').toUpperCase()
  const header = (sheet.rows[0] ?? []).map(norm).filter(Boolean)
  if (header.length !== 11) throw mockError(`The sheet must have exactly 11 columns; it has ${header.length}. Download the template again.`, 'bad_request')
  const missing = EXAM_MARK_COLUMNS.filter(c => !header.includes(c))
  if (missing.length) throw mockError(`The sheet is missing the column(s) ${missing.join(', ')}. Download the template again.`, 'bad_request')
  const idx = new Map((sheet.rows[0] ?? []).map((h, i) => [norm(h), i]))
  const data = sheet.rows.slice(1).filter(r => (r[idx.get('SLNO')!] ?? '').trim())
  if (!data.length) throw mockError('There is no data in the sheet.', 'bad_request')
  if (data.length > EXAM_MARK_MAX_ROWS) throw mockError(`The sheet can have at most ${EXAM_MARK_MAX_ROWS} data rows.`, 'bad_request')

  const keyRows = new Map<string, string[]>()
  const rows = data.map(cells => {
    const cell = (c: ExamMarkColumn) => (cells[idx.get(c)!] ?? '').trim()
    const problems: ExamMarkProblem[] = []
    const add = (column: string | null, message: string) => problems.push({ column, message })
    for (const c of EXAM_MARK_COLUMNS) if (!cell(c)) add(c, `${c} is required.`)
    for (const c of ['SEMCODE', 'ACADEMICINTAKE'] as const) if (cell(c) && !/^\d+$/.test(cell(c))) add(c, `${c} must be a whole number.`)
    const mark = (c: ExamMarkColumn, isMax: boolean) => {
      const t = cell(c)
      if (!t) return null
      const n = Number(t)
      if (!Number.isFinite(n)) { add(c, `${c} must be a number.`); return null }
      if (isMax && n <= 0) add(c, `${c} must be more than 0.`)
      else if (!isMax && n < 0) add(c, `${c} cannot be negative.`)
      if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) add(c, `${c} can have at most 2 decimals.`)
      return n
    }
    const iaTotal = mark('IATOTAL', false), iaMax = mark('IAMAX', true), ueTotal = mark('UETOTAL', false), ueMax = mark('UEMAX', true)
    const sNum = cell('STUDENTNUM'), sem = cell('SEMCODE'), session = cell('ACADEMICINTAKE'), unit = cell('UNITCODE').toUpperCase()
    const student = MOCK_STUDENTS[sNum]
    if (sNum && !student) add('STUDENTNUM', 'Student not found.')
    if (session && /^\d+$/.test(session) && !MOCK_SESSIONS.has(session)) add('ACADEMICINTAKE', `Academic session ${session} not found.`)
    if (student && sem && !student.sems[sem]) add('SEMCODE', `Semester ${sem} is not part of the student's programme.`)
    else if (student && sem && unit && !student.sems[sem].includes(unit)) add('UNITCODE', `Course unit ${unit} is not part of semester ${sem} of the student's programme.`)
    if (mockExisting.has(`${sNum}|${sem}|${unit}`)) add(null, 'A result already exists for this student and course unit.')
    if (iaTotal !== null && iaMax !== null && iaTotal > iaMax) add('IATOTAL', 'IA mark is more than the IA max.')
    if (ueTotal !== null && ueMax !== null && ueTotal > ueMax) add('UETOTAL', 'UE mark is more than the UE max.')
    const slNo = cell('SLNO')
    const k = `${sNum}|${sem}|${unit}`
    keyRows.set(k, [...(keyRows.get(k) ?? []), slNo])
    const result: ExamMarkResult | null = iaTotal === null || iaMax === null || ueTotal === null || ueMax === null ? null
      : ueTotal === 0 ? 'RL' : iaTotal >= iaMax / 2 && ueTotal >= ueMax / 2 ? 'Pass' : 'Fail'
    return {
      slNo, studentNum: sNum || null, studentName: student?.name ?? (cell('STUDENTNAME') || null),
      semCode: sem || null, academicIntake: session || null, unitCode: unit || null,
      unitName: MOCK_UNIT_NAMES[unit] ?? (cell('UNITNAME') || null),
      iaTotal, iaMax, ueTotal, ueMax, result, problems, _key: k,
    }
  })
  return rows.map(({ _key, ...r }) => {
    const dupes = keyRows.get(_key) ?? []
    if (dupes.length > 1) r.problems.push({ column: null, message: `Appears more than once in the file (rows ${dupes.join(', ')}).` })
    return { ...r, result: r.problems.length ? null : r.result }
  })
}
