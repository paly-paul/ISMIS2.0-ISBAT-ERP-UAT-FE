import { apiGet, apiPostForm } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface UeMarkImportUnit {
  courseUnitGuid: string
  courseUnitCode: string
  courseUnitName: string
}

export interface UeMarkImportExam {
  universityExamGuid: string
  layout: number
  maxMarks: {
    sectionAMax: number | null
    sectionBMax: number | null
    sectionCMax: number | null
    recordMax: number | null
    codingMax: number | null
    outputMax: number | null
    vivaMax: number | null
    synopsisMax: number | null
    reviewMax: number | null
    methodologyMax: number | null
    analysisMax: number | null
  }
  // The exam rule's total maximum — the "Maximum Marks" header (2026-10-12).
  examRuleTotalMark: number
  isVerified: boolean
}

export interface UeMarkImportTemplateResponse {
  url?: string
  expiresAtUtc?: string
  blob?: Blob
  filename?: string | null
}

export interface UeMarkImportPreviewItem {
  slNo: string
  matchingCode: string
  studentGuid: string
  regNo: string
  studentName: string
  sectionAMark: number | null
  sectionBMark: number | null
  sectionCMark: number | null
  recordMark: number | null
  codingMark: number | null
  outputMark: number | null
  vivaMark: number | null
  synopsisMark: number | null
  reviewMark: number | null
  methodologyMark: number | null
  analysisMark: number | null
}

export interface UeMarkImportFileParams {
  file: File
  sheetName?: string
  universityExamGuid: string
}

export interface UeMarkImportResult {
  success: boolean
  message: string
}

const mockUnits: UeMarkImportUnit[] = [
  { courseUnitGuid: 'dse1101-guid', courseUnitCode: 'DSE1101', courseUnitName: 'Office Automation' },
  { courseUnitGuid: 'dse1102-guid', courseUnitCode: 'DSE1102', courseUnitName: 'Programming in C' }
]

const mockExam: UeMarkImportExam = {
  universityExamGuid: 'mock-exam-guid',
  layout: 0, // Theory layout
  maxMarks: {
    sectionAMax: 20, sectionBMax: 50, sectionCMax: 30,
    recordMax: null, codingMax: null, outputMax: null, vivaMax: null,
    synopsisMax: null, reviewMax: null, methodologyMax: null, analysisMax: null
  },
  examRuleTotalMark: 100,
  isVerified: false
}

const mockPreview: UeMarkImportPreviewItem[] = [
  {
    slNo: '1', matchingCode: '32444493', studentGuid: 'std-1', regNo: '022240764', studentName: 'Turyasingura Joab',
    sectionAMark: 15, sectionBMark: 50, sectionCMark: 18,
    recordMark: null, codingMark: null, outputMark: null, vivaMark: null,
    synopsisMark: null, reviewMark: null, methodologyMark: null, analysisMark: null
  }
]

export function getUeMarkImportUnits(programGuid: string, semesterGuid: string): Promise<UeMarkImportUnit[]> {
  if (MOCK_AUTH) return Promise.resolve(mockUnits)
  const params = new URLSearchParams({
    programGuid: programGuid?.toUpperCase() || '',
    semesterGuid: semesterGuid?.toUpperCase() || ''
  })
  return apiGet<any>(`/api/v1/assessment/ue-mark-import/units?${params.toString()}`)
    .then(data => Array.isArray(data) ? data : (data?.data ?? []))
}

export function getUeMarkImportExam(
  programGuid: string,
  semesterGuid: string,
  courseUnitGuid: string,
  intakeGuid: string,
  ueType: number
): Promise<UeMarkImportExam> {
  if (MOCK_AUTH) return Promise.resolve(mockExam)
  const params = new URLSearchParams({
    programGuid: programGuid?.toUpperCase() || '',
    semesterGuid: semesterGuid?.toUpperCase() || '',
    courseUnitGuid: courseUnitGuid?.toUpperCase() || '',
    intakeGuid: intakeGuid?.toUpperCase() || '',
    ueType: String(ueType),
  })
  return apiGet<UeMarkImportExam>(`/api/v1/assessment/ue-mark-import/exam?${params.toString()}`)
}

export async function getUeMarkImportTemplate(universityExamGuid: string): Promise<UeMarkImportTemplateResponse> {
  if (MOCK_AUTH) return { url: 'https://example.com/mock-template.xlsx', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() }
  const params = new URLSearchParams({ universityExamGuid: universityExamGuid?.toUpperCase() || '' })
  const res = await fetch(`/api/v1/assessment/ue-mark-import/template?${params.toString()}`, {
    method: 'GET',
    headers: { 'ngrok-skip-browser-warning': 'true' },
    credentials: 'include',
  })

  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const json = await res.json().catch(() => null)
    if (!res.ok || (json && json.success === false)) {
      const errMsg = json?.message || (Array.isArray(json?.errors) ? json.errors[0] : null) || json?.title || `Error ${res.status}`
      throw new Error(errMsg)
    }
    const downloadUrl = json?.data?.url || json?.url || (typeof json?.data === 'string' ? json.data : null)
    if (downloadUrl) {
      return { url: downloadUrl, expiresAtUtc: json?.data?.expiresAtUtc || json?.expiresAtUtc || '' }
    }
    if (json?.data && typeof json.data === 'object' && json.data.downloadUrl) {
      return { url: json.data.downloadUrl, expiresAtUtc: json.data.expiresAtUtc || '' }
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    let extractedMsg = errorText
    try {
      const parsed = JSON.parse(errorText)
      extractedMsg = parsed?.message || (Array.isArray(parsed?.errors) ? parsed.errors[0] : null) || parsed?.title || errorText
    } catch {
      // plain text error
    }
    throw new Error(extractedMsg || `Failed to download template (HTTP ${res.status})`)
  }

  const disposition = res.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i)
  const filename = match ? decodeURIComponent(match[1]) : 'UE_Mark_Import_Template.xlsx'
  const blob = await res.blob()
  return { blob, filename }
}

export function postUeMarkImportSheets(file: File): Promise<string[]> {
  if (MOCK_AUTH) return Promise.resolve(['Theory_Template_20260928', 'Project_Template_20260928'])
  const formData = new FormData()
  formData.append('file', file)
  return apiPostForm<string[]>('/api/v1/assessment/ue-mark-import/sheets', formData)
    .then(data => data ?? [])
}

export function postUeMarkImportPreview(params: UeMarkImportFileParams): Promise<UeMarkImportPreviewItem[]> {
  if (MOCK_AUTH) return Promise.resolve(mockPreview)
  const formData = new FormData()
  formData.append('file', params.file)
  if (params.sheetName) formData.append('SheetName', params.sheetName)
  formData.append('UniversityExamGuid', params.universityExamGuid?.toUpperCase() || '')

  return apiPostForm<UeMarkImportPreviewItem[]>('/api/v1/assessment/ue-mark-import/preview', formData)
    .then(data => data ?? [])
}

export function postUeMarkImportImport(params: UeMarkImportFileParams): Promise<UeMarkImportResult> {
  if (MOCK_AUTH) return Promise.resolve({ success: true, message: 'Marks Saved successfully......! (Mocked)' })
  const formData = new FormData()
  formData.append('file', params.file)
  if (params.sheetName) formData.append('SheetName', params.sheetName)
  formData.append('UniversityExamGuid', params.universityExamGuid?.toUpperCase() || '')

  return apiPostForm<boolean>('/api/v1/assessment/ue-mark-import/import', formData)
    .then(data => ({
      success: Boolean(data),
      message: 'Marks Saved successfully......!',
    }))
}
