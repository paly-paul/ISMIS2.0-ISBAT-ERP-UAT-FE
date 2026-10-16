import { apiGet, apiGetBlob, apiPost } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface HecDropdownItem {
  value: string
  label: string
}

// GET /academic/intakes/hec-graduation-dropdown — intakes from 20222 on,
// newest first. Label `description (intakeCode)` (hec-graduate-transcript-page.md).
export function getHecIntakesDropdown(): Promise<HecDropdownItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { value: 'hec-intk-20261', label: 'Spring 2026 (20261)' },
      { value: 'hec-intk-20253', label: 'Fall 2025 (20253)' },
      { value: 'hec-intk-20222', label: 'Summer 2022 (20222)' },
    ])
  }
  return apiGet<any[] | null>('/api/v1/academic/intakes/hec-graduation-dropdown').then(rows =>
    (rows ?? []).map(r => ({
      value: r.value ?? r.intakeGuid ?? r.guid,
      label: r.label ?? (r.description ? `${r.description} (${r.intakeCode})` : String(r.intakeCode ?? '')),
    })),
  )
}

// GET /academic/program-groups/hec-graduation-dropdown — HEC and HECHS only.
// Label `name (id)`.
export function getHecProgramsDropdown(): Promise<HecDropdownItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { value: 'pg-hec', label: 'Higher Education Certificate (HEC)' },
      { value: 'pg-hechs', label: 'Higher Education Certificate in Health Sciences (HECHS)' },
    ])
  }
  return apiGet<any[] | null>('/api/v1/academic/program-groups/hec-graduation-dropdown').then(rows =>
    (rows ?? []).map(r => ({
      value: r.value ?? r.guid ?? r.programGroupGuid,
      label: r.label ?? (r.name && r.id ? `${r.name} (${r.id})` : r.name ?? ''),
    })),
  )
}

// GET /academic/program-groups/dropdown — every program group (the general
// Graduate Transcript page). The HEC page uses getHecProgramsDropdown.
export function getProgramGroupsDropdown(): Promise<HecDropdownItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { value: 'pg-1', label: 'Bachelor of Information Technology' },
      { value: 'pg-2', label: 'Bachelor of Business Administration' },
      { value: 'pg-3', label: 'Higher Education Certificate' },
    ])
  }
  return apiGet<any[] | null>('/api/v1/academic/program-groups/dropdown').then(rows =>
    (rows ?? []).map(r => ({
      value: r.value ?? r.guid ?? r.programGroupGuid ?? r.id,
      label: r.label ?? r.name ?? r.programGroupName ?? r.description ?? '',
    })),
  )
}

export interface GraduateTranscriptPendingRow {
  studentGuid: string
  studentNumber: string | null
  studentName: string | null
  programGuid: string | null
  programName: string | null
}

export interface GraduateTranscriptGenerateRequest {
  academicIntakeGuid: string
  examMonth: number
  examYear: number
  studentGuids: string[]
}

export interface GraduateTranscriptGenerateResponse {
  requested: number
  created: number
  refreshed: number
}

export function getGraduateTranscriptPending(academicIntakeGuid: string, programGuid?: string) {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { studentGuid: 'st-1', studentNumber: '012221001', studentName: 'Alice Smith', programGuid: programGuid || 'p-1', programName: 'BSc IT' },
      { studentGuid: 'st-2', studentNumber: '012221002', studentName: 'Bob Jones', programGuid: programGuid || 'p-1', programName: 'BSc IT' },
      { studentGuid: 'st-3', studentNumber: '012221003', studentName: 'Charlie Brown', programGuid: programGuid || 'p-1', programName: 'BSc IT' },
    ] as GraduateTranscriptPendingRow[])
  }
  
  const qs = new URLSearchParams()
  qs.set('academicIntakeGuid', academicIntakeGuid || '')
  if (programGuid) qs.set('programGuid', programGuid)
  
  return apiGet<GraduateTranscriptPendingRow[]>(`/api/v1/assessment/graduate-transcript/pending?${qs.toString()}`)
}

export function generateGraduateTranscripts(req: GraduateTranscriptGenerateRequest) {
  if (MOCK_AUTH) {
    return new Promise<GraduateTranscriptGenerateResponse>(resolve => {
      setTimeout(() => {
        resolve({
          requested: req.studentGuids.length,
          created: req.studentGuids.length - 1,
          refreshed: 1
        })
      }, 1000)
    })
  }
  return apiPost<GraduateTranscriptGenerateResponse>(`/api/v1/assessment/graduate-transcript/generate`, req)
}

export interface GraduateTranscriptCollectionRow {
  transcriptGuid: string
  studentGuid: string | null
  studentNumber: string | null
  studentName: string | null
  programName: string | null
  collectionDate: string | null
  collectedByName: string | null
  phone: string | null
}

export function searchGraduateTranscriptCollection(searchTerm: string) {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { transcriptGuid: 'tg-1', studentGuid: 'sg-1', studentNumber: '012221999', studentName: 'JANE DOE SAMPLE', programName: 'BSc IT', collectionDate: null, collectedByName: null, phone: null },
      { transcriptGuid: 'tg-2', studentGuid: 'sg-2', studentNumber: '012222000', studentName: 'JOHN SMITH', programName: 'BSc CS', collectionDate: '2026-10-01T10:00:00Z', collectedByName: 'SELF', phone: null }
    ].filter(x => x.studentNumber?.includes(searchTerm) || x.studentName?.toLowerCase().includes(searchTerm.toLowerCase())) as GraduateTranscriptCollectionRow[])
  }
  
  const qs = new URLSearchParams()
  qs.set('searchTerm', searchTerm)
  return apiGet<GraduateTranscriptCollectionRow[]>(`/api/v1/assessment/graduate-transcript/collection/search?${qs.toString()}`)
}

// GET /graduate-transcript/{transcriptGuid}/pdf — the single-page certificate
// with the QR and console number baked in.
export function getGraduateTranscriptPdf(transcriptGuid: string): Promise<{ blob: Blob; filename: string | null }> {
  if (MOCK_AUTH) {
    return Promise.resolve({ blob: new Blob(['%PDF-1.4 mock graduate transcript'], { type: 'application/pdf' }), filename: `Graduate_Transcript_${transcriptGuid}.pdf` })
  }
  return apiGetBlob(`/api/v1/assessment/graduate-transcript/${encodeURIComponent(transcriptGuid)}/pdf`)
}

export interface RecordCollectionRequest {
  transcriptGuid: string
  collectedByName: string
  phone: string | null
}

export function recordGraduateTranscriptCollection(req: RecordCollectionRequest) {
  if (MOCK_AUTH) {
    return Promise.resolve(true)
  }
  return apiPost<boolean>(`/api/v1/assessment/graduate-transcript/${req.transcriptGuid}/collection`, {
    collectedByName: req.collectedByName,
    phone: req.phone
  })
}
