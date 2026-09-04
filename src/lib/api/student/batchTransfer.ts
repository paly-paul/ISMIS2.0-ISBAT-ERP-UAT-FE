import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs Batch Transfer (student/batch-transfer/page.tsx). Confirmed via
// students/batch-transfer/*.md (2026-08-19) — a real, dedicated batch-
// transfer surface exists after all, replacing the earlier reuse of
// students/resume/* ("Student Resuming") this page used before. That reuse
// is gone: this endpoint only ever moves a student's batch within the same
// program (never semester/fee — POST's own request body is just
// newBatchGuid + remarks), has its own real GET history endpoint (the old
// resume-based wiring had none, so the Transfer History grid always
// rendered empty), and writes its own T_BATCH_TRANSFER audit trail rather
// than a generic "Resuming Student" T_STUDENT_RESUME row.
export interface StudentBatchDetailDto {
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
  discountGuid: string | null
  discountName: string | null
  feeGuid: string | null
  feeCode: string | null
  feeDesc: string | null
  intakeGuid: string | null
  intakeDescription: string | null
}

export interface EligibleBatchDto {
  batchGuid: string
  batchCode: string
}

export interface BatchTransferRequest {
  newBatchGuid: string
  remarks: string | null
}

export interface BatchTransferResultDto {
  batchTransferGuid: string
  transferCode: string
  transferDate: string
  oldBatchGuid: string | null
  oldBatchCode: string | null
  newBatchGuid: string
  newBatchCode: string
}

export interface BatchTransferHistoryItemDto {
  batchTransferGuid: string
  transferCode: string | null
  transferDate: string
  studentName: string | null
  studentRegNo: string | null
  oldBatchGuid: string | null
  oldBatchCode: string | null
  newBatchGuid: string | null
  newBatchCode: string | null
  remarks: string | null
}

const mockDetail: Omit<StudentBatchDetailDto, 'studentGuid' | 'studentNum' | 'studentName'> = {
  programGuid: 'mock-program', programName: 'BSc. Information Technology', programCode: 'BSCIT',
  semesterGuid: 'mock-semester', semesterName: 'Year One - Semester One',
  currentBatchGuid: 'mock-batch-current', currentBatchCode: 'BSCIT-2024A',
  campusGuid: 'mock-campus', campusName: 'ISBAT University - Main Campus',
  discountGuid: null, discountName: null,
  feeGuid: 'mock-fee', feeCode: 'BSC.IT.DA.LCL', feeDesc: 'BSc. IT — Day · Local',
  intakeGuid: 'mock-intake', intakeDescription: 'Fall 2024',
}
const mockEligibleBatches: EligibleBatchDto[] = [
  { batchGuid: 'mock-batch-1', batchCode: 'BSCIT-2024B' },
  { batchGuid: 'mock-batch-2', batchCode: 'BSCIT-2025A' },
]

export function getBatchTransferDetail(studentGuid: string, mockSeed: { studentRegNo: string; studentName: string }): Promise<StudentBatchDetailDto> {
  if (MOCK_AUTH) return Promise.resolve({ studentGuid, studentNum: mockSeed.studentRegNo, studentName: mockSeed.studentName, ...mockDetail })
  return apiGet<StudentBatchDetailDto>(`/api/v1/students/${studentGuid}/batch-transfer/detail`)
}

export function getEligibleBatches(studentGuid: string): Promise<EligibleBatchDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockEligibleBatches)
  return apiGet<EligibleBatchDto[] | null>(`/api/v1/students/${studentGuid}/batch-transfer/eligible-batches`).then(data => data ?? [])
}

export function postBatchTransfer(studentGuid: string, input: BatchTransferRequest): Promise<BatchTransferResultDto> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      batchTransferGuid: `mock-bt-${Date.now()}`,
      transferCode: `BT/MOCK/${Math.floor(Math.random() * 1000)}`,
      transferDate: new Date().toISOString(),
      oldBatchGuid: 'mock-batch-current', oldBatchCode: 'BSCIT-2024A',
      newBatchGuid: input.newBatchGuid, newBatchCode: mockEligibleBatches.find(b => b.batchGuid === input.newBatchGuid)?.batchCode ?? 'BSCIT-2024B',
    })
  }
  return apiPost<BatchTransferResultDto>(`/api/v1/students/${studentGuid}/batch-transfer`, input)
}

export function getBatchTransferHistory(studentGuid: string): Promise<BatchTransferHistoryItemDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<BatchTransferHistoryItemDto[] | null>(`/api/v1/students/${studentGuid}/batch-transfer/history`).then(data => data ?? [])
}
