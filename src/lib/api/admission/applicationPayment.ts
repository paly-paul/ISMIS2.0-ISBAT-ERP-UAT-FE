import { apiGet, apiPostForm } from '../client'
import { Enquiry } from './enquiry'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via Application-Payments/Create.bru — multipart/form-data (not
// JSON), so this always goes through apiPostForm, not apiPost, to support the
// payProofFile upload.
//
// countryGuid ("replaces old countryCode string field") is a real, required
// field per Create.bru's docs — CONFIRMED via a real successful payment
// (201, appRefNo returned) sent with a genuine countryGuid. The Application-
// Filling Countries dropdown (GET .../application-filling/countries) has no
// guid at all and is NOT the right source — the real one is GET
// /api/v1/users/countries (lib/api/academic/country.ts, useCountries()),
// same endpoint Country Master and Application-Filling's SaveGeneral now
// use.
//
// enquiryGuid is CONFIRMED required despite Create.bru's docs explicitly
// marking it "(optional)" — reproduced a real 400 by removing only this
// field from an otherwise-working payload. Every payment must link to a
// real enquiry (see useEnquiries() on the payment page).
//
// oDelIntApplication has no documented semantics beyond the sample value in
// Create.bru — always sent as 0 until clarified.
export interface ApplicationPaymentInput {
  enquiryGuid: string
  oDelIntApplication: number
  studentName: string
  intakeGuid: string
  campusGuid: string
  programGuid: string
  semesterGuid: string
  batchGuid: string
  batchTimeGuid: string
  feeHdGuid: string
  countryGuid: string
  mobile: string
  email: string | null
  // Per Create.bru docs: when this is set, amount/currencyGuid/exRate/payType/
  // receiptBookGuid are not required server-side — all four are nullable here
  // and omitted from the multipart body entirely when null, rather than sent
  // as empty/zero values.
  exemptionTypeGuid: string | null
  // dd/MMM/yyyy, e.g. "28/Jul/2026" — see formatBruDate in the payment page.
  payDate: string
  payType: number | null
  amount: number | null
  currencyGuid: string | null
  exRate: number | null
  // Per Create.bru docs: required when payType > 1 (non-cash payments).
  bankGuid: string | null
  receiptBookGuid: string | null
  remarks: string | null
  payProofFile: File | null
}

// --- Payment-scoped dropdown DTOs -----------------------------------------
// These six endpoints (Application-Payments/Dropdowns/*.bru) exist on the
// backend but the .bru docs only name the response type, not its exact
// fields. The shapes below are a best-effort guess (guid + name, matching
// this app's existing conventions for the same concepts elsewhere, e.g.
// Bank.bankName, ReceiptBook.bookCode) — verify against a real network
// response once the dev backend is reachable and correct these if they
// differ, same as any other "unconfirmed" note in this codebase.

export interface BankAccountInfoDto {
  bankGuid: string
  bankName: string
}

export interface BatchInfoDto {
  batchGuid: string
  batchCode: string
}

// Confirmed via a real dropdowns/exemption-types response — the display
// field is label, not exemptionTypeName as first guessed (that guess left
// the dropdown's option labels blank since e.exemptionTypeName was always
// undefined). value (an int) also comes back but isn't used — the guid is
// what's sent on create.
export interface ExemptionTypeDto {
  exemptionTypeGuid: string
  value: number
  label: string
}

// Confirmed via a real GET dropdowns/fees?programGuid= response — there is
// no flat "amount" field on this DTO (a first guess assumed one and used it
// to auto-fill the Application Fee Amount field, which was wrong). amtPer
// looks like a percentage rather than a currency amount, and what it's a
// percentage OF isn't confirmed, so it's not used for anything yet — Fee
// Amount stays manual-entry only.
export interface ProgramFeeHeadInfoDto {
  feeHdGuid: string
  feeCode: string
  feeDesc: string
  intProgram: number
  status: number
  amtPer: number
}

// Confirmed via a real dropdowns/payment-types response — the id field is
// intPaymentType, not payType as first guessed (that guess produced a
// literal "NaN" in the submitted payType field, since String(undefined)
// then Number("undefined") both silently fail without throwing).
export interface PaymentTypeDto {
  intPaymentType: number
  paymentTypeName: string
}

// Success (201) — CONFIRMED via a real Create.bru response sample. There is
// no receiptType field at all on the wire (an earlier guess assumed one per
// Application_Payment_Change_Requests_Final_Updated.md #6's "return these
// values in the successful save response" wording, but the real response
// only ever carries receiptNo — paymentCode is the closer match for a
// human-readable receipt reference). receiptNo is a plain number (e.g.
// 1024), not a string as first guessed, and comes back null for exemption
// payments (see the note below). intakeGuid/exemptionTypeGuid are echoed
// back exactly as submitted, not derived server-side.
export interface CreateApplicationPaymentResponse {
  paymentGuid?: string
  appRefNo?: string
  paymentCode?: string
  intApplication?: number
  studentName?: string
  intakeGuid?: string
  campusGuid?: string
  programGuid?: string
  semesterGuid?: string
  batchGuid?: string
  batchTimeGuid?: string
  feeHdGuid?: string
  countryGuid?: string
  mobile?: number
  email?: string
  // For an exemption payment (exemptionTypeGuid provided as a real guid):
  // payType/exRate/currencyGuid come back null, amount/amountUsh come back
  // 0, and receiptNo comes back null — no receipt/bank is resolved for
  // exemptions.
  amount?: number
  amountUsh?: number
  currencyGuid?: string | null
  exRate?: number | null
  payDate?: string
  payType?: number | null
  exemptionTypeGuid?: string | null
  receiptNo?: number | null
  remarks?: string | null
  [key: string]: unknown
}

const mockBanks: BankAccountInfoDto[] = [{ bankGuid: 'mock-bank-1', bankName: 'Stanbic Bank' }]
const mockBatches: BatchInfoDto[] = [{ batchGuid: 'mock-batch-1', batchCode: 'BSCVFXS27DA' }]
const mockExemptionTypes: ExemptionTypeDto[] = [
  { exemptionTypeGuid: 'mock-exemption-1', value: 1, label: 'HEC' },
  { exemptionTypeGuid: 'mock-exemption-2', value: 2, label: 'Sponsorship' },
  { exemptionTypeGuid: 'mock-exemption-3', value: 3, label: 'Existing Student' },
]
const mockFees: ProgramFeeHeadInfoDto[] = [{ feeHdGuid: 'mock-fee-1', feeCode: 'STD', feeDesc: 'Standard Application Fee', intProgram: 0, status: 1, amtPer: 0 }]
const mockPaymentTypes: PaymentTypeDto[] = [
  { intPaymentType: 1, paymentTypeName: 'Cash' },
  { intPaymentType: 2, paymentTypeName: 'Cheque' },
  { intPaymentType: 3, paymentTypeName: 'Bank' },
  { intPaymentType: 4, paymentTypeName: 'DD' },
]

export function getApplicationPaymentBanks(): Promise<BankAccountInfoDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockBanks)
  return apiGet<BankAccountInfoDto[] | null>('/api/v1/admissions/application-payments/dropdowns/banks').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

interface UnconvertedEnquiriesResult {
  items: Enquiry[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// GET /api/v1/admissions/application-payments/unconverted-enquiries?intakeGuid=...
// Per Application_Payment_Change_Requests_Final_Updated.md #2 — backs the
// Application Payment page's Enquiry dropdown, scoped to a selected Intake
// and restricted to enquiries not yet converted into students. Response
// shape is NOT confirmed against a real sample — inferred by reusing the
// already-confirmed Enquiry DTO (enquiry.ts) and its list envelope
// (items/totalCount/pageNumber/pageSize), since this is presumably the same
// underlying Enquiry record set, just pre-filtered server-side. Verify
// against a real response and correct the item shape if it differs (e.g. if
// this endpoint returns a narrower projection rather than the full DTO).
export function getUnconvertedEnquiries(intakeGuid: string, page = 1, pageSize = 10): Promise<UnconvertedEnquiriesResult> {
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  return apiGet<UnconvertedEnquiriesResult | null>(
    `/api/v1/admissions/application-payments/unconverted-enquiries?intakeGuid=${intakeGuid}&page=${page}&pageSize=${pageSize}`,
  ).then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function getApplicationPaymentBatches(programGuid: string, semesterGuid: string, batchTimeGuid: string): Promise<BatchInfoDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockBatches)
  return apiGet<BatchInfoDto[] | null>(
    `/api/v1/admissions/application-payments/dropdowns/batches?programGuid=${programGuid}&semesterGuid=${semesterGuid}&batchTimeGuid=${batchTimeGuid}`,
  ).then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

export function getApplicationPaymentExemptionTypes(): Promise<ExemptionTypeDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockExemptionTypes)
  return apiGet<ExemptionTypeDto[] | null>('/api/v1/admissions/application-payments/dropdowns/exemption-types').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

export function getApplicationPaymentFees(programGuid: string): Promise<ProgramFeeHeadInfoDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockFees)
  return apiGet<ProgramFeeHeadInfoDto[] | null>(`/api/v1/admissions/application-payments/dropdowns/fees?programGuid=${programGuid}`).then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

export function getApplicationPaymentTypes(): Promise<PaymentTypeDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockPaymentTypes)
  return apiGet<PaymentTypeDto[] | null>('/api/v1/admissions/application-payments/dropdowns/payment-types').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Dropdowns/ReceiptBooks.bru (GET .../dropdowns/receipt-books) is NOT wired
// here — confirmed via a live call that it 500s server-side with
// "Required parameter \"int category\" was not provided from query string",
// an undocumented required param with no confirmed value. The payment page
// uses the generic, already-working GET /api/v1/finance/receipt-books
// (lib/api/finance/receiptBook.ts, useReceiptBooks()) instead — same
// receiptBookGuid/bookCode shape, confirmed via a real response.

export function createApplicationPayment(input: ApplicationPaymentInput): Promise<CreateApplicationPaymentResponse> {
  if (MOCK_AUTH) {
    return Promise.resolve({ intApplication: Math.floor(Math.random() * 100000), studentName: input.studentName })
  }

  console.log('[application payment API] createApplicationPayment input', {
    ...input,
    payProofFile: input.payProofFile ? { name: input.payProofFile.name, size: input.payProofFile.size, type: input.payProofFile.type } : null,
  })

  const formData = new FormData()
  formData.append('enquiryGuid', input.enquiryGuid)
  formData.append('oDelIntApplication', String(input.oDelIntApplication ?? 0))
  formData.append('studentName', input.studentName)
  formData.append('intakeGuid', input.intakeGuid)
  formData.append('campusGuid', input.campusGuid)
  formData.append('programGuid', input.programGuid)
  formData.append('semesterGuid', input.semesterGuid)
  formData.append('batchGuid', input.batchGuid)
  formData.append('batchTimeGuid', input.batchTimeGuid)
  formData.append('feeHdGuid', input.feeHdGuid)
  formData.append('countryGuid', input.countryGuid)
  formData.append('mobile', input.mobile)
  if (input.email) formData.append('email', input.email)
  // currencyGuid/bankGuid/receiptBookGuid/exemptionTypeGuid are all
  // nullable Guid?-typed fields on the backend. CONFIRMED via a real 400
  // with a completely empty response body (no JSON at all — not even the
  // usual validation_error envelope) when a genuinely-waived payment sent
  // these as empty strings: ASP.NET's multipart model binder throws an
  // unhandled, unformatted parse failure on Guid.Parse("") before the
  // request even reaches the controller or any JSON-error middleware. Omit
  // the form field entirely instead of sending "" — that's the only way a
  // multipart Guid?-typed field can come through as genuinely null.
  if (input.exemptionTypeGuid) formData.append('exemptionTypeGuid', input.exemptionTypeGuid)
  formData.append('payDate', input.payDate)
  if (input.payType !== null && input.payType !== undefined) formData.append('payType', String(input.payType))
  if (input.amount !== null && input.amount !== undefined) formData.append('amount', String(input.amount))
  if (input.currencyGuid) formData.append('currencyGuid', input.currencyGuid)
  if (input.exRate !== null && input.exRate !== undefined) formData.append('exRate', String(input.exRate))
  if (input.bankGuid) formData.append('bankGuid', input.bankGuid)
  if (input.receiptBookGuid) formData.append('receiptBookGuid', input.receiptBookGuid)
  if (input.remarks) formData.append('remarks', input.remarks)
  if (input.payProofFile) formData.append('payProofFile', input.payProofFile)

  return apiPostForm<CreateApplicationPaymentResponse>('/api/v1/admissions/application-payments', formData)
}
