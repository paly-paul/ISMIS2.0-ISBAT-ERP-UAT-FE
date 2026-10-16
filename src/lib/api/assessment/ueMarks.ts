import { apiGet, apiPost, apiPut } from '../client'
import type { UeAttendanceUnitDto } from './ueAttendance'

// Confirmed via erp-docs/api/assessment-attendance-service/assessment/
// ue-detailed-marks/*.md (2026-10-12). The grid is layout-dependent: which
// mark fields are meaningful depends on `layout`, and `maxMarks` carries the
// ceiling for each of them — fixed server-side by programme level, so the
// screens never compute limits themselves.
//
// Marking is blind: rows carry only `matchingCode` (opaque, never parsed)
// and `studentGuid` (the save key, never resolved to a name or reg. no.).

export type UeLayout = 'Theory' | 'Practical' | 'Project'

export type UeMarkField =
  | 'sectionAMark' | 'sectionBMark' | 'sectionCMark'
  | 'recordMark' | 'codingMark' | 'outputMark' | 'vivaMark'
  | 'synopsisMark' | 'reviewMark' | 'methodologyMark' | 'analysisMark'

export type UeMaxField =
  | 'sectionAMax' | 'sectionBMax' | 'sectionCMax'
  | 'recordMax' | 'codingMax' | 'outputMax' | 'vivaMax'
  | 'synopsisMax' | 'reviewMax' | 'methodologyMax' | 'analysisMax'

export type UeMarkValues = Record<UeMarkField, number | null>

export const ALL_UE_MARK_FIELDS: UeMarkField[] = [
  'sectionAMark', 'sectionBMark', 'sectionCMark',
  'recordMark', 'codingMark', 'outputMark', 'vivaMark',
  'synopsisMark', 'reviewMark', 'methodologyMark', 'analysisMark',
]

export interface UeDetailedMarkRowDto extends UeMarkValues {
  studentGuid: string
  // "{assessmentId}{legacyStudentId}"; null for a student with no legacy id.
  matchingCode: string | null
  isAbsent: boolean
  totalMark: number | null
}

export interface UeDetailedMarksGridDto {
  universityExamGuid: string
  courseUnitName: string | null
  layout: UeLayout
  isVerified: boolean
  maxMarks: Record<UeMaxField, number | null>
  // The exam rule's total — "Maximum Marks". Can differ from the sum of maxMarks.
  examRuleTotalMark: number
  rows: UeDetailedMarkRowDto[]
}

// PUT response: the saved row with the server-computed total.
export type SavedUeMarkDto = Omit<UeDetailedMarkRowDto, 'isAbsent'>

export interface VerifyUeMarksResultDto {
  universityExamGuid: string
  isVerified: boolean
}

// Columns per layout, in the legacy grid's order. Project reuses recordMark
// as "Report" (get-ue-detailed-marks.md).
export const UE_LAYOUT_FIELDS: Record<UeLayout, { field: UeMarkField; max: UeMaxField; label: string }[]> = {
  Theory: [
    { field: 'sectionAMark', max: 'sectionAMax', label: 'Section A' },
    { field: 'sectionBMark', max: 'sectionBMax', label: 'Section B' },
    { field: 'sectionCMark', max: 'sectionCMax', label: 'Section C' },
  ],
  Practical: [
    { field: 'recordMark', max: 'recordMax', label: 'Record' },
    { field: 'codingMark', max: 'codingMax', label: 'Coding' },
    { field: 'outputMark', max: 'outputMax', label: 'Output' },
    { field: 'vivaMark', max: 'vivaMax', label: 'Viva' },
  ],
  Project: [
    { field: 'synopsisMark', max: 'synopsisMax', label: 'Synopsis' },
    { field: 'reviewMark', max: 'reviewMax', label: 'Review' },
    { field: 'methodologyMark', max: 'methodologyMax', label: 'Methodology' },
    { field: 'analysisMark', max: 'analysisMax', label: 'Analysis & Findings' },
    { field: 'recordMark', max: 'recordMax', label: 'Report' },
    { field: 'vivaMark', max: 'vivaMax', label: 'Viva' },
  ],
}

// Mark columns for a grid. Theory's Section C exists only when sectionCMax is
// set (master-level programmes have no Section C).
export function ueColumnsFor(layout: UeLayout, maxMarks: Record<UeMaxField, number | null>) {
  return UE_LAYOUT_FIELDS[layout].filter(c => c.field !== 'sectionCMark' || maxMarks.sectionCMax != null)
}

// layout is numeric on the wire (0 Theory, 1 Practical, 2 Project). Strings
// are still accepted in case an older build is hit; anything else is Theory,
// same as the server's own fallback.
const LAYOUT_BY_INDEX: UeLayout[] = ['Theory', 'Practical', 'Project']
export function normalizeUeLayout(raw: unknown): UeLayout {
  if (typeof raw === 'number') return LAYOUT_BY_INDEX[raw] ?? 'Theory'
  const s = String(raw ?? '').trim().toLowerCase()
  return LAYOUT_BY_INDEX.find(l => l.toLowerCase() === s) ?? 'Theory'
}

export function getUeDetailedMarks(universityExamGuid: string): Promise<UeDetailedMarksGridDto> {
  return apiGet<UeDetailedMarksGridDto>(`/api/v1/assessment/ue-detailed-marks/${universityExamGuid}`)
    .then(data => ({
      ...data,
      layout: normalizeUeLayout(data?.layout),
      maxMarks: data?.maxMarks ?? ({} as UeDetailedMarksGridDto['maxMarks']),
      examRuleTotalMark: data?.examRuleTotalMark ?? 0,
      rows: data?.rows ?? [],
    }))
}

// Mark-entry course units: lecturer-scoped (only the units planned to the
// logged-in lecturer in the current intake, else every unit). The verify
// screen is not scoped and uses getUeAttendanceUnits instead.
export function getUeDetailedMarksUnits(programGuid: string, semesterGuid: string): Promise<UeAttendanceUnitDto[]> {
  const qs = new URLSearchParams({ programGuid, semesterGuid })
  return apiGet<UeAttendanceUnitDto[] | null>(`/api/v1/assessment/ue-detailed-marks/units?${qs.toString()}`)
    .then(data => data ?? [])
}

// One student per call (insert-or-update). Every field of the exam's layout
// is required; every other field must be null. totalMark is server-computed.
export function saveStudentUeMark(universityExamGuid: string, studentGuid: string, marks: UeMarkValues): Promise<SavedUeMarkDto> {
  return apiPut<SavedUeMarkDto>(`/api/v1/assessment/ue-detailed-marks/${universityExamGuid}/students/${studentGuid}`, marks)
}

export function verifyUeMarks(universityExamGuid: string): Promise<VerifyUeMarksResultDto> {
  return apiPost<VerifyUeMarksResultDto>(`/api/v1/assessment/ue-detailed-marks/${universityExamGuid}/verify`, {})
}
