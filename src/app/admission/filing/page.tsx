'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { FailurePopup } from '@/components/modals/shared/FailurePopup'
import { useIntakes, useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useProgramDropdown, useProgramMaster, useProgramMasterByGuid, useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useBatch, useBatches } from '@/hooks/academic/useBatches'
import { useCountries } from '@/hooks/config/useCountries'
import { useProgramFeeStructures } from '@/hooks/academic/useProgramFeeStructure'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { sanitizePhoneInput } from '@/lib/errorMessages'
import { consumeFilingPrefillRef } from '@/lib/filingHandoff'
import {
  FilingApplicationSearchResult,
  useDeleteQualification,
  useSaveGeneral,
  useSaveQualification,
  useSearchApplicationsForFiling,
  useSearchApplicationsForFilingInfinite,
  useSubmitApplication,
  useUploadPhoto,
} from '@/hooks/admission/useApplicationFiling'

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

function Field({ label, req, children, span }: { label: string; req?: boolean; span?: number; children: React.ReactNode }) {
  return (
    <div className={span === 2 ? 'fg span2' : span === 3 ? 'fg span3' : 'fg'}>
      <label className="lbl">{label}{req && <span className="req">*</span>}</label>
      {children}
    </div>
  )
}
function Input({ placeholder, type = 'text', readOnly, value, onChange }: { placeholder?: string; type?: string; readOnly?: boolean; value?: string; onChange?: (v: string) => void }) {
  if (type === 'date' && !readOnly) {
    return <DatePicker value={value} onChange={v => onChange?.(v)} placeholder={placeholder} />
  }
  // .no-spinner strips the native up/down arrows on type="number" fields
  // (Year, Duration (Years) below) — same class already used for Exchange
  // Rates' number inputs elsewhere in the app.
  const className = type === 'number' ? 'ctrl no-spinner' : 'ctrl'
  if (value !== undefined) {
    return <input className={className} type={type} placeholder={placeholder} readOnly={readOnly} value={value} onChange={e => onChange?.(e.target.value)} />
  }
  return <input className={className} type={type} placeholder={placeholder} readOnly={readOnly} />
}
function Select({ options, placeholder, value, onChange }: { options: string[]; placeholder?: string; value?: string; onChange?: (v: string) => void }) {
  return <SearchSelect placeholder={placeholder || 'Select...'} options={options} value={value} onChange={onChange} />
}
function FileZone({ hint = 'Click to upload', file, onChange }: { hint?: string; file?: File | null; onChange?: (f: File | null) => void }) {
  const [dragActive, setDragActive] = useState(false)
  return (
    <div
      className={`file-zone${dragActive ? ' drag-active' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={e => {
        e.preventDefault(); setDragActive(false)
        const dropped = e.dataTransfer.files?.[0]
        if (dropped) onChange?.(dropped)
      }}
    >
      <input type="file" onChange={e => onChange?.(e.target.files?.[0] ?? null)} />
      <i className={`lni ${file ? 'lni-checkmark-circle' : 'lni-cloud-upload'} file-zone-icon`} style={file ? { color: 'var(--green)' } : undefined} />
      <p>{file ? file.name : hint}</p>
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
  // Scoped to the current academic intake — intakeCode is a CONFIRMED real
  // filter on the underlying /application-payments endpoint (a live
  // ?intakeCode=20261 request came back properly scoped, ~hundreds of rows
  // instead of the 442+ that one intake alone already had).
  //
  // currentAcademicIntake comes back null whenever no intake in the live
  // data is flagged currentIntake — CONFIRMED the same real data gap that
  // broke the Intake dropdown on the enquiry forms earlier (see
  // online-enquiry/ondesk-enquiry/kiosk-enquiry's own fallback). Without a
  // fallback here, intakeCode silently never made it into the request at
  // all. Falls back to the intake with the highest intakeCode (a
  // year+sequence value like 20261 — the most recently created intake) as
  // a best-guess "current" one, same "prefer the real flag, never leave the
  // feature fully broken because of it" approach as the enquiry forms fix.
  const { data: intakes = [] }    = useIntakes()
  const { data: currentAcademicIntake } = useCurrentAcademicIntake()
  const latestIntakeCode = intakes.length
    ? intakes.reduce((max, i) => (i.intakeCode > max ? i.intakeCode : max), intakes[0].intakeCode)
    : undefined
  const effectiveIntakeCode = currentAcademicIntake?.intakeCode ?? latestIntakeCode

  // searchTerm is CONFIRMED real server-side on this endpoint (2026-09-08) —
  // debounced the same 300ms as the other real-server-search pickers in this
  // app (CourseUnitSearchPicker, Payment Console's student search) so it
  // isn't fired on every single keystroke.
  const [committedApplicantSearch, setCommittedApplicantSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setCommittedApplicantSearch(applicantSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [applicantSearch])

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
    committedApplicantSearch, APPLICANT_PAGE_SIZE, showApplicantDropdown && !!committedApplicantSearch, effectiveIntakeCode,
  )
  const loadedApplicants = applicantPages?.pages.flatMap(p => p.items) ?? []
  // Server already filtered by committedApplicantSearch — no client-side
  // re-filter needed (or wanted: the server is the source of truth for what
  // matches, same as every other confirmed-real search in this app).
  const visibleSearchItems = loadedApplicants

  // Same scrollTop > 0 guard the other infinite-scroll dropdowns in this
  // app use (CourseUnitSearchPicker, Payment Console's student search) — a
  // plain distance-to-bottom check alone fires spuriously on a short list
  // right after a new page loads, even with no user interaction.
  function handleApplicantScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasMoreApplicants || isFetchingMoreApplicants) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextApplicantPage()
  }

  // Auto-carries the appRefNo over from Payment's "Proceed to Filing" button
  // (see lib/filingHandoff.ts) instead of leaving the counsellor to manually
  // retype/remember it right after generating a receipt — read once on
  // mount, consumed immediately so a later manual visit/refresh doesn't
  // keep re-triggering this. Kept as its own dedicated one-shot lookup
  // (bypassing the 300ms debounce above) rather than waiting on the
  // interactive dropdown's own debounced search, so the auto-select fires
  // as soon as possible after landing on the page. pageSize can stay small
  // now that searchTerm is a real server-side filter (see
  // getApplicationPayments) — the exact appRefNo should land on page 1 —
  // where this previously needed pageSize=12000 to reliably find it via
  // client-side filtering over a near-complete unfiltered fetch.
  const [prefillRef, setPrefillRef] = useState<string | null>(null)
  useEffect(() => {
    const ref = consumeFilingPrefillRef()
    if (!ref) return
    setPrefillRef(ref)
    setApplicantSearch(ref)
    setShowApplicantDropdown(true)
  }, [])

  const { data: prefillResults } = useSearchApplicationsForFiling(
    prefillRef ?? '', 1, 20, !!prefillRef, effectiveIntakeCode,
  )
  // Once the search this triggers actually comes back, auto-select the
  // matching row so the counsellor lands straight on a filled Personal Info
  // tab instead of still having to click it from the dropdown. If nothing
  // matches (e.g. the backend hasn't indexed the new payment yet), surface
  // that plainly rather than leaving an empty dropdown with no explanation.
  useEffect(() => {
    if (!prefillRef || !prefillResults) return
    const ref = prefillRef
    setPrefillRef(null)
    const match = prefillResults.items.find(a => a.appRefNo === ref)
    if (match) selectApplication(match)
    else showToast(`Could not find application ${ref} yet — try searching again in a moment, or check the reference number`, 'error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillResults])

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

  const { data: campuses = [] }   = useCampuses()
  const { data: programs = [] }   = useProgramMasters()
  const { data: programDropdown = [] } = useProgramDropdown()
  const { data: singleProgram }   = useProgramMaster(
    programGuid,
    !!programGuid && !programs.some(p => p.programGuid === programGuid) && !programDropdown.some(p => p.programGuid === programGuid)
  )
  const { data: semesters = [] }  = useSemestersForProgram(programGuid, !!programGuid)
  const { data: batchTimes = [] } = useBatchTimes()
  // Same payment-scoped Dropdowns/Batches.bru endpoint that turned out
  // unreliable on the Payment page (200 with an empty array for
  // combinations that do have a matching batch) — use the generic,
  // already-confirmed-correct Batches list filtered client-side instead.
  const { data: allBatchesData }  = useBatches(1, 1000)
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
  const { data: allFeeStructuresData } = useProgramFeeStructures(1, 1000)
  const fees = (allFeeStructuresData?.items ?? []).filter(f => f.programGuid === programGuid && f.status)
  const { data: countries = [] }  = useCountries()

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
    for (const p of programDropdown) {
      if (!map.has(p.programGuid)) {
        map.set(p.programGuid, `${p.programName} (${p.programCode})`)
      }
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
  }, [programs, programDropdown, selectedProgramFallback, singleProgram, programGuid, selectedApplication?.programGuid, selectedApplication?.programName])

  const semesterOptions  = semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))
  const batchTimeOptions = batchTimes.map(bt => ({ value: bt.batchTimeGuid, label: bt.batchTime }))
  const batchOptions     = [
    ...batches.map(b => ({ value: b.batchGuid, label: b.batchCode })),
    ...(selectedBatchFallback ? [{ value: selectedBatchFallback.batchGuid, label: selectedBatchFallback.batchCode }] : []),
  ]
  const feeOptions       = fees.map(f => ({ value: f.feeHdGuid, label: `${f.feeDesc} (${f.feeCode})` }))
  const countryOptions   = countries.map(c => ({ value: c.countryGuid, label: c.countryName }))

  // Passport/Visa/Refugee sections only apply to non-home-country nationals.
  const isForeign = countryGuid !== '' && !countries.find(c => c.countryGuid === countryGuid)?.defaultCountry

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
    if (isRefugee && !refugeeId.trim()) { showToast('Refugee ID is required for refugee students', 'error'); return }

    // Intake.intakeCode is a number on the wire (e.g. 20264) — this API's
    // intakeCode field is a plain string (e.g. "2026"), so stringify it.
    const selectedIntake = intakes.find(i => i.intakeGuid === intakeGuid)

    saveGeneral.mutate(
      {
        appRefNo: selectedApplication.appRefNo,
        // Always null now — see the note above this component's state
        // declarations for why the field itself was dropped.
        enquiryGuid: null,
        intakeCode: selectedIntake ? String(selectedIntake.intakeCode) : null,
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
        onError: (error: Error) => showToast(error.message || 'Failed to save application details', 'error'),
      },
    )
  }

  // ── Qualifications ──────────────────────────────────────────────────────
  const [qualRows, setQualRows] = useState<QualRow[]>([emptyQualRow(1)])
  const [experienceRows, setExperienceRows] = useState([{ id: 1 }])
  const saveQualification = useSaveQualification()
  const deleteQualification = useDeleteQualification()

  function updateQualRow(id: number, patch: Partial<QualRow>) {
    setQualRows(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function handleSaveQualRow(row: QualRow) {
    if (!selectedApplication) { showToast('Select an application above first', 'error'); return }
    if (!row.institution.trim() || !row.university.trim() || !row.passYear || !row.grade.trim() || !row.yearsTaken || !row.proofFile) {
      showToast('Institution, University, Year, Grade, Duration and Proof Document are all required', 'error'); return
    }
    saveQualification.mutate(
      {
        appRefNo: selectedApplication.appRefNo,
        institution: row.institution.trim(),
        university: row.university.trim(),
        passYear: Number(row.passYear),
        grade: row.grade.trim(),
        yearsTaken: Number(row.yearsTaken),
        proofFile: row.proofFile,
      },
      {
        onSuccess: res => { updateQualRow(row.id, { savedId: res.intApplicationQual }); showToast('Qualification saved', 'success') },
        onError: (error: Error) => showToast(error.message || 'Failed to save qualification', 'error'),
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

  const allQualsSaved = qualRows.length > 0 && qualRows.every(r => r.savedId != null)

  function handleSaveLastQual() {
    const targetRow = qualRows.slice().reverse().find(r => r.savedId == null) || qualRows[qualRows.length - 1]
    if (targetRow) handleSaveQualRow(targetRow)
  }

  function renderQualRow(row: QualRow, index: number) {
    const saved = row.savedId != null
    return (
      <div key={row.id} className={`qual-card mb-3 p-3 rounded-lg border border-g200${saved ? ' saved' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="qual-num">{index + 1}</span>
          <span className="text-xs font-semibold text-g500">Qualification {index + 1}</span>
        </div>
        <div className="g3">
          <Field label="Institution" req><Input placeholder="School / University" value={row.institution} onChange={v => updateQualRow(row.id, { institution: v })} readOnly={saved} /></Field>
          <Field label="University / Awarding Board" req><Input placeholder="e.g. Makerere University" value={row.university} onChange={v => updateQualRow(row.id, { university: v })} readOnly={saved} /></Field>
          <Field label="Year" req><Input type="number" placeholder="2023" value={row.passYear} onChange={v => updateQualRow(row.id, { passYear: v })} readOnly={saved} /></Field>
        </div>
        <div className="g3 mt-3">
          <Field label="Grade" req><Input placeholder="e.g. First Class, 4.2 CGPA" value={row.grade} onChange={v => updateQualRow(row.id, { grade: v })} readOnly={saved} /></Field>
          <Field label="Duration (Years)" req><Input type="number" placeholder="3" value={row.yearsTaken} onChange={v => updateQualRow(row.id, { yearsTaken: v })} readOnly={saved} /></Field>
          <Field label="Proof Document" req>
            {saved
              ? <p className="text-sm text-g500 mt-1">{row.proofFile?.name ?? 'Uploaded'}</p>
              : <FileZone file={row.proofFile} onChange={f => updateQualRow(row.id, { proofFile: f })} />}
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
  const [photoSaved, setPhotoSaved] = useState(false)
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const uploadPhoto = useUploadPhoto()
  const submitApplication = useSubmitApplication()

  const qualifiedCount = qualRows.filter(r => r.savedId != null).length
  const canSubmit = generalSaved && intApplication != null && qualifiedCount > 0 && declarationAccepted
  // Drives the progress strip under the pipeline — same four checkpoints as
  // the Documents tab's own "Application Status" checklist plus the final
  // declaration, so the two never disagree about what "done" means.
  const filingProgressPct = Math.round(
    ([generalSaved, qualifiedCount > 0, photoSaved, declarationAccepted].filter(Boolean).length / 4) * 100,
  )

  function handleSavePhoto() {
    if (!selectedApplication || !photoFile) return
    uploadPhoto.mutate({ appRefNo: selectedApplication.appRefNo, photo: photoFile }, {
      onSuccess: () => { setPhotoSaved(true); showToast('Photo uploaded', 'success') },
      onError: (error: Error) => showToast(error.message || 'Failed to upload photo', 'error'),
    })
  }

  function handleSubmitApplication() {
    if (!selectedApplication || intApplication == null) return
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

  // Left-side identity panel shared by all three stages (Personal Info,
  // Qualifications, Documents) — a single definition rather than
  // duplicating the same avatar/name/facts/progress markup three times.
  // null before an application is selected, but that's fine: every place
  // this is actually rendered already sits behind its own `!selectedApplication`
  // guard.
  const summaryPanel = selectedApplication && (
    <aside className="filing-summary-panel">
      <div className="filing-summary-avatar-wrap">
        <div className="filing-summary-avatar">{initials(`${firstName} ${lastName}`.trim() || applicantName(selectedApplication))}</div>
        <label className="filing-summary-avatar-edit" title="Upload profile photo">
          <input type="file" accept="image/*" />
          <i className="lni lni-camera-2" />
        </label>
      </div>
      <div className="filing-summary-name">{`${firstName} ${lastName}`.trim() || applicantName(selectedApplication) || 'Applicant'}</div>
      <span className="badge badge-blue">{selectedApplication.appRefNo}</span>

      <div className="filing-summary-meta">
        <div className="filing-summary-meta-row"><i className="lni lni-envelope" /> <span>{email || '—'}</span></div>
        <div className="filing-summary-meta-row"><i className="lni lni-phone" /> <span>{phone ? `${phoneCode} ${phone}` : '—'}</span></div>
      </div>

      <div className="filing-summary-facts">
        <div className="filing-summary-fact"><span>Nationality</span><strong>{countryOptions.find(c => c.value === countryGuid)?.label ?? '—'}</strong></div>
        <div className="filing-summary-fact"><span>Campus</span><strong>{campusOptions.find(c => c.value === campusGuid)?.label ?? '—'}</strong></div>
        <div className="filing-summary-fact"><span>Programme</span><strong>{programOptions.find(p => p.value === programGuid)?.label ?? '—'}</strong></div>
      </div>

      <div className="filing-summary-progress">
        <div className="prog-bar-track"><div className="prog-bar-fill" style={{ width: `${filingProgressPct}%` }} /></div>
        <span className="filing-progress-label">{filingProgressPct}% complete</span>
      </div>
    </aside>
  )

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
            <div className="relative">
              <input className="ctrl" placeholder="Search applicant ref no, name, email or phone..."
                value={selectedApplication ? `${selectedApplication.appRefNo} — ${applicantName(selectedApplication)}` : applicantSearch}
                onChange={e => { setApplicantSearch(e.target.value); setShowApplicantDropdown(true); setSelectedApplication(null) }}
                onFocus={() => setShowApplicantDropdown(true)} />
              {showApplicantDropdown && (
                <div
                  className="applicant-dd absolute left-0 right-0 top-full mt-1 bg-white border border-g200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto"
                  onScroll={handleApplicantScroll}
                >
                  {!applicantSearch.trim() ? (
                    <div className="p-3 text-sm text-g400 flex items-center gap-2"><i className="lni lni-search-alt" /> Type to search…</div>
                  ) : isSearchingApplicants && loadedApplicants.length === 0 ? (
                    <div className="p-3 text-sm text-g400 flex items-center gap-2"><i className="lni lni-reload" /> Searching…</div>
                  ) : isApplicantSearchError && loadedApplicants.length === 0 ? (
                    <div className="p-3 text-sm text-clr-red flex items-center gap-2"><i className="lni lni-warning" /> Search failed. Please try again.</div>
                  ) : visibleSearchItems.length === 0 ? (
                    <div className="p-3 text-sm text-g400">
                      No results {hasMoreApplicants ? 'in what’s loaded so far — keep scrolling to search further.' : 'found.'}
                    </div>
                  ) : (
                    <>
                      {visibleSearchItems.map(a => (
                        <button key={a.appRefNo} className="applicant-row" onClick={() => selectApplication(a)}>
                          <span className="av-chip">{initials(applicantName(a))}</span>
                          <span className="flex-1 min-w-0 flex flex-col">
                            <span className="font-semibold text-g800 truncate">{applicantName(a) || '—'}</span>
                            <span className="text-xs text-g400">{a.appRefNo}</span>
                          </span>
                        </button>
                      ))}
                      {isFetchingMoreApplicants && (
                        <div className="p-2 text-center text-xs text-g400"><i className="lni lni-reload" /> Loading more…</div>
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
                  const tabDone = t.id === 'personal' ? generalSaved : t.id === 'qualifications' ? qualifiedCount > 0 : photoSaved && declarationAccepted
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
                      <Field label="First Name" req><Input placeholder="First name" value={firstName} onChange={setFirstName} /></Field>
                      {/* <Field label="Middle Name"><Input placeholder="Middle name" /></Field> */}
                      <Field label="Last Name" req><Input placeholder="Last name" value={lastName} onChange={setLastName} /></Field>
                      <Field label="Gender" req><Select options={GENDERS} value={gender} onChange={setGender} /></Field>
                    </div>
                    <div className="g3 mt-3">
                      <Field label="Date of Birth" req><Input type="date" value={dob} onChange={setDob} /></Field>
                      <Field label="Nationality" req><SearchSelect options={countryOptions} value={countryGuid} placeholder="-- Select Country --" onChange={setCountryGuid} /></Field>
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
                        <div className="g2 mt-3">
                          <Field label="Passport Number"><Input placeholder="AB1234567" value={passportNo} onChange={setPassportNo} /></Field>
                          <Field label="Passport Copy"><FileZone file={passportFile} onChange={setPassportFile} /></Field>
                          {/* <Field label="Passport Expiry"><Input type="date" /></Field><Field label="Country of Issue"><Select options={COUNTRIES_OF_ISSUE} /></Field>
                          <Field label="Visa Number"><Input placeholder="VIS-XXXX" /></Field>
                          <Field label="Visa Type"><Select options={['Student', 'Work', 'Tourist', 'Diplomatic']} /></Field> */}
                        </div>
                        <div className="g3 mt-3">
                          <Field label="Visa Start Date"><Input type="date" value={vStartDate} onChange={setVStartDate} /></Field>
                          <Field label="Visa Expiry"><Input type="date" value={vEndDate} onChange={setVEndDate} /></Field>
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
                            <Field label="Refugee ID" req><Input placeholder="Refugee ID number" value={refugeeId} onChange={setRefugeeId} /></Field>
                            {/* <Field label="UNHCR Case Number"><Input placeholder="UNH-XXXX" /></Field> */}
                            <Field label="Refugee Certificate"><FileZone file={refugeeFile} onChange={setRefugeeFile} /></Field>
                          </div>
                        )}
                      </>
                    )}

                    <div className="sec-divider mt-5">Sponsorship Details</div>
                    <div className="g3 mt-3">
                      <Field label="Sponsor Name"><Input placeholder="Sponsor name" value={spName} onChange={setSpName} /></Field>
                      <Field label="Sponsor Phone"><Input type="tel" placeholder="+256 7XX XXX XXX" value={spPhone} onChange={v => setSpPhone(sanitizePhoneInput(v))} /></Field>
                      <Field label="Sponsor Email"><Input type="email" placeholder="sponsor@email.com" value={spEmail} onChange={setSpEmail} /></Field>
                    </div>
                    <div className="g3 mt-3">
                      <Field label="Sponsor Country"><SearchSelect options={countryOptions} value={spCountryGuid} placeholder="-- Select Country --" onChange={setSpCountryGuid} /></Field>
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
                          disabled={saveQualification.isPending || !permissions.add}
                          onClick={handleSaveLastQual}
                        >
                          {saveQualification.isPending ? 'Saving…' : 'Save Qualification'}
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
                      <Field label="Photo" req><FileZone hint="Click to upload passport-style photo (JPG/JPEG/PNG/BMP)" file={photoFile} onChange={setPhotoFile} /></Field>
                      <div className="flex items-end">
                        <button className="btn text-xs" disabled={!photoFile || uploadPhoto.isPending || photoSaved || !permissions.add} onClick={handleSavePhoto}>
                          {photoSaved ? <><i className="lni lni-checkmark-circle" /> Uploaded</> : uploadPhoto.isPending ? 'Uploading…' : 'Upload Photo'}
                        </button>
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
                      <div className={`chk-item ${photoSaved ? 'pass' : 'pending'}`}>
                        <i className={`lni ${photoSaved ? 'lni-checkmark-circle' : 'lni-timer'}`} />
                        <span className="flex-1 text-sm text-g700">Student Photo</span>
                        <span className="chk-status text-xs">{photoSaved ? 'Uploaded' : 'Pending'}</span>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 mt-5" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={declarationAccepted} onChange={e => setDeclarationAccepted(e.target.checked)} style={{ width: 16, height: 16 }} />
                      <span className="font-medium text-g700">I confirm the information provided is correct.</span>
                    </label>

                    <div className="flex justify-between mt-5">
                      <button className="btn" onClick={() => setActiveTab('qualifications')}><i className="lni lni-arrow-left" /> Qualifications</button>
                      <button className="btn btn-primary btn-submit-ready" disabled={!canSubmit || submitApplication.isPending || !permissions.add} onClick={handleSubmitApplication}>
                        <i className="lni lni-checkmark" /> {submitApplication.isPending ? 'Submitting…' : 'Submit Application for Vetting'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Toast toast={toast} />

      {submitted && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <SuccessPopup
              title="Application Submitted!"
              subtitle={`${selectedApplication?.appRefNo ?? 'Application'} has been submitted for vetting.`}
              onClose={() => router.push('/admission/vetting')}
            />
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
