import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// ProgramLevelDto, per erp-docs/api/academic-service/academic/program-levels.
// semCount is derived server-side (yearCount * 2). currencyCode/currencyName
// are resolved from Finance and come back as '' (not null) when unresolvable.
export interface ProgramLevel {
  programLevelGuid: string
  levelCode: string
  levelName: string
  yearCount: number
  semCount: number
  minCreditLoad: number
  appFee: number
  lateFee: number
  currencyGuid: string
  currencyCode: string
  currencyName: string
}

// Previous hardcoded rows (pre GET /api/v1/academic/program-levels
// integration) — noIA and linkedProgs aren't part of the confirmed real
// response, kept here for reference until/unless the backend adds them.
// const mockRows = [
//   { code: 'CERT', name: "Certificate / HEC",          years: 1, sems: 2, minCredits: 48,  noIA: 'No',  linkedProgs: 3 },
//   { code: 'DIP',  name: "Diploma",                    years: 2, sems: 4, minCredits: 96,  noIA: 'No',  linkedProgs: 5 },
//   { code: 'BACH', name: "Bachelor's Degree",           years: 3, sems: 6, minCredits: 132, noIA: 'No',  linkedProgs: 12 },
//   { code: 'ENG',  name: "Bachelor of Engineering",    years: 4, sems: 8, minCredits: 160, noIA: 'No',  linkedProgs: 4 },
//   { code: 'MAST', name: "Master's Degree",             years: 2, sems: 4, minCredits: 72,  noIA: 'No',  linkedProgs: 6 },
//   { code: 'PHD',  name: "Doctor of Philosophy (PhD)", years: 3, sems: 6, minCredits: 0,   noIA: 'Yes', linkedProgs: 2 },
// ]

const mockProgramLevels: ProgramLevel[] = [
  { programLevelGuid: '1', levelCode: 'CERT', levelName: 'Certificate / HEC',          yearCount: 1, semCount: 2, minCreditLoad: 48,  appFee: 50000, lateFee: 10000, currencyGuid: 'ugx', currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '2', levelCode: 'DIP',  levelName: 'Diploma',                    yearCount: 2, semCount: 4, minCreditLoad: 96,  appFee: 50000, lateFee: 10000, currencyGuid: 'ugx', currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '3', levelCode: 'BACH', levelName: "Bachelor's Degree",          yearCount: 3, semCount: 6, minCreditLoad: 132, appFee: 50000, lateFee: 10000, currencyGuid: 'ugx', currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '4', levelCode: 'ENG',  levelName: 'Bachelor of Engineering',    yearCount: 4, semCount: 8, minCreditLoad: 160, appFee: 50000, lateFee: 10000, currencyGuid: 'ugx', currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '5', levelCode: 'MAST', levelName: "Master's Degree",            yearCount: 2, semCount: 4, minCreditLoad: 72,  appFee: 50000, lateFee: 10000, currencyGuid: 'ugx', currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '6', levelCode: 'PHD',  levelName: 'Doctor of Philosophy (PhD)', yearCount: 3, semCount: 6, minCreditLoad: 1,   appFee: 50000, lateFee: 10000, currencyGuid: 'ugx', currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
]

export interface ProgramLevelListResponse {
  items: ProgramLevel[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// GET /program-levels is paged since 2026-10-09 (get-program-levels.md):
// PagedResult with ?page (default 1) and ?pageSize (default 10, unbounded).
// The table and the infinite-scroll pickers page on the server.
export function getProgramLevelsPaged(page = 1, pageSize = 20, search = ''): Promise<ProgramLevelListResponse> {
  const q = search.trim()
  if (MOCK_AUTH) {
    const rows = q
      ? mockProgramLevels.filter(level => `${level.levelCode} ${level.levelName}`.toLowerCase().includes(q.toLowerCase()))
      : mockProgramLevels
    const start = (page - 1) * pageSize
    return Promise.resolve({ items: rows.slice(start, start + pageSize), totalCount: rows.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q) params.set('search', q)
  return apiGet<ProgramLevelListResponse>(`/api/v1/academic/program-levels?${params}`)
}

// Every level in one request, for callers that resolve guids to names
// (Programme Master, Repetition Tag). Without an explicit pageSize the
// endpoint stops at its default 10. There are only a handful of levels.
const ALL_LEVELS_PAGE_SIZE = 1000

// Fetch programme levels, optionally filtered by search text.
export function getProgramLevels(search = ''): Promise<ProgramLevel[]> {
  return getProgramLevelsPaged(1, ALL_LEVELS_PAGE_SIZE, search).then(res => res?.items ?? [])
}

// GET /program-levels/dropdown (get-program-levels-dropdown.md) — lightweight
// picker list, ordered by the level's own sequence (IntLevel). `guid` is the
// programLevelGuid.
export interface ProgramLevelDropdownItem {
  guid: string
  id: number
  name: string
}

export function getProgramLevelsDropdown(): Promise<ProgramLevelDropdownItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockProgramLevels.map((l, i) => ({ guid: l.programLevelGuid, id: i + 1, name: l.levelName })))
  }
  return apiGet<ProgramLevelDropdownItem[] | null>('/api/v1/academic/program-levels/dropdown').then(data => data ?? [])
}

// Body for POST and PUT. semCount is not accepted (derived server-side).
// currencyGuid is required on both, even though PUT's DTO marks it nullable,
// because the validator still rejects it when it's missing.
export interface ProgramLevelInput {
  levelCode: string
  levelName: string
  yearCount: number
  minCreditLoad: number
  appFee: number
  lateFee: number
  currencyGuid: string
}

let mockProgramLevelSeq = mockProgramLevels.length + 1

// Create a new programme level and return the saved record.
export function createProgramLevel(input: ProgramLevelInput): Promise<ProgramLevel> {
  if (MOCK_AUTH) {
    const level: ProgramLevel = {
      programLevelGuid: String(mockProgramLevelSeq++),
      levelCode: input.levelCode,
      levelName: input.levelName,
      yearCount: input.yearCount,
      semCount: input.yearCount * 2,
      minCreditLoad: input.minCreditLoad,
      appFee: input.appFee,
      lateFee: input.lateFee,
      // Server-resolved from currencyGuid on the real response.
      currencyCode: '',
      currencyName: '',
      currencyGuid: input.currencyGuid,
    }
    mockProgramLevels.push(level)
    return Promise.resolve(level)
  }
  return apiPost<ProgramLevel>('/api/v1/academic/program-levels', input)
}

// Fetch one programme level by its GUID.
export function getProgramLevelById(guid: string): Promise<ProgramLevel> {
  if (MOCK_AUTH) {
    const existing = mockProgramLevels.find(p => p.programLevelGuid === guid)
    if (!existing) return Promise.reject(new Error('Programme level not found'))
    return Promise.resolve(existing)
  }
  return apiGet<ProgramLevel>(`/api/v1/academic/program-levels/${guid}`)
}

// Update a programme level by GUID and return the updated record.
export function updateProgramLevel(guid: string, input: ProgramLevelInput): Promise<ProgramLevel> {
  if (MOCK_AUTH) {
    const existing = mockProgramLevels.find(p => p.programLevelGuid === guid)
    if (!existing) return Promise.reject(new Error('Programme level not found'))
    Object.assign(existing, input, { semCount: input.yearCount * 2 })
    return Promise.resolve(existing)
  }
  return apiPut<ProgramLevel>(`/api/v1/academic/program-levels/${guid}`, input)
}

// Delete a programme level and return true when the API confirms success.
export function deleteProgramLevel(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockProgramLevels.findIndex(p => p.programLevelGuid === guid)
    if (index === -1) return Promise.reject(new Error('Programme level not found'))
    mockProgramLevels.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/program-levels/${guid}`)
}
