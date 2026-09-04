import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface FeeTransferHistoryItemDto {
  feeTransferGuid: string
  transferCode: string
  transferDate: string
  oldFeeGuid: string | null
  oldFeeCode: string | null
  oldFeeDesc: string | null
  newFeeGuid: string | null
  newFeeCode: string | null
  newFeeDesc: string | null
  remarks: string | null
}

export interface FeeTransferStudentContextDto {
  studentGuid: string
  studentName: string
  studentRegNo: string
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
  batchGuid: string | null
  batchName: string | null
  campusGuid: string | null
  campusName: string | null
  intakeGuid: string | null
  intakeName: string | null
  currentFeeGuid: string | null
  currentFeeCode: string | null
  currentFeeDesc: string | null
}

export interface FeeTransferRequest {
  newFeeGuid: string
  changeAllSemesters: boolean
  remarks: string | null
}

export interface FeeTransferResultDto {
  feeTransferGuid: string
  transferCode: string
  transferDate: string
  oldFeeGuid: string
  oldFeeCode: string
  oldFeeDesc: string
  newFeeGuid: string
  newFeeCode: string
  newFeeDesc: string
}

// --- MOCK DATA ---
const MOCK_CONTEXT: Record<string, FeeTransferStudentContextDto> = {
  'stu-mock-3': {
    studentGuid: 'stu-mock-3',
    studentName: 'JOHN DOE',
    studentRegNo: 'KA07210001',
    programGuid: 'mock-prog-1',
    programName: 'Diploma in Computer Science',
    semesterGuid: 'mock-sem-3',
    semesterName: 'Semester 3',
    batchGuid: 'mock-batch-1',
    batchName: 'DNCS-F21-S3',
    campusGuid: 'mock-camp-1',
    campusName: 'Kampala Campus',
    intakeGuid: 'mock-int-1',
    intakeName: 'February 2021',
    currentFeeGuid: 'mock-fee-1',
    currentFeeCode: 'DNCS.L.F21',
    currentFeeDesc: 'DNCS.L.F21',
  }
}

let MOCK_HISTORY: Record<string, FeeTransferHistoryItemDto[]> = {
  'stu-mock-3': [
    {
      feeTransferGuid: '1c952a4d-ed14-4fc0-a768-e58c946b78d3',
      transferCode: 'FT/20313/2',
      transferDate: '2026-08-18T12:45:36.210951Z',
      oldFeeGuid: '417450c9-f78a-4dea-9022-61a686f5dbe6',
      oldFeeCode: 'DNCS.I.F21',
      oldFeeDesc: 'DNCS.I.F21',
      newFeeGuid: 'mock-fee-1',
      newFeeCode: 'DNCS.LE.INT.FL25',
      newFeeDesc: 'DNCS.LE.INT.FL25',
      remarks: 'Student moved to lateral entry fee structure',
    }
  ]
}

// --- API FUNCTIONS ---
export function getFeeTransferContext(studentGuid: string): Promise<FeeTransferStudentContextDto> {
  if (MOCK_AUTH) {
    const ctx = MOCK_CONTEXT[studentGuid] || { ...MOCK_CONTEXT['stu-mock-3'], studentGuid, studentName: 'Mock Student' }
    return Promise.resolve(ctx)
  }
  return apiGet<FeeTransferStudentContextDto>(`/api/v1/students/${studentGuid}/fee-transfer/student-context`)
}

export function getFeeTransferHistory(studentGuid: string): Promise<FeeTransferHistoryItemDto[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(MOCK_HISTORY[studentGuid] || [])
  }
  return apiGet<FeeTransferHistoryItemDto[] | null>(`/api/v1/students/${studentGuid}/fee-transfer/history`).then(res => res ?? [])
}

export function executeFeeTransfer(studentGuid: string, payload: FeeTransferRequest): Promise<FeeTransferResultDto> {
  if (MOCK_AUTH) {
    const newRecord: FeeTransferHistoryItemDto = {
      feeTransferGuid: Date.now().toString(),
      transferCode: `FT/20261/${Math.floor(Math.random() * 1000)}`,
      transferDate: new Date().toISOString(),
      oldFeeGuid: 'mock-fee-1',
      oldFeeCode: 'OLD.FEE',
      oldFeeDesc: 'Old Fee Structure',
      newFeeGuid: payload.newFeeGuid,
      newFeeCode: 'NEW.FEE',
      newFeeDesc: 'New Fee Structure',
      remarks: payload.remarks,
    }
    MOCK_HISTORY[studentGuid] = [newRecord, ...(MOCK_HISTORY[studentGuid] || [])]
    return Promise.resolve(newRecord as any)
  }
  return apiPost<FeeTransferResultDto>(`/api/v1/students/${studentGuid}/fee-transfer`, payload)
}
