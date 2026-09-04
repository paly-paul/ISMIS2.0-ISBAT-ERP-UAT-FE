import { apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Shared header-field shape — used both standalone (the old header-only
// endpoint, since removed) and as the base for the combined save-complete
// payload below. Confirmed shape via Academic/Fee-Structure/CreateHeader.bru.
export interface ProgramFeeStructureHeaderInput {
  feeCode: string
  feeDesc: string
  status: boolean
  localOrForeign: boolean
  programGuid: string
  lef: number | null
  cef: number | null
  ace: number | null
  lec: number | null
  cec: number | null
  acec: number | null
  calcType: number
  amtPer: number | null
  intakeGuid: string | null
}

// Confirmed via a real POST response (from the old header-only endpoint):
// guid key is feeHdGuid (not feeStructureHdGuid), and it echoes the input
// fields back plus a programFees array. Reused as the save-complete response
// shape too — not independently confirmed for that endpoint, but the same
// resource, so a reasonable best-effort assumption until seen live.
export interface ProgramFeeStructureHeader extends ProgramFeeStructureHeaderInput {
  feeHdGuid: string
  programFees: unknown[]
}

// One fee line inside a save-complete payload — semesterGuid is a real guid
// here, unlike Program Master's own embedded fee structure (semCode, a
// 1-based int position) — see the note on FeeLineUpdateInput in
// programMaster.ts for that other convention.
export interface ProgramFeeLineSaveInput {
  semesterGuid: string
  ledgerGuid: string
  currencyGuid: string
  ledgerNum: number
  amount: number
}

// Confirmed via the user-provided save-complete payload — combines the
// header fields above with feeLines in one request, replacing the old
// header-only endpoint + a separate (never-built) line-item endpoint.
export interface ProgramFeeStructureSaveCompleteInput extends ProgramFeeStructureHeaderInput {
  feeLines: ProgramFeeLineSaveInput[]
}

let mockHeaderSeq = 1

export function saveProgramFeeStructureComplete(input: ProgramFeeStructureSaveCompleteInput): Promise<ProgramFeeStructureHeader> {
  if (MOCK_AUTH) {
    return Promise.resolve({ ...input, feeHdGuid: String(mockHeaderSeq++), programFees: input.feeLines })
  }
  return apiPost<ProgramFeeStructureHeader>('/api/v1/academic/Programfee-structure/hd/save-complete', input)
}

interface ProgramFeeStructureListResult {
  items: ProgramFeeStructureHeader[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// GET /api/v1/academic/Programfee-structure — confirmed via a real response:
// same header shape as save-complete's own response (ProgramFeeStructureHeader
// above), paginated. Backs the standalone /academic/fee-structure page's main
// table, previously still rendering local MOCK_FEES with nothing wired up at
// all (program_master_frontend_fixes.md, "Fee Structure (Main Menu) - Get All
// API Not Integrated"). programGuid is an optional filter — the page itself
// doesn't offer a programme filter yet, but the query param is real and
// worth exposing now rather than adding it as a second breaking change later.
// search is forwarded to the endpoint's own ?search= param (same convention
// as getIntakes/getSkills) rather than filtered client-side — not confirmed
// against a spec, so callers pair it with a client-side re-filter of
// whatever comes back, keeping results correct even if the backend doesn't
// actually recognize the param.
export function getProgramFeeStructures(pageNumber = 1, pageSize = 20, programGuid?: string, search = ''): Promise<ProgramFeeStructureListResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({ items: [], totalCount: 0, pageNumber, pageSize })
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (programGuid) params.set('programGuid', programGuid)
  const q = search.trim()
  if (q) params.set('search', q)
  return apiGet<ProgramFeeStructureListResult | null>(`/api/v1/academic/Programfee-structure?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// One real fee line as returned by GET fee-lines/:feeHdGuid. ledgerNum here
// is confirmed to be an independent, real per-line priority set by whoever
// created the structure — a real sample has three lines for the same
// semester listed as ledgerNum 1/3/2, not matching their array order at all.
// This is genuinely different from Program Master's own EMBEDDED fee
// structure, where LedgerNum turned out to need deriving from array position
// instead (see the note on FeeLineUpdateInput in programMaster.ts) — two
// separate backend resources, two different LedgerNum conventions, don't
// conflate them.
export interface ProgramFeeLineDetail {
  programGuid: string
  semesterGuid: string
  ledgerGuid: string
  ledgerName: string
  ledgerNum: number
  currencyGuid: string
  currencyName: string
  amount: number
}

// Fetch-by-guid convention, mirrors the rest of the app's real Edit modals —
// backs FeeStructureModal's Edit mode, which previously had no real fee-line
// data at all (editData was a purely decorative prefill: programme code,
// fee code, description, a display-only currency string — no feeHdGuid, no
// fetch of any kind).
export function getProgramFeeLines(feeHdGuid: string): Promise<ProgramFeeLineDetail[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<ProgramFeeLineDetail[] | null>(`/api/v1/academic/Programfee-structure/fee-lines/${feeHdGuid}`)
    .then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Confirmed via a real update-complete payload — same shape as
// ProgramFeeStructureHeaderInput, plus feeHdGuid carried in the body itself
// (not just the URL).
export interface ProgramFeeStructureUpdateInput extends ProgramFeeStructureHeaderInput {
  feeHdGuid: string
  feeLines: ProgramFeeLineSaveInput[]
}

export function updateProgramFeeStructureComplete(feeHdGuid: string, input: ProgramFeeStructureUpdateInput): Promise<ProgramFeeStructureHeader> {
  if (MOCK_AUTH) {
    return Promise.resolve({ ...input, programFees: input.feeLines })
  }
  return apiPut<ProgramFeeStructureHeader>(`/api/v1/academic/Programfee-structure/hd/${feeHdGuid}/update-complete`, input)
}
