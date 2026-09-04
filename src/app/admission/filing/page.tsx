'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { FailurePopup } from '@/components/modals/shared/FailurePopup'
import { useIntakes, useCurrentAcademicIntake } from '@/hooks/academic/useIntakes'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useBatchTimes } from '@/hooks/config/useBatchTimes'
import { useBatches } from '@/hooks/academic/useBatches'
import { useCountries } from '@/hooks/config/useCountries'
import { useEnquiries } from '@/hooks/admission/useEnquiries'
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
  useSubmitApplication,
  useUploadPhoto,
} from '@/hooks/admission/useApplicationFiling'

// Family Details tab removed per the Application Filling requirements doc
// (req. 10) — sponsorship fields already live in Personal Info.
type Tab = 'personal' | 'qualifications' | 'documents'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'personal',       label: 'Personal Info',    icon: 'lni-user-4' },
  { id: 'qualifications', label: 'Qualifications',   icon: 'lni-graduation' },
  { id: 'documents',      label: 'Documents',        icon: 'lni-folder-2' },
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
  if (value !== undefined) {
    return <input className="ctrl" type={type} placeholder={placeholder} readOnly={readOnly} value={value} onChange={e => onChange?.(e.target.value)} />
  }
  return <input className="ctrl" type={type} placeholder={placeholder} readOnly={readOnly} />
}
function Select({ options, placeholder, value, onChange }: { options: string[]; placeholder?: string; value?: string; onChange?: (v: string) => void }) {
  return <SearchSelect placeholder={placeholder || 'Select...'} options={options} value={value} onChange={onChange} />
}
function FileZone({ hint = 'Click to upload', file, onChange }: { hint?: string; file?: File | null; onChange?: (f: File | null) => void }) {
  return (
    <div className="file-zone">
      <input type="file" onChange={e => onChange?.(e.target.files?.[0] ?? null)} />
      <i className="lni lni-cloud-upload file-zone-icon" />
      <p>{file ? file.name : hint}</p>
    </div>
  )
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
  // instead of the 442+ that one intake alone already had). Only fetches
  // once there's an actual search term — opening the box with nothing typed
  // used to fire the same big query anyway (searchTerm=''), pulling the
  // entire batch on every focus. That, combined with rendering every single
  // result into the dropdown below with no cap, was rendering several
  // thousand <button>s at once — slow/heavy enough to look like results
  // were silently going missing, when really the browser was just choking
  // on the sheer volume.
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
  const { data: searchResults } = useSearchApplicationsForFiling(
    applicantSearch, 1, 12000, showApplicantDropdown && !!applicantSearch.trim(), effectiveIntakeCode,
  )
  const searchItems = searchResults?.items ?? []
  // Capped to a handful of matches for display — same convention as
  // enquiry-list/vetting's own searchMatches — even though the query above
  // can match against up to 12000 real rows.
  const visibleSearchItems = searchItems.slice(0, 8)

  // Auto-carries the appRefNo over from Payment's "Proceed to Filing" button
  // (see lib/filingHandoff.ts) instead of leaving the counsellor to manually
  // retype/remember it right after generating a receipt — read once on
  // mount, consumed immediately so a later manual visit/refresh doesn't
  // keep re-triggering this.
  const pendingPrefillRef = useRef<string | null>(null)
  useEffect(() => {
    const ref = consumeFilingPrefillRef()
    if (!ref) return
    pendingPrefillRef.current = ref
    setApplicantSearch(ref)
    setShowApplicantDropdown(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once the search this triggers actually comes back, auto-select the
  // matching row so the counsellor lands straight on a filled Personal Info
  // tab instead of still having to click it from the dropdown. If nothing
  // matches (e.g. the backend hasn't indexed the new payment yet), surface
  // that plainly rather than leaving an empty dropdown with no explanation.
  useEffect(() => {
    if (!pendingPrefillRef.current || !searchResults) return
    const ref = pendingPrefillRef.current
    pendingPrefillRef.current = null
    const match = searchItems.find(a => a.appRefNo === ref)
    if (match) selectApplication(match)
    else showToast(`Could not find application ${ref} yet — try searching again in a moment, or check the reference number`, 'error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults])

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

    setFirstName(a.firstName?.trim() ?? '')
    setLastName(a.lastName?.trim() ?? '')
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
    setEnquiryGuid(a.enquiryGuid ?? '')
    setCampusGuid(a.campusGuid ?? '')
    setProgramGuidState(a.programGuid ?? '')
    setSemesterGuidState(a.semesterGuid ?? '')
    setBatchTimeGuidState(a.batchTimeGuid ?? '')
    setBatchGuid(a.batchGuid ?? '')
    setFeeHdGuid(a.feeHdGuid ?? '')
  }

  // ── General (Personal Info tab) ─────────────────────────────────────────
  // SaveGeneral.bru marks enquiryGuid "(optional)" — same claim Create.bru
  // made about Application-Payments' identical field, which turned out to
  // be false (confirmed by reproducing a 400 with only that field removed
  // from an otherwise-working payload). Not independently confirmed here
  // yet, but wired as required defensively given that precedent — worth
  // testing whether omitting it here also 400s.
  const [enquiryGuid, setEnquiryGuid] = useState('')
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

  // Restored as an editable, required picker — the current search source
  // (/application-payments) only ever carries intEnquiry (a raw int, no
  // confirmed guid mapping), never a real enquiryGuid, so every application
  // selected from search hits the "missing Enquiry" save-blocking toast
  // with nothing to fix it unless a real picker exists here.
  const { data: enquiriesData }   = useEnquiries(1, 1000)
  const { data: campuses = [] }   = useCampuses()
  const { data: programs = [] }   = useProgramMasters()
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
  // Same payment-scoped Dropdowns/Fees.bru endpoint that turned out
  // unreliable on the Payment page (blank for a Programme that does have
  // real fee structures) — use the generic, already-confirmed-correct
  // Programme Fee Structure list filtered client-side instead, same fix as
  // applied there.
  const { data: allFeeStructuresData } = useProgramFeeStructures(1, 1000)
  const fees = (allFeeStructuresData?.items ?? []).filter(f => f.programGuid === programGuid && f.status)
  const { data: countries = [] }  = useCountries()

  const enquiryOptions   = (enquiriesData?.items ?? []).map(e => ({ value: e.enquiryGuid, label: `${e.studentName} (${e.enquiryCode})` }))
  const campusOptions    = campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))
  const programOptions   = programs.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` }))
  const semesterOptions  = semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))
  const batchTimeOptions = batchTimes.map(bt => ({ value: bt.batchTimeGuid, label: bt.batchTime }))
  const batchOptions     = batches.map(b => ({ value: b.batchGuid, label: b.batchCode }))
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
    if (!enquiryGuid) { showToast('Enquiry is required', 'error'); return }
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
        enquiryGuid,
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

  function renderQualRow(row: QualRow) {
    const saved = row.savedId != null
    return (
      <div key={row.id} className="mb-3 p-3 rounded-lg border border-g200">
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
          {saved
            ? <span className="badge badge-green"><i className="lni lni-checkmark-circle" /> Saved</span>
            : <button className="btn text-xs" disabled={saveQualification.isPending || !permissions.add} onClick={() => handleSaveQualRow(row)}>
                {saveQualification.isPending ? 'Saving…' : 'Save Qualification'}
              </button>}
          <button className="btn btn-neu text-xs" disabled={deleteQualification.isPending || (saved && !permissions.delete)} onClick={() => handleDeleteQualRow(row)}>
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

      <div className="card mb-4 p-5">
        <h2 className="font-bold text-g800 mb-3">Link to Payment Record</h2>
        <div className="g2">
          <div className="fg">
            <label className="lbl">Applicant<span className="req">*</span></label>
            <div className="relative">
              <input className="ctrl" placeholder="Search applicant ref no, name, email or phone..."
                value={selectedApplication ? `${selectedApplication.appRefNo} — ${applicantName(selectedApplication)}` : applicantSearch}
                onChange={e => { setApplicantSearch(e.target.value); setShowApplicantDropdown(true); setSelectedApplication(null) }}
                onFocus={() => setShowApplicantDropdown(true)} />
              {showApplicantDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-g200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {!applicantSearch.trim()
                    ? <div className="p-3 text-sm text-g400">Type to search…</div>
                    : visibleSearchItems.length === 0
                      ? <div className="p-3 text-sm text-g400">No results</div>
                      : visibleSearchItems.map(a => (
                        <button key={a.appRefNo} className="w-full text-left px-4 py-2 text-sm hover:bg-b50 flex justify-between" onClick={() => selectApplication(a)}>
                          <span className="font-medium text-g800">{a.appRefNo}</span><span className="text-g500">{applicantName(a)}</span>
                        </button>
                      ))}
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
          <div className="info-box mt-4">
            {/* Save Status intentionally not shown here — requirements doc says
                not to display it in the UI at all. */}
            <div className="g2">
              <div><span className="text-xs text-g400 block">Email</span><span className="text-sm font-semibold text-g800">{selectedApplication.emailId ?? '—'}</span></div>
              <div><span className="text-xs text-g400 block">Phone</span><span className="text-sm font-semibold text-g800">{selectedApplication.phone ?? '—'}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {!selectedApplication ? (
          <div className="p-8 text-center text-g400">
            <i className="lni lni-search-alt" style={{ fontSize: 28 }} />
            <p className="mt-2">Select an application above to begin filing.</p>
          </div>
        ) : (
          <>
            <div className="flex border-b border-g200">
              {TABS.map(t => (
                <button key={t.id} className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.id ? 'border-b500 text-b600 bg-b50' : 'border-transparent text-g500 hover:text-g700'}`} onClick={() => setActiveTab(t.id)}>
                  <i className={`lni ${t.icon}`} /> {t.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'personal' && (
                <div>
                  <div className="flex items-start gap-5 mb-5">
                    <div className="file-zone w-32 h-32 flex-shrink-0"><input type="file" accept="image/*" /><i className="lni lni-camera-2 file-zone-icon" /><p>Profile Photo</p></div>
                    <div className="flex-1">
                      <div className="g3"><Field label="First Name" req><Input placeholder="First name" value={firstName} onChange={setFirstName} /></Field>{/* <Field label="Middle Name"><Input placeholder="Middle name" /></Field> */}<Field label="Last Name" req><Input placeholder="Last name" value={lastName} onChange={setLastName} /></Field></div>
                      <div className="g3 mt-3"><Field label="Gender" req><Select options={GENDERS} value={gender} onChange={setGender} /></Field><Field label="Date of Birth" req><Input type="date" value={dob} onChange={setDob} /></Field><Field label="Nationality" req><SearchSelect options={countryOptions} value={countryGuid} placeholder="-- Select Country --" onChange={setCountryGuid} /></Field></div>
                    </div>
                  </div>
                  <div className="g3">
                    <Field label="National ID"><Input placeholder="CM-XXXXX-XXXX" value={nationalId} onChange={setNationalId} /></Field>
                    <Field label="Email" req><Input type="email" placeholder="email@example.com" value={email} onChange={setEmail} /></Field>
                    <Field label="Phone" req>
                      <div className="flex gap-2">
                        <SearchSelect options={COUNTRY_CODES} value={phoneCode} onChange={setPhoneCode} style={{ width: 108, flexShrink: 0 }} />
                        <input className="ctrl flex-1" type="tel" inputMode="numeric" placeholder="7XX XXX XXX" value={phone} onChange={e => setPhone(sanitizePhoneInput(e.target.value, false))} />
                      </div>
                    </Field>
                  </div>
                  <div className="g3 mt-3">
                    <Field label="National ID Copy"><FileZone file={nationalIdFile} onChange={setNationalIdFile} /></Field>
                    {/* <Field label="Residential Address" span={2}><Input placeholder="Full address" /></Field> */}
                  </div>
                  {/* <div className="g3 mt-3"><Field label="University Email"><Input readOnly placeholder="Auto-generated" /></Field><Field label="Religion"><Select options={RELIGIONS} /></Field><Field label="Marital Status"><Select options={MARITAL} /></Field></div> */}

                  <div className="sec-divider mt-5">Programme Details</div>
                  {/* Intake picker stays hidden — intakeGuid prefills fine from the
                      selected application. Enquiry is back as an editable, required
                      picker: the current search source (/application-payments) only
                      ever carries intEnquiry (a raw int, no confirmed guid mapping),
                      never a real enquiryGuid, so EVERY application selected from
                      search was hitting the "missing Enquiry" save-blocking toast
                      with nothing on this page left to fix it. */}
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
                    <Field label="Enquiry" req><SearchSelect options={enquiryOptions} value={enquiryGuid} placeholder="-- Select Enquiry --" onChange={setEnquiryGuid} /></Field>
                    <Field label="Campus" req><SearchSelect options={campusOptions} value={campusGuid} placeholder="-- Select Campus --" onChange={setCampusGuid} disabled /></Field>
                    <Field label="Programme" req><SearchSelect options={programOptions} value={programGuid} placeholder="-- Select Programme --" onChange={setProgramGuid} disabled /></Field>
                  </div>
                  <div className="g3 mt-3">
                    <Field label="Fee Structure" req><SearchSelect options={feeOptions} value={feeHdGuid} placeholder={programGuid ? '-- Select Fee Structure --' : '-- Select Programme First --'} onChange={setFeeHdGuid} disabled /></Field>
                    <Field label="Semester"><SearchSelect options={semesterOptions} value={semesterGuid} placeholder={programGuid ? '-- Select Semester --' : '-- Select Programme First --'} onChange={setSemesterGuid} disabled /></Field>
                    <Field label="Batch Time"><SearchSelect options={batchTimeOptions} value={batchTimeGuid} placeholder="-- Select --" onChange={setBatchTimeGuid} /></Field>
                  </div>
                  <div className="g3 mt-3">
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
                      <div className="g3 mt-3"><Field label="Passport Number"><Input placeholder="AB1234567" value={passportNo} onChange={setPassportNo} /></Field>{/* <Field label="Passport Expiry"><Input type="date" /></Field><Field label="Country of Issue"><Select options={COUNTRIES_OF_ISSUE} /></Field> */}</div>
                      <div className="g3 mt-3">
                        <Field label="Passport Copy"><FileZone file={passportFile} onChange={setPassportFile} /></Field>
                        {/* <Field label="Visa Number"><Input placeholder="VIS-XXXX" /></Field>
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
                    <button className="btn" disabled={saveGeneral.isPending || !permissions.add} onClick={handleSaveGeneralAndAdvance}>
                      {saveGeneral.isPending ? 'Saving…' : <>Save &amp; Next: Qualifications <i className="lni lni-arrow-right" /></>}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'qualifications' && (
                <div>
                  <div className="sec-divider">Highest Qualification</div>
                  {renderQualRow(qualRows[0])}
                  <div className="sec-divider mt-5 flex items-center justify-between">
                    <span>Additional Qualifications</span>
                    <button className="btn text-xs" onClick={() => setQualRows(rows => [...rows, emptyQualRow(Date.now())])}><i className="lni lni-plus" /> Add Row</button>
                  </div>
                  {qualRows.slice(1).map(row => renderQualRow(row))}
                  {/* <div className="sec-divider mt-5 flex items-center justify-between">
                    <span>Work Experience</span>
                    <button className="btn text-xs" onClick={() => setExperienceRows(r => [...r, { id: Date.now() }])}><i className="lni lni-plus" /> Add Entry</button>
                  </div>
                  {experienceRows.map(row => (
                    <div key={row.id} className="g3 mt-3"><Field label="Organization"><Input placeholder="Company / Organization" /></Field><Field label="Role"><Input placeholder="Job title" /></Field><Field label="Duration"><Input placeholder="e.g. 2 years" /></Field></div>
                  ))} */}
                  <div className="flex justify-between mt-5">
                    <button className="btn" onClick={() => setActiveTab('personal')}><i className="lni lni-arrow-left" /> Personal Info</button>
                    <button className="btn" onClick={() => setActiveTab('documents')}>Next: Documents <i className="lni lni-arrow-right" /></button>
                  </div>
                </div>
              )}

              {/* Family Details tab removed per the Application Filling requirements
                  doc (req. 10) — sponsorship fields already live in Personal Info. */}

              {activeTab === 'documents' && (
                <div>
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
                    <button className="btn bg-b500 text-white" disabled={!canSubmit || submitApplication.isPending || !permissions.add} onClick={handleSubmitApplication}>
                      <i className="lni lni-checkmark" /> {submitApplication.isPending ? 'Submitting…' : 'Submit Application for Vetting'}
                    </button>
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
