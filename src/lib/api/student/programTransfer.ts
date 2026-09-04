import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Student module's Programme Transfer page (see
// student/prog-transfer/page.tsx). Confirmed against students/program-transfer/
// *.md (2026-08-18/28) — this fills in the "New Batch"/"New Semester"/
// "New Fee Structure" dropdowns and the transfer history grid that used to
// be TARGET_BATCHES/TARGET_SEMESTERS/TARGET_FEE_STRUCTURES/TRANSFER_HISTORY
// mock constants, plus the actual submit endpoint.

export interface ProgramTransferDetail {
  studentGuid: string
  studentNum: string | null
  studentName: string | null
  programGuid: string | null
  programName: string | null
  programCode: string | null
  semesterGuid: string | null
  semesterName: string | null
  currentBatchGuid: string | null
  currentBatchCode: string | null
  campusGuid: string | null
  campusName: string | null
  intakeGuid: string | null
  intakeDescription: string | null
  // admissionType is a raw numeric code (1 = "Regular Student", ...) — not
  // documented as an enum anywhere in the students/ doc set, so admissionTypeLabel
  // (confirmed live, 2026-09-04) is what actually gets displayed; admissionType
  // itself is kept only as a last-resort fallback if a response ever omits the label.
  admissionType: string | null
  admissionTypeLabel?: string | null
  feeGuid: string | null
  feeCode: string | null
  feeDesc: string | null
  discountGuid: string | null
  discountName: string | null
  // Confirmed live (2026-09-04) alongside discountGuid/discountName above —
  // not in the original doc sample, so optional rather than assumed always present.
  discountCode?: string | null
  discountAmtPer?: number | null
  // 1 = Amount, 2 = Percentage — same convention as StudentDetailDto's own calcType.
  discountCalcType?: number | null
}

export interface ProgramTransferBatchOption {
  batchGuid: string
  batchCode: string
}

// Confirmed via a real GET .../program-transfer/fee-structures response
// (2026-09-01) — the guid field is feeHdGuid, not feeGuid as the doc's own
// sample promised. This mismatch was silent rather than a crash: SearchSelect
// matches an option by `value === current`, so an option whose value read as
// undefined (accessing the nonexistent f.feeGuid) still displayed its label
// once picked — undefined selected against undefined current still "matches"
// — while the page's targetFeeStructure state stayed undefined underneath,
// which is exactly why Execute Transfer stayed disabled (and would have
// submitted newFeeId: undefined) even though the field looked filled in.
export interface ProgramFeeStructureOption {
  feeHdGuid: string
  intFee: number
  feeCode: string
  feeDesc: string
}

export interface ProgramTransferHistoryRow {
  programTransferId: string
  programTransferCode: string
  programTransferDate: string
  oldProgramGuid: string | null
  oldProgramName: string | null
  newProgramGuid: string | null
  newProgramName: string | null
  newBatchGuid: string | null
  newBatchCode: string | null
  newSemesterGuid: string | null
  newSemesterName: string | null
  newFeeGuid: string | null
  remarks: string | null
}

export interface ProgramTransferInput {
  newProgramGuid: string
  newBatchGuid: string
  newSemesterGuid: string
  newFeeGuid: string
  remarks?: string | null
}

export interface ProgramTransferResult {
  programTransferId: string
  programTransferCode: string
  newStudentRegNo: string | null
  newStudentNum: string | null
  regNoRegenerated: boolean
}

const mockBatches: ProgramTransferBatchOption[] = [
  { batchGuid: 'batch-mock-a', batchCode: 'BSc.AF-2024B · Evening' },
  { batchGuid: 'batch-mock-b', batchCode: 'BSc.AF-2025A · Day' },
]

const mockFeeStructures: ProgramFeeStructureOption[] = [
  { feeHdGuid: 'fee-mock-a', intFee: 0, feeCode: 'LOCAL.650', feeDesc: 'Local · $650/sem' },
  { feeHdGuid: 'fee-mock-b', intFee: 0, feeCode: 'LOCAL.750', feeDesc: 'Local · $750/sem' },
  { feeHdGuid: 'fee-mock-c', intFee: 0, feeCode: 'INTL.1200', feeDesc: 'International · $1200/sem' },
]

export function getProgramTransferDetail(studentGuid: string): Promise<ProgramTransferDetail> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      studentGuid, studentNum: null, studentName: null, programGuid: null, programName: null, programCode: null,
      semesterGuid: null, semesterName: null, currentBatchGuid: null, currentBatchCode: null, campusGuid: null,
      campusName: 'ISBAT University - Main Campus', intakeGuid: null, intakeDescription: 'Fall 2024', admissionType: 'Local',
      feeGuid: 'fee-mock-b', feeCode: 'LOCAL.750', feeDesc: 'Local · $750/sem', discountGuid: null, discountName: null,
    })
  }
  return apiGet<ProgramTransferDetail>(`/api/v1/students/${studentGuid}/program-transfer/detail`)
}

export function getProgramTransferBatches(programGuid: string, semesterGuid: string): Promise<ProgramTransferBatchOption[]> {
  if (MOCK_AUTH) return Promise.resolve(mockBatches)
  const params = new URLSearchParams({ programGuid, semesterGuid })
  return apiGet<ProgramTransferBatchOption[] | null>(`/api/v1/students/program-transfer/batches?${params.toString()}`)
    .then(data => data ?? [])
}

export function getProgramTransferFeeStructures(programGuid: string): Promise<ProgramFeeStructureOption[]> {
  if (MOCK_AUTH) return Promise.resolve(mockFeeStructures)
  const params = new URLSearchParams({ programGuid })
  return apiGet<ProgramFeeStructureOption[] | null>(`/api/v1/students/program-transfer/fee-structures?${params.toString()}`)
    .then(data => data ?? [])
}

export function getProgramTransferHistory(studentGuid: string): Promise<ProgramTransferHistoryRow[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<ProgramTransferHistoryRow[] | null>(`/api/v1/students/${studentGuid}/program-transfer/history`)
    .then(data => data ?? [])
}

export function postProgramTransfer(studentGuid: string, input: ProgramTransferInput): Promise<ProgramTransferResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      programTransferId: `ptx-mock-${Date.now()}`, programTransferCode: `PT/MOCK/${Math.floor(Math.random() * 100)}`,
      newStudentRegNo: null, newStudentNum: null, regNoRegenerated: false,
    })
  }
  return apiPost<ProgramTransferResult>(`/api/v1/students/${studentGuid}/program-transfer`, input)
}
