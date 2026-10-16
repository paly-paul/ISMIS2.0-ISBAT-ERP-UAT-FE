'use client'
import React, { Suspense, useState, useRef, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { FailurePopup } from '@/components/modals/shared/FailurePopup'
import { ImportSourceModal } from '@/components/modals/admission/ImportSourceModal'
import { ImportCrmModal } from '@/components/modals/admission/ImportCrmModal'
import { ImportOdelModal } from '@/components/modals/admission/ImportOdelModal'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { useCurrentAcademicIntake, useCurrentAdmissionIntake, useIntake } from '@/hooks/academic/useIntakes'
import { useSearchCampusesInfinite } from '@/hooks/config/useCampuses'
import { useCountries, useSearchCountriesInfinite } from '@/hooks/config/useCountries'
import { useSearchProgramMastersByCampusInfinite } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useProgramFeeStructures } from '@/hooks/academic/useProgramFeeStructure'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useBatches } from '@/hooks/academic/useBatches'
import { useFinanceCurrencies, getDefaultFinanceCurrencyGuid } from '@/hooks/finance/useFinanceCurrencies'
import { useExchangeRateExists, useExchangeRatesByDate } from '@/hooks/finance/useExchangeRates'
import { TodayExchangeRateModal } from '@/components/modals/finance/TodayExchangeRateModal'
import { RatesAlreadySetNote } from '@/components/finance/RatesAlreadySetNote'
import { useReceiptBooks } from '@/hooks/finance/useReceiptBooks'
import { useProcBanks } from '@/hooks/finance/useProcBanks'
import { Country, dialCode, findDefaultCountry } from '@/lib/api/academic/country'
import { EMPTY_GUID } from '@/lib/api/academic/batch'
import { useEnquiry, useEnquiries } from '@/hooks/admission/useEnquiries'
import {
  useApplicationPaymentExemptionTypes,
  useApplicationPaymentTypes,
  useCreateApplicationPayment,
  useUnconvertedEnquiriesInfinite,
} from '@/hooks/admission/useApplicationPayments'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { sanitizePhoneInput, stripLeadingZeros } from '@/lib/errorMessages'
import { formatDate, monthsAgoYmd, RECENT_DATE_MONTHS } from '@/lib/date'
import { setFilingPrefill } from '@/lib/filingHandoff'
import { openPdfInNewTab } from '@/lib/openPdf'
import { AuthError } from '@/lib/api/client'
import { getApplicationPaymentReceiptPdf, hasPrintableReceipt } from '@/lib/api/admission/applicationPayment'
import type { NewPaymentHandoff } from '@/lib/api/admission/applicationFiling'
import { flattenUniquePages } from '@/lib/pagination'
import { FIELD_ERROR_CLASS, scrollToFirstError } from '@/lib/scrollToFirstError'

const PIPELINE = [
  { label: 'App. Payment',  desc: 'Current step', status: 'active' },
  { label: 'App. Filing',   desc: 'Next step',    status: '' },
  { label: 'Vetting',       desc: '',              status: '' },
  { label: 'Reg. Payment',  desc: '',              status: '' },
  { label: 'Registration',  desc: '',              status: '' },
]

// Application Source and Receipt Type/No. dropdowns removed per
// Application_Payment_Change_Requests_Final_Updated.md #3/#6 — Application
// Source had no counterpart on POST /api/v1/admissions/application-payments
// anyway; Receipt Type/No. are no longer user-entered at all, they come back
// on the create response instead (see savedReceipt below).

// UI-only — the confirmed payload's `mobile` field is raw digits with no
// country prefix (see Create.bru's "700000000" example), so this dropdown
// never feeds the API; it's here purely so the phone number reads naturally.
const COUNTRY_CODES = [
  { value: '+256', label: '+256 · Uganda' },
  { value: '+254', label: '+254 · Kenya' },
  { value: '+255', label: '+255 · Tanzania' },
  { value: '+250', label: '+250 · Rwanda' },
  { value: '+257', label: '+257 · Burundi' },
  { value: '+211', label: '+211 · South Sudan' },
  { value: '+243', label: '+243 · DR Congo' },
  { value: '+91',  label: '+91 · India' },
  { value: '+44',  label: '+44 · United Kingdom' },
  { value: '+1',   label: '+1 · USA/Canada' },
]

// CONFIRMED via a live 400 — the ISO-style "yyyy-mm-ddT00:00:00" this used to
// send was rejected outright ("Payment date must be in dd/MMM/yyyy format."),
// so the earlier assumption that the response payload's shape was also what
// Create wants was wrong; payDate genuinely needs the dd/MMM/yyyy string
// (e.g. "06/Aug/2026"), not an ISO timestamp.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Local date, same "today" every Finance page uses for exchange rates.
function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatRate(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPaymentDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${String(d).padStart(2, '0')}/${MONTH_ABBR[m - 1]}/${String(y).padStart(4, '0')}`
}

interface Option { value: string; label: string }

function labelFor(options: Option[], value: string): string {
  return options.find(o => o.value === value)?.label ?? ''
}

interface FormData {
  intakeGuid: string; enquiryGuid: string; firstName: string; lastName: string
  phoneCode: string; phone: string; email: string; countryGuid: string
  campusGuid: string; programGuid: string; semesterGuid: string; batchTimeGuid: string; batchGuid: string
  feeHdGuid: string
  exemptionTypeGuid: string; payType: string
  receiptBookGuid: string; feeAmount: string; currencyGuid: string
  paymentDate: string
  bankGuid: string; remarks: string
}

function getTodayYmd(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// POST /application-payments: payDate must be within the last 3 months and
// not in the future (validation_error otherwise). Window maths lives in
// lib/date.ts, shared with the enquiry forms' enquiryDate.
const PAY_DATE_RANGE_MESSAGE = 'Payment date must be within the last 3 months and not in the future.'
// POST /application-payments: studentName (first + last) max 50 chars.
const STUDENT_NAME_MAX = 50
function getPaymentDateMinYmd(): string {
  return monthsAgoYmd(RECENT_DATE_MONTHS)
}

const initialForm: FormData = {
  intakeGuid: '', enquiryGuid: '',
  firstName: '', lastName: '', phoneCode: '+256', phone: '', email: '', countryGuid: '',
  campusGuid: '', programGuid: '', semesterGuid: '', batchTimeGuid: '', batchGuid: '',
  feeHdGuid: '',
  exemptionTypeGuid: '', payType: '',
  receiptBookGuid: '', feeAmount: '', currencyGuid: '',
  paymentDate: getTodayYmd(),
  bankGuid: '', remarks: '',
}

type FieldErrors = Partial<Record<keyof FormData, string>>

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className={FIELD_ERROR_CLASS} style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{msg}</p> : null
}

function Field({ label, req, children, span2, error }: { label: string; req?: boolean; children: React.ReactNode; span2?: boolean; error?: string }) {
  return (
    <div className={`fg${span2 ? ' span2' : ''}`}>
      <label className="lbl">{label}{req && <span className="req"> *</span>}</label>
      {children}
      <FieldError msg={error} />
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value?: string }) {
  const filled = !!value
  return (
    <div className={`prev-row${filled ? ' filled' : ''}`}>
      <span className="prev-lbl">{label}</span>
      <span className="prev-sep">:</span>
      <span className="prev-val flex items-center gap-1.5">
        {value || '—'}
        {filled && <i className="lni lni-checkmark-circle prev-check" />}
      </span>
    </div>
  )
}

function findMatchingCountry(enquiry: any, countryList: Country[]): Country | undefined {
  if (!countryList || countryList.length === 0) return undefined

  // 1. Direct match by countryGuid or country_guid or nationalityGuid
  const guid = enquiry.countryGuid || enquiry.country_guid || enquiry.nationalityGuid
  if (guid) {
    const match = countryList.find(c => c.countryGuid?.toLowerCase() === String(guid).toLowerCase())
    if (match) return match
  }

  // 2. Match by country name or nationality
  const rawName = (enquiry.countryName || enquiry.country || enquiry.country_name || enquiry.nationality || '')
    .toString().trim().toLowerCase()
  if (rawName) {
    const match = countryList.find(c =>
      c.countryName?.trim().toLowerCase() === rawName ||
      c.nationality?.trim().toLowerCase() === rawName ||
      c.countryName?.trim().toLowerCase().includes(rawName) ||
      rawName.includes(c.countryName?.trim().toLowerCase() ?? '___')
    )
    if (match) return match
  }

  // 3. Match by country code or prefix (e.g. "UG", "UGA", "256", "ZM", "ZW", etc.)
  const rawCode = (enquiry.countryCode || enquiry.country_code || enquiry.countryPrefix || '')
    .toString().trim().toLowerCase().replace(/^\+/, '')
  if (rawCode) {
    const match = countryList.find(c => {
      const code = c.countryCode?.trim().toLowerCase().replace(/^0+/, '')
      const prefix = c.countryPrefix?.trim().toLowerCase().replace(/^\+/, '')
      return (
        c.countryCode?.trim().toLowerCase() === rawCode ||
        code === rawCode.replace(/^0+/, '') ||
        c.countryPrefix?.trim().toLowerCase() === rawCode ||
        prefix === rawCode
      )
    })
    if (match) return match
  }

  // 4. Match by phone dialing code if mobile phone is provided
  const mobile = (enquiry.mobile || enquiry.phone || '').toString().trim()
  if (mobile) {
    for (const c of countryList) {
      const dial = c.countryCode ? c.countryCode.replace(/^0+/, '') : ''
      if (dial && (mobile.startsWith(`+${dial}`) || mobile.startsWith(dial))) {
        return c
      }
    }
  }

  // 5. Default country (Uganda) fallback
  return findDefaultCountry(countryList)
}


// Split out from the default export so useSearchParams() (below) can sit
// behind a Suspense boundary, per Next.js App Router's requirement for any
// client component that reads the URL's query string.
function PaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const permissions = usePagePermissions()
  const [toast, setToast]       = useState<{ msg: string; type: string } | null>(null)
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [showReceipt, setShowReceipt] = useState(false)
  // Result of createPayment.mutate — shown as the shared SuccessPopup/
  // FailurePopup overlays (same components ProgrammeModal/Filing use), not
  // just the plain Toast. This page previously only ever toasted the save
  // result, never actually wired up these popups despite having the same
  // "confirm what just happened" need as every other save flow in the app.
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [form, setForm]         = useState<FormData>({ ...initialForm })
  const [enquirySearch, setEnquirySearch] = useState('')
  const [campusSearch, setCampusSearch] = useState('')
  const [programSearch, setProgramSearch] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [committedCampusSearch, setCommittedCampusSearch] = useState('')
  const [committedProgramSearch, setCommittedProgramSearch] = useState('')
  const [committedCountrySearch, setCommittedCountrySearch] = useState('')
  const [campusPickerOpen, setCampusPickerOpen] = useState(false)
  const [programPickerOpen, setProgramPickerOpen] = useState(false)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [phoneCodePickerOpen, setPhoneCodePickerOpen] = useState(false)
  const [payProofFile, setPayProofFile] = useState<File | null>(null)
  // Per Application_Payment_Change_Requests_Final_Updated.md #6 — Receipt
  // Type/No. are no longer user-entered; populated from the create
  // response's own fields once a payment actually saves. CONFIRMED via a
  // real response: there's no receiptType on the wire at all — paymentCode
  // (e.g. "APP20261") is the real human-readable reference, receiptNo is a
  // plain number (e.g. 1024, null for exemption payments).
  // The rest of this snapshot (name/programme/campus/intake/amount/method/
  // date labels) exists so the form can actually be cleared after a
  // successful save — the receipt used to read straight off live `form`
  // state, which is the reason it was never cleared: clearing `form` would
  // have blanked the just-generated receipt along with it.
  const [savedReceipt, setSavedReceipt] = useState<{
    appRefNo?: string; paymentCode?: string; receiptNo?: number | null
    // For Print Receipt; printable only for a normal payment with a receipt.
    paymentGuid?: string; printable?: boolean
    // The server emails the applicant in the background when an email was
    // entered (post-application-payment.md › Confirmation email).
    email?: string
    studentName?: string; programLabel?: string; campusLabel?: string; intakeLabel?: string
    amountLabel?: string; methodLabel?: string; dateLabel?: string
    exRateLabel?: string; amountUshLabel?: string
    // Handed to Filing by "Proceed to Filing" (lib/filingHandoff.ts).
    filing?: NewPaymentHandoff
  }>({})


  // Receipt Upload drag-and-drop highlight — same treatment as Filing's own
  // file zones.
  const [payProofDragActive, setPayProofDragActive] = useState(false)

  const pipelineRef = useRef<HTMLDivElement>(null)
  const [canPipLeft, setCanPipLeft]   = useState(false)
  const [canPipRight, setCanPipRight] = useState(false)

  function checkPipelineScroll() {
    const el = pipelineRef.current
    if (!el) return
    setCanPipLeft(el.scrollLeft > 4)
    setCanPipRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    checkPipelineScroll()
    const el = pipelineRef.current
    const ro = new ResizeObserver(checkPipelineScroll)
    if (el) ro.observe(el)
    window.addEventListener('resize', checkPipelineScroll)
    return () => { ro.disconnect(); window.removeEventListener('resize', checkPipelineScroll) }
  }, [])

  function scrollPipeline(dir: 'left' | 'right') {
    pipelineRef.current?.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' })
  }

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Step 9 — server-rendered receipt PDF, same flow as Payment Console's
  // printReceipt: the tab opens synchronously on click (popup blockers drop a
  // window.open after an await) and the PDF loads into it; if the popup was
  // blocked, it downloads instead. On an error the blank tab closes and the
  // server's message shows.
  const [printingReceipt, setPrintingReceipt] = useState(false)
  // receipt_generation_failed (Finance unreachable) is temporary: shown under
  // the button with Try again, instead of a toast that disappears.
  const [receiptRetryError, setReceiptRetryError] = useState<string | null>(null)
  async function printReceipt(paymentGuid: string, receiptNo: string) {
    if (printingReceipt) return
    setPrintingReceipt(true)
    setReceiptRetryError(null)
    try {
      await openPdfInNewTab(() => getApplicationPaymentReceiptPdf(paymentGuid), `Receipt_${receiptNo || paymentGuid}.pdf`)
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'Could not load the receipt.'
      if (err instanceof AuthError && err.code === 'receipt_generation_failed') setReceiptRetryError(msg)
      else showToast(msg, 'error')
    } finally {
      setPrintingReceipt(false)
    }
  }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }

  const set = (k: keyof FormData, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  // Inline errors from the last Save attempt. Each one stays visible only
  // while its field still holds the value it was raised for, so editing a
  // field clears its error without every setter having to do it.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [errorSnapshot, setErrorSnapshot] = useState<FormData | null>(null)
  const errorFor = (k: keyof FormData) =>
    fieldErrors[k] && errorSnapshot && form[k] === errorSnapshot[k] ? fieldErrors[k] : undefined

  // Warn on leaving with unfilled work — same beforeunload + confirm-on-nav
  // pattern as the Filing page's hasUnsavedWork/confirmLeave. "Unsaved" here
  // means the form has drifted from its blank initial state and the payment
  // hasn't actually saved yet (showReceipt flips true — and the form itself
  // gets reset — right after a successful save, so this naturally clears
  // itself post-save without needing a separate "submitted" flag like
  // Filing's own submitted state).
  const hasUnsavedWork = !showReceipt && JSON.stringify(form) !== JSON.stringify(initialForm)
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsavedWork) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedWork])

  function confirmLeave() {
    return !hasUnsavedWork || window.confirm("You have unsaved changes on this payment. If you leave now, they won't be saved. Continue?")
  }

  // Confirming "leave" only ever navigated away — it never actually cleared
  // `form`, so the fields were still sitting in React state the moment you
  // came back. That's a real gap given what the confirm dialog just
  // promised ("they won't be saved"), and this page's own searchParams
  // effect above already notes Next's client-side router cache can reuse
  // the same PaymentPageContent instance across repeat visits — so without
  // an explicit reset here, a confirmed "leave" was never actually leaving
  // the data behind.
  function leaveTo(path: string) {
    if (!confirmLeave()) return
    setForm({ ...initialForm }); setFieldErrors({})
    setPayProofFile(null)
    appliedEnquiryGuidRef.current = null
    router.push(path)
  }

  // Cascading resets: changing an upstream selection invalidates whatever
  // was scoped to it downstream (Batch depends on Programme+Semester+Batch
  // Time; Semester and Fee Structure depend on Programme; Programme depends
  // on Campus per #7; Enquiry depends on Intake per #1/#2).
  function setIntake(v: string) {
    setForm(prev => ({ ...prev, intakeGuid: v, enquiryGuid: '' }))
    setEnquirySearch('')
    appliedEnquiryGuidRef.current = null
  }
  function setCampus(v: string) { setForm(prev => ({ ...prev, campusGuid: v, programGuid: '', semesterGuid: '', batchGuid: '', feeHdGuid: '' })) }
  function setProgram(v: string) { setForm(prev => ({ ...prev, programGuid: v, semesterGuid: '', batchGuid: '', feeHdGuid: '' })) }
  function setSemester(v: string) { setForm(prev => ({ ...prev, semesterGuid: v, batchGuid: '' })) }
  function setBatchTime(v: string) { setForm(prev => ({ ...prev, batchTimeGuid: v, batchGuid: '' })) }

  useEffect(() => {
    const timer = setTimeout(() => setCommittedCampusSearch(campusSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [campusSearch])
  useEffect(() => {
    const timer = setTimeout(() => setCommittedProgramSearch(programSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [programSearch])
  useEffect(() => {
    const timer = setTimeout(() => setCommittedCountrySearch(countrySearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [countrySearch])

  // ── Real data ──────────────────────────────────────────────────────────
  // enquiryGuid is optional on Create — a payment can be taken without
  // linking an enquiry (an earlier backend build 400'd without it; no
  // longer the case). Per Application_Payment_Change_Requests_Final_
  // Updated.md #1/#2, the Enquiry dropdown is scoped to the selected Intake
  // and restricted to not-yet-converted enquiries (GET
  // .../unconverted-enquiries?intakeGuid=...&page=...&pageSize=...),
  // replacing the old generic "first 100 of 11k+" useEnquiries() list — only
  // enabled once an Intake is actually picked. Fetched via the
  // server-paginated, scroll-to-load-more useUnconvertedEnquiriesInfinite
  // (see the Enquiry dropdown below) rather than a single capped
  // pageSize=1000 snapshot of the whole intake.
  // post-application-payment.md (fix/admission-bugs): a payment is accepted
  // only for the intake flagged current or current-admission, so those two
  // (usually the same row) are the only Intake options. An enquiry from an
  // older intake still shows its intake (withSelected below) — the server
  // then rejects the conversion with its "previous intake" message.
  const currentIntakeQuery = useCurrentAcademicIntake()
  const admissionIntakeQuery = useCurrentAdmissionIntake()
  const campusQuery = useSearchCampusesInfinite(committedCampusSearch, 20, campusPickerOpen)
  const programQuery = useSearchProgramMastersByCampusInfinite(form.campusGuid, committedProgramSearch, 20, programPickerOpen)
  const countryQuery = useSearchCountriesInfinite(committedCountrySearch, 20, countryPickerOpen || phoneCodePickerOpen)
  const intakes = useMemo(() => {
    const list = [admissionIntakeQuery.data, currentIntakeQuery.data].filter((i): i is NonNullable<typeof i> => !!i)
    return list.filter((i, idx) => list.findIndex(x => x.intakeGuid === i.intakeGuid) === idx)
  }, [admissionIntakeQuery.data, currentIntakeQuery.data])
  const intakesLoading = currentIntakeQuery.isLoading || admissionIntakeQuery.isLoading
  const noOpenIntake = !intakesLoading && currentIntakeQuery.isSuccess && admissionIntakeQuery.isSuccess && intakes.length === 0
  const campuses = useMemo(() => flattenUniquePages(campusQuery.data?.pages ?? [], c => c.campusGuid), [campusQuery.data])
  const programsByCampus = useMemo(() => flattenUniquePages(programQuery.data?.pages ?? [], p => p.programGuid), [programQuery.data])
  const countries = useMemo(() => flattenUniquePages(countryQuery.data?.pages ?? [], c => c.countryGuid), [countryQuery.data])
  // `countries` above is only the picker's current search page (20 rows,
  // fetched once a picker opens) — too partial to pick the default country
  // or match an enquiry's country against. The full list (one request,
  // cached) backs those lookups instead; the picker keeps its paged search.
  const { data: allCountries = [] } = useCountries()
  const { data: semesters = [] } = useSemestersForProgram(form.programGuid, !!form.programGuid)
  const { data: batchTimes = [] } = useBatchTimes()
  // The payment-scoped Dropdowns/Batches.bru endpoint returns a real 200
  // with an empty array for combinations that do have a matching batch in
  // the generic Batches list — its filtering logic looks broken server-side,
  // not just unconfirmed. Falls back to the already-confirmed-correct
  // generic Batches list (same one Batch Management uses, real
  // programGuid/semesterGuid/batchTimeGuid), filtered client-side instead.
  // Same "payment-scoped endpoint is unreliable, use the generic one"
  // pattern as the Receipt Books field below.
  const { data: allBatchesData }     = useBatches(1, 1000)
  const batches = (allBatchesData?.items ?? []).filter(b =>
    b.programGuid === form.programGuid && b.semesterGuid === form.semesterGuid && b.batchTimeGuid === form.batchTimeGuid,
  )
  // The payment-scoped Dropdowns/Fees.bru endpoint (getApplicationPaymentFees
  // in lib/api/admission/applicationPayment.ts) is what this dropdown used to
  // run on — reported blank for a selected Programme that does have real fee
  // structures under it. Same
  // "payment-scoped endpoint is unreliable for this page, use the generic
  // master instead" pattern already applied to Batches and Receipt Books
  // above: fall back to the already-confirmed-real Programme Fee Structure
  // list (same one /academic/fee-structure's own table uses), filtered
  // client-side by the selected Programme and Active status instead.
  const { data: allFeeStructuresData } = useProgramFeeStructures(1, 1000)
  const fees = (allFeeStructuresData?.items ?? []).filter(f => f.programGuid === form.programGuid && f.status)
  const { data: exemptionTypes = [] } = useApplicationPaymentExemptionTypes()
  const { data: paymentTypes = [] }  = useApplicationPaymentTypes()
  const { data: currencies = [] }    = useFinanceCurrencies()
  // Per Application_Payment_Change_Requests_Final_Updated.md #4 — sourced
  // from the Proc Bank Master API (m_proc_bank), not the generic Finance
  // Banks endpoint. CONFIRMED (the hard way): swapping this to the generic
  // Banks master produced a live "Bank account not found" 400 on submit —
  // the payment's bankGuid needs a real bank ACCOUNT (ProcBank has
  // compCode/branchCode/accountCode; the generic Banks master returns those
  // as null on every row, i.e. it's a bank-name list only, not accounts).
  // Same status enum convention as procBank.ts's STATUS_VALUES
  // (1 = Inactive, 2 = Active) — only offer Active.
  const { data: allProcBanks = [] }  = useProcBanks()
  const banks = allProcBanks.filter(b => b.status === 2)
  // The payment-scoped Dropdowns/ReceiptBooks.bru endpoint 500s server-side
  // (undocumented required "category" int query param) — fall back to the
  // already-working generic Finance Receipt Books endpoint instead. Same
  // receiptBookGuid/bookCode shape, just the full master list rather than a
  // payment-filtered one, so only offer Active (status === 1) ones here.
  const { data: allReceiptBooks = [] } = useReceiptBooks()
  const receiptBooks = allReceiptBooks.filter(r => r.status === 1)

  // Country and phone-code dropdowns now use the server-backed search/scroll
  // list, same pattern as the public enquiry pages, instead of a one-shot
  // full-page fetch of the whole country catalog.
  const PAY_TYPE_TO_RECEIPT_CATEGORY: Record<number, number> = {
    1: 0, // Cash
    2: 1, // Cheque
    3: 1, // Bank
    4: 1, // DD
    5: 2, // Online
  }
  const selectedPayType = Number(form.payType || 0)
  const matchingReceiptBooks = selectedPayType
    ? receiptBooks.filter(r => r.category === PAY_TYPE_TO_RECEIPT_CATEGORY[selectedPayType])
    : receiptBooks
  const receiptBookOptions = matchingReceiptBooks.map(r => ({ value: r.receiptBookGuid, label: r.bookCode }))
  const createPayment = useCreateApplicationPayment()

  // Fetch full detail for the selected enquiry (fresh fields — intake/
  // campus/programme/candidate info — that the dropdown's own label doesn't
  // carry) and prefill the form from it, confirmed via a real GET
  // /api/v1/admissions/enquiries/:guid response.
  const { data: selectedEnquiry } = useEnquiry(form.enquiryGuid || null, !!form.enquiryGuid)
  // Guards against re-applying the same enquiry's data over edits the user
  // has since made — e.g. a background refetch on window focus returning a
  // new object for the same guid shouldn't stomp on manual changes.
  const appliedEnquiryGuidRef = useRef<string | null>(null)

  // "Convert" on enquiry-followup(-master) links here with
  // ?enquiryGuid=... — picked up via an effect (not a useState lazy
  // initializer) because Next's client-side router cache can reuse this
  // same PaymentPageContent instance across repeated visits to this route,
  // so a one-time initializer only ever captured the *first* visit's query
  // string and silently went stale on every Convert after that (the
  // reported bug: no request ever fired because form.enquiryGuid stayed
  // frozen at ''). Re-running on every searchParams change makes each
  // Convert click work independently of whether the page happens to remount.
  useEffect(() => {
    const guid = searchParams.get('enquiryGuid')
    if (guid && guid !== form.enquiryGuid) {
      appliedEnquiryGuidRef.current = null
      setForm(prev => ({ ...prev, enquiryGuid: guid }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (!selectedEnquiry) return

    const enquiryGuid = selectedEnquiry.enquiryGuid
    const isNewEnquiry = appliedEnquiryGuidRef.current !== enquiryGuid

    if (isNewEnquiry) {
      appliedEnquiryGuidRef.current = enquiryGuid
      const [firstName, ...rest] = (selectedEnquiry.studentName || '').trim().split(/\s+/)

      const matchedCountry = findMatchingCountry(selectedEnquiry, allCountries)
      // The enquiry's own phone country (mobileCountryGuid, 2026-10) wins for
      // the dial code; older enquiries don't have one, so fall back to the
      // student's country.
      const mobileCountry = selectedEnquiry.mobileCountryGuid
        ? allCountries.find(c => c.countryGuid === selectedEnquiry.mobileCountryGuid)
        : undefined
      const phoneDial = mobileCountry ? dialCode(mobileCountry) : matchedCountry ? dialCode(matchedCountry) : undefined

      setForm(prev => ({
        ...prev,
        intakeGuid: selectedEnquiry.intakeGuid || prev.intakeGuid,
        campusGuid: selectedEnquiry.campusGuid || prev.campusGuid,
        programGuid: selectedEnquiry.programGuid ?? '',
        semesterGuid: '',
        batchGuid: '',
        feeHdGuid: '',
        firstName: firstName ?? '',
        lastName: rest.join(' '),
        phone: selectedEnquiry.mobile ?? prev.phone,
        email: selectedEnquiry.email ?? prev.email,
        // An enquiry with no country comes back as the all-zero guid — treat
        // that as "none" so the field asks for a country instead of holding
        // an invalid value (which also blocked the default-country prefill).
        countryGuid: matchedCountry?.countryGuid
          ?? (selectedEnquiry.countryGuid && selectedEnquiry.countryGuid !== EMPTY_GUID ? selectedEnquiry.countryGuid : '')
          ?? prev.countryGuid,
        phoneCode: phoneDial ?? prev.phoneCode,
        remarks: selectedEnquiry.remarks ?? prev.remarks,
      }))
    } else if (allCountries.length > 0 && !form.countryGuid) {
      // In case countries finished loading after selectedEnquiry was processed
      const matchedCountry = findMatchingCountry(selectedEnquiry, allCountries)
      if (matchedCountry) {
        setForm(prev => ({
          ...prev,
          countryGuid: matchedCountry.countryGuid,
          phoneCode: prev.phoneCode || dialCode(matchedCountry),
        }))
      }
    }
  }, [selectedEnquiry, allCountries, form.countryGuid])

  // Pre-select the home country (Uganda) on page load once the full list is in
  useEffect(() => {
    if (allCountries.length > 0 && !form.countryGuid && !form.enquiryGuid) {
      const defaultCountry = findDefaultCountry(allCountries)
      if (defaultCountry) {
        setForm(prev => ({
          ...prev,
          countryGuid: defaultCountry.countryGuid,
          phoneCode: dialCode(defaultCountry),
        }))
      }
    }
  }, [allCountries, form.countryGuid, form.enquiryGuid])

  // Pre-select default currency on page load once currencies list is loaded
  useEffect(() => {
    if (currencies.length > 0 && !form.currencyGuid) {
      setForm(prev => ({
        ...prev,
        currencyGuid: getDefaultFinanceCurrencyGuid(currencies),
      }))
    }
  }, [currencies, form.currencyGuid])

  // Enquiry dropdown — the shared SearchSelect over unconverted enquiries for
  // the intake, server-searched (debounced) with scroll-to-load-more.
  const [committedEnquirySearch, setCommittedEnquirySearch] = useState('')
  const [enquiryPickerOpen, setEnquiryPickerOpen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setCommittedEnquirySearch(enquirySearch.trim()), 300)
    return () => clearTimeout(t)
  }, [enquirySearch])
  const enquiryQuery = useUnconvertedEnquiriesInfinite(form.intakeGuid, committedEnquirySearch, 20, enquiryPickerOpen && !!form.intakeGuid)
  const enquiryOptions = useMemo(
    () => flattenUniquePages(enquiryQuery.data?.pages ?? [], e => e.enquiryGuid)
      .map(e => ({ value: e.enquiryGuid, label: `${e.studentName} (${e.enquiryCode})` })),
    [enquiryQuery.data],
  )
  // Sourced from selectedEnquiry (the full-detail fetch above), not the
  // paged list, so a ?enquiryGuid= handoff from enquiry-followup(-master)
  // shows a real label before that enquiry has been paged into the list.
  const selectedEnquiryLabel = selectedEnquiry ? `${selectedEnquiry.studentName} (${selectedEnquiry.enquiryCode})` : null
  if (form.enquiryGuid && selectedEnquiryLabel && !enquiryOptions.some(o => o.value === form.enquiryGuid)) {
    enquiryOptions.unshift({ value: form.enquiryGuid, label: selectedEnquiryLabel })
  }

  // These pickers only load their options when opened, so a value set by the
  // enquiry prefill (Convert → ?enquiryGuid=) had no matching option and the
  // field — and the Preview panel's labelFor() — showed blank. Keep the
  // selected value listed with a label from data we already have until the
  // real option pages in.
  const { data: selectedIntakeDetail } = useIntake(form.intakeGuid || null, !!form.intakeGuid)
  function withSelected(options: Option[], value: string, label: string | null | undefined): Option[] {
    return value && label && !options.some(o => o.value === value) ? [{ value, label }, ...options] : options
  }
  const enquiryMatches = (field: 'campusGuid' | 'programGuid' | 'countryGuid', value: string) =>
    !!selectedEnquiry && !!value && selectedEnquiry[field] === value

  const intakeOptions   = withSelected(
    intakes.map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` })),
    form.intakeGuid,
    selectedIntakeDetail?.intakeGuid === form.intakeGuid ? `${selectedIntakeDetail.intakeCode} — ${selectedIntakeDetail.description}` : null,
  )
  const campusOptions   = withSelected(
    campuses.map(c => ({ value: c.campusGuid, label: c.campusName })),
    form.campusGuid,
    enquiryMatches('campusGuid', form.campusGuid) ? selectedEnquiry!.campusName : null,
  )
  const programOptions  = withSelected(
    programsByCampus.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` })),
    form.programGuid,
    enquiryMatches('programGuid', form.programGuid) && selectedEnquiry!.programName
      ? `${selectedEnquiry!.programName}${selectedEnquiry!.programCode ? ` (${selectedEnquiry!.programCode})` : ''}`
      : null,
  )
  const countryOptions  = withSelected(
    countries.map(c => ({ value: c.countryGuid, label: c.countryName })),
    form.countryGuid,
    allCountries.find(c => c.countryGuid === form.countryGuid)?.countryName
      ?? (enquiryMatches('countryGuid', form.countryGuid) ? selectedEnquiry!.countryName : null),
  )
  // The default +256 may not be on the picker's current page — keep it listed.
  const phoneCodeOptions = countries.length
    ? withSelected(
        Array.from(
          new Map(countries.map(c => [dialCode(c), `${dialCode(c)} · ${c.countryName}`])).entries(),
        ).map(([value, label]) => ({ value, label })),
        form.phoneCode,
        form.phoneCode,
      )
    : COUNTRY_CODES

  function handleCountryChange(guid: string) {
    const match = countries.find(c => c.countryGuid === guid) ?? allCountries.find(c => c.countryGuid === guid)
    setForm(prev => ({
      ...prev,
      countryGuid: guid,
      phoneCode: match ? dialCode(match) : prev.phoneCode,
    }))
  }
  const semesterOptions = semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))
  const batchTimeOptions = batchTimes.map(bt => ({ value: bt.batchTimeGuid, label: bt.batchTime }))
  const batchOptions    = batches.map(b => ({ value: b.batchGuid, label: b.batchCode }))
  const feeOptions      = fees.map(f => ({ value: f.feeHdGuid, label: `${f.feeDesc} (${f.feeCode})` }))
  const exemptionOptions: Option[] = [{ value: '', label: '-- None (Pay Full Fee) --' }, ...exemptionTypes.map(e => ({ value: e.exemptionTypeGuid, label: e.label }))]
  const payTypeOptions  = paymentTypes.map(t => ({ value: String(t.intPaymentType), label: t.paymentTypeName }))
  const currencyOptions = currencies.map(c => ({ value: c.currencyGuid, label: c.currencyCode }))
  const bankOptions     = banks.map(b => ({ value: b.procBankGuid, label: b.bankName }))


  const isWaived = !!form.exemptionTypeGuid
  // Per Create.bru docs, bankGuid's requirement is tied only to payType > 1
  // — exemption only makes payType/amount/currencyGuid/exRate/receiptBookGuid
  // "not required", not forbidden. isBank previously also checked !isWaived,
  // which silently forced bankGuid to null on submit any time an exemption
  // was selected — even though the Bank Transfer Details section stayed
  // visible and let you pick one. Now reflects the actual Payment Method
  // selection regardless of waived status.
  const isBank   = Number(form.payType) > 1
  const selectedBankGuid = isBank ? (form.bankGuid || null) : null
  const showBankDetails = isBank

  // Live form-completion feedback for the progress strip and the submit
  // button's "ready" glow — mirrors handleSubmit's own required-field list
  // below, but kept as its own separate computation (not factored into one
  // shared source) so a display-only change here can never alter what's
  // actually enforced on submit.
  const requiredFieldsFilled = [
    !!form.firstName, !!form.lastName, !!form.phone,
    !!form.intakeGuid, !!form.countryGuid, !!form.campusGuid, !!form.programGuid,
    !!form.semesterGuid, !!form.batchTimeGuid, !!form.batchGuid, !!form.feeHdGuid,
    !!form.paymentDate,
    ...(isWaived ? [] : [
      !!form.payType, !!form.currencyGuid, !!form.receiptBookGuid, !!form.feeAmount,
      ...(isBank ? [!!form.bankGuid] : []),
    ]),
  ]
  const formCompletePct = Math.round((requiredFieldsFilled.filter(Boolean).length / requiredFieldsFilled.length) * 100)
  const formReady = requiredFieldsFilled.every(Boolean)

  // Fee Amount is manual-entry only — a first attempt tried to auto-fill it
  // from the selected Fee Structure's dropdown entry, but the real DTO
  // (confirmed via a live response) has no flat currency amount field, only
  // amtPer (a percentage of something unconfirmed), so there's nothing to
  // auto-fill from yet.

  // Today's rates, fetched per currency via GET /exchange-rates/exists
  // (exRate = UGX per 1 unit of the currency). The base currency is 1 by
  // definition. KSH, not KES — that's the backend Currency Master's code.
  const today = todayYmd()
  const baseCurrency = currencies.find(c => c.isDefault === 1)
  const usdCurrency  = currencies.find(c => c.currencyCode === 'USD')
  const kshCurrency  = currencies.find(c => c.currencyCode === 'KSH')
  const usdRateQuery = useExchangeRateExists(usdCurrency?.currencyGuid ?? null, today)
  const kshRateQuery = useExchangeRateExists(kshCurrency?.currencyGuid ?? null, today)
  const usdRate = usdRateQuery.data?.exists ? usdRateQuery.data.exRate : null
  const kshRate = kshRateQuery.data?.exists ? kshRateQuery.data.exRate : null
  const usdRateMissing = !!usdCurrency && usdRateQuery.isSuccess && !usdRateQuery.data?.exists

  const kshRateMissing = !!kshCurrency && kshRateQuery.isSuccess && !kshRateQuery.data?.exists
  // Rate-entry popup, opened on a given currency (the user can switch it).
  const [rateModalCurrencyGuid, setRateModalCurrencyGuid] = useState<string | undefined>(undefined)
  function openRateModal(currencyGuid?: string) { setRateModalCurrencyGuid(currencyGuid); openModal('exchange-rate') }
  const [ratesSetNote, setRatesSetNote] = useState(false)
  const rateCurrencies = currencies.filter(c => c.currencyGuid !== baseCurrency?.currencyGuid)

  // No USD rate for today → ask for it once, as soon as that's known. After
  // a Cancel it stays closed; the bar's "Enter rate" button (or submitting a
  // USD payment) reopens it.
  const usdPromptShown = useRef(false)
  useEffect(() => {
    if (usdRateMissing && !usdPromptShown.current) { usdPromptShown.current = true; openRateModal(usdCurrency?.currencyGuid) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdRateMissing])

  const selectedCurrency = currencies.find(c => c.currencyGuid === form.currencyGuid)
  // Read-only rate preview for the selected currency on the chosen Payment
  // Date. The server does its own lookup on submit and returns the rate it
  // applied (post-application-payment.md, 2026-10), so nothing here is sent.
  // The base currency is 1 by definition and needs no lookup.
  const isBaseCurrency = !!selectedCurrency && selectedCurrency.currencyGuid === baseCurrency?.currencyGuid
  const needsRateLookup = !isWaived && !!selectedCurrency && !isBaseCurrency && !!form.paymentDate
  const payDateRatesQuery = useExchangeRatesByDate(form.paymentDate, needsRateLookup)
  const previewRate: number | null = isBaseCurrency ? 1
    : payDateRatesQuery.data?.find(r => r.currencyGuid === selectedCurrency?.currencyGuid)?.exRate ?? null
  // Empty list or 404 (the helper maps it to []) = no rate for that date.
  const payDateRateMissing = needsRateLookup && payDateRatesQuery.isSuccess && previewRate == null
  const payDateLabel = form.paymentDate ? formatDate(`${form.paymentDate}T00:00:00`) : ''

  useEffect(() => {
    if (form.receiptBookGuid && !matchingReceiptBooks.some(r => r.receiptBookGuid === form.receiptBookGuid)) {
      set('receiptBookGuid', '')
    }
  }, [form.receiptBookGuid, matchingReceiptBooks])

  // Defaults the Currency picker to Finance's own default currency (UGX) as
  // soon as the list loads, same convention Payment Console's own currency
  // picker uses (getDefaultFinanceCurrencyGuid) — previously nothing ever
  // set form.currencyGuid, so this field always started blank and had to be
  // picked by hand on every application, even though a sensible default was
  // available all along. Only runs while nothing's been picked yet (a
  // manual pick, or a value already on the form from some other source,
  // both take priority) — same "don't fight the user's own choice" guard as
  // that page's effect.
  useEffect(() => {
    if (!form.currencyGuid && currencies.length > 0) set('currencyGuid', getDefaultFinanceCurrencyGuid(currencies))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencies])

  function handleSubmit() {
    const studentName = `${form.firstName} ${form.lastName}`.trim()
    // Spaces/hyphens are allowed while typing ("700 000 000"); the API's
    // mobile is a long, so only the digits are sent.
    const mobileDigits = form.phone.replace(/[\s-]/g, '')
    // Required fields, then the post-application-payment.md rules a filled-in
    // value can still break. One message per field, shown under it.
    const e: FieldErrors = {}
    const req = (k: keyof FormData, label: string) => { if (!form[k]) e[k] = `${label} is required` }
    req('intakeGuid', 'Intake')
    req('firstName', 'First Name')
    req('lastName', 'Last Name')
    req('phone', 'Phone')
    req('countryGuid', 'Country')
    req('campusGuid', 'Campus')
    req('programGuid', 'Programme')
    req('feeHdGuid', 'Fee Structure')
    req('semesterGuid', 'Semester')
    req('batchTimeGuid', 'Batch Time')
    req('batchGuid', 'Batch')
    if (!isWaived) {
      req('payType', 'Payment Method')
      req('receiptBookGuid', 'Receipt Book')
      req('feeAmount', 'Application Fee Amount')
      req('currencyGuid', 'Currency')
    }
    req('paymentDate', 'Payment Date')
    if (!isWaived && isBank) req('bankGuid', 'Bank Name')

    if (!e.lastName && studentName.length > STUDENT_NAME_MAX) e.lastName = `First and last name together must be ${STUDENT_NAME_MAX} characters or fewer (now ${studentName.length})`
    // mobile is a number server-side: digits only, and no leading 0 (the
    // dial code is picked separately).
    if (!e.phone && !/^\d+$/.test(mobileDigits)) e.phone = 'Phone must contain digits only'
    else if (!e.phone && mobileDigits.startsWith('0')) e.phone = 'Phone must not start with 0. Drop the leading 0; the country code is picked separately'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email'
    if (!isWaived && !e.feeAmount && !(Number(form.feeAmount) > 0)) e.feeAmount = 'Application Fee Amount must be greater than 0'
    // The picker already blocks out-of-range dates, but a form left open past
    // midnight (or a restored draft) can still hold one.
    if (!e.paymentDate && (form.paymentDate < getPaymentDateMinYmd() || form.paymentDate > getTodayYmd())) e.paymentDate = PAY_DATE_RANGE_MESSAGE

    setFieldErrors(e)
    setErrorSnapshot({ ...form })
    if (Object.keys(e).length) {
      showToast('Please fix the highlighted fields', 'error')
      scrollToFirstError(e)
      return
    }
    // Submit is disabled in this state too; this covers Enter/any other path.
    if (payDateRateMissing) {
      showToast('No exchange rate for this currency on this date. Pick another date, or ask Finance to add the rate.', 'error')
      return
    }

    const payload = {
      enquiryGuid: form.enquiryGuid || null,
      oDelIntApplication: 0,
      studentName,
      intakeGuid: form.intakeGuid,
      campusGuid: form.campusGuid,
      programGuid: form.programGuid,
      semesterGuid: form.semesterGuid,
      batchGuid: form.batchGuid,
      batchTimeGuid: form.batchTimeGuid,
      feeHdGuid: form.feeHdGuid,
      countryGuid: form.countryGuid,
      mobile: mobileDigits,
      email: form.email.trim() || null,
      exemptionTypeGuid: form.exemptionTypeGuid || null,
      payDate: formatPaymentDate(form.paymentDate),
      payType: form.exemptionTypeGuid ? null : Number(form.payType || 1),
      amount: form.exemptionTypeGuid ? null : Number(form.feeAmount || 0),
      currencyGuid: form.exemptionTypeGuid ? null : form.currencyGuid || null,
      bankGuid: selectedBankGuid,
      receiptBookGuid: form.exemptionTypeGuid ? null : form.receiptBookGuid || null,
      remarks: form.remarks.trim() || null,
      payProofFile,
    }

    createPayment.mutate(payload,
      {
        onSuccess: (response) => {
          // Snapshot everything the receipt panel displays BEFORE clearing
          // the form — the receipt used to read live `form`/labelFor values,
          // which is why the form was never reset after a successful save
          // (clearing it would have blanked the receipt too).
          setSavedReceipt({
            appRefNo: response?.appRefNo, paymentCode: response?.paymentCode, receiptNo: response?.receiptNo,
            paymentGuid: response?.paymentGuid,
            printable: !!response?.paymentGuid && !isWaived && hasPrintableReceipt({ receiptNo: response?.receiptNo }),
            email: form.email.trim() || undefined,
            studentName: `${form.firstName} ${form.lastName}`.trim(),
            programLabel: labelFor(programOptions, form.programGuid),
            campusLabel: labelFor(campusOptions, form.campusGuid),
            intakeLabel: labelFor(intakeOptions, form.intakeGuid),
            amountLabel: isWaived ? 'Waived' : `${form.feeAmount} ${selectedCurrency?.currencyCode ?? ''}`,
            // The server's applied rate and converted amount are the
            // confirmed values — not the preview shown on the form.
            exRateLabel: !isWaived && response?.exRate != null ? formatRate(response.exRate) : undefined,
            amountUshLabel: !isWaived && response?.amountUsh != null ? `${formatRate(response.amountUsh)} ${baseCurrency?.currencyCode ?? 'UGX'}` : undefined,
            methodLabel: isWaived ? 'Waived' : labelFor(payTypeOptions, form.payType),
            dateLabel: formatDate(form.paymentDate || new Date()),
            filing: response?.paymentGuid && response.appRefNo ? {
              paymentGuid: response.paymentGuid,
              appRefNo: response.appRefNo,
              studentName,
              mobile: mobileDigits || null,
              email: form.email.trim() || null,
              intakeCode: (intakes.find(i => i.intakeGuid === form.intakeGuid) ?? (selectedIntakeDetail?.intakeGuid === form.intakeGuid ? selectedIntakeDetail : undefined))?.intakeCode ?? null,
              intakeGuid: form.intakeGuid || null,
              enquiryGuid: form.enquiryGuid || null,
              countryGuid: form.countryGuid || null,
              campusGuid: form.campusGuid,
              programGuid: form.programGuid,
              programName: labelFor(programOptions, form.programGuid) || null,
              semesterGuid: form.semesterGuid,
              batchTimeGuid: form.batchTimeGuid,
              batchGuid: form.batchGuid,
              feeHdGuid: form.feeHdGuid,
              receiptNo: response.receiptNo ?? null,
              isExemption: isWaived,
            } : undefined,
          })
          setReceiptRetryError(null)
          setShowReceipt(true)
          setShowSuccessPopup(true)
          setForm({ ...initialForm, currencyGuid: getDefaultFinanceCurrencyGuid(currencies) })
          setPayProofFile(null)
          appliedEnquiryGuidRef.current = null
        },
        onError: (error: Error) => {
          const msg = error.message || ''
          // Rule-based 400s (post-application-payment.md, fix/admission-bugs)
          // go under the field they're about; anything else — duplicate
          // applicant, missing exchange rate, unconfigured Registered status —
          // stays in the failure popup. None of these are worth retrying.
          const field: keyof FormData | null =
            /current intake only|no active admission intake/i.test(msg) ? 'intakeGuid'
            : /previous intake|already been converted/i.test(msg) ? 'enquiryGuid'
            : /^currency not found/i.test(msg) ? 'currencyGuid'
            : null
          if (!field) { setFailure(msg || 'Failed to save payment. Please try again.'); return }
          const text =
            /previous intake/i.test(msg)
              ? `${msg} Clear the enquiry and enter the payment manually, or create a new enquiry in the current intake.`
            : /already been converted/i.test(msg)
              ? `${msg} Pick another enquiry, or clear it and enter the payment manually.`
            : msg
          const e: FieldErrors = { [field]: text }
          setFieldErrors(e)
          setErrorSnapshot({ ...form })
          scrollToFirstError(e)
        },
      },
    )
  }

  function handleClear() {
    setForm({ ...initialForm, currencyGuid: getDefaultFinanceCurrencyGuid(currencies) }); setFieldErrors({}); setShowReceipt(false); setPayProofFile(null); setSavedReceipt({}); setReceiptRetryError(null)
    setEnquirySearch('')
    appliedEnquiryGuidRef.current = null
  }

  return (
    <div id="page-payment" className="flex flex-col gap-0">

      {/* ── Sticky top: exchange bar + header + pipeline ── */}
      <div className="pmt-sticky-top">

        {/* Exchange rate bar */}
        <div className="card flex items-center gap-3 px-4 py-2.5 mb-4" style={{ flexWrap: 'wrap' }}>
          <i className="lni lni-protection text-b500" style={{ fontSize: 16, flexShrink: 0 }} />
          <span className="font-semibold text-g700" style={{ flexShrink: 0, fontSize: 'var(--fs-xs)' }}>Today&apos;s Exchange Rates</span>
          {[
            { code: 'USD', currency: usdCurrency, query: usdRateQuery, rate: usdRate, onEnter: () => openRateModal(usdCurrency?.currencyGuid) },
            { code: 'KSH', currency: kshCurrency, query: kshRateQuery, rate: kshRate, onEnter: () => openRateModal(kshCurrency?.currencyGuid) },
          ].map(({ code, currency, query, rate, onEnter }) => (
            <div key={code} className="flex items-center gap-1.5 ml-2">
              <span className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>1 {code} =</span>
              {!currency ? (
                <span className="text-g400" style={{ fontSize: 12 }}>not in Currency Master</span>
              ) : query.isLoading ? (
                <span className="text-g400" style={{ fontSize: 12 }}>Loading…</span>
              ) : query.isError ? (
                <span className="text-clr-red" style={{ fontSize: 12 }}><i className="lni lni-warning" /> Couldn&apos;t load</span>
              ) : rate != null ? (
                <span className="font-semibold text-g800" style={{ fontSize: 13 }}>{rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              ) : (
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', color: 'var(--amber)', padding: '2px 8px', gap: 4 }}
                  onClick={onEnter}
                  title={`No ${code} rate for today — click to enter it`}
                >
                  <i className="lni lni-pencil" style={{ fontSize: 11 }} /> Set {code} rate
                </button>
              )}
              <span className="badge-blue text-[11px] px-1.5 py-0.5 rounded font-bold">{baseCurrency?.currencyCode ?? 'UGX'}</span>
            </div>
          ))}
          <span className="text-[11px] text-g400 ml-auto">Rates for {formatDate(`${today}T00:00:00`)}</span>
          {/* Opens the rate popup (with its currency dropdown) on the first
              currency still missing today's rate, else the first one. */}
          <button
            className="btn btn-primary btn-sm"
            style={{ gap: 5 }}
            onClick={() => {
              // Both of today's rates already set — nothing to enter here.
              if (usdRate != null && kshRate != null) { setRatesSetNote(true); return }
              openRateModal((usdRateMissing ? usdCurrency : kshRateMissing ? kshCurrency : undefined)?.currencyGuid)
            }}
            disabled={rateCurrencies.length === 0}
          >
            <i className="lni lni-plus" style={{ fontSize: 12 }} /> Set Exchange Rate
          </button>
          {ratesSetNote && <RatesAlreadySetNote codes={['USD', 'KSH']} onDismiss={() => setRatesSetNote(false)} />}
        </div>

        {/* Page header */}
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Stage 1 · Application Payment</div>
            <div className="pg-sub">Collect application fee · Supports Cash &amp; Bank Transfer · Generates official receipt</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">            {/* Hidden for now — the Enquiry dropdown above already pulls in an enquiry.
            <button className="btn btn-neu btn-sm" onClick={() => openModal('import-source')}>
              <i className="lni lni-download" /> Import from Enquiry
            </button>
            */}
            <button className="btn btn-neu btn-sm" onClick={() => openModal('import-odel')}>
              <i className="lni lni-cloud-download" /> Import from ODel App
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => openModal('import-crm')}>
              <i className="lni lni-download" /> Import from CRM
            </button>
          </div>
        </div>

        {/* Pipeline */}
        <div className="pip-scroll-host">
          {canPipLeft && (
            <button className="tbl-arrow tbl-arrow-l" onClick={() => scrollPipeline('left')} aria-label="Scroll left">
              <i className="lni lni-chevron-left" />
            </button>
          )}
          <div className="pipeline" ref={pipelineRef} onScroll={checkPipelineScroll}>
            {PIPELINE.map((step, i) => (
              <React.Fragment key={step.label}>
                <div className={`pip-step${step.status ? ` ${step.status}` : ''}`}>
                  <div className="pip-circle">{i + 1}</div>
                  <div className="flex flex-col gap-0.5">
                    <span className="pip-label">{step.label}</span>
                    {step.desc && <span className="pip-desc">{step.desc}</span>}
                  </div>
                </div>
                {i < PIPELINE.length - 1 && <div className="pip-line" />}
              </React.Fragment>
            ))}
          </div>
          {canPipRight && (
            <button className="tbl-arrow tbl-arrow-r" onClick={() => scrollPipeline('right')} aria-label="Scroll right">
              <i className="lni lni-chevron-right" />
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="g2">

        {/* Left — forms */}
        <div className="flex flex-col gap-5">

          <div className="pmt-progress">
            <div className="prog-bar-track"><div className="prog-bar-fill" style={{ width: `${formCompletePct}%` }} /></div>
            <span className="pmt-progress-label">{formCompletePct}% complete</span>
          </div>

          {/* Section 1: Application Type & Candidate Info */}
          <div className="card pmt-card">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-g100">
              <i className="lni lni-clipboard text-b500" style={{ fontSize: 18 }} />
              <div className="card-title">Application Type &amp; Candidate Info</div>
            </div>

            <div className="g2 mb-4">
              <Field label="Intake" req error={errorFor('intakeGuid')}>
                <SearchSelect
                  options={intakeOptions}
                  value={form.intakeGuid}
                  placeholder={noOpenIntake ? 'No intake open for admission' : '-- Select Intake --'}
                  onChange={setIntake}
                  isLoading={intakesLoading}
                />
              </Field>
              <Field label="Enquiry" error={errorFor('enquiryGuid')}>
                <SearchSelect
                  options={enquiryOptions}
                  value={form.enquiryGuid}
                  placeholder={form.intakeGuid ? '-- Select Enquiry --' : '-- Select Intake First --'}
                  onChange={v => set('enquiryGuid', v)}
                  onSearch={setEnquirySearch}
                  onOpenChange={setEnquiryPickerOpen}
                  disabled={!form.intakeGuid}
                  isLoading={(enquiryQuery.isFetching && !enquiryQuery.isFetchingNextPage) || enquirySearch.trim() !== committedEnquirySearch}
                  hasNextPage={enquiryQuery.hasNextPage}
                  isFetchingNextPage={enquiryQuery.isFetchingNextPage}
                  onLoadMore={() => enquiryQuery.fetchNextPage()}
                />
              </Field>
            </div>

            <p className="text-[10px] font-bold tracking-widest uppercase text-b500 mb-3">Candidate Details</p>

            <div className="g2">
              <Field label="First Name" req error={errorFor('firstName')}>
                <input className="ctrl" placeholder="e.g. Sarah" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              </Field>
              <Field label="Last Name" req error={errorFor('lastName')}>
                <input className="ctrl" placeholder="e.g. Nakato" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              </Field>
              <Field label="Phone" req error={errorFor('phone')}>
                <div className="flex gap-2">
                  <SearchSelect
                    options={phoneCodeOptions.length ? phoneCodeOptions : COUNTRY_CODES}
                    value={form.phoneCode}
                    onChange={v => set('phoneCode', v)}
                    onSearch={setCountrySearch}
                    onOpenChange={setPhoneCodePickerOpen}
                    isLoading={countryQuery.isLoading}
                    hasNextPage={countryQuery.hasNextPage}
                    isFetchingNextPage={countryQuery.isFetchingNextPage}
                    onLoadMore={() => countryQuery.fetchNextPage()}
                    style={{ width: 108, flexShrink: 0 }}
                  />
                  <input className="ctrl flex-1" type="tel" inputMode="numeric" placeholder="700 000 000" value={form.phone} onChange={e => set('phone', sanitizePhoneInput(e.target.value, false))} />
                </div>
              </Field>
              <Field label="Email" error={errorFor('email')}>
                <div className="inp-wrap">
                  <i className="inp-icon lni lni-envelope" />
                  <input className="ctrl" type="email" placeholder="applicant@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </Field>
              <Field label="Country" req error={errorFor('countryGuid')}>
                <SearchSelect
                  options={countryOptions}
                  value={form.countryGuid}
                  placeholder="-- Select Country --"
                  onChange={handleCountryChange}
                  onSearch={setCountrySearch}
                  onOpenChange={setCountryPickerOpen}
                  isLoading={countryQuery.isLoading}
                  hasNextPage={countryQuery.hasNextPage}
                  isFetchingNextPage={countryQuery.isFetchingNextPage}
                  onLoadMore={() => countryQuery.fetchNextPage()}
                />
              </Field>
              <Field label="Campus" req error={errorFor('campusGuid')}>
                <SearchSelect
                  options={campusOptions}
                  value={form.campusGuid}
                  placeholder="-- Select Campus --"
                  onChange={setCampus}
                  onSearch={setCampusSearch}
                  onOpenChange={setCampusPickerOpen}
                  isLoading={campusQuery.isLoading}
                  hasNextPage={campusQuery.hasNextPage}
                  isFetchingNextPage={campusQuery.isFetchingNextPage}
                  onLoadMore={() => campusQuery.fetchNextPage()}
                />
              </Field>
              <Field label="Interested Programme" req error={errorFor('programGuid')}>
                <SearchSelect
                  options={programOptions}
                  value={form.programGuid}
                  placeholder={form.campusGuid ? '-- Select Programme --' : '-- Select Campus First --'}
                  onChange={setProgram}
                  disabled={!form.campusGuid}
                  onSearch={setProgramSearch}
                  onOpenChange={setProgramPickerOpen}
                  isLoading={programQuery.isLoading}
                  hasNextPage={programQuery.hasNextPage}
                  isFetchingNextPage={programQuery.isFetchingNextPage}
                  onLoadMore={() => programQuery.fetchNextPage()}
                />
              </Field>
              <Field label="Fee Structure" req error={errorFor('feeHdGuid')}>
                <SearchSelect options={feeOptions} value={form.feeHdGuid} placeholder={form.programGuid ? '-- Select Fee Structure --' : '-- Select Programme First --'} onChange={v => set('feeHdGuid', v)} />
              </Field>
              <Field label="Semester" req error={errorFor('semesterGuid')}>
                <SearchSelect options={semesterOptions} value={form.semesterGuid} placeholder={form.programGuid ? '-- Select Semester --' : '-- Select Programme First --'} onChange={setSemester} />
              </Field>
              <Field label="Batch Time" req error={errorFor('batchTimeGuid')}>
                <SearchSelect options={batchTimeOptions} value={form.batchTimeGuid} placeholder="-- Select --" onChange={setBatchTime} />
              </Field>
              <Field label="Batch" req error={errorFor('batchGuid')}>
                <SearchSelect
                  options={batchOptions}
                  value={form.batchGuid}
                  placeholder={form.programGuid && form.semesterGuid && form.batchTimeGuid ? '-- Select Batch --' : '-- Select Programme, Semester & Batch Time First --'}
                  onChange={v => set('batchGuid', v)}
                />
              </Field>
            </div>
          </div>

          {/* Section 2: Payment Details */}
          <div className="card pmt-card">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-g100">
              <i className="lni lni-credit-cards text-b500" style={{ fontSize: 18 }} />
              <div className="card-title">Payment Details</div>
            </div>

            {isWaived && (
              <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg bg-clr-amber-bg border border-clr-amber-bd text-clr-amber" style={{ fontSize: 'var(--fs-sm)' }}>
                <i className="lni lni-warning" /> Fee exemption active: <strong>{labelFor(exemptionOptions, form.exemptionTypeGuid)}</strong>
              </div>
            )}

            <div className="g2 mb-4">
              <Field label="Exemption Type">
                <SearchSelect options={exemptionOptions} value={form.exemptionTypeGuid} onChange={v => set('exemptionTypeGuid', v)} />
              </Field>
              {/* Payment Method/Receipt Book/Amount/Currency/Bank Account are
                  disabled (not just optional) once an Exemption Type is
                  picked, per Application_Payment_Change_Requests_Final_
                  Updated.md #5. */}
              <Field label="Payment Method" req={!isWaived} error={errorFor('payType')}>
                <SearchSelect options={payTypeOptions} value={form.payType} placeholder="-- Select Payment Method --" onChange={v => set('payType', v)} disabled={isWaived} />
              </Field>
              <Field label="Receipt Book" req={!isWaived} error={errorFor('receiptBookGuid')}>
                <SearchSelect options={receiptBookOptions} value={form.receiptBookGuid} placeholder="-- Select Receipt Book --" onChange={v => set('receiptBookGuid', v)} disabled={isWaived} />
              </Field>
            </div>

            {/* Fee amount display */}
            <div className="fg">
              <label className="lbl">Application Fee Amount <span className="req">*</span></label>
              <div className={`amt-display${isWaived ? ' waived' : ''}`}>
                <div className="flex-1">
                  <div className="amt-val-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      className="amt-val-input"
                      value={form.feeAmount}
                      // Digits and one decimal point only; the API rejects
                      // anything that isn't a number above 0.
                      onChange={e => set('feeAmount', stripLeadingZeros(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')))}
                      disabled={isWaived}
                    />
                    <SearchSelect options={currencyOptions} value={form.currencyGuid} onChange={v => set('currencyGuid', v)}
                      style={{ width: 84, flexShrink: 0 }} disabled={isWaived} />
                  </div>
                  <p className="amt-val-hint">
                    {isWaived ? 'Fee waived — exemption applied.' : 'Enter the application fee amount.'}
                  </p>
                  {/* Preview only — the server applies its own lookup on save. */}
                  {needsRateLookup && (
                    payDateRatesQuery.isLoading ? (
                      <p className="amt-val-hint">Checking the {selectedCurrency?.currencyCode} rate for {payDateLabel}…</p>
                    ) : payDateRatesQuery.isError ? (
                      <p className="amt-val-hint text-clr-red"><i className="lni lni-warning" /> Couldn&apos;t load the exchange rate. The server will still check it on save.</p>
                    ) : payDateRateMissing ? (
                      <p className="amt-val-hint text-clr-red"><i className="lni lni-warning" /> No exchange rate for this currency on this date.</p>
                    ) : previewRate != null ? (
                      <p className="amt-val-hint">
                        Rate on {payDateLabel}: 1 {selectedCurrency?.currencyCode} = {formatRate(previewRate)} {baseCurrency?.currencyCode ?? 'UGX'}
                        {Number(form.feeAmount) > 0 && <> · ≈ {formatRate(Number(form.feeAmount) * previewRate)} {baseCurrency?.currencyCode ?? 'UGX'}</>}
                      </p>
                    ) : null
                  )}
                  {isWaived && <p className="amt-waived-lbl">✓ WAIVED</p>}
                </div>
                <span className="badge-amber text-xs px-2 py-1 rounded-md font-bold">{selectedCurrency?.currencyCode ?? '—'}</span>
              </div>
              <FieldError msg={errorFor('feeAmount') ?? errorFor('currencyGuid')} />
            </div>

            <div className="g2 mt-4">
              <Field label="Payment Date" req error={errorFor('paymentDate')}>
                <DatePicker
                  value={form.paymentDate}
                  onChange={v => set('paymentDate', v)}
                  // Local "today", not toISOString() — that's UTC, which in
                  // Uganda (UTC+3) is still yesterday until 03:00.
                  minYmd={getPaymentDateMinYmd()}
                  maxYmd={getTodayYmd()}
                  rangeMessage={PAY_DATE_RANGE_MESSAGE}
                />
              </Field>
            </div>

            <Field label="Receipt Upload" span2>
              <div
                className={`file-zone${payProofDragActive ? ' drag-active' : ''}`}
                onDragOver={e => { e.preventDefault(); setPayProofDragActive(true) }}
                onDragLeave={() => setPayProofDragActive(false)}
                onDrop={e => {
                  e.preventDefault(); setPayProofDragActive(false)
                  const dropped = e.dataTransfer.files?.[0]
                  if (dropped) setPayProofFile(dropped)
                }}
              >
                <input type="file" accept="image/*,.pdf" onChange={e => setPayProofFile(e.target.files?.[0] ?? null)} />
                <i className={`lni ${payProofFile ? 'lni-checkmark-circle' : 'lni-upload'}`} style={{ fontSize: 20, color: payProofFile ? 'var(--green)' : 'var(--g400)' }} />
                <span className="text-g500" style={{ fontSize: 'var(--fs-sm)' }}>
                  {payProofFile ? payProofFile.name : 'Click to upload or drag & drop a scanned receipt'}
                </span>
              </div>
            </Field>

            {showBankDetails && (
              <div className="mt-4 p-4 rounded-xl bg-g50 border border-g200">
                <h3 className="font-semibold text-g700 mb-3" style={{ fontSize: 'var(--fs-sm)' }}>Bank Transfer Details</h3>
                <Field label="Bank Name" req error={errorFor('bankGuid')}>
                  <select className="ctrl" value={form.bankGuid} onChange={e => set('bankGuid', e.target.value)} disabled={isWaived}>
                    <option value="">Select bank</option>
                    {bankOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="fg mt-4">
              <label className="lbl">Remarks / Notes</label>
              <textarea className="ctrl" style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="e.g. Sponsor name, special circumstances..."
                value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>

            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-g100 flex-wrap">
              <button className="btn btn-neu btn-sm" onClick={() => leaveTo('/admission/dashboard')}>
                <i className="lni lni-close" /> Cancel / Close
              </button>
              <button className="btn btn-neu btn-sm" onClick={handleClear}>
                <i className="lni lni-reload" /> Clear
              </button>
              {permissions.add && (
                <button className={`btn btn-primary ml-auto${formReady ? ' btn-submit-ready' : ''}`} disabled={createPayment.isPending || payDateRateMissing} onClick={handleSubmit}
                  title={payDateRateMissing ? 'No exchange rate for this currency on this date' : undefined}>
                  <i className="lni lni-credit-cards" /> {createPayment.isPending ? 'Saving…' : 'Save Payment & Generate Receipt →'}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Right — Live Preview while filling out the form; swaps to the
            Generated Receipt once a payment's been saved (moved here from
            below the form, 2026-09-10 per request) — the live preview has
            nothing left to show at that point anyway (the form resets to
            blank right after a successful save, see onSuccess above), so
            showing it there was just dead space next to the one thing that
            actually matters post-save. */}
        <div>
          {showReceipt ? (
            <div className="card pmt-card tab-panel-in">
              <div className="flex items-center gap-2 mb-4">
                <i className="lni lni-ticket-alt text-clr-green" style={{ fontSize: 18 }} />
                <div className="card-title">Generated Receipt</div>
              </div>
              <div className="border border-g200 rounded-xl p-5 bg-g50">
                <div className="text-center mb-4 pb-3 border-b border-g200">
                  <h3 className="font-bold text-g900" style={{ fontSize: 'var(--fs-lg)' }}>ISBAT University</h3>
                  <p className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>Application Fee Receipt</p>
                </div>
                <div className="flex flex-col gap-1" style={{ fontSize: 'var(--fs-sm)' }}>
                  {[
                    ['Receipt No.', savedReceipt.receiptNo != null ? String(savedReceipt.receiptNo) : 'RCT-AUTO'],
                    ['Payment Code', savedReceipt.paymentCode || '—'],
                    ['Date', savedReceipt.dateLabel ?? ''],
                    ['Candidate', savedReceipt.studentName ?? ''],
                    ['Programme', savedReceipt.programLabel ?? ''],
                    ['Campus', savedReceipt.campusLabel ?? ''],
                    ['Intake', savedReceipt.intakeLabel ?? ''],
                    ['Amount', savedReceipt.amountLabel ?? ''],
                    ...(savedReceipt.exRateLabel ? [['Exchange Rate', savedReceipt.exRateLabel]] : []),
                    ...(savedReceipt.amountUshLabel ? [['Amount (UGX)', savedReceipt.amountUshLabel]] : []),
                    ['Method', savedReceipt.methodLabel ?? ''],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-1">
                      <span className="text-g500 shrink-0">{label}</span>
                      {/* Right-aligned so a long value (e.g. programme name) wraps
                          cleanly instead of butting up against its label. */}
                      <span className={`text-right ${label === 'Amount' ? 'font-bold text-b600' : 'font-medium text-g700'}`}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-dashed border-g300 text-center text-g400" style={{ fontSize: 'var(--fs-xs)' }}>
                  This is a computer-generated receipt. No signature required.
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                {/* Hidden for exemption payments — they have no receipt (400). */}
                {savedReceipt.printable && savedReceipt.paymentGuid && (
                  <button className="btn btn-neu btn-sm" disabled={printingReceipt} onClick={() => printReceipt(savedReceipt.paymentGuid!, String(savedReceipt.receiptNo ?? ''))}>
                    <i className={`lni ${printingReceipt ? 'lni-spinner-arrow spin' : 'lni-printer'}`} /> {printingReceipt ? 'Opening…' : 'Print Receipt'}
                  </button>
                )}
                <button
                  className="btn btn-primary btn-sm ml-auto"
                  onClick={() => {
                    // Hands the saved payment to Filing so it opens straight on
                    // this applicant (see lib/filingHandoff.ts).
                    if (savedReceipt.filing) setFilingPrefill(savedReceipt.filing)
                    router.push('/admission/filing')
                  }}
                >
                  Proceed to Filing <i className="lni lni-arrow-right" />
                </button>
              </div>
              {receiptRetryError && savedReceipt.paymentGuid && (
                <div className="warn-box mt-3" role="alert">
                  <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0 }} />
                  <div className="flex-1" style={{ fontSize: 12.5 }}>{receiptRetryError} The receipt service may be temporarily unavailable.</div>
                  <button className="btn btn-neu btn-sm" disabled={printingReceipt} onClick={() => printReceipt(savedReceipt.paymentGuid!, String(savedReceipt.receiptNo ?? ''))}>
                    <i className="lni lni-reload" /> Try again
                  </button>
                </div>
              )}
              {savedReceipt.email && (
                <p className="text-g500 mt-3" style={{ fontSize: 'var(--fs-xs)' }}>
                  <i className="lni lni-envelope" /> A confirmation is being sent to <strong>{savedReceipt.email}</strong>. It can take up to about two minutes.
                </p>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-g100">
                <div className="flex items-center gap-2">
                  <i className="lni lni-eye text-b500" style={{ fontSize: 16 }} />
                  <div className="card-title">Live Application Preview</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${formReady ? 'badge-green' : 'badge-blue'}`}>{formReady ? 'Ready to submit' : `${formCompletePct}% filled`}</span>
              </div>

              <div className="flex flex-col gap-2">
                <PreviewRow label="Intake"            value={labelFor(intakeOptions, form.intakeGuid)} />
                <PreviewRow label="First Name"         value={form.firstName} />
                <PreviewRow label="Last Name"          value={form.lastName} />
                <PreviewRow label="Phone"              value={form.phone ? `${form.phoneCode} ${form.phone}` : ''} />
                <PreviewRow label="Email"              value={form.email} />
                <PreviewRow label="Campus"             value={labelFor(campusOptions, form.campusGuid)} />
                <PreviewRow label="Programme"          value={labelFor(programOptions, form.programGuid)} />
                <PreviewRow label="Fee Structure"      value={labelFor(feeOptions, form.feeHdGuid)} />
                <PreviewRow label="Semester"           value={labelFor(semesterOptions, form.semesterGuid)} />
                <PreviewRow label="Batch Time"         value={labelFor(batchTimeOptions, form.batchTimeGuid)} />
                <PreviewRow label="Batch"              value={labelFor(batchOptions, form.batchGuid)} />
              </div>

              <hr className="border-g200 my-4" />

              <div className="flex flex-col gap-2">
                <div className="prev-row">
                  <span className="prev-lbl">Fee Status</span>
                  <span className="prev-sep">:</span>
                  <span className="prev-val text-clr-green font-bold">
                    {isWaived ? 'Waived' : `${selectedCurrency?.currencyCode ?? ''} ${parseInt(form.feeAmount || '0').toLocaleString()}`}
                  </span>
                </div>
                <div className="prev-row">
                  <span className="prev-lbl">Receipt No.</span>
                  <span className="prev-sep">:</span>
                  <span className="prev-val">{savedReceipt.receiptNo || '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImportSourceModal isOpen={openModals.has('import-source')} onClose={() => closeModal('import-source')} showToast={showToast} />
      <ImportCrmModal isOpen={openModals.has('import-crm')} onClose={() => closeModal('import-crm')} showToast={showToast} />
      <ImportOdelModal isOpen={openModals.has('import-odel')} onClose={() => closeModal('import-odel')} showToast={showToast} />
      <TodayExchangeRateModal
        isOpen={openModals.has('exchange-rate')}
        onClose={() => closeModal('exchange-rate')}
        currencies={rateCurrencies}
        initialCurrencyGuid={rateModalCurrencyGuid}
        baseCode={baseCurrency?.currencyCode ?? 'UGX'}
        date={today}
        onSaved={(code, rate) => { closeModal('exchange-rate'); showToast(`Today's ${code} rate saved: 1 ${code} = ${rate} ${baseCurrency?.currencyCode ?? 'UGX'}.`, 'success') }}
      />
      <Toast toast={toast} />

      {showSuccessPopup && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <SuccessPopup
              title="Payment Saved!"
              subtitle={`${savedReceipt.appRefNo ?? 'The application fee payment'} has been recorded and a receipt generated below.${savedReceipt.email ? ` A confirmation is being sent to ${savedReceipt.email} — it can take up to about two minutes.` : ''}`}
              onClose={() => setShowSuccessPopup(false)}
            />
          </div>
        </div>
      )}
      {failure && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <FailurePopup title="Couldn't Save Payment" subtitle={failure} onClose={() => setFailure(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentPageContent />
    </Suspense>
  )
}
