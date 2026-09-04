import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Student module's Student Statement page (see
// student/statement/page.tsx). Confirmed against students/student-statement/
// *.md (2026-08-21) — the real resource is header + paymentHistory[] +
// outstandingItems[], not a single flat "ledger row" list with an
// actual/paid/balance triple per row like the old mock LEDGER_ROWS had.
// Payments already made and items still outstanding are two separate lists
// server-side, same split the Finance Payment Console already renders.

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface StudentStatementSearchResultDto {
  studentGuid: string
  applicationGuid: string | null
  studentRegNo: string | null
  studentName: string | null
  programName: string | null
  semesterName: string | null
  batchCode: string | null
}

export interface StudentStatementHeaderDto {
  applicationGuid: string
  appRefNo: string | null
  studentName: string | null
  studentNum: string | null
  studentRegNo: string | null
  studentGuid: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
  batchGuid: string | null
  batchCode: string | null
  admissionTypeLabel: string | null
}

// category: PaymentHistoryCategory — 1=Tuition, 2=Other, 3=Nche, 4=Guild, 5=Advance
export interface StudentStatementPaymentDto {
  slNo: number
  paymentGuid: string
  category: number
  paymentCode: string | null
  payDate: string
  amount: number
  currencyGuid: string | null
  currencyName: string | null
  receipt: string | null
  payType: string | null
}

// category: PaymentGroupCategory — 1=Tuition, 2=Other, 3=Nche, 4=Guild
export interface StudentStatementOutstandingDto {
  slNo: number
  category: number
  ledgerGuid: string | null
  semesterGuid: string | null
  description: string | null
  currencyGuid: string | null
  currencyName: string | null
  outstanding: number
}

export interface StudentStatementDto {
  header: StudentStatementHeaderDto
  paymentHistory: StudentStatementPaymentDto[]
  outstandingItems: StudentStatementOutstandingDto[]
}

export interface GetStudentFeeSummaryDto {
  totalAmountToPay: number
  amountPaid: number
  pendingFee: number
}

export interface StudentStatementSearchFilters {
  studentGuid?: string
  studentRegNo?: string
  studentName?: string
}

const mockSearchResults: StudentStatementSearchResultDto[] = [
  { studentGuid: 'stu-mock-1', applicationGuid: 'app-mock-1', studentRegNo: '011240104', studentName: 'Aisha Nakamya', programName: 'BSc. Computer Science', semesterName: 'Semester 1', batchCode: 'BSC-IT-S26-DA' },
  { studentGuid: 'stu-mock-2', applicationGuid: 'app-mock-2', studentRegNo: '012221279', studentName: 'Okello James', programName: 'BBA Business Administration', semesterName: 'Semester 2', batchCode: 'BBA-2024-JAN-A' },
]

const mockStatement: StudentStatementDto = {
  header: {
    applicationGuid: 'app-mock-1', appRefNo: 'APP-2024-0001', studentName: 'Aisha Nakamya', studentNum: '011240104',
    studentRegNo: '011240104', studentGuid: 'stu-mock-1', programGuid: 'prog-mock-1', programName: 'BSc. Computer Science',
    semesterGuid: 'sem-mock-1', semesterName: 'Semester 1', batchGuid: 'batch-mock-1', batchCode: 'BSC-IT-S26-DA',
    admissionTypeLabel: 'Fresh',
  },
  paymentHistory: [
    { slNo: 1, paymentGuid: 'pay-mock-1', category: 1, paymentCode: 'PAY-001', payDate: '2024-01-15T00:00:00', amount: 750000, currencyGuid: 'cur-ugx', currencyName: 'UGX', receipt: 'RCT-2024-00142', payType: 'Cash' },
    { slNo: 2, paymentGuid: 'pay-mock-2', category: 1, paymentCode: 'PAY-002', payDate: '2024-06-10T00:00:00', amount: 750, currencyGuid: 'cur-usd', currencyName: 'USD', receipt: 'RCT-2024-00289', payType: 'Bank' },
  ],
  outstandingItems: [
    { slNo: 1, category: 1, ledgerGuid: 'ldg-mock-1', semesterGuid: 'sem-mock-1', description: 'Tuition Fee — Semester 1', currencyGuid: 'cur-usd', currencyName: 'USD', outstanding: 450 },
  ],
}

export function searchStudentStatement(filters: StudentStatementSearchFilters, page = 1, pageSize = 10): Promise<PagedResult<StudentStatementSearchResultDto>> {
  if (MOCK_AUTH) {
    const term = (filters.studentName ?? filters.studentRegNo ?? '').trim().toLowerCase()
    const items = filters.studentGuid
      ? mockSearchResults.filter(s => s.studentGuid === filters.studentGuid)
      : term
        ? mockSearchResults.filter(s => `${s.studentName} ${s.studentRegNo}`.toLowerCase().includes(term))
        : mockSearchResults
    return Promise.resolve({ items, totalCount: items.length, page, pageSize })
  }
  const params = new URLSearchParams()
  if (filters.studentGuid) params.set('studentGuid', filters.studentGuid)
  if (filters.studentRegNo?.trim()) params.set('studentRegNo', filters.studentRegNo.trim())
  if (filters.studentName?.trim()) params.set('studentName', filters.studentName.trim())
  params.set('pageNumber', String(page))
  params.set('pageSize', String(pageSize))
  return apiGet<PagedResult<StudentStatementSearchResultDto> | null>(`/api/v1/students/studentstatement/search?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, page, pageSize })
}

export function getStudentStatement(studentGuid: string): Promise<StudentStatementDto> {
  if (MOCK_AUTH) return Promise.resolve(mockStatement)
  return apiGet<StudentStatementDto>(`/api/v1/students/studentstatement/${studentGuid}`)
}

export function getStudentFeeSummary(studentGuid: string): Promise<GetStudentFeeSummaryDto> {
  if (MOCK_AUTH) return Promise.resolve({ totalAmountToPay: 1500, amountPaid: 600, pendingFee: 900 })
  return apiGet<GetStudentFeeSummaryDto>(`/api/v1/students/studentstatement/${studentGuid}/fee-summary`)
}

export function getStudentStatementPdfUrl(studentGuid: string): string {
  // Returning the URL so the frontend can just window.open or window.location.href it
  return `/api/v1/students/studentstatement/${studentGuid}/pdf`
}
