'use client'
import React, { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { FailurePopup } from '@/components/modals/shared/FailurePopup'
import { ImportSourceModal } from '@/components/modals/admission/ImportSourceModal'
import { ImportCrmModal } from '@/components/modals/admission/ImportCrmModal'
import { ImportOdelModal } from '@/components/modals/admission/ImportOdelModal'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useProgramMastersByCampus } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useProgramFeeStructures } from '@/hooks/academic/useProgramFeeStructure'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useBatches } from '@/hooks/academic/useBatches'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { useReceiptBooks } from '@/hooks/finance/useReceiptBooks'
import { useProcBanks } from '@/hooks/finance/useProcBanks'
import { useCountries } from '@/hooks/config/useCountries'
import { useEnquiry } from '@/hooks/admission/useEnquiries'
import {
  useApplicationPaymentExemptionTypes,
  useApplicationPaymentTypes,
  useCreateApplicationPayment,
  useUnconvertedEnquiries,
} from '@/hooks/admission/useApplicationPayments'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { sanitizePhoneInput } from '@/lib/errorMessages'
import { formatDate } from '@/lib/date'
import { setFilingPrefillRef } from '@/lib/filingHandoff'

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

const initialForm: FormData = {
  intakeGuid: '', enquiryGuid: '',
  firstName: '', lastName: '', phoneCode: '+256', phone: '', email: '', countryGuid: '',
  campusGuid: '', programGuid: '', semesterGuid: '', batchTimeGuid: '', batchGuid: '',
  feeHdGuid: '',
  exemptionTypeGuid: '', payType: '',
  receiptBookGuid: '', feeAmount: '', currencyGuid: '',
  paymentDate: '',
  bankGuid: '', remarks: '',
}

function Field({ label, req, children, span2 }: { label: string; req?: boolean; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`fg${span2 ? ' span2' : ''}`}>
      <label className="lbl">{label}{req && <span className="req"> *</span>}</label>
      {children}
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="prev-row">
      <span className="prev-lbl">{label}</span>
      <span className="prev-sep">:</span>
      <span className="prev-val">{value || '—'}</span>
    </div>
  )
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
    studentName?: string; programLabel?: string; campusLabel?: string; intakeLabel?: string
    amountLabel?: string; methodLabel?: string; dateLabel?: string
  }>({})

  // Displayed exchange rates — kept as controlled state (not just readOnly
  // display) so the submitted exRate actually matches what's shown here.
  const [usdRate, setUsdRate] = useState('3720')
  const [kesRate, setKesRate] = useState('28.5')

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
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }

  const set = (k: keyof FormData, v: string) => setForm(prev => ({ ...prev, [k]: v }))

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
    setForm({ ...initialForm })
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
    appliedEnquiryGuidRef.current = null
  }
  function setCampus(v: string) { setForm(prev => ({ ...prev, campusGuid: v, programGuid: '', semesterGuid: '', batchGuid: '', feeHdGuid: '' })) }
  function setProgram(v: string) { setForm(prev => ({ ...prev, programGuid: v, semesterGuid: '', batchGuid: '', feeHdGuid: '' })) }
  function setSemester(v: string) { setForm(prev => ({ ...prev, semesterGuid: v, batchGuid: '' })) }
  function setBatchTime(v: string) { setForm(prev => ({ ...prev, batchTimeGuid: v, batchGuid: '' })) }

  // ── Real data ──────────────────────────────────────────────────────────
  // enquiryGuid is CONFIRMED required on Create (the .bru docs mark it
  // "optional" but a real 400 reproduced by removing only this field from
  // an otherwise-working payload proves otherwise) — every payment must
  // link to a real enquiry. Per Application_Payment_Change_Requests_Final_
  // Updated.md #1/#2, the Enquiry dropdown is now scoped to the selected
  // Intake and restricted to not-yet-converted enquiries (GET
  // .../unconverted-enquiries?intakeGuid=...&page=1&pageSize=10), replacing
  // the old generic "first 100 of 11k+" useEnquiries() list — only enabled
  // once an Intake is actually picked.
  const { data: unconvertedEnquiriesData } = useUnconvertedEnquiries(form.intakeGuid, 1, 1000, !!form.intakeGuid)
  const { data: intakes = [] }       = useIntakes()
  const { data: campuses = [] }      = useCampuses()
  // Per #7 — scoped to the selected Campus instead of every programme.
  const { data: programsByCampus = [] } = useProgramMastersByCampus(form.campusGuid, !!form.campusGuid)
  const { data: semesters = [] }     = useSemestersForProgram(form.programGuid, !!form.programGuid)
  const { data: batchTimes = [] }    = useBatchTimes()
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
  // No dedicated Countries dropdown under Application-Payments — reuses the
  // same real, guid-bearing Country source as Country Master and Filing
  // (GET /api/v1/users/countries), confirmed end-to-end via a real
  // successful payment.
  const { data: countries = [] }     = useCountries()
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
    if (!selectedEnquiry || appliedEnquiryGuidRef.current === selectedEnquiry.enquiryGuid) return
    appliedEnquiryGuidRef.current = selectedEnquiry.enquiryGuid
    const [firstName, ...rest] = selectedEnquiry.studentName.trim().split(/\s+/)
    // Case/whitespace-tolerant match — Enquiry.countryCode used to be
    // confirmed 2-letter ISO alpha-2 back when online/ondesk-enquiry
    // hardcoded 'UG' on create. Those forms now send a real countryGuid
    // instead (see EnquiryInput.countryGuid in lib/api/admission/enquiry.ts),
    // and the read side isn't confirmed to still echo back a code for every
    // row — confirmed nullable the hard way (a real enquiry crashed here on
    // .trim() of an undefined countryCode). Skip the match entirely rather
    // than crash when it's missing; the Country Master's own countryCode
    // VALUES have also never been confirmed against a real response (mock
    // stand-ins use 3-letter alpha-3 codes like 'UGA') — if the real master
    // turns out to also be alpha-3, this exact-ish match still won't find
    // anything and Country/Phone Code will silently stay unmapped, same as
    // before. Not guessing an alpha2→alpha3 conversion table here since a
    // wrong guess would produce a silently WRONG country rather than just an
    // empty field — verify the real /api/v1/users/countries countryCode
    // format and fix this properly once confirmed.
    const matchedCountry = selectedEnquiry.countryCode
      ? countries.find(
          c => c.countryCode.trim().toLowerCase() === selectedEnquiry.countryCode!.trim().toLowerCase(),
        )
      : undefined
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
      countryGuid: matchedCountry?.countryGuid ?? prev.countryGuid,
      phoneCode: matchedCountry?.countryPrefix ?? prev.phoneCode,
      remarks: selectedEnquiry.remarks ?? prev.remarks,
    }))
  }, [selectedEnquiry, countries])

  const enquiryOptions  = (unconvertedEnquiriesData?.items ?? []).map(e => ({ value: e.enquiryGuid, label: `${e.studentName} (${e.enquiryCode})` }))
  const enquiryOptionsWithSelected = selectedEnquiry
    ? [
        { value: selectedEnquiry.enquiryGuid, label: `${selectedEnquiry.studentName} (${selectedEnquiry.enquiryCode})` },
        ...enquiryOptions.filter(o => o.value !== selectedEnquiry.enquiryGuid),
      ]
    : enquiryOptions

  const intakeOptions   = intakes.map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` }))
  const campusOptions   = campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))
  const programOptions  = programsByCampus.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` }))
  const countryOptions  = countries.map(c => ({ value: c.countryGuid, label: c.countryName }))
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

  

  // Fee Amount is manual-entry only — a first attempt tried to auto-fill it
  // from the selected Fee Structure's dropdown entry, but the real DTO
  // (confirmed via a live response) has no flat currency amount field, only
  // amtPer (a percentage of something unconfirmed), so there's nothing to
  // auto-fill from yet.

  const selectedCurrency = currencies.find(c => c.currencyGuid === form.currencyGuid)
  const exRate = selectedCurrency?.currencyCode === 'USD' ? Number(usdRate) || 1
    : selectedCurrency?.currencyCode === 'KES' ? Number(kesRate) || 1
    : 1

  useEffect(() => {
    if (form.receiptBookGuid && !matchingReceiptBooks.some(r => r.receiptBookGuid === form.receiptBookGuid)) {
      set('receiptBookGuid', '')
    }
  }, [form.receiptBookGuid, matchingReceiptBooks])

  function handleSubmit() {
    const missing: string[] = []
    if (!form.enquiryGuid) missing.push('Enquiry')
    if (!form.firstName) missing.push('First Name')
    if (!form.lastName) missing.push('Last Name')
    if (!form.phone) missing.push('Phone')
    if (!form.intakeGuid) missing.push('Intake')
    if (!form.countryGuid) missing.push('Country')
    if (!form.campusGuid) missing.push('Campus')
    if (!form.programGuid) missing.push('Programme')
    if (!form.semesterGuid) missing.push('Semester')
    if (!form.batchTimeGuid) missing.push('Batch Time')
    if (!form.batchGuid) missing.push('Batch')
    if (!form.feeHdGuid) missing.push('Fee Structure')
    if (!form.paymentDate) missing.push('Payment Date')
    if (!isWaived) {
      if (!form.payType) missing.push('Payment Method')
      if (!form.currencyGuid) missing.push('Currency')
      if (!form.receiptBookGuid) missing.push('Receipt Book')
      if (!form.feeAmount) missing.push('Application Fee Amount')
      if (isBank && !form.bankGuid) missing.push('Bank Name')
    }
    if (missing.length) {
      showToast(`Please fill: ${missing.join(', ')}`, 'error')
      return
    }

    const payload = {
      enquiryGuid: form.enquiryGuid,
      oDelIntApplication: 0,
      studentName: `${form.firstName} ${form.lastName}`.trim(),
      intakeGuid: form.intakeGuid,
      campusGuid: form.campusGuid,
      programGuid: form.programGuid,
      semesterGuid: form.semesterGuid,
      batchGuid: form.batchGuid,
      batchTimeGuid: form.batchTimeGuid,
      feeHdGuid: form.feeHdGuid,
      countryGuid: form.countryGuid,
      mobile: form.phone.trim(),
      email: form.email.trim() || null,
      exemptionTypeGuid: form.exemptionTypeGuid || null,
      payDate: formatPaymentDate(form.paymentDate),
      payType: form.exemptionTypeGuid ? null : Number(form.payType || 1),
      amount: form.exemptionTypeGuid ? null : Number(form.feeAmount || 0),
      currencyGuid: form.exemptionTypeGuid ? null : form.currencyGuid || null,
      exRate: form.exemptionTypeGuid ? null : exRate || 1,
      bankGuid: selectedBankGuid,
      receiptBookGuid: form.exemptionTypeGuid ? null : form.receiptBookGuid || null,
      remarks: form.remarks.trim() || null,
      payProofFile,
    }

    console.log('[application payment] submitting payload', {
      ...payload,
      payProofFile: payProofFile ? { name: payProofFile.name, size: payProofFile.size, type: payProofFile.type } : null,
    })

    createPayment.mutate(payload,
      {
        onSuccess: (response) => {
          // Snapshot everything the receipt panel displays BEFORE clearing
          // the form — the receipt used to read live `form`/labelFor values,
          // which is why the form was never reset after a successful save
          // (clearing it would have blanked the receipt too).
          setSavedReceipt({
            appRefNo: response?.appRefNo, paymentCode: response?.paymentCode, receiptNo: response?.receiptNo,
            studentName: `${form.firstName} ${form.lastName}`.trim(),
            programLabel: labelFor(programOptions, form.programGuid),
            campusLabel: labelFor(campusOptions, form.campusGuid),
            intakeLabel: labelFor(intakeOptions, form.intakeGuid),
            amountLabel: isWaived ? 'Waived' : `${form.feeAmount} ${selectedCurrency?.currencyCode ?? ''}`,
            methodLabel: isWaived ? 'Waived' : labelFor(payTypeOptions, form.payType),
            dateLabel: formatDate(form.paymentDate || new Date()),
          })
          setShowReceipt(true)
          setShowSuccessPopup(true)
          setForm({ ...initialForm })
          setPayProofFile(null)
          appliedEnquiryGuidRef.current = null
        },
        onError: (error: Error) => setFailure(error.message || 'Failed to save payment. Please try again.'),
      },
    )
  }

  function handleClear() {
    setForm({ ...initialForm }); setShowReceipt(false); setPayProofFile(null); setSavedReceipt({})
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
          <span className="badge-green text-[11px] px-2 py-0.5 rounded-md font-semibold">Auto-fetched</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>1 USD =</span>
            <input className="ctrl text-center font-semibold" style={{ width: 70, padding: '3px 6px', fontSize: 13 }} value={usdRate} onChange={e => setUsdRate(e.target.value)} readOnly />
            <span className="badge-blue text-[11px] px-1.5 py-0.5 rounded font-bold">UGX</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>1 KES =</span>
            <input className="ctrl text-center font-semibold" style={{ width: 70, padding: '3px 6px', fontSize: 13 }} value={kesRate} onChange={e => setKesRate(e.target.value)} readOnly />
            <span className="badge-blue text-[11px] px-1.5 py-0.5 rounded font-bold">UGX</span>
          </div>
          <span className="text-[11px] text-g400 ml-auto">Last updated: Today 08:30 AM</span>
          <button className="btn btn-neu btn-sm" style={{ gap: 5 }}>
            <i className="lni lni-reload" style={{ fontSize: 12 }} /> Refresh
          </button>
        </div>

        {/* Page header */}
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Stage 1 · Application Payment</div>
            <div className="pg-sub">Collect application fee · Supports Cash &amp; Bank Transfer · Generates official receipt</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn btn-neu btn-sm" onClick={() => leaveTo('/admission/dashboard')}>
              <i className="lni lni-arrow-left" /> Back
            </button>
            <button className="btn btn-neu btn-sm" onClick={() => openModal('import-source')}>
              <i className="lni lni-download" /> Import from Enquiry
            </button>
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

          {/* Section 1: Application Type & Candidate Info */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-g100">
              <i className="lni lni-clipboard text-b500" style={{ fontSize: 18 }} />
              <div className="card-title">Application Type &amp; Candidate Info</div>
            </div>

            <div className="g2 mb-4">
              <Field label="Intake" req>
                <SearchSelect options={intakeOptions} value={form.intakeGuid} placeholder="-- Select Intake --" onChange={setIntake} />
              </Field>
              <Field label="Enquiry" req>
                <SearchSelect
                  options={enquiryOptionsWithSelected}
                  value={form.enquiryGuid}
                  placeholder={form.intakeGuid ? '-- Select Enquiry --' : '-- Select Intake First --'}
                  onChange={v => set('enquiryGuid', v)}
                  disabled={!form.intakeGuid}
                />
              </Field>
            </div>

            <p className="text-[10px] font-bold tracking-widest uppercase text-b500 mb-3">Candidate Details</p>

            <div className="g2">
              <Field label="First Name" req>
                <input className="ctrl" placeholder="e.g. Sarah" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              </Field>
              <Field label="Last Name" req>
                <input className="ctrl" placeholder="e.g. Nakato" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              </Field>
              <Field label="Phone" req>
                <div className="flex gap-2">
                  <SearchSelect options={COUNTRY_CODES} value={form.phoneCode} onChange={v => set('phoneCode', v)} style={{ width: 108, flexShrink: 0 }} />
                  <input className="ctrl flex-1" type="tel" inputMode="numeric" placeholder="700 000 000" value={form.phone} onChange={e => set('phone', sanitizePhoneInput(e.target.value, false))} />
                </div>
              </Field>
              <Field label="Email">
                <div className="inp-wrap">
                  <i className="inp-icon lni lni-envelope" />
                  <input className="ctrl" type="email" placeholder="applicant@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </Field>
              <Field label="Country" req>
                <SearchSelect options={countryOptions} value={form.countryGuid} placeholder="-- Select Country --" onChange={v => set('countryGuid', v)} />
              </Field>
              <Field label="Campus" req>
                <SearchSelect options={campusOptions} value={form.campusGuid} placeholder="-- Select Campus --" onChange={setCampus} />
              </Field>
              <Field label="Interested Programme" req>
                <SearchSelect
                  options={programOptions}
                  value={form.programGuid}
                  placeholder={form.campusGuid ? '-- Select Programme --' : '-- Select Campus First --'}
                  onChange={setProgram}
                  disabled={!form.campusGuid}
                />
              </Field>
              <Field label="Fee Structure" req>
                <SearchSelect options={feeOptions} value={form.feeHdGuid} placeholder={form.programGuid ? '-- Select Fee Structure --' : '-- Select Programme First --'} onChange={v => set('feeHdGuid', v)} />
              </Field>
              <Field label="Semester" req>
                <SearchSelect options={semesterOptions} value={form.semesterGuid} placeholder={form.programGuid ? '-- Select Semester --' : '-- Select Programme First --'} onChange={setSemester} />
              </Field>
              <Field label="Batch Time" req>
                <SearchSelect options={batchTimeOptions} value={form.batchTimeGuid} placeholder="-- Select --" onChange={setBatchTime} />
              </Field>
              <Field label="Batch" req>
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
          <div className="card">
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
              <Field label="Payment Method" req={!isWaived}>
                <SearchSelect options={payTypeOptions} value={form.payType} placeholder="-- Select Payment Method --" onChange={v => set('payType', v)} disabled={isWaived} />
              </Field>
              <Field label="Receipt Book" req={!isWaived}>
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
                      onChange={e => set('feeAmount', e.target.value)}
                      disabled={isWaived}
                    />
                    <SearchSelect options={currencyOptions} value={form.currencyGuid} onChange={v => set('currencyGuid', v)}
                      style={{ width: 84, flexShrink: 0 }} disabled={isWaived} />
                  </div>
                  <p className="amt-val-hint">
                    {isWaived ? 'Fee waived — exemption applied.' : 'Enter the application fee amount.'}
                  </p>
                  {isWaived && <p className="amt-waived-lbl">✓ WAIVED</p>}
                </div>
                <span className="badge-amber text-xs px-2 py-1 rounded-md font-bold">{selectedCurrency?.currencyCode ?? '—'}</span>
              </div>
            </div>

            <div className="g2 mt-4">
              <Field label="Payment Date" req>
                <DatePicker value={form.paymentDate} onChange={v => set('paymentDate', v)} maxYmd={new Date().toISOString().slice(0, 10)} />
              </Field>
            </div>

            <Field label="Receipt Upload" span2>
              <div className="file-zone">
                <input type="file" accept="image/*,.pdf" onChange={e => setPayProofFile(e.target.files?.[0] ?? null)} />
                <i className="lni lni-upload text-g400" style={{ fontSize: 20 }} />
                <span className="text-g500" style={{ fontSize: 'var(--fs-sm)' }}>
                  {payProofFile ? payProofFile.name : 'Click to upload or drag & drop a scanned receipt'}
                </span>
              </div>
            </Field>

            {showBankDetails && (
              <div className="mt-4 p-4 rounded-xl bg-g50 border border-g200">
                <h3 className="font-semibold text-g700 mb-3" style={{ fontSize: 'var(--fs-sm)' }}>Bank Transfer Details</h3>
                <Field label="Bank Name" req>
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
                <button className="btn btn-primary ml-auto" disabled={createPayment.isPending} onClick={handleSubmit}>
                  <i className="lni lni-credit-cards" /> {createPayment.isPending ? 'Saving…' : 'Save Payment & Generate Receipt →'}
                </button>
              )}
            </div>
          </div>

          {/* Generated receipt */}
          {showReceipt && (
            <div className="card">
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
                    ['Method', savedReceipt.methodLabel ?? ''],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1">
                      <span className="text-g500">{label}</span>
                      <span className={label === 'Amount' ? 'font-bold text-b600' : 'font-medium text-g700'}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-dashed border-g300 text-center text-g400" style={{ fontSize: 'var(--fs-xs)' }}>
                  This is a computer-generated receipt. No signature required.
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button className="btn btn-neu btn-sm"><i className="lni lni-printer" /> Print Receipt</button>
                <button
                  className="btn btn-primary btn-sm ml-auto"
                  onClick={() => {
                    // Carries the appRefNo over so Filing can auto-search/select this
                    // application instead of the counsellor having to retype it —
                    // see the note above savedReceipt's state declaration for why this
                    // couldn't just reuse live `form` state.
                    if (savedReceipt.appRefNo) setFilingPrefillRef(savedReceipt.appRefNo)
                    router.push('/admission/filing')
                  }}
                >
                  Proceed to Filing <i className="lni lni-arrow-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right — Live Preview */}
        <div>
          <div className="card">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-g100">
              <div className="flex items-center gap-2">
                <i className="lni lni-eye text-b500" style={{ fontSize: 16 }} />
                <div className="card-title">Live Application Preview</div>
              </div>
              <span className="badge-green text-[11px] px-2 py-0.5 rounded-md font-semibold">Auto-updated</span>
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
        </div>
      </div>

      <ImportSourceModal isOpen={openModals.has('import-source')} onClose={() => closeModal('import-source')} showToast={showToast} />
      <ImportCrmModal isOpen={openModals.has('import-crm')} onClose={() => closeModal('import-crm')} showToast={showToast} />
      <ImportOdelModal isOpen={openModals.has('import-odel')} onClose={() => closeModal('import-odel')} showToast={showToast} />
      <Toast toast={toast} />

      {showSuccessPopup && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <SuccessPopup
              title="Payment Saved!"
              subtitle={`${savedReceipt.appRefNo ?? 'The application fee payment'} has been recorded and a receipt generated below.`}
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
