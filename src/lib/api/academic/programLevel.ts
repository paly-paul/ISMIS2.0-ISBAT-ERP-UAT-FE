import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a programme level record returned by the API.
export interface ProgramLevel {
  programLevelGuid: string
  levelCode: string
  levelName: string
  yearCount: number
  semCount: number
  minCreditLoad: number
  appFee: number
  lateFee: number
  intCurrency: number
  currencyCode: string
  currencyName: string
  // Not confirmed present on GET (list/by-guid) — only proven via the real
  // Create/Update payload requiring it (see ProgramLevelInput below; the
  // backend rejected intCurrency with "Currency is required"). Optional
  // until a real GET response confirms it's echoed back.
  currencyGuid?: string
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
  { programLevelGuid: '1', levelCode: 'CERT', levelName: 'Certificate / HEC',          yearCount: 1, semCount: 2, minCreditLoad: 48,  appFee: 50000, lateFee: 10000, intCurrency: 1, currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '2', levelCode: 'DIP',  levelName: 'Diploma',                    yearCount: 2, semCount: 4, minCreditLoad: 96,  appFee: 50000, lateFee: 10000, intCurrency: 1, currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '3', levelCode: 'BACH', levelName: "Bachelor's Degree",          yearCount: 3, semCount: 6, minCreditLoad: 132, appFee: 50000, lateFee: 10000, intCurrency: 1, currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '4', levelCode: 'ENG',  levelName: 'Bachelor of Engineering',    yearCount: 4, semCount: 8, minCreditLoad: 160, appFee: 50000, lateFee: 10000, intCurrency: 1, currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '5', levelCode: 'MAST', levelName: "Master's Degree",            yearCount: 2, semCount: 4, minCreditLoad: 72,  appFee: 50000, lateFee: 10000, intCurrency: 1, currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
  { programLevelGuid: '6', levelCode: 'PHD',  levelName: 'Doctor of Philosophy (PhD)', yearCount: 3, semCount: 6, minCreditLoad: 0,   appFee: 50000, lateFee: 10000, intCurrency: 1, currencyCode: 'UGX', currencyName: 'Uganda Shilling' },
]

// Fetch programme levels, optionally filtered by search text.
export function getProgramLevels(search = ''): Promise<ProgramLevel[]> {
  if (MOCK_AUTH) return Promise.resolve(mockProgramLevels)
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiGet<ProgramLevel[] | null>(`/api/v1/academic/program-levels${query}`).then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Payload used when creating or updating a programme level.
// Confirmed via real testing: the backend rejects intCurrency (Currency
// Master's legacy int) with "Currency is required" — it wants currencyGuid
// instead, matching ProcBank/Exchange-Rate's convention elsewhere.
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
      // Not part of the confirmed create payload — mock-only placeholder.
      semCount: input.yearCount * 2,
      minCreditLoad: input.minCreditLoad,
      appFee: input.appFee,
      lateFee: input.lateFee,
      // Server-resolved from currencyGuid on the real GET response — no
      // local currency list to cross-reference against here.
      intCurrency: 0,
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
    Object.assign(existing, input)
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
