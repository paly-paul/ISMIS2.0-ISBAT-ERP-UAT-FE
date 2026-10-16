'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { openPdfInNewTab } from '@/lib/openPdf'
import { getApplicationPaymentReceiptPdf, hasPrintableReceipt } from '@/lib/api/admission/applicationPayment'
import { FailurePopup } from '@/components/modals/shared/FailurePopup'
import { useSearchCampusesInfinite } from '@/hooks/config/useCampuses'
import { useProgramMaster, useProgramMasterByGuid, useSearchProgramMastersInfinite } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useBatch, useBatches } from '@/hooks/academic/useBatches'
import { useCountries, useSearchCountriesInfinite } from '@/hooks/config/useCountries'
import { useProgramFeeStructures } from '@/hooks/academic/useProgramFeeStructure'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { sanitizePhoneInput, sanitizeNameInput } from '@/lib/errorMessages'
import { consumeFilingPrefill } from '@/lib/filingHandoff'
import { getEnquiryById, getEnquiries } from '@/lib/api/admission/enquiry'
import { flattenUniquePages } from '@/lib/pagination'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import {
  FilingApplicationSearchResult,
  useApplicationByPaymentGuid,
  useDeleteQualification,
  useSaveGeneral,
  useSaveQualification,
  useSearchApplicationsForFilingInfinite,
  useSubmitApplication,
  useUploadPhoto,
} from '@/hooks/admission/useApplicationFiling'
import { filingResultFromNewPayment } from '@/lib/api/admission/applicationFiling'

// Family Details tab removed per the Application Filling requirements doc
// (req. 10) — sponsorship fields already live in Personal Info.
type Tab = 'personal' | 'qualifications' | 'documents'
const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'personal',       label: 'Personal Info',    icon: 'lni-user-4',     desc: 'Applicant, programme and passport/visa details' },
  { id: 'qualifications', label: 'Qualifications',   icon: 'lni-graduation', desc: 'Academic qualifications and proof documents' },
  { id: 'documents',      label: 'Documents',        icon: 'lni-folder-2',   desc: 'Photo, uploaded documents and final submission' },
]

// Nationality/Sponsor Country use the real, confirmed guid-bearing Country
// source — GET /api/v1/users/countries (useCountries(), same one Country
// Master uses) — not Application-Filling's own Countries.bru dropdown,
// which turned out to have no guid at all (see the note on
// CountryDropdownDto in lib/api/admission/applicationFiling.ts).
// RELIGIONS/MARITAL and the Passport Expiry/Country of Issue/Visa Number/
// Visa Type/UNHCR Case Number fields below still have no counterpart
// anywhere in the Application Filling docs — kept as decorative/local
// fields (not sent), same treatment as Application Source/Receipt Type on
// the payment page. Country of Issue keeps this local list rather than the
// real dropdown since it isn't part of any confirmed payload.
const COUNTRIES_OF_ISSUE = ['Ugandan', 'Kenyan', 'Tanzanian', 'Rwandan', 'Burundian', 'South Sudanese', 'Congolese', 'Other']
const RELIGIONS      = ['Christian', 'Muslim', 'Hindu', 'Buddhist', 'Other']
const MARITAL        = ['Single', 'Married', 'Divorced', 'Widowed']
// The API's gender field is a byte with only two values (0 = Female, 1 = Male) — no third option to encode.
const GENDERS        = ['Male', 'Female']
const SPONSOR_TYPES  = ['Self', 'Parent/Guardian', 'Government', 'Organization', 'Other']
const COUNTRY_CODES  = [
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

interface QualRow {
  id: number
  institution: string
  university: string
  passYear: string
  grade: string
  yearsTaken: string
  proofFile: File | null
  savedId: number | null
}

function emptyQualRow(id: number): QualRow {
  return { id, institution: '', university: '', passYear: '', grade: '', yearsTaken: '', proofFile: null, savedId: null }
}

// Qualification duration (yearsTaken) — whole years, per the API.
const QUAL_DURATION_MIN = 1
const QUAL_DURATION_MAX = 10
// POST /application-filling/qualifications limits.
const QUAL_TEXT_MAX = 200
const QUAL_GRADE_MAX = 50
const PASS_YEAR_MIN = 1950
// POST /application-filling/photo: extension-checked only.
const PHOTO_EXT_RE = /\.(jpe?g|png|bmp)$/i
const PHOTO_TYPE_MESSAGE = 'Only JPG, PNG, or BMP images are accepted.'

// `error` renders the same inline field message the academic forms use
// (.field-err, picked up by scrollToFirstError).
function Field({ label, req, children, span, error }: { label: string; req?: boolean; span?: number; children: React.ReactNode; error?: string }) {
  return (
    <div className={span === 2 ? 'fg span2' : span === 3 ? 'fg span3' : 'fg'}>
      <label className="lbl">{label}{req && <span className="req">*</span>}</label>
      {children}
      {error && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  )
}
function Input({ placeholder, type = 'text', readOnly, value, onChange, inputMode, maxLength, hasError, minYmd, maxYmd, rangeMessage }: { placeholder?: string; type?: string; readOnly?: boolean; value?: string; onChange?: (v: string) => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number; hasError?: boolean; minYmd?: string; maxYmd?: string; rangeMessage?: string }) {
  if (type === 'date' && !readOnly) {
    return <DatePicker value={value} onChange={v => onChange?.(v)} placeholder={placeholder} minYmd={minYmd} maxYmd={maxYmd} rangeMessage={rangeMessage} hasError={hasError} />
  }
  // .no-spinner strips the native up/down arrows on type="number" fields
  // (Year below) — same class already used for Exchange Rates' number
  // inputs elsewhere in the app.
  const className = type === 'number' ? 'ctrl no-spinner' : 'ctrl'
  if (value !== undefined) {
    return <input className={className} type={type} placeholder={placeholder} readOnly={readOnly} inputMode={inputMode} maxLength={maxLength} value={value} onChange={e => onChange?.(e.target.value)} style={hasError ? { borderColor: 'var(--red)' } : undefined} aria-invalid={hasError || undefined} />
  }
  return <input className={className} type={type} placeholder={placeholder} readOnly={readOnly} />
}
function Select({ options, placeholder, value, onChange }: { options: string[]; placeholder?: string; value?: string; onChange?: (v: string) => void }) {
  return <SearchSelect placeholder={placeholder || 'Select...'} options={options} value={value} onChange={onChange} />
}
function FileZone({ hint = 'Click to upload', file, onChange, hasError }: { hint?: string; file?: File | null; onChange?: (f: File | null) => void; hasError?: boolean }) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // A picked file used to be replaceable but never removable. Clearing also
  // resets the native input, or re-picking the same file wouldn't fire
  // onChange. Only clears the local pick — a document already saved to the
  // application isn't deleted server-side.
  function removeFile(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (inputRef.current) inputRef.current.value = ''
    onChange?.(null)
  }
  return (
    <div
      className={`file-zone${dragActive ? ' drag-active' : ''}`}
      style={hasError ? { borderColor: 'var(--red)' } : undefined}
      onDragOver={e => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={e => {
        e.preventDefault(); setDragActive(false)
        const dropped = e.dataTransfer.files?.[0]
        if (dropped) onChange?.(dropped)
      }}
    >
      <input ref={inputRef} type="file" onChange={e => onChange?.(e.target.files?.[0] ?? null)} />
      <i className={`lni ${file ? 'lni-checkmark-circle' : 'lni-cloud-upload'} file-zone-icon`} style={file ? { color: 'var(--green)' } : undefined} />
      <p>{file ? file.name : hint}</p>
      {file && onChange && (
        // Sits above the full-size invisible file input (z-index), so this
        // click removes instead of opening the file dialog.
        <button
          type="button"
          className="btn btn-neu btn-sm"
          style={{ position: 'relative', zIndex: 1, marginTop: 8 }}
          onClick={removeFile}
          aria-label={`Remove ${file.name}`}
        >
          <i className="lni lni-trash-can" aria-hidden="true" /> Remove
        </button>
      )}
    </div>
  )
}

// Two-letter initials for the avatar chips in the applicant search dropdown
// and the selected-applicant profile strip — falls back to '?' when there's
// nothing to initial from (name still loading, or genuinely blank).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

// firstName often carries the full name with lastName null in real data
// (see FilingApplicationSearchResult) — join whatever's present.
function applicantName(a: FilingApplicationSearchResult): string {
  return [a.firstName, a.lastName].filter(Boolean).join(' ').trim()
}

// A selected applicant shows as "NAME (APPREF)" in the search box; editing
// it (e.g. one backspace) turned that whole label into the search term,
// which the server (matching name OR appRefNo) never matches. When the text
// still carries the "(APPREF" part, search by that reference instead.
function applicantSearchTerm(text: string): string {
  const ref = text.match(/\(([^()]*)\)?\s*$/)?.[1]?.trim()
  return ref && ref.length >= 2 ? ref : text.trim()
}

// One row in the Documents tab's "Uploaded Documents" list (req. 11: view/
// download uploaded documents). Two sources of a document, handled
// differently since only one of them is actually viewable client-side:
// - `file`: a File the user just picked in this session (not yet saved, or
//   saved this session) — View/Download work via a real object-URL, no
//   backend round-trip needed.
// - `savedName`: a filename the backend already has on record from a prior
//   save (e.g. FilingApplicationSearchResult.idUserFileName) — there is no
//   confirmed document-retrieval endpoint anywhere in the Application Filing
//   API surface, so this can only show the filename, not serve the file.
//   Flagged rather than guessed at a URL, same convention as this file's
//   other "display raw, don't guess" fields.
function DocRow({ label, file, savedName }: { label: string; file: File | null; savedName?: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setUrl(null); return }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const name = file?.name ?? savedName ?? null
  return (
    <div className="flex items-center justify-between py-2 border-b border-g100 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <i className="lni lni-files text-g400" />
        <span className="text-sm text-g700">{label}</span>
        {name && <span className="text-xs text-g400 truncate">{name}</span>}
      </div>
      {url ? (
        <div className="flex gap-2 flex-shrink-0">
          <a className="btn text-xs" href={url} target="_blank" rel="noreferrer"><i className="lni lni-eye" /> View</a>
          <a className="btn text-xs" href={url} download={file?.name}><i className="lni lni-download" /> Download</a>
        </div>
      ) : name ? (
        <span className="text-xs text-g400 flex-shrink-0">Previously uploaded — no retrieval endpoint yet</span>
      ) : (
        <span className="text-xs text-g400 flex-shrink-0">Not uploaded</span>
      )}
    </div>
  )
}

const PIPELINE = [
  { label: 'Payment', done: true }, { label: 'Filing', active: true },
  { label: 'Vetting', done: false }, { label: 'Registration', done: false }, { label: 'Onboarding', done: false },
]

export default function FilingPage() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('personal')
  // Result of the final Submit Application action — shown as FailurePopup,
  // same "success/failure both get the shared popup" pairing as SuccessPopup
  // below and the Payment page's Save Payment action.
  const [failure, setFailure] = useState<string | null>(null)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ── Link to Payment Record ──────────────────────────────────────────────
  const [applicantSearch, setApplicantSearch] = useState('')
  const [showApplicantDropdown, setShowApplicantDropdown] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<FilingApplicationSearchResult | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [committedCountrySearch, setCommittedCountrySearch] = useState('')
  // searchTerm is CONFIRMED real server-side on this endpoint (2026-09-08) —
  // debounced the same 300ms as the other real-server-search pickers in this
  // app (CourseUnitSearchPicker, Payment Console's student search) so it
  // isn't fired on every single keystroke.
  const [committedApplicantSearch, setCommittedApplicantSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setCommittedApplicantSearch(applicantSearchTerm(applicantSearch)), 300)
    return () => clearTimeout(t)
  }, [applicantSearch])
  useEffect(() => {
    const t = setTimeout(() => setCommittedCountrySearch(countrySearch.trim()), 300)
    return () => clearTimeout(t)
  }, [countrySearch])

  // Real server-paginated, scroll-to-load-more applicant search — replaces
  // the old single pageSize=12000 "fetch nearly everything up front, filter
  // client-side" fetch (which, combined with rendering every single result
  // into the dropdown below with no cap, was slow/heavy enough on a real
  // ~442+-row intake to look like results were silently going missing, when
  // really the browser was just choking on the sheer volume) with real
  // server-side filtering (APPLICANT_PAGE_SIZE at a time, scrolled to load
  // more matches).
  const APPLICANT_PAGE_SIZE = 20
  const {
    data: applicantPages, fetchNextPage: fetchNextApplicantPage, hasNextPage: hasMoreApplicants,
    isFetchingNextPage: isFetchingMoreApplicants, isFetching: isSearchingApplicants, isError: isApplicantSearchError,
  } = useSearchApplicationsForFilingInfinite(
    committedApplicantSearch, APPLICANT_PAGE_SIZE, showApplicantDropdown && !!committedApplicantSearch,
  )
  const loadedApplicants = applicantPages?.pages.flatMap(p => p.items) ?? []
  // Server already filtered by committedApplicantSearch — no client-side
  // re-filter needed (the server is the source of truth for what matches).

  // Same scrollTop > 0 guard the other infinite-scroll dropdowns in this
  // app use — a plain distance-to-bottom check alone fires spuriously on a
  // short list right after a new page loads.
  function handleApplicantScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasMoreApplicants || isFetchingMoreApplicants) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextApplicantPage()
  }

  // Closes the results on an outside click, same as Payment Console's search.
  const applicantBoxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showApplicantDropdown) return
    function handle(e: MouseEvent) {
      if (!applicantBoxRef.current?.contains(e.target as Node)) setShowApplicantDropdown(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showApplicantDropdown])

  // Payment's "Proceed to Filing" hands over the just-saved payment itself
  // (lib/filingHandoff.ts). Select it directly, the same as a dropdown pick:
  // no search, because a just-paid applicant has no application row yet.
  // Read once on mount and consumed, so a refresh or later visit doesn't
  // reopen it.
  useEffect(() => {
    const payment = consumeFilingPrefill()
    if (payment) selectApplication(filingResultFromNewPayment(payment))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once an application is picked, warn on leaving until it's actually been
  // submitted for vetting — covers tab close/refresh/typing a new URL/
  // navigating to an external site. beforeunload never fires for in-app
  // client-side route changes (Next.js router.push), so this doesn't
  // interfere with the redirect after a successful submit; the explicit
  // "Stage 1" button below is guarded separately since that's an in-app
  // navigation this page controls directly.
  const hasUnsavedWork = !!selectedApplication && !submitted
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
    return !hasUnsavedWork || window.confirm("You have unsaved changes on this application. If you leave now, they won't be saved. Continue?")
  }

  // Prefills the editable Personal Info fields from the search result —
  // this data is already known server-side, no reason to make the counsellor
  // retype it. Everything set here stays a normal controlled input
  // afterward, so it can still be corrected before saving. Uses the raw
  // Programme Details setters (not the cascade-reset wrappers) since those
  // wrappers would otherwise clear semesterGuid/feeHdGuid right back out
  // immediately after this sets them.
  function selectApplication(a: FilingApplicationSearchResult) {
    setSelectedApplication(a); setShowApplicantDropdown(false); setApplicantSearch('')

    let fName = a.firstName?.trim() ?? ''
    let lName = a.lastName?.trim() ?? ''
    if (fName && !lName && fName.includes(' ')) {
      const parts = fName.split(/\s+/)
      fName = parts[0]
      lName = parts.slice(1).join(' ')
    }
    setFirstName(fName)
    setLastName(lName)
    setGender(a.gender === 1 ? 'Male' : a.gender === 0 ? 'Female' : '')
    setDob(a.dob ? a.dob.slice(0, 10) : '')
    setCountryGuid(a.countryGuid ?? '')
    setNationalId(a.nationalId ?? '')
    setEmail(a.emailId ?? '')
    setPhone(a.phone ?? '')
    setPassportNo(a.passportNo ?? '')
    setIsRefugee(a.refugee === 1)
    setRefugeeId(a.refugeeId ?? '')

    if (!a.dob) {
      if (a.enquiryGuid) {
        getEnquiryById(a.enquiryGuid)
          .then(enq => {
            if (enq.dob) setDob(enq.dob.slice(0, 10))
            if (enq.countryGuid && !a.countryGuid) setCountryGuid(enq.countryGuid)
          })
          .catch(() => {})
      } else if (a.phone || a.emailId) {
        getEnquiries(1, 10, a.phone || a.emailId || '')
          .then(res => {
            const found = res.items.find(
              e =>
                (a.phone && e.mobile && e.mobile.replace(/\D/g, '').includes(a.phone.replace(/\D/g, ''))) ||
                (a.emailId && e.email && e.email.toLowerCase() === a.emailId.toLowerCase()),
            )
            if (found && found.dob) {
              setDob(found.dob.slice(0, 10))
            }
          })
          .catch(() => {})
      }
    }

    setIntakeGuid(a.intakeGuid ?? '')
    setCampusGuid(a.campusGuid ?? '')
    setProgramGuidState(a.programGuid ?? '')
    setSemesterGuidState(a.semesterGuid ?? '')
    setBatchTimeGuidState(a.batchTimeGuid ?? '')
    setBatchGuid(a.batchGuid ?? '')
    setFeeHdGuid(a.feeHdGuid ?? '')
  }

  // ── General (Personal Info tab) ─────────────────────────────────────────
  // enquiryGuid dropped from this page's own state entirely per request,
  // 2026-09-07 — no longer tracked, prefilled, or picked here; the save
  // payload below now always sends enquiryGuid: null. Flagged deliberately:
  // SaveGeneral.bru marks it "(optional)", but the identical claim on
  // Application-Payments' Create.bru turned out to be false (confirmed by
  // reproducing a real 400 with only that field removed from an otherwise-
  // working payload) — that was never independently re-confirmed here, so if
  // SaveGeneral 400s on a null enquiryGuid, this is the first place to look.
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [countryGuid, setCountryGuid] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [nationalIdFile, setNationalIdFile] = useState<File | null>(null)
  const [email, setEmail] = useState('')
  const [phoneCode, setPhoneCode] = useState('+256')
  const [phone, setPhone] = useState('')
  const [passportNo, setPassportNo] = useState('')
  const [passportFile, setPassportFile] = useState<File | null>(null)
  const [vStartDate, setVStartDate] = useState('')
  const [vEndDate, setVEndDate] = useState('')
  // Inline errors on the General tab (currently just the visa date pair).
  const [generalErrors, setGeneralErrors] = useState<Record<string, string>>({})
  const [visaFile, setVisaFile] = useState<File | null>(null)
  const [isRefugee, setIsRefugee] = useState(false)
  const [refugeeId, setRefugeeId] = useState('')
  const [refugeeFile, setRefugeeFile] = useState<File | null>(null)

  const [intakeGuid, setIntakeGuid] = useState('')
  const [campusGuid, setCampusGuid] = useState('')
  const [programGuid, setProgramGuidState] = useState('')
  const [semesterGuid, setSemesterGuidState] = useState('')
  const [batchTimeGuid, setBatchTimeGuidState] = useState('')
  const [batchGuid, setBatchGuid] = useState('')
  const [feeHdGuid, setFeeHdGuid] = useState('')

  function setProgramGuid(v: string) { setProgramGuidState(v); setSemesterGuidState(''); setBatchGuid(''); setFeeHdGuid('') }
  function setSemesterGuid(v: string) { setSemesterGuidState(v); setBatchGuid('') }
  function setBatchTimeGuid(v: string) { setBatchTimeGuidState(v); setBatchGuid('') }

  const [generalSaved, setGeneralSaved] = useState(false)
  const [intApplication, setIntApplication] = useState<number | null>(null)

  const countryQuery = useSearchCountriesInfinite(committedCountrySearch, 20, countryPickerOpen)
  const countrySearchResults = useMemo(() => flattenUniquePages(countryQuery.data?.pages ?? [], c => c.countryGuid), [countryQuery.data])
  const campusQuery = useSearchCampusesInfinite('', 20, !!selectedApplication)
  const campuses = useMemo(() => flattenUniquePages(campusQuery.data?.pages ?? [], c => c.campusGuid), [campusQuery.data])
  const programQuery = useSearchProgramMastersInfinite('', 20, !!selectedApplication)
  const programs = useMemo(() => flattenUniquePages(programQuery.data?.pages ?? [], p => p.programGuid), [programQuery.data])
  const { data: singleProgram }   = useProgramMaster(
    programGuid,
    !!programGuid && !programs.some(p => p.programGuid === programGuid)
  )
  const { data: semesters = [] }  = useSemestersForProgram(programGuid, !!programGuid)
  const { data: batchTimes = [] } = useBatchTimes(!!selectedApplication)
  // Same payment-scoped Dropdowns/Batches.bru endpoint that turned out
  // unreliable on the Payment page (200 with an empty array for
  // combinations that do have a matching batch) — use the generic,
  // already-confirmed-correct Batches list filtered client-side instead.
  const { data: allBatchesData }  = useBatches(1, 20, '', !!selectedApplication)
  const batches = (allBatchesData?.items ?? []).filter(b =>
    b.programGuid === programGuid && b.semesterGuid === semesterGuid && b.batchTimeGuid === batchTimeGuid,
  )
  // Same gap as Programme above: a real selected application's batchGuid
  // (prefilled from the payment record) can be a genuinely valid batch that
  // just isn't in useBatches()' own first 1000 rows — the university has
  // more than 1000 real batches, so page 1 alone doesn't cover every
  // possible combination. Fetches that one specific batch directly and
  // merges it in below, same "guarantee the selected option's label
  // resolves even if the general list doesn't carry it" fix.
  const missingSelectedBatch = !!batchGuid && !batches.some(b => b.batchGuid === batchGuid)
  const { data: selectedBatchFallback } = useBatch(batchGuid || null, missingSelectedBatch)
  // Same payment-scoped Dropdowns/Fees.bru endpoint that turned out
  // unreliable on the Payment page (blank for a Programme that does have
  // real fee structures) — use the generic, already-confirmed-correct
  // Programme Fee Structure list filtered client-side instead, same fix as
  // applied there.
  const { data: allFeeStructuresData } = useProgramFeeStructures(1, 20, undefined, !!selectedApplication)
  const fees = (allFeeStructuresData?.items ?? []).filter(f => f.programGuid === programGuid && f.status)
  const { data: countries = [] }  = useCountries(!!selectedApplication || countryPickerOpen)

  // CONFIRMED live: a real selected application's programGuid (locked/
  // prefilled from the payment record, see selectApplication above) can
  // resolve a real Fee Structure and Semester (both filtered/fetched by
  // that same programGuid) while having no matching entry in
  // useProgramMasters()' own list — the Programme field then renders
  // unselected even though a real, valid programGuid is set. Fetches that
  // one specific programme directly and merges it in below, same
  // "guarantee the selected option's label resolves even if the general
  // list doesn't carry it" fix as the Payment page's own
  // enquiryOptionsWithSelected.
  const missingSelectedProgram = !!programGuid && !programs.some(p => p.programGuid === programGuid)
  const { data: selectedProgramFallback } = useProgramMasterByGuid(programGuid, missingSelectedProgram)

  const campusOptions    = campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))
  // Merges every source of a Programme label this page can see: the
  // (possibly paginated/scoped) programs list, the supplementary
  // programDropdown list, and — same "guarantee the selected option's label
  // resolves even if the general list doesn't carry it" fix as batchOptions
  // below — selectedProgramFallback, the one-off fetch-by-guid for a real
  // selected application's programGuid that isn't in either list.
  const programOptions   = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of programs) {
      map.set(p.programGuid, `${p.programName} (${p.programCode})`)
    }
    if (selectedProgramFallback && !map.has(selectedProgramFallback.programGuid)) {
      map.set(selectedProgramFallback.programGuid, `${selectedProgramFallback.programName} (${selectedProgramFallback.programCode})`)
    }
    const currentProgGuid = programGuid || selectedApplication?.programGuid
    if (currentProgGuid && !map.has(currentProgGuid)) {
      const fallback = selectedApplication?.programName || singleProgram?.programName || 'Selected Programme'
      map.set(currentProgGuid, fallback)
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [programs, selectedProgramFallback, singleProgram, programGuid, selectedApplication?.programGuid, selectedApplication?.programName])

  const semesterOptions  = semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))
  const batchTimeOptions = batchTimes.map(bt => ({ value: bt.batchTimeGuid, label: bt.batchTime }))
  const batchOptions     = [
    ...batches.map(b => ({ value: b.batchGuid, label: b.batchCode })),
    ...(selectedBatchFallback ? [{ value: selectedBatchFallback.batchGuid, label: selectedBatchFallback.batchCode }] : []),
  ]
  const countryOptions   = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of countries) map.set(c.countryGuid, c.countryName)
    for (const c of countrySearchResults) {
      if (!map.has(c.countryGuid)) map.set(c.countryGuid, c.countryName)
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [countries, countrySearchResults])

  // Passport/Visa/Refugee sections only apply to non-home-country nationals.
  // Compares against the ONE home country (defaultCountry == 1) instead of
  // reading the picked country's own flag as truthy: a flag that comes back
  // as "0" (string) is truthy, which made every nationality look like home
  // and kept these sections locked. Number() accepts 1 or "1"; Uganda by
  // code/name is the fallback if no country is flagged.
  const homeCountryGuid = (
    countries.find(c => Number(c.defaultCountry) === 1)
    ?? countries.find(c => c.countryCode?.toUpperCase() === 'UGA' || c.countryName?.trim().toLowerCase() === 'uganda')
  )?.countryGuid
  const isForeign = countryGuid !== '' && !!homeCountryGuid && countryGuid !== homeCountryGuid

  // Per the requirements doc (req. 8): entering any Passport or Visa detail
  // locks out Refugee Details entirely. Clearing isRefugee/refugeeId/
  // refugeeFile the moment this flips true keeps what's saved consistent
  // with what the locked-out UI shows, rather than silently submitting
  // stale refugee data the user can no longer see or edit.
  const hasPassportOrVisa = !!(passportNo.trim() || passportFile || vStartDate || vEndDate || visaFile)
  useEffect(() => {
    if (!hasPassportOrVisa) return
    setIsRefugee(false); setRefugeeId(''); setRefugeeFile(null)
  }, [hasPassportOrVisa])

  // ── Sponsor (Family tab fields that actually map to the API) ────────────
  const [spName, setSpName] = useState('')
  const [spEmail, setSpEmail] = useState('')
  const [spCountryGuid, setSpCountryGuid] = useState('')
  const [spPhone, setSpPhone] = useState('')

  // Best-effort enrichment from GET
  // /application-filling/by-payment/{paymentGuid} (get-application-by-guid.md)
  // — the search source above (application-payments) doesn't carry every
  // personal-detail field (see FilingApplicationSearchResult's own notes),
  // and this endpoint's full ApplicationDetailDto can fill in what it left
  // null. Confirmed by the backend team (2026-09-10) to be a genuinely
  // narrow window: it only returns data while the application's Action ==
  // Submitted. It 400s both for the ordinary "still being filled in" case
  // this page mostly handles AND for one that has already been vetted/
  // rejected/registered — so this realistically only ever enriches an
  // applicant who was fully filed and submitted in a prior session and
  // hasn't been vetted yet. Either 400 is expected and handled as "nothing
  // to enrich with", not an error. selectedApplication.applicationGuid is
  // actually backed by the payment record's paymentGuid, not a real
  // application-filling guid (see mapApplicationPaymentToSearchResult's own
  // comment) — this by-payment route is what that value is genuinely meant
  // for, replacing an earlier call to the plain {applicationGuid} route that
  // only "worked" by coincidence (a mismatched guid there 400s the same way
  // a not-yet-submitted application does).
  const {
    data: applicationDetail,
    isError: applicationDetailFailed,
    isFetched: applicationDetailFetched,
  } = useApplicationByPaymentGuid(
    selectedApplication?.applicationGuid,
    // Re-enabled (2026-09-10) per request. Still expected to 400 for the
    // vast majority of selections (see the comment above) — that's handled
    // as a quiet no-op by the enrichment effect below, not a real failure.
    !!selectedApplication,
  )

  // Sponsor details can now come pre-filled from the enquiry (sponsor
  // fallback, 2026-10-15). by-payment sends spCountryName alongside the
  // guid, so seed it as an option — the paged country picker may not have
  // loaded that country yet, which would leave the field looking blank.
  const spCountryOptions = useMemo(() => {
    const name = applicationDetail?.spCountryName
    if (!spCountryGuid || spCountryGuid !== applicationDetail?.spCountryGuid || !name) return countryOptions
    if (countryOptions.some(o => o.value === spCountryGuid)) return countryOptions
    return [{ value: spCountryGuid, label: name }, ...countryOptions]
  }, [countryOptions, spCountryGuid, applicationDetail?.spCountryGuid, applicationDetail?.spCountryName])

  // The sponsor phone's dial-code country, when spPhone came from the
  // enquiry (null when it's the application's own). The save request has no
  // dial-code field, so it's shown as a hint rather than stored.
  const spPhoneCountryHint = applicationDetail?.spPhoneCountryName && spPhone && spPhone === applicationDetail.spPhone
    ? applicationDetail.spPhoneCountryName
    : null

  // The locked Fee Structure's label: by-payment now returns feeName/feeCode
  // for the application's own fee head, so it's added here whenever the
  // general fee-structure list (one page, filtered client-side) doesn't
  // carry it — otherwise the field rendered blank. Both fields are nullable.
  const feeOptions = useMemo(() => {
    const options = fees.map(f => ({ value: f.feeHdGuid, label: `${f.feeDesc} (${f.feeCode})` }))
    const detailFeeGuid = applicationDetail?.feeHdGuid
    const detailFeeLabel = applicationDetail?.feeName
      ? (applicationDetail.feeCode && applicationDetail.feeCode !== applicationDetail.feeName ? `${applicationDetail.feeName} (${applicationDetail.feeCode})` : applicationDetail.feeName)
      : applicationDetail?.feeCode
    if (detailFeeGuid && detailFeeLabel && !options.some(o => o.value === detailFeeGuid)) {
      options.unshift({ value: detailFeeGuid, label: detailFeeLabel })
    }
    return options
  }, [fees, applicationDetail?.feeHdGuid, applicationDetail?.feeName, applicationDetail?.feeCode])

  const [enrichedForGuid, setEnrichedForGuid] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedApplication || !applicationDetailFetched) return
    if (enrichedForGuid === selectedApplication.applicationGuid) return
    setEnrichedForGuid(selectedApplication.applicationGuid)

    if (applicationDetail) {
      // Backend quirk confirmed live (2026-09-11): some nullable string
      // fields come back as the literal string "null" instead of a real
      // JSON null (spName/spEmail/spPhone/refugeeId seen so far) — treated
      // the same as an actual null here so an "only fill if empty" guard
      // below doesn't end up prefilling a field with the text "null".
      const orNull = (s: string | null | undefined) => (s && s !== 'null' ? s : null)

      if (!firstName && orNull(applicationDetail.firstName)) setFirstName(applicationDetail.firstName as string)
      if (!lastName && orNull(applicationDetail.lastName)) setLastName(applicationDetail.lastName as string)
      if (!email && orNull(applicationDetail.emailId)) setEmail(applicationDetail.emailId as string)
      if (!phone && orNull(applicationDetail.phone)) setPhone(applicationDetail.phone as string)
      if (!dob && applicationDetail.dob) setDob(applicationDetail.dob.slice(0, 10))
      // by-payment can send only genderLabel ("Female"/"Male") with no
      // numeric gender — fall back to the label so the field isn't left blank.
      const genderFromLabel = GENDERS.find(g => g.toLowerCase() === (applicationDetail.genderLabel ?? '').trim().toLowerCase())
      if (!gender && applicationDetail.gender != null) setGender(applicationDetail.gender === 1 ? 'Male' : 'Female')
      else if (!gender && genderFromLabel) setGender(genderFromLabel)
      if (!countryGuid && orNull(applicationDetail.countryGuid)) setCountryGuid(applicationDetail.countryGuid as string)
      if (!nationalId && orNull(applicationDetail.nationalId)) setNationalId(applicationDetail.nationalId as string)
      if (!passportNo && orNull(applicationDetail.passportNo)) setPassportNo(applicationDetail.passportNo as string)
      // Visa dates — ApplicationListItem-only fields (not on
      // FilingApplicationSearchResult, so selectApplication() above never
      // had these to prefill from) — first genuinely new data this
      // enrichment call adds rather than just filling a gap selectApplication
      // already tried to.
      if (!vStartDate && applicationDetail.vStartDate) setVStartDate(applicationDetail.vStartDate.slice(0, 10))
      if (!vEndDate && applicationDetail.vEndDate) setVEndDate(applicationDetail.vEndDate.slice(0, 10))
      // Same label-only case as gender: refugeeLabel "Yes" with no numeric refugee.
      if (!isRefugee && (applicationDetail.refugee === 1 || applicationDetail.refugeeLabel?.trim().toLowerCase() === 'yes')) {
        setIsRefugee(true)
        setRefugeeId(orNull(applicationDetail.refugeeId) ?? '')
      }
      // Sponsor (Family tab) — same "genuinely new, not on
      // FilingApplicationSearchResult" case as the visa dates above.
      if (!spName && orNull(applicationDetail.spName)) setSpName(applicationDetail.spName as string)
      if (!spEmail && orNull(applicationDetail.spEmail)) setSpEmail(applicationDetail.spEmail as string)
      if (!spCountryGuid && orNull(applicationDetail.spCountryGuid)) setSpCountryGuid(applicationDetail.spCountryGuid as string)
      if (!spPhone && orNull(applicationDetail.spPhone)) setSpPhone(applicationDetail.spPhone as string)
      // Programme Details — the locked/disabled Campus/Programme/Fee
      // Structure/Semester/Batch Time/Batch dropdowns (see
      // handleSaveGeneralAndAdvance's own comment) read straight off this
      // state, normally set by selectApplication() from the payment-search
      // result. Confirmed live (2026-09-11) that source can come back with
      // these still null even though this by-payment endpoint has the real
      // guids — filled in here the same "only if still empty" way, using
      // the raw setters (not setProgramGuid/setSemesterGuid/
      // setBatchTimeGuid, which cascade-clear the fields below them and
      // would fight each other run back-to-back here).
      if (!intakeGuid && orNull(applicationDetail.intakeGuid)) setIntakeGuid(applicationDetail.intakeGuid as string)
      if (!campusGuid && orNull(applicationDetail.campusGuid)) setCampusGuid(applicationDetail.campusGuid as string)
      if (!programGuid && orNull(applicationDetail.programGuid)) setProgramGuidState(applicationDetail.programGuid as string)
      if (!semesterGuid && orNull(applicationDetail.semesterGuid)) setSemesterGuidState(applicationDetail.semesterGuid as string)
      if (!batchTimeGuid && orNull(applicationDetail.batchTimeGuid)) setBatchTimeGuidState(applicationDetail.batchTimeGuid as string)
      if (!batchGuid && orNull(applicationDetail.batchGuid)) setBatchGuid(applicationDetail.batchGuid as string)
      if (!feeHdGuid && orNull(applicationDetail.feeHdGuid)) setFeeHdGuid(applicationDetail.feeHdGuid as string)
      // Previously-uploaded document file names — merged onto
      // selectedApplication itself (not its own form state) since the
      // Documents tab's DocRow reads savedName straight off
      // selectedApplication.*UserFileName; FilingApplicationSearchResult
      // (the payment record this came from) never carries these, so they're
      // always empty until this enrichment fills them in.
      setSelectedApplication(prev => (prev ? {
        ...prev,
        idUserFileName: prev.idUserFileName ?? orNull(applicationDetail.idUserFileName),
        passUserFileName: prev.passUserFileName ?? orNull(applicationDetail.passUserFileName),
        visaUserFileName: prev.visaUserFileName ?? orNull(applicationDetail.visaUserFileName),
        studUserFileName: prev.studUserFileName ?? orNull(applicationDetail.studUserFileName),
      } : prev))
    } else if (applicationDetailFailed) {
      // Quiet, non-blocking — this is the expected outcome for the vast
      // majority of selections (still-mid-filing applications), not a
      // real failure the counsellor needs to act on.
      showToast('No prior completed application record found to pull extra details from', 'info')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApplication, applicationDetail, applicationDetailFailed, applicationDetailFetched, enrichedForGuid])

  const saveGeneral = useSaveGeneral()

  function handleSaveGeneralAndAdvance() {
    if (!selectedApplication) { showToast('Select an application above first', 'error'); return }
    // Campus/Programme/Fee Structure are locked, auto-filled from the
    // selected application — if one is still missing here, the selected
    // application itself doesn't carry it and there's no picker left on
    // this page to fix it; surface that plainly instead of a generic
    // "required" message the user can't act on.
    if (!campusGuid || !programGuid || !feeHdGuid) {
      showToast('This application is missing Campus/Programme/Fee Structure data — check the source record', 'error')
      return
    }
    const e: Record<string, string> = {}
    // Typing can't add digits (sanitizeNameInput), but names prefilled from
    // the enquiry or an earlier record can still contain them.
    if (!firstName.trim()) e.firstName = 'First Name is required'
    else if (/\d/.test(firstName)) e.firstName = 'First Name can’t contain numbers'
    if (!lastName.trim()) e.lastName = 'Last Name is required'
    else if (/\d/.test(lastName)) e.lastName = 'Last Name can’t contain numbers'
    // The pickers already block an out-of-order pair, but dates prefilled
    // from an earlier record can still arrive that way.
    if (vStartDate && vEndDate && vStartDate > vEndDate) e.vEndDate = 'Visa expiry can’t be before the visa start date'
    // API: refugeeId required when refugee = 1.
    if (isRefugee && !refugeeId.trim()) e.refugeeId = 'Refugee ID is required when refugee status is selected.'
    setGeneralErrors(e)
    if (Object.keys(e).length) { scrollToFirstError(e); return }

    // The selected application already carries the real intakeCode from the
    // server-side search response; no separate intake list lookup is needed.
    saveGeneral.mutate(
      {
        appRefNo: selectedApplication.appRefNo,
        // Always null now — see the note above this component's state
        // declarations for why the field itself was dropped.
        enquiryGuid: null,
        intakeCode: selectedApplication.intakeCode ? String(selectedApplication.intakeCode) : null,
        emailId: email.trim() || null,
        dob: dob || null,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        gender: gender === 'Male' ? 1 : gender === 'Female' ? 0 : null,
        countryGuid: countryGuid || null,
        phone: phone.trim() || null,
        nationalId: nationalId.trim() || null,
        nationalIdFile,
        passportNo: passportNo.trim() || null,
        passportFile,
        vStartDate: vStartDate || null,
        vEndDate: vEndDate || null,
        visaFile,
        spName: spName.trim() || null,
        spEmail: spEmail.trim() || null,
        spCountryGuid: spCountryGuid || null,
        spPhone: spPhone.trim() || null,
        campusGuid, programGuid, feeHdGuid,
        semesterGuid: semesterGuid || null,
        batchTimeGuid: batchTimeGuid || null,
        batchGuid: batchGuid || null,
        refugee: isRefugee ? 1 : 0,
        refugeeId: isRefugee ? refugeeId.trim() || null : null,
        refugeeFile,
      } as const,
      {
        onSuccess: res => {
          setIntApplication(res.intApplication); setGeneralSaved(true)
          showToast('Application details saved', 'success'); setActiveTab('qualifications')
        },
        onError: (error: Error) => {
          if (/refugee id/i.test(error.message)) {
            const fe = { refugeeId: error.message }
            setGeneralErrors(prev => ({ ...prev, ...fe }))
            scrollToFirstError(fe)
            return
          }
          showToast(error.message || 'Failed to save application details', 'error')
        },
      },
    )
  }

  // ── Qualifications ──────────────────────────────────────────────────────
  const [qualRows, setQualRows] = useState<QualRow[]>([emptyQualRow(1)])
  const [experienceRows, setExperienceRows] = useState([{ id: 1 }])
  const saveQualification = useSaveQualification()
  const deleteQualification = useDeleteQualification()

  // Inline field errors per qualification row, keyed by row id then field.
  const [qualErrors, setQualErrors] = useState<Record<number, Record<string, string>>>({})

  function updateQualRow(id: number, patch: Partial<QualRow>) {
    setQualRows(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
    // Editing a field clears its own message, like the academic forms.
    setQualErrors(prev => {
      const rowErrs = prev[id]
      if (!rowErrs || !Object.keys(patch).some(k => rowErrs[k])) return prev
      const next = { ...rowErrs }
      for (const k of Object.keys(patch)) delete next[k]
      return { ...prev, [id]: next }
    })
  }

  // Required checks plus the POST /application-filling/qualifications rules
  // (2026-10 handoff). Rule messages match the API's own wording.
  function qualRowErrors(row: QualRow): Record<string, string> {
    const e: Record<string, string> = {}
    if (!row.institution.trim()) e.institution = 'Institution is required'
    else if (!/\p{L}/u.test(row.institution)) e.institution = 'Institution name must contain letters and cannot be only numbers.'
    else if (row.institution.trim().length > QUAL_TEXT_MAX) e.institution = `Institution must be ${QUAL_TEXT_MAX} characters or fewer`
    if (!row.university.trim()) e.university = 'University / Awarding Board is required'
    else if (!/\p{L}/u.test(row.university)) e.university = 'University / board name must contain letters and cannot be only numbers.'
    else if (row.university.trim().length > QUAL_TEXT_MAX) e.university = `University / Awarding Board must be ${QUAL_TEXT_MAX} characters or fewer`
    // Server checks against the current UTC year.
    const passYear = Number(row.passYear)
    const thisYear = new Date().getUTCFullYear()
    if (!row.passYear) e.passYear = 'Year is required'
    else if (!Number.isInteger(passYear) || passYear < PASS_YEAR_MIN || passYear > thisYear) e.passYear = `Year must be between ${PASS_YEAR_MIN} and ${thisYear}`
    if (!row.grade.trim()) e.grade = 'Grade is required'
    else if (row.grade.trim().length > QUAL_GRADE_MAX) e.grade = `Grade must be ${QUAL_GRADE_MAX} characters or fewer`
    const years = Number(row.yearsTaken)
    if (!row.yearsTaken) e.yearsTaken = 'Duration is required'
    else if (!Number.isInteger(years) || years < QUAL_DURATION_MIN || years > QUAL_DURATION_MAX) e.yearsTaken = 'Duration must be between 1 and 10 years.'
    if (!row.proofFile) e.proofFile = 'Proof Document is required'
    return e
  }

  // Server-side rule failures that belong to a specific field.
  function qualServerFieldError(message: string): Record<string, string> | null {
    if (/institution name/i.test(message)) return { institution: message }
    if (/university \/ board name/i.test(message)) return { university: message }
    if (/duration must be/i.test(message)) return { yearsTaken: message }
    if (/pass ?year|year of completion/i.test(message)) return { passYear: message }
    if (/grade/i.test(message)) return { grade: message }
    if (/proof document/i.test(message)) return { proofFile: message }
    return null
  }

  function handleSaveQualRow(row: QualRow) {
    if (!selectedApplication) { showToast('Select an application above first', 'error'); return }
    const errs = qualRowErrors(row)
    if (Object.keys(errs).length) {
      setQualErrors(prev => ({ ...prev, [row.id]: errs }))
      scrollToFirstError(errs)
      return
    }
    saveQualification.mutate(
      {
        appRefNo: selectedApplication.appRefNo,
        institution: row.institution.trim(),
        university: row.university.trim(),
        passYear: Number(row.passYear),
        grade: row.grade.trim(),
        yearsTaken: Number(row.yearsTaken),
        // Non-null: qualRowErrors above requires a proof file.
        proofFile: row.proofFile!,
      },
      {
        onSuccess: res => { updateQualRow(row.id, { savedId: res.intApplicationQual }); showToast('Qualification saved', 'success') },
        onError: (error: Error) => {
          const fieldErr = qualServerFieldError(error.message || '')
          if (fieldErr) { setQualErrors(prev => ({ ...prev, [row.id]: { ...prev[row.id], ...fieldErr } })); scrollToFirstError(fieldErr); return }
          showToast(error.message || 'Failed to save qualification', 'error')
        },
      },
    )
  }

  function handleDeleteQualRow(row: QualRow) {
    if (row.savedId == null) { setQualRows(rows => rows.filter(r => r.id !== row.id)); return }
    deleteQualification.mutate(row.savedId, {
      onSuccess: () => { setQualRows(rows => rows.filter(r => r.id !== row.id)); showToast('Qualification removed', 'success') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete qualification', 'error'),
    })
  }

  const [isSavingAllQuals, setIsSavingAllQuals] = useState(false)
  const unsavedCount = qualRows.filter(r => r.savedId == null).length
  const allQualsSaved = qualRows.length > 0 && unsavedCount === 0

  async function handleSaveAllQualifications() {
    if (!selectedApplication) {
      showToast('Select an application above first', 'error')
      return
    }

    const unsavedRows = qualRows.filter(r => r.savedId == null)
    if (unsavedRows.length === 0) {
      setActiveTab('documents')
      return
    }

    // Validate every unsaved row at once and show each problem under its own
    // field, scrolling to the first one.
    const allErrors: Record<number, Record<string, string>> = {}
    for (const row of unsavedRows) {
      const errs = qualRowErrors(row)
      if (Object.keys(errs).length) allErrors[row.id] = errs
    }
    if (Object.keys(allErrors).length) {
      setQualErrors(allErrors)
      scrollToFirstError(allErrors)
      return
    }
    setQualErrors({})

    setIsSavingAllQuals(true)
    try {
      const results = await Promise.all(
        unsavedRows.map(row =>
          saveQualification.mutateAsync({
            appRefNo: selectedApplication.appRefNo,
            institution: row.institution.trim(),
            university: row.university.trim(),
            passYear: Number(row.passYear),
            grade: row.grade.trim(),
            yearsTaken: Number(row.yearsTaken),
            proofFile: row.proofFile!,
          }).then(res => ({ id: row.id, savedId: res.intApplicationQual }))
            // Remember which row failed so a field-level message can land on it.
            .catch((err: Error) => { throw Object.assign(err, { qualRowId: row.id }) })
        )
      )

      setQualRows(prev =>
        prev.map(r => {
          const match = results.find(res => res.id === r.id)
          return match ? { ...r, savedId: match.savedId } : r
        })
      )

      showToast(`${unsavedRows.length} qualification${unsavedRows.length > 1 ? 's' : ''} saved successfully`, 'success')
    } catch (error: any) {
      const fieldErr = qualServerFieldError(error?.message || '')
      if (fieldErr && error?.qualRowId != null) {
        const rowId: number = error.qualRowId
        setQualErrors(prev => ({ ...prev, [rowId]: { ...prev[rowId], ...fieldErr } }))
        scrollToFirstError(fieldErr)
      } else {
        showToast(error?.message || 'Failed to save one or more qualifications', 'error')
      }
    } finally {
      setIsSavingAllQuals(false)
    }
  }

  function renderQualRow(row: QualRow, index: number) {
    const saved = row.savedId != null
    const err = qualErrors[row.id] ?? {}
    return (
      <div key={row.id} className={`qual-card mb-3 p-3 rounded-lg border border-g200${saved ? ' saved' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="qual-num">{index + 1}</span>
          <span className="text-xs font-semibold text-g500">Qualification {index + 1}</span>
        </div>
        <div className="g3">
          <Field label="Institution" req error={err.institution}><Input placeholder="School / University" maxLength={QUAL_TEXT_MAX} value={row.institution} onChange={v => updateQualRow(row.id, { institution: v })} readOnly={saved} hasError={!!err.institution} /></Field>
          <Field label="University / Awarding Board" req error={err.university}><Input placeholder="e.g. Makerere University" maxLength={QUAL_TEXT_MAX} value={row.university} onChange={v => updateQualRow(row.id, { university: v })} readOnly={saved} hasError={!!err.university} /></Field>
          <Field label="Year" req error={err.passYear}><Input type="number" placeholder="2023" value={row.passYear} onChange={v => updateQualRow(row.id, { passYear: v })} readOnly={saved} hasError={!!err.passYear} /></Field>
        </div>
        <div className="g3 mt-3">
          <Field label="Grade" req error={err.grade}><Input placeholder="e.g. First Class, 4.2 CGPA" maxLength={QUAL_GRADE_MAX} value={row.grade} onChange={v => updateQualRow(row.id, { grade: v })} readOnly={saved} hasError={!!err.grade} /></Field>
          <Field label="Duration (Years)" req error={err.yearsTaken}>
            {/* Whole years 1–10 only (API rule). Text + numeric keypad rather
                than type="number", which lets through "e", decimals and
                negatives; keystrokes that would leave 1–10 are ignored. */}
            <Input
              inputMode="numeric"
              maxLength={2}
              placeholder="1–10"
              value={row.yearsTaken}
              readOnly={saved}
              hasError={!!err.yearsTaken}
              onChange={v => {
                const digits = v.replace(/\D/g, '')
                const n = Number(digits)
                if (digits === '' || (n >= QUAL_DURATION_MIN && n <= QUAL_DURATION_MAX)) updateQualRow(row.id, { yearsTaken: digits })
              }}
            />
          </Field>
          <Field label="Proof Document" req error={err.proofFile}>
            {saved
              ? <p className="text-sm text-g500 mt-1">{row.proofFile?.name ?? 'Uploaded'}</p>
              : <FileZone file={row.proofFile} onChange={f => updateQualRow(row.id, { proofFile: f })} hasError={!!err.proofFile} />}
          </Field>
        </div>
        <div className="flex justify-end items-center gap-2 mt-3">
          {saved && (
            <span className="badge badge-green"><i className="lni lni-checkmark-circle" /> Saved</span>
          )}
          <button
            type="button"
            className="btn btn-neu text-xs"
            disabled={deleteQualification.isPending || (saved && !permissions.delete)}
            onClick={() => handleDeleteQualRow(row)}
          >
            <i className="lni lni-trash-can" /> {saved ? 'Delete' : 'Remove'}
          </button>
        </div>
      </div>
    )
  }

  // ── Documents / Photo / Submit ──────────────────────────────────────────
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoSaved, setPhotoSaved] = useState(false)
  const uploadPhoto = useUploadPhoto()
  const submitApplication = useSubmitApplication()

  useEffect(() => {
    setPhotoSaved(!!selectedApplication?.studUserFileName)
    setPhotoFile(null); setPhotoError(null)
  }, [selectedApplication])

  const hasPhoto = photoSaved || !!selectedApplication?.studUserFileName
  const qualifiedCount = qualRows.filter(r => r.savedId != null).length
  const canSubmit = generalSaved && intApplication != null && qualifiedCount > 0 && hasPhoto
  // Drives the progress strip under the pipeline — same three checkpoints as
  // the Documents tab's own "Application Status" checklist, so the two
  // never disagree about what "done" means. Was four checkpoints including
  // a declaration/consent checkbox, removed 2026-09-15 per request.
  const filingProgressPct = Math.round(
    ([generalSaved, qualifiedCount > 0, hasPhoto].filter(Boolean).length / 3) * 100,
  )

  function handleSavePhoto() {
    if (!selectedApplication || !photoFile) {
      setPhotoError('Please select a photo file first')
      scrollToFirstError({ photo: 'x' })
      return
    }
    if (!PHOTO_EXT_RE.test(photoFile.name)) {
      setPhotoError(PHOTO_TYPE_MESSAGE)
      scrollToFirstError({ photo: 'x' })
      return
    }
    uploadPhoto.mutate({ appRefNo: selectedApplication.appRefNo, photo: photoFile }, {
      onSuccess: () => { setPhotoSaved(true); showToast('Photo uploaded successfully', 'success') },
      onError: (error: Error) => {
        if (/jpg|png|bmp|photo/i.test(error.message)) { setPhotoError(error.message); scrollToFirstError({ photo: 'x' }); return }
        showToast(error.message || 'Failed to upload photo', 'error')
      },
    })
  }

  function handleSubmitApplication() {
    if (!selectedApplication || intApplication == null) {
      showToast('Please save Personal & Programme Details first.', 'error')
      return
    }
    if (qualifiedCount === 0) {
      showToast('Please add and save at least one qualification before submitting.', 'error')
      return
    }
    if (!hasPhoto) {
      showToast('Applicant profile photo is required. Please upload the photo before submitting.', 'error')
      return
    }

    submitApplication.mutate({ intApplication, appRefNo: selectedApplication.appRefNo }, {
      // setSubmitted(true) both stops the unsaved-changes warning and
      // triggers the full-screen success popup below — the actual redirect
      // happens from the popup's own onClose (click Continue, or its
      // auto-close timer) rather than immediately, matching the
      // confirmation pattern used elsewhere in this app (e.g. NewBatchModal).
      onSuccess: () => setSubmitted(true),
      // FailurePopup instead of a toast — same "success/failure both get the
      // shared popup, not just success" pattern as the Payment page's Save
      // Payment action, for the equivalent final-submission step here.
      onError: (error: Error) => setFailure(error.message || 'Failed to submit application'),
    })
  }

  // After submitting: print the application payment receipt
  // (get-application-payment-receipt.md). selectedApplication.applicationGuid
  // is the payment's paymentGuid (see mapApplicationPaymentToSearchResult).
  const canPrintReceipt = !!selectedApplication?.applicationGuid && selectedApplication.receiptNo !== undefined
    && hasPrintableReceipt({ exemptionType: selectedApplication.exemptionType, receiptNo: selectedApplication.receiptNo })
  const [printingReceipt, setPrintingReceipt] = useState(false)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  async function printFilingReceipt() {
    if (!selectedApplication || printingReceipt) return
    setPrintingReceipt(true)
    setReceiptError(null)
    const paymentGuid = selectedApplication.applicationGuid
    try {
      await openPdfInNewTab(() => getApplicationPaymentReceiptPdf(paymentGuid), `Receipt_${selectedApplication.receiptNo ?? paymentGuid}.pdf`)
    } catch (err) {
      setReceiptError(err instanceof Error && err.message ? err.message : 'Could not load the receipt.')
    } finally {
      setPrintingReceipt(false)
    }
  }

  // Left-side identity panel shared by all three stages (Personal Info,
  // Qualifications, Documents) — a single definition rather than
  // duplicating the same avatar/name/facts/progress markup three times.
  // null before an application is selected, but that's fine: every place
  // this is actually rendered already sits behind its own `!selectedApplication`
  // guard.
  // Commented out per request (2026-09-10) — the student card is hidden on
  // Application Filing for now. Left in place, not deleted, so it's a
  // one-line revert (just uncomment the JSX below and drop the `null`).
  const summaryPanel = null
  // selectedApplication && (
  //   <aside className="filing-summary-panel">
  //     <div className="filing-summary-avatar-wrap">
  //       <div className="filing-summary-avatar">{initials(`${firstName} ${lastName}`.trim() || applicantName(selectedApplication))}</div>
  //       <label className="filing-summary-avatar-edit" title="Upload profile photo">
  //         <input
  //           type="file"
  //           accept="image/*"
  //           onChange={e => {
  //             const file = e.target.files?.[0]
  //             if (file && selectedApplication) {
  //               setPhotoFile(file)
  //               uploadPhoto.mutate({ appRefNo: selectedApplication.appRefNo, photo: file }, {
  //                 onSuccess: () => { setPhotoSaved(true); showToast('Photo uploaded successfully', 'success') },
  //                 onError: (error: Error) => showToast(error.message || 'Failed to upload photo', 'error'),
  //               })
  //             }
  //           }}
  //         />
  //         {/* lni-camera-2 isn't a real LineIcons 4.0 class (confirmed: every
  //             other camera icon in this app — profile/page.tsx,
  //             odel-student-preview/page.tsx — uses plain lni-camera and
  //             renders) — the glyph never painted, leaving a blank white
  //             circle with no visible cue that this was an upload control. */}
  //         <i className="lni lni-camera" />
  //       </label>
  //     </div>
  //     <div className="filing-summary-name">{`${firstName} ${lastName}`.trim() || applicantName(selectedApplication) || 'Applicant'}</div>
  //     <span className="badge badge-blue">{selectedApplication.appRefNo}</span>

  //     <div className="filing-summary-meta">
  //       <div className="filing-summary-meta-row"><i className="lni lni-envelope" /> <span>{email || '—'}</span></div>
  //       <div className="filing-summary-meta-row"><i className="lni lni-phone" /> <span>{phone ? `${phoneCode} ${phone}` : '—'}</span></div>
  //     </div>

  //     <div className="filing-summary-facts">
  //       <div className="filing-summary-fact"><span>Nationality</span><strong>{countryOptions.find(c => c.value === countryGuid)?.label ?? '—'}</strong></div>
  //       <div className="filing-summary-fact"><span>Campus</span><strong>{campusOptions.find(c => c.value === campusGuid)?.label ?? '—'}</strong></div>
  //       <div className="filing-summary-fact"><span>Programme</span><strong>{programOptions.find(p => p.value === programGuid)?.label ?? '—'}</strong></div>
  //     </div>

  //     <div className="filing-summary-progress">
  //       <div className="prog-bar-track"><div className="prog-bar-fill" style={{ width: `${filingProgressPct}%` }} /></div>
  //       <span className="filing-progress-label">{filingProgressPct}% complete</span>
  //     </div>
  //   </aside>
  // )

  return (
    <div id="page-filing">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-bold text-g900">Stage 2 &middot; Application Filing</h1>
          <p className="text-sm text-g500 mt-1">Counsellor enters applicant details, qualifications, family info and uploads documents.</p>
        </div>
        <button className="btn" onClick={() => { if (confirmLeave()) router.push('/admission/payment') }}><i className="lni lni-arrow-left" /> Stage 1</button>
      </div>

      <div className="pipeline">
        {PIPELINE.map((s, i) => (
          <div key={i} className={`pip-step${s.done ? ' done' : ''}${(s as any).active ? ' active' : ''}`}>
            <div className="pip-circle">{s.done ? <i className="lni lni-checkmark" /> : i + 1}</div>
            <span className="text-sm font-semibold text-g700">{s.label}</span>
          </div>
        ))}
      </div>

      {selectedApplication && (
        <div className="filing-progress">
          <div className="prog-bar-track"><div className="prog-bar-fill" style={{ width: `${filingProgressPct}%` }} /></div>
          <span className="filing-progress-label">{filingProgressPct}% complete</span>
        </div>
      )}

      <div className="card mb-4 p-5">
        <h2 className="font-bold text-g800 mb-3 flex items-center gap-2">
          <span className="sec-icon-badge"><i className="lni lni-link" /></span>
          Link to Payment Record
        </h2>
        <div className="g2">
          <div className="fg">
            <label className="lbl">Applicant<span className="req">*</span></label>
            {/* Same search bar + results list as Payment Console's Student
                Search: icon input, floating list, name over ref · phone · email.
                Server-searched (debounced 300ms), scroll to load more. */}
            <div style={{ position: 'relative' }} ref={applicantBoxRef}>
              <div className="inp-wrap">
                <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                <input
                  className="ctrl"
                  type="text"
                  placeholder="e.g. APP20261/388 or Masereka Elijah"
                  value={selectedApplication ? `${applicantName(selectedApplication) || '—'} (${selectedApplication.appRefNo})` : applicantSearch}
                  onChange={e => { setApplicantSearch(e.target.value); setShowApplicantDropdown(true); setSelectedApplication(null) }}
                  onFocus={() => setShowApplicantDropdown(true)}
                />
              </div>
              {showApplicantDropdown && (
                <div
                  className="mt-1"
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
                    boxShadow: 'var(--neu-out)', maxHeight: 260, overflowY: 'auto',
                  }}
                  onScroll={handleApplicantScroll}
                >
                  {!applicantSearch.trim() ? (
                    <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>Type a name, ref no, phone or email to search.</div>
                  ) : (isSearchingApplicants || applicantSearch.trim() !== committedApplicantSearch) && loadedApplicants.length === 0 ? (
                    <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>Searching…</div>
                  ) : isApplicantSearchError && loadedApplicants.length === 0 ? (
                    <div className="text-clr-red px-3 py-2" style={{ fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
                  ) : loadedApplicants.length === 0 ? (
                    <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>No matching applications found.</div>
                  ) : (
                    <>
                      {loadedApplicants.map(a => (
                        <div
                          key={a.appRefNo}
                          className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                          onClick={() => selectApplication(a)}
                        >
                          <div className="font-bold">{applicantName(a) || '—'}</div>
                          <div className="text-g500" style={{ fontSize: 11 }}>{a.appRefNo} · {a.phone || '—'} · {a.emailId || '—'}</div>
                        </div>
                      ))}
                      {isFetchingMoreApplicants && (
                        <div className="text-g400 px-3 py-2" style={{ fontSize: 12 }}>Loading more…</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Hidden until an application is selected, per the Application Filling
              requirements doc — the ref number box has nothing useful to show
              (or edit — it's always read-only) before that point. */}
          {selectedApplication && (
            <Field label="Application Reference Number">
              <input className="ctrl" readOnly value={selectedApplication.appRefNo} />
            </Field>
          )}
        </div>
        {selectedApplication && (
          // Save Status intentionally not shown here — requirements doc says
          // not to display it in the UI at all.
          <div className="applicant-profile-strip">
            <span className="av-chip">{initials(applicantName(selectedApplication))}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-g900">{applicantName(selectedApplication) || 'Applicant'}</span>
                <span className="badge badge-blue">{selectedApplication.appRefNo}</span>
              </div>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                <span className="text-xs text-g500 flex items-center gap-1"><i className="lni lni-envelope text-g400" /> {selectedApplication.emailId ?? '—'}</span>
                <span className="text-xs text-g500 flex items-center gap-1"><i className="lni lni-phone text-g400" /> {selectedApplication.phone ?? '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {!selectedApplication ? (
          <div className="filing-empty-state">
            <div className="filing-empty-icon"><i className="lni lni-search-alt" /></div>
            <p className="text-g500 font-medium">Select an application above to begin filing.</p>
            <p className="text-xs text-g400 mt-1">Search by reference number, name, email or phone.</p>
          </div>
        ) : (
          <>
            <div className="filing-stepper-wrap">
              <div className="filing-stepper">
                {TABS.map((t, i) => {
                  const tabDone = t.id === 'personal' ? generalSaved : t.id === 'qualifications' ? qualifiedCount > 0 : hasPhoto
                  const isActive = activeTab === t.id
                  const currentIndex = TABS.findIndex(x => x.id === activeTab)
                  return (
                    <Fragment key={t.id}>
                      <button
                        type="button"
                        className={`filing-step${isActive ? ' active' : ''}${tabDone ? ' done' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                      >
                        <span className="filing-step-circle">
                          {tabDone ? <i className="lni lni-checkmark" /> : i + 1}
                        </span>
                        <span className="filing-step-label">{t.label}</span>
                      </button>
                      {i < TABS.length - 1 && (
                        <span className={`filing-step-connector${i < currentIndex ? ' done' : ''}`} />
                      )}
                    </Fragment>
                  )
                })}
              </div>
            </div>

            <div className="p-5 tab-panel-in" key={activeTab}>
              <div className="filing-step-hdr">
                <i className={`lni ${TABS.find(t => t.id === activeTab)?.icon}`} />
                <div>
                  <div className="filing-step-hdr-title">{TABS.find(t => t.id === activeTab)?.label}</div>
                  <div className="filing-step-hdr-desc">{TABS.find(t => t.id === activeTab)?.desc}</div>
                </div>
              </div>
              {activeTab === 'personal' && (
                <div className="filing-stage-layout">
                  {summaryPanel}
                  <div className="filing-form-col">
                    <div className="g3">
                      <Field label="First Name" req error={generalErrors.firstName}><Input placeholder="First name" value={firstName} onChange={v => { setFirstName(sanitizeNameInput(v)); setGeneralErrors(p => ({ ...p, firstName: '' })) }} hasError={!!generalErrors.firstName} /></Field>
                      {/* <Field label="Middle Name"><Input placeholder="Middle name" /></Field> */}
                      <Field label="Last Name" req error={generalErrors.lastName}><Input placeholder="Last name" value={lastName} onChange={v => { setLastName(sanitizeNameInput(v)); setGeneralErrors(p => ({ ...p, lastName: '' })) }} hasError={!!generalErrors.lastName} /></Field>
                      <Field label="Gender" req><Select options={GENDERS} value={gender} onChange={setGender} /></Field>
                    </div>
                    <div className="g3 mt-3">
                      <Field label="Date of Birth" req><Input type="date" value={dob} onChange={setDob} /></Field>
                      <Field label="Nationality" req>
                        <SearchSelect
                          options={countryOptions}
                          value={countryGuid}
                          placeholder="-- Select Country --"
                          onChange={setCountryGuid}
                          onSearch={setCountrySearch}
                          onOpenChange={setCountryPickerOpen}
                          isLoading={countryQuery.isLoading}
                          hasNextPage={countryQuery.hasNextPage}
                          isFetchingNextPage={countryQuery.isFetchingNextPage}
                          onLoadMore={() => countryQuery.fetchNextPage()}
                        />
                      </Field>
                      <Field label="National ID"><Input placeholder="CM-XXXXX-XXXX" value={nationalId} onChange={setNationalId} /></Field>
                    </div>
                    <div className="g3 mt-3">
                      <Field label="Email" req><Input type="email" placeholder="email@example.com" value={email} onChange={setEmail} /></Field>
                      <Field label="Phone" req>
                        <div className="flex gap-2">
                          <SearchSelect options={COUNTRY_CODES} value={phoneCode} onChange={setPhoneCode} style={{ width: 108, flexShrink: 0 }} />
                          <input className="ctrl flex-1" type="tel" inputMode="numeric" placeholder="7XX XXX XXX" value={phone} onChange={e => setPhone(sanitizePhoneInput(e.target.value, false))} />
                        </div>
                      </Field>
                      <Field label="National ID Copy"><FileZone file={nationalIdFile} onChange={setNationalIdFile} /></Field>
                    </div>
                    {/* <div className="g3 mt-3"><Field label="University Email"><Input readOnly placeholder="Auto-generated" /></Field><Field label="Religion"><Select options={RELIGIONS} /></Field><Field label="Marital Status"><Select options={MARITAL} /></Field></div> */}

                    <div className="sec-divider mt-5">Programme Details</div>
                    {/* Intake picker stays hidden — intakeGuid prefills fine from the
                        selected application. Enquiry dropped from this page entirely per
                        request, 2026-09-07 — see the note above this component's state
                        declarations (enquiryGuid is no longer tracked here at all; the save
                        payload always sends enquiryGuid: null). Previously this was an
                        editable, required picker, restored specifically because the search
                        source (/application-payments) only ever carries intEnquiry (a raw
                        int, no confirmed guid mapping), never a real enquiryGuid, which was
                        hitting a "missing Enquiry" save-blocking toast for every application
                        selected from search — if SaveGeneral turns out to actually require a
                        real enquiryGuid, that exact failure mode is back. */}
                    {/* Campus/Programme/Fee Structure/Semester are locked read-only per the
                        same doc (req. 7) — all four are confirmed present on the selected
                        application's search result and prefill correctly; `disabled` keeps
                        them visible but non-editable. Batch Time/Batch are NOT locked, despite
                        req. 7 listing them too — confirmed via a real save that
                        FilingApplicationSearchResult doesn't actually carry batchTimeGuid/
                        batchGuid on the wire (Semester prefills, these two don't), so locking
                        them left the picker permanently empty with no way to fix it. Left
                        editable until there's a confirmed source to prefill+lock them from. */}
                    <div className="g3 mt-3">
                      <Field label="Campus" req><SearchSelect options={campusOptions} value={campusGuid} placeholder="-- Select Campus --" onChange={setCampusGuid} disabled /></Field>
                      <Field label="Programme" req><SearchSelect options={programOptions} value={programGuid} placeholder="-- Select Programme --" onChange={setProgramGuid} disabled /></Field>
                      <Field label="Fee Structure" req><SearchSelect options={feeOptions} value={feeHdGuid} placeholder={programGuid ? '-- Select Fee Structure --' : '-- Select Programme First --'} onChange={setFeeHdGuid} disabled /></Field>
                    </div>
                    <div className="g3 mt-3">
                      <Field label="Semester"><SearchSelect options={semesterOptions} value={semesterGuid} placeholder={programGuid ? '-- Select Semester --' : '-- Select Programme First --'} onChange={setSemesterGuid} disabled /></Field>
                      <Field label="Batch Time"><SearchSelect options={batchTimeOptions} value={batchTimeGuid} placeholder="-- Select --" onChange={setBatchTimeGuid} /></Field>
                      <Field label="Batch">
                        <SearchSelect
                          options={batchOptions}
                          value={batchGuid}
                          placeholder={programGuid && semesterGuid && batchTimeGuid ? '-- Select Batch --' : '-- Select Programme, Semester & Batch Time First --'}
                          onChange={setBatchGuid}
                        />
                      </Field>
                    </div>

                    <div className="sec-divider mt-5">Passport &amp; Visa Details</div>
                    {!isForeign ? (
                      <p className="text-g400 mt-2" style={{ fontSize: 'var(--fs-xs)' }}>Applies to non-Ugandan nationals — select a Nationality above to unlock.</p>
                    ) : (
                      <>
                        {/* One consistent 3-column grid for the whole
                            section (was a 2-col Passport row followed by a
                            separate 3-col Visa row — uneven, and the odd
                            column count out of step with the rest of the
                            form's own g3 rows). */}
                        <div className="g3 mt-3">
                          <Field label="Passport Number"><Input placeholder="AB1234567" value={passportNo} onChange={setPassportNo} /></Field>
                          <Field label="Passport Copy"><FileZone file={passportFile} onChange={setPassportFile} /></Field>
                          {/* <Field label="Passport Expiry"><Input type="date" /></Field><Field label="Country of Issue"><Select options={COUNTRIES_OF_ISSUE} /></Field>
                          <Field label="Visa Number"><Input placeholder="VIS-XXXX" /></Field>
                          <Field label="Visa Type"><Select options={['Student', 'Work', 'Tourist', 'Diplomatic']} /></Field> */}
                          {/* Start can't be after expiry and expiry can't be before
                              start (same day is fine) — each picker is bounded by
                              the other's value. */}
                          <Field label="Visa Start Date" error={generalErrors.vStartDate}>
                            <Input
                              type="date"
                              value={vStartDate}
                              onChange={v => { setVStartDate(v); setGeneralErrors(p => ({ ...p, vStartDate: '', vEndDate: '' })) }}
                              maxYmd={vEndDate || undefined}
                              rangeMessage="Visa start date can’t be after the visa expiry"
                              hasError={!!generalErrors.vStartDate}
                            />
                          </Field>
                          <Field label="Visa Expiry" error={generalErrors.vEndDate}>
                            <Input
                              type="date"
                              value={vEndDate}
                              onChange={v => { setVEndDate(v); setGeneralErrors(p => ({ ...p, vStartDate: '', vEndDate: '' })) }}
                              minYmd={vStartDate || undefined}
                              rangeMessage="Visa expiry can’t be before the visa start date"
                              hasError={!!generalErrors.vEndDate}
                            />
                          </Field>
                          <Field label="Visa Copy"><FileZone file={visaFile} onChange={setVisaFile} /></Field>
                        </div>
                      </>
                    )}

                    <div className="sec-divider mt-5">Refugee Details</div>
                    {!isForeign ? (
                      <p className="text-g400 mt-2" style={{ fontSize: 'var(--fs-xs)' }}>Applies to non-Ugandan nationals — select a Nationality above to unlock.</p>
                    ) : hasPassportOrVisa ? (
                      <p className="text-g400 mt-2" style={{ fontSize: 'var(--fs-xs)' }}>Locked — Passport/Visa details were entered above. Clear them to record Refugee details instead.</p>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 mt-3" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={isRefugee} onChange={e => setIsRefugee(e.target.checked)} style={{ width: 16, height: 16 }} />
                          <span className="font-medium text-g700">Refugee / Asylum Seeker Student?</span>
                        </label>
                        {isRefugee && (
                          <div className="g3 mt-3">
                            <Field label="Refugee ID" req error={generalErrors.refugeeId}><Input placeholder="Refugee ID number" value={refugeeId} onChange={v => { setRefugeeId(v); setGeneralErrors(p => ({ ...p, refugeeId: "" })) }} hasError={!!generalErrors.refugeeId} /></Field>
                            {/* <Field label="UNHCR Case Number"><Input placeholder="UNH-XXXX" /></Field> */}
                            <Field label="Refugee Certificate"><FileZone file={refugeeFile} onChange={setRefugeeFile} /></Field>
                          </div>
                        )}
                      </>
                    )}

                    <div className="sec-divider mt-5">Sponsorship Details</div>
                    <div className="g3 mt-3">
                      <Field label="Sponsor Name"><Input placeholder="Sponsor name" value={spName} onChange={setSpName} /></Field>
                      <Field label="Sponsor Phone">
                        <Input type="tel" placeholder="+256 7XX XXX XXX" value={spPhone} onChange={v => setSpPhone(sanitizePhoneInput(v))} />
                        {spPhoneCountryHint && <p className="text-xs text-g500 mt-1">From the enquiry · dial code country: {spPhoneCountryHint}</p>}
                      </Field>
                      <Field label="Sponsor Email"><Input type="email" placeholder="sponsor@email.com" value={spEmail} onChange={setSpEmail} /></Field>
                    </div>
                    <div className="g3 mt-3">
                      <Field label="Sponsor Country">
                        <SearchSelect
                          options={spCountryOptions}
                          value={spCountryGuid}
                          placeholder="-- Select Country --"
                          onChange={setSpCountryGuid}
                          onSearch={setCountrySearch}
                          onOpenChange={setCountryPickerOpen}
                          isLoading={countryQuery.isLoading}
                          hasNextPage={countryQuery.hasNextPage}
                          isFetchingNextPage={countryQuery.isFetchingNextPage}
                          onLoadMore={() => countryQuery.fetchNextPage()}
                        />
                      </Field>
                      <div className="fg" />
                      <div className="fg" />
                    </div>

                    <div className="flex justify-end mt-5">
                      <button className="btn btn-primary" disabled={saveGeneral.isPending || !permissions.add} onClick={handleSaveGeneralAndAdvance}>
                        {saveGeneral.isPending ? 'Saving…' : <>Save &amp; Next: Qualifications <i className="lni lni-arrow-right" /></>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'qualifications' && (
                <div className="filing-stage-layout">
                  {summaryPanel}
                  <div className="filing-form-col">
                    <div className="sec-divider">Highest Qualification</div>
                    {renderQualRow(qualRows[0], 0)}
                    {qualRows.length > 1 && (
                      <>
                        <div className="sec-divider mt-5">Additional Qualifications</div>
                        {qualRows.slice(1).map((row, i) => renderQualRow(row, i + 1))}
                      </>
                    )}
                    {/* <div className="sec-divider mt-5 flex items-center justify-between">
                      <span>Work Experience</span>
                      <button className="btn text-xs" onClick={() => setExperienceRows(r => [...r, { id: Date.now() }])}><i className="lni lni-plus" /> Add Entry</button>
                    </div>
                    {experienceRows.map(row => (
                      <div key={row.id} className="g3 mt-3"><Field label="Organization"><Input placeholder="Company / Organization" /></Field><Field label="Role"><Input placeholder="Job title" /></Field><Field label="Duration"><Input placeholder="e.g. 2 years" /></Field></div>
                    ))} */}
                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        className="btn btn-neu text-xs flex items-center gap-1.5 text-blue font-semibold"
                        onClick={() => setQualRows(rows => [...rows, emptyQualRow(Date.now())])}
                      >
                        <i className="lni lni-plus" /> Add Row
                      </button>
                    </div>
                    <div className="flex justify-between mt-5">
                      <button className="btn" onClick={() => setActiveTab('personal')}><i className="lni lni-arrow-left" /> Personal Info</button>
                      {!allQualsSaved ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isSavingAllQuals || saveQualification.isPending || !permissions.add}
                          onClick={handleSaveAllQualifications}
                        >
                          {isSavingAllQuals ? 'Saving Qualifications…' : `Save Qualification${unsavedCount > 1 ? `s (${unsavedCount})` : ''}`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setActiveTab('documents')}
                        >
                          Next: Documents <i className="lni lni-arrow-right" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Family Details tab removed per the Application Filling requirements
                  doc (req. 10) — sponsorship fields already live in Personal Info. */}

              {activeTab === 'documents' && (
                <div className="filing-stage-layout">
                  {summaryPanel}
                  <div className="filing-form-col">
                    <div className="sec-divider">Student Photo</div>
                    <div className="g2 mt-3">
                      <Field label="Photo" req error={photoError ?? undefined}>
                        <FileZone
                          hint="Click to upload passport-style photo (JPG/JPEG/PNG/BMP)"
                          file={photoFile}
                          onChange={f => {
                            // Reject other types on pick so they never reach upload.
                            if (f && !PHOTO_EXT_RE.test(f.name)) { setPhotoError(PHOTO_TYPE_MESSAGE); return }
                            setPhotoError(null)
                            setPhotoFile(f); if (f) setPhotoSaved(false)
                          }}
                        />
                      </Field>
                      <div className="flex flex-col items-start justify-end gap-1">
                        {/* Was a bare `btn text-xs` with no color variant — this page's
                            other primary actions (Save & Continue, Submit Application)
                            all use btn-primary, so next to those this one read as plain
                            text rather than a clickable button. Users picked a photo in
                            the FileZone above and had no visual cue that a second click
                            here was still needed to actually save it. btn-success once a
                            file is picked (not yet saved) draws the eye to the pending
                            action; falls back to btn-neu once there's nothing to do. */}
                        <button
                          className={`btn btn-sm${photoSaved ? ' btn-neu' : photoFile ? ' btn-success' : ' btn-neu'}`}
                          disabled={!photoFile || uploadPhoto.isPending || (photoSaved && !photoFile) || !permissions.add}
                          onClick={handleSavePhoto}
                        >
                          {photoSaved
                            ? <><i className="lni lni-checkmark-circle" /> Uploaded</>
                            : uploadPhoto.isPending
                            ? <><i className="lni lni-reload" /> Uploading…</>
                            : <><i className="lni lni-cloud-upload" /> Upload Photo</>}
                        </button>
                        {photoFile && !photoSaved && !uploadPhoto.isPending && (
                          <span className="text-xs text-g400">Click Upload Photo to save it</span>
                        )}
                      </div>
                    </div>

                    <div className="sec-divider mt-5">Uploaded Documents</div>
                    <div className="mt-3">
                      <DocRow label="National ID" file={nationalIdFile} savedName={selectedApplication.idUserFileName} />
                      <DocRow label="Passport Copy" file={passportFile} savedName={selectedApplication.passUserFileName} />
                      <DocRow label="Visa Copy" file={visaFile} savedName={selectedApplication.visaUserFileName} />
                      <DocRow label="Refugee Certificate" file={refugeeFile} savedName={null} />
                      <DocRow label="Student Photo" file={photoFile} savedName={selectedApplication.studUserFileName} />
                      {qualRows.map((row, i) => (
                        <DocRow key={row.id} label={`Qualification Proof #${i + 1}`} file={row.proofFile} savedName={null} />
                      ))}
                    </div>

                    <div className="sec-divider mt-5">Application Status</div>
                    <div className="checklist mt-3">
                      <div className={`chk-item ${generalSaved ? 'pass' : 'pending'}`}>
                        <i className={`lni ${generalSaved ? 'lni-checkmark-circle' : 'lni-timer'}`} />
                        <span className="flex-1 text-sm text-g700">Personal &amp; Programme Details</span>
                        <span className="chk-status text-xs">{generalSaved ? 'Saved' : 'Not saved yet'}</span>
                      </div>
                      <div className={`chk-item ${qualifiedCount > 0 ? 'pass' : 'pending'}`}>
                        <i className={`lni ${qualifiedCount > 0 ? 'lni-checkmark-circle' : 'lni-timer'}`} />
                        <span className="flex-1 text-sm text-g700">Qualifications</span>
                        <span className="chk-status text-xs">{qualifiedCount} saved</span>
                      </div>
                      <div className={`chk-item ${hasPhoto ? 'pass' : 'pending'}`}>
                        <i className={`lni ${hasPhoto ? 'lni-checkmark-circle' : 'lni-timer'}`} />
                        <span className="flex-1 text-sm text-g700">Student Photo</span>
                        <span className="chk-status text-xs">{hasPhoto ? 'Uploaded' : 'Required — Pending'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-5">
                      <button className="btn" onClick={() => setActiveTab('qualifications')}><i className="lni lni-arrow-left" /> Qualifications</button>
                      <div className="flex flex-col items-end gap-1">
                        {!hasPhoto && (
                          <span className="text-xs text-clr-red font-medium flex items-center gap-1">
                            <i className="lni lni-warning" /> Applicant profile photo is required before submitting
                          </span>
                        )}
                        <button
                          className={`btn btn-primary btn-submit-ready${!canSubmit ? ' opacity-75' : ''}`}
                          disabled={submitApplication.isPending || !permissions.add}
                          onClick={handleSubmitApplication}
                        >
                          <i className="lni lni-checkmark" /> {submitApplication.isPending ? 'Submitting…' : 'Submit Application for Vetting'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Toast toast={toast} />

      {/* No auto-close (unlike SuccessPopup): the user needs time to print the
          application payment receipt before moving on to Vetting. */}
      {submitted && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 420 }} role="dialog" aria-modal="true" aria-labelledby="filing-submitted-title">
            <div style={{ textAlign: 'center', padding: '32px 28px 26px' }}>
              <div className="pc-receipt-check" style={{ fontSize: 30, marginBottom: 10 }}><i className="lni lni-checkmark-circle"></i></div>
              <div id="filing-submitted-title" className="font-bold text-g900" style={{ fontSize: 'var(--fs-lg)' }}>Application Submitted!</div>
              <p className="text-g500 mt-1" style={{ fontSize: 13 }}>
                {selectedApplication?.appRefNo ?? 'The application'} has been submitted for vetting.
              </p>
              {receiptError && (
                <div className="warn-box mt-4" role="alert" style={{ textAlign: 'left' }}>
                  <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5 }}>{receiptError}</div>
                </div>
              )}
              <div className="flex gap-2 justify-center mt-5 flex-wrap">
                {/* Normal payments with a receipt only — exemptions have none. */}
                {canPrintReceipt && (
                  <button className="btn btn-neu" disabled={printingReceipt} onClick={printFilingReceipt}>
                    <i className={`lni ${printingReceipt ? 'lni-spinner-arrow spin' : receiptError ? 'lni-reload' : 'lni-printer'}`} />{' '}
                    {printingReceipt ? 'Opening…' : receiptError ? 'Try again' : 'Print Receipt'}
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => router.push('/admission/vetting')}>
                  Continue to Vetting <i className="lni lni-arrow-right" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {failure && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <FailurePopup title="Couldn't Submit Application" subtitle={failure} onClose={() => setFailure(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
