'use client'
import { useState, useEffect, CSSProperties } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { AuthError } from '@/lib/api/client'
import { CreateIntakeInput } from '@/lib/api/academic/intake'
import { useIntake } from '@/hooks/academic/useIntakes'

// Create and Edit share this form now — same fields, same calendar UI.
//
// Step 2 (Semester Planning Calendar) is a generic array of entries with
// Add/Remove buttons, so Create gets the same ability to add extra
// semesters that Edit already had (Create used to be stuck with a fixed
// "1st Semester" plus a disabled toggle for a second).

// Default duration used until the calendar dates are available.
const DEFAULT_SEMESTER_WEEKS = 15

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

const INTAKE_SEQUENCES = [
  { value: '1', label: 'Spring' },
  { value: '2', label: 'Fall' },
]

// Card styling shared by every date-category group in the Semester Planning Calendar step.
const CATEGORY_CARD_STYLE: CSSProperties = {
  padding: '1rem',
  boxShadow: '1px 3px 3px 3px rgba(0, 0, 0, 0.15)',
  borderRadius: '10px',
}

// Financial Year / Exam Year are both restricted to a 3-year window relative
// to today's real calendar year — Previous/Current/Next — rather than a free
// number input. `existing` (the loaded intake's own current value, Edit
// only) is added as an extra option when it falls outside that window, so
// editing an older record never silently blanks the field just because its
// year isn't one of the three "current" choices.
function relativeYearOptions(existing?: string): { value: string; label: string }[] {
  const current = new Date().getFullYear()
  const options = [
    { value: String(current - 1), label: `Previous Year (${current - 1})` },
    { value: String(current), label: `Current Year (${current})` },
    { value: String(current + 1), label: `Next Year (${current + 1})` },
  ]
  if (existing && !options.some(o => o.value === existing)) {
    options.unshift({ value: existing, label: existing })
  }
  return options
}

// One accordion section's worth of semester-calendar fields. Keyed by a
// stable UI-only `id` (not sent to the backend — semCode is derived from
// the entry's position in the array on submit), same "array of records +
// stable local id" convention FeeStructureModal uses for its `structures`.
interface CalendarEntryForm {
  id: number
  admissionStartDate: string
  admissionLateFeeDate: string
  admissionEndDate: string
  reentryStartDate: string
  reentryLateFeeDate: string
  reentryEndDate: string
  semStart: string
  lumpsumDate: string
  term1EndDate: string
  term2StartDate: string
  term2End: string
  resitStartDate: string
  resitEndDate: string
  finalExamStartDate: string
  finalExamEndDate: string
  clearanceDate: string
}

let nextCalendarEntryId = 1

function blankCalendarEntry(id: number): CalendarEntryForm {
  return {
    id,
    admissionStartDate: '', admissionLateFeeDate: '', admissionEndDate: '',
    reentryStartDate: '', reentryLateFeeDate: '', reentryEndDate: '',
    semStart: '', lumpsumDate: '', term1EndDate: '', term2StartDate: '', term2End: '',
    resitStartDate: '', resitEndDate: '', finalExamStartDate: '', finalExamEndDate: '', clearanceDate: '',
  }
}

// Per-entry error keys are namespaced by the entry's local id so two
// different semester sections can carry independent errors on the same
// field name (e.g. both section 1 and section 2 missing "Term 1 End Date").
function errKey(id: number, field: string) {
  return `${id}:${field}`
}

interface IntakeFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  intakeGuid: string | null
  createIntake: {
    mutate: (input: CreateIntakeInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateIntake: {
    mutate: (variables: { intakeGuid: string; input: CreateIntakeInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function IntakeFormModal({ isOpen, onClose, showToast, mode, intakeGuid, createIntake, updateIntake }: IntakeFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: intake, isLoading, isError, error } = useIntake(intakeGuid, isOpen && isEdit)

  const [step, setStep]     = useState(1)
  const [saved, setSaved]   = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // First step: the main intake details.
  const [description, setDescription]     = useState('')
  // Tracks whether the Description reflects a real, intentional value (either
  // the record's own saved description on load for Edit, or something the
  // user typed) — once true, Financial Year/Intakes changes stop
  // auto-suggesting a new one.
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  const [financialYear, setFinancialYear] = useState('')
  const [examYear, setExamYear]           = useState('')
  const [examMonth, setExamMonth]         = useState('')
  const [intakeSeq, setIntakeSeq]         = useState('')
  const [currentIntake, setCurrentIntake]                 = useState(false)
  const [currentAdmissionIntake, setCurrentAdmissionIntake] = useState(false)
  const [lastDateForReRegistration, setLastDateForReRegistration] = useState('')
  const [grievanceStartDate, setGrievanceStartDate] = useState('')
  const [grievanceEndDate, setGrievanceEndDate]     = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Second step: a left sidebar listing one entry per semester calendar —
  // starts with whatever the intake already has on Edit (at least one, even
  // if blank), or a single blank entry on Create — and grows/shrinks via
  // addSemester()/removeSemester().
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntryForm[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  // The API returns full datetime values, so the form strips the time portion for date fields.
  function toDateInputValue(value: string | null | undefined): string {
    if (!value) return ''
    return value.includes('T') ? value.split('T')[0] : value
  }

  // Prefill the form when the selected intake loads (Edit), or reset to
  // blanks when opening fresh (Create).
  useEffect(() => {
    if (!isOpen) return

    if (isEdit && intake) {
      setDescription(intake.description)
      setDescriptionTouched(true)
      setFinancialYear(String(intake.financialYear))
      setExamYear(String(intake.examYear))
      setExamMonth(String(intake.examMonth))
      setIntakeSeq(String(intake.intakes))
      setCurrentIntake(intake.currentIntake)
      setCurrentAdmissionIntake(intake.currentAdmissionIntake)
      setLastDateForReRegistration(toDateInputValue(intake.lastDateForReRegistration))
      setGrievanceStartDate(toDateInputValue(intake.grievanceStartDate))
      setGrievanceEndDate(toDateInputValue(intake.grievanceEndDate))

      const sortedEntries = [...(intake.academicCalendar ?? [])].sort((a, b) => a.semCode - b.semCode)
      const source = sortedEntries.length > 0 ? sortedEntries : [null]
      setCalendarEntries(source.map(entry => ({
        id: nextCalendarEntryId++,
        admissionStartDate: toDateInputValue(entry?.admissionStartDate),
        admissionLateFeeDate: toDateInputValue(entry?.admissionLateFeeDate),
        admissionEndDate: toDateInputValue(entry?.admissionEndDate),
        reentryStartDate: toDateInputValue(entry?.reentryStartDate),
        reentryLateFeeDate: toDateInputValue(entry?.reentryLateFeeDate),
        reentryEndDate: toDateInputValue(entry?.reentryEndDate),
        semStart: toDateInputValue(entry?.semesterStartDate ?? entry?.term1StartDate),
        lumpsumDate: toDateInputValue(entry?.lumpsumDate),
        term1EndDate: toDateInputValue(entry?.term1EndDate),
        term2StartDate: toDateInputValue(entry?.term2StartDate),
        term2End: toDateInputValue(entry?.semesterEndDate ?? entry?.term2EndDate),
        resitStartDate: toDateInputValue(entry?.resitStartDate),
        resitEndDate: toDateInputValue(entry?.resitEndDate),
        finalExamStartDate: toDateInputValue(entry?.finalExamStartDate),
        finalExamEndDate: toDateInputValue(entry?.finalExamEndDate),
        clearanceDate: toDateInputValue(entry?.clearanceDate),
      })))
      setActiveIdx(0)

      setErrors({})
      setStep(1)
    } else if (!isEdit) {
      setStep(1)
      setDescription('')
      setDescriptionTouched(false)
      setFinancialYear('')
      setExamYear('')
      setExamMonth('')
      setIntakeSeq('')
      setCurrentIntake(false)
      setCurrentAdmissionIntake(false)
      setLastDateForReRegistration('')
      setGrievanceStartDate('')
      setGrievanceEndDate('')
      setCalendarEntries([blankCalendarEntry(nextCalendarEntryId++)])
      setActiveIdx(0)
      setErrors({})
    }
  }, [isOpen, isEdit, intake])

  // Intake Code is derived, not typed — (Financial Year * 10) + Intake
  // sequence number, e.g. Financial Year 2025, Spring (sequence 1) ->
  // 2025*10 + 1 = 20251; the same year's Fall (sequence 2) -> 20252.
  // Recomputed live on Edit too, overriding whatever the record originally
  // had — this is the single source of truth for the value, not just a
  // default at creation time.
  function computeIntakeCode(): number | null {
    if (!financialYear || !intakeSeq) return null
    return Number(financialYear) * 10 + Number(intakeSeq)
  }

  // Auto-suggests "{Spring/Fall} {Financial Year} Intake" — only while
  // descriptionTouched is false, so it never overwrites the record's own
  // saved description (Edit) or anything the user has typed.
  useEffect(() => {
    if (descriptionTouched || !financialYear || !intakeSeq) return
    const label = INTAKE_SEQUENCES.find(s => s.value === intakeSeq)?.label
    if (!label) return
    setDescription(`${label} ${financialYear} Intake`)
  }, [financialYear, intakeSeq, descriptionTouched])

  // Estimate the visible duration in weeks from the first semester's dates —
  // durationInWeeks is a single intake-level field, not per-semester.
  function calcDurationWeeks(): number | null {
    const first = calendarEntries[0]
    if (!first?.semStart || !first?.term2End) return null
    const ms = new Date(first.term2End).getTime() - new Date(first.semStart).getTime()
    // Round up, not to nearest — the backend re-validates semesterEndDate
    // against semStart + (durationInWeeks - 2) weeks, so rounding down here
    // (Math.round can round down) computes a shorter span than what the user
    // actually selected and rejects a perfectly valid end date.
    return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24 * 7)) : null
  }

  function calcDuration() {
    const weeks = calcDurationWeeks()
    return weeks === null ? '' : String(weeks)
  }

  function parseDate(value: string | null | undefined) {
    if (!value) return null
    const normalized = value.trim()
    if (!normalized) return null
    const [year, month, day] = normalized.split('-').map(Number)
    if ([year, month, day].some(part => Number.isNaN(part))) return null
    return new Date(Date.UTC(year, month - 1, day))
  }

  // Empty date inputs are sent as null so the API accepts them.
  function toApiDate(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed
    return `${datePart}T00:00:00`
  }

  function buildAcademicCalendarEntries(): CreateIntakeInput['academicCalendar'] {
    return calendarEntries.map((entry, idx) => ({
      academicCalendarGuid: null,
      semCode: idx + 1,
      admissionStartDate: toApiDate(entry.admissionStartDate),
      admissionLateFeeDate: toApiDate(entry.admissionLateFeeDate),
      admissionEndDate: toApiDate(entry.admissionEndDate),
      reentryStartDate: toApiDate(entry.reentryStartDate),
      reentryLateFeeDate: toApiDate(entry.reentryLateFeeDate),
      reentryEndDate: toApiDate(entry.reentryEndDate),
      semesterStartDate: toApiDate(entry.semStart),
      semesterEndDate: toApiDate(entry.term2End),
      lumpsumDate: toApiDate(entry.lumpsumDate),
      term1StartDate: toApiDate(entry.semStart),
      term1EndDate: toApiDate(entry.term1EndDate),
      term2StartDate: toApiDate(entry.term2StartDate),
      term2EndDate: toApiDate(entry.term2End),
      resitStartDate: toApiDate(entry.resitStartDate),
      resitEndDate: toApiDate(entry.resitEndDate),
      finalExamStartDate: toApiDate(entry.finalExamStartDate),
      finalExamEndDate: toApiDate(entry.finalExamEndDate),
      clearanceDate: toApiDate(entry.clearanceDate),
    }))
  }

  function addSemester() {
    const id = nextCalendarEntryId++
    setCalendarEntries(prev => [...prev, blankCalendarEntry(id)])
    setActiveIdx(calendarEntries.length)
  }

  function removeSemester(id: number) {
    if (calendarEntries.length <= 1) return
    const idx = calendarEntries.findIndex(en => en.id === id)
    setCalendarEntries(prev => prev.filter(en => en.id !== id))
    setActiveIdx(prev => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }

  function updateEntry(id: number, field: keyof Omit<CalendarEntryForm, 'id'>, value: string) {
    setCalendarEntries(prev => prev.map(en => en.id === id ? { ...en, [field]: value } : en))
    const key = errKey(id, field)
    if (errors[key]) setErrors(p => { const next = { ...p }; delete next[key]; return next })
  }

  function validate(stepNumber = step) {
    const e: Record<string, string> = {}

    if (stepNumber === 1) {
      if (!description.trim())    e.description   = 'Description is required'
      if (!financialYear.trim())  e.financialYear  = 'Financial Year is required'
      if (!examYear.trim())       e.examYear       = 'Exam Year is required'
      if (!examMonth)             e.examMonth      = 'Please select an Exam Month'
      if (!intakeSeq.trim())      e.intakeSeq      = 'Intakes is required'
      // Confirmed required by the backend (validation_error: "must not be
      // empty") despite CreateIntakeInput typing these as nullable.
      if (!lastDateForReRegistration) e.lastDateForReRegistration = 'Last Date for Re-registration is required'
      if (!grievanceStartDate)        e.grievanceStartDate        = 'Grievance Start Date is required'
      if (!grievanceEndDate)          e.grievanceEndDate          = 'Grievance End Date is required'
    }

    if (stepNumber === 2) {
      calendarEntries.forEach((entry, idx) => {
        const startDate = parseDate(entry.semStart)
        const endDate   = parseDate(entry.term2End)

        if (!entry.semStart)      e[errKey(entry.id, 'semStart')]      = `Semester ${idx + 1} start date is required`
        if (!entry.term1EndDate)  e[errKey(entry.id, 'term1EndDate')]  = `Semester ${idx + 1} term 1 end date is required`
        if (!entry.term2StartDate) e[errKey(entry.id, 'term2StartDate')] = `Semester ${idx + 1} term 2 start date is required`
        if (!entry.term2End)      e[errKey(entry.id, 'term2End')]      = `Semester ${idx + 1} end date is required`

        // No client-side cap on how far term2End can be from semStart — the
        // backend enforces its own max-end-date rule (semesterStartDate +
        // (durationInWeeks - 2) weeks), but durationInWeeks itself is
        // derived from the first entry's own dates (see calcDurationWeeks()
        // / handleSave), so that check is satisfied by construction. A
        // validation_error would still surface via the failure screen if the
        // backend ever disagrees.
        if (startDate && endDate && endDate < startDate) {
          e[errKey(entry.id, 'term2End')] = `Semester ${idx + 1} end date must be on or after its start date`
        }

        const admissionStart   = parseDate(entry.admissionStartDate)
        const admissionLateFee = parseDate(entry.admissionLateFeeDate)
        const admissionEnd     = parseDate(entry.admissionEndDate)
        if (admissionStart && admissionLateFee && admissionLateFee < admissionStart) {
          e[errKey(entry.id, 'admissionLateFeeDate')] = 'Admission late fee date must be on or after the admission start date'
        }
        if (admissionLateFee && admissionEnd && admissionEnd < admissionLateFee) {
          e[errKey(entry.id, 'admissionEndDate')] = 'Admission end date must be on or after the admission late fee date'
        }

        const reentryStart   = parseDate(entry.reentryStartDate)
        const reentryLateFee = parseDate(entry.reentryLateFeeDate)
        const reentryEnd     = parseDate(entry.reentryEndDate)
        if (reentryStart && reentryLateFee && reentryLateFee < reentryStart) {
          e[errKey(entry.id, 'reentryLateFeeDate')] = 'Re-entry late fee date must be on or after the re-entry start date'
        }
        if (reentryStart && reentryEnd && reentryEnd < reentryStart) {
          e[errKey(entry.id, 'reentryEndDate')] = 'Re-entry end date must be on or after the re-entry start date'
        }

        const resitStart = parseDate(entry.resitStartDate)
        const resitEnd   = parseDate(entry.resitEndDate)
        if (resitStart && resitEnd && resitEnd < resitStart) {
          e[errKey(entry.id, 'resitEndDate')] = 'Resit end date must be on or after the resit start date'
        }

        const finalExamStart = parseDate(entry.finalExamStartDate)
        const finalExamEnd   = parseDate(entry.finalExamEndDate)
        if (finalExamStart && finalExamEnd && finalExamEnd < finalExamStart) {
          e[errKey(entry.id, 'finalExamEndDate')] = 'Final exam end date must be on or after the final exam start date'
        }
      })
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (!isOpen) return null

  function handleClose() {
    setStep(1)
    setSaved(false)
    setFailure(null)
    setErrors({})
    onClose()
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Intake Updated!' : 'Intake Created!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new intake has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title={isEdit ? "Couldn't Update Intake" : "Couldn't Create Intake"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Intake"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load intake details.') : 'Failed to load intake details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !intake)) {
    return (
      <div className="modal-overlay open" id="intake-edit-modal">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Intake</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div className="modal-scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <span style={{ color: 'var(--g400)' }}>Loading intake details…</span>
          </div>
        </div>
      </div>
    )
  }

  // This endpoint does not expose a confirmed failure-code list yet
  // (unlike countries/departments, where the docs spelled out bad_request vs
  // validation_error), so for now anything that comes back from the API just
  // shows the failure screen with whatever message the backend sent.
  function handleSaveError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'create'} intake${code ? ` (${code})` : ''}. Please try again.`)
  }

  function handleSave() {
    if (!validate(2)) return
    if (isEdit && !intakeGuid) return

    const input: CreateIntakeInput = {
      // Derived, not typed — see computeIntakeCode() above.
      intakeCode: computeIntakeCode() ?? 0,
      description,
      financialYear: Number(financialYear),
      examYear: Number(examYear),
      intakes: Number(intakeSeq),
      examMonth: Number(examMonth),
      month: MONTHS.find(m => m.value === examMonth)?.label ?? '',
      // The backend validates semesterEndDate against semesterStartDate +
      // (durationInWeeks - 2) weeks, so this has to be the actual semester
      // span (+2 buffer weeks), not a fixed nominal number — see
      // DEFAULT_SEMESTER_WEEKS comment above for the confirmed evidence.
      durationInWeeks: (calcDurationWeeks() ?? (DEFAULT_SEMESTER_WEEKS - 2)) + 2,
      lastDateForReRegistration: toApiDate(lastDateForReRegistration),
      currentIntake,
      grievanceStartDate: toApiDate(grievanceStartDate),
      currentAdmissionIntake,
      grievanceEndDate: toApiDate(grievanceEndDate),
      academicCalendar: buildAcademicCalendarEntries(),
    }

    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Intake updated successfully' : 'Intake added successfully') }

    if (isEdit && intakeGuid) {
      updateIntake.mutate({ intakeGuid, input }, { onSuccess, onError: handleSaveError })
    } else {
      createIntake.mutate(input, { onSuccess, onError: handleSaveError })
    }
  }

  const isPending = isEdit ? updateIntake.isPending : createIntake.isPending

  return (
    <div className="modal-overlay open" id={isEdit ? 'intake-edit-modal' : 'new-intake-modal'}>
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-calendar'}`}></i> {isEdit ? <>Edit Intake — <span className="font-mono">{intake!.intakeCode}</span></> : 'Create New Intake'}
          </div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="prog-steps">
          <div className={`prog-step${step === 1 ? ' active' : ''}`}>
            <span className="prog-step-num">1</span>
            <span>Intake Details</span>
          </div>
          <div className="prog-step-line"></div>
          <div className={`prog-step${step === 2 ? ' active' : ''}`}>
            <span className="prog-step-num">2</span>
            <span>Semester Planning Calendar</span>
          </div>
        </div>

        {step === 1 && (
          <div className="modal-scroll">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '3.5rem', rowGap: '1rem' }}>
              {/* Field order: Financial Year -> Intakes -> Description ->
                  Intake Code -> Exam Year -> Exam Month. Financial Year /
                  Exam Year are Previous/Current/Next Year dropdowns (plus,
                  on Edit, the record's own existing value if it falls
                  outside that window); Intake Code is derived (read-only),
                  not typed — see computeIntakeCode() above. */}
              <div className="fg">
                <div className="lbl">Financial Year <span className="req">*</span></div>
                <SearchSelect
                  placeholder="Select financial year…"
                  value={financialYear}
                  onChange={v => { setFinancialYear(v); if (errors.financialYear) setErrors(p => ({ ...p, financialYear: '' })) }}
                  options={relativeYearOptions(isEdit ? financialYear : undefined)}
                />
                {errors.financialYear && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.financialYear}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Intakes <span className="req">*</span></div>
                <SearchSelect
                  placeholder="Select intakes…"
                  value={intakeSeq}
                  onChange={v => { setIntakeSeq(v); if (errors.intakeSeq) setErrors(p => ({ ...p, intakeSeq: '' })) }}
                  options={INTAKE_SEQUENCES}
                />
                {errors.intakeSeq && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.intakeSeq}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Description <span className="req">*</span></div>
                <input
                  className="ctrl"
                  style={errors.description ? { borderColor: 'var(--red)' } : undefined}
                  type="text"
                  placeholder="e.g. September 2027 Intake"
                  value={description}
                  onChange={e => { setDescription(e.target.value); setDescriptionTouched(true); if (errors.description) setErrors(p => ({ ...p, description: '' })) }}
                />
                {errors.description && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.description}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Intake Code</div>
                <input
                  className="ctrl font-mono"
                  style={{ background: 'var(--g100)', color: computeIntakeCode() ? 'var(--g700)' : 'var(--g400)', cursor: 'not-allowed' }}
                  type="text"
                  value={computeIntakeCode() ?? ''}
                  readOnly
                  placeholder="Set Financial Year and Intakes first"
                />
              </div>
              <div className="fg">
                <div className="lbl">Exam Year <span className="req">*</span></div>
                <SearchSelect
                  placeholder="Select exam year…"
                  value={examYear}
                  onChange={v => { setExamYear(v); if (errors.examYear) setErrors(p => ({ ...p, examYear: '' })) }}
                  options={relativeYearOptions(isEdit ? examYear : undefined)}
                />
                {errors.examYear && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.examYear}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Exam Month <span className="req">*</span></div>
                <SearchSelect
                  placeholder="Select month…"
                  value={examMonth}
                  onChange={v => { setExamMonth(v); if (errors.examMonth) setErrors(p => ({ ...p, examMonth: '' })) }}
                  options={MONTHS}
                />
                {errors.examMonth && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.examMonth}</p>}
              </div>
              <div className="fg" style={{ gridColumn: 'span 3' }}>
                <div className="lbl">Set As</div>
                <div style={{ display: 'flex', gap: 28, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--g700)' }}>
                    <input
                      type="checkbox"
                      checked={currentIntake}
                      onChange={e => setCurrentIntake(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--b500)', cursor: 'pointer' }}
                    />
                    Academic Intake
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--g700)' }}>
                    <input
                      type="checkbox"
                      checked={currentAdmissionIntake}
                      onChange={e => setCurrentAdmissionIntake(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--b500)', cursor: 'pointer' }}
                    />
                    Admission Intake
                  </label>
                </div>
              </div>
              <div className="fg">
                <div className="lbl">Last Date for Re-registration <span className="req">*</span></div>
                <DatePicker value={lastDateForReRegistration} onChange={v => { setLastDateForReRegistration(v); if (errors.lastDateForReRegistration) setErrors(p => ({ ...p, lastDateForReRegistration: '' })) }} hasError={!!errors.lastDateForReRegistration} />
                {errors.lastDateForReRegistration && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.lastDateForReRegistration}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Grievance Start Date <span className="req">*</span></div>
                <DatePicker value={grievanceStartDate} onChange={v => { setGrievanceStartDate(v); if (errors.grievanceStartDate) setErrors(p => ({ ...p, grievanceStartDate: '' })) }} hasError={!!errors.grievanceStartDate} />
                {errors.grievanceStartDate && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.grievanceStartDate}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Grievance End Date <span className="req">*</span></div>
                <DatePicker value={grievanceEndDate} onChange={v => { setGrievanceEndDate(v); if (errors.grievanceEndDate) setErrors(p => ({ ...p, grievanceEndDate: '' })) }} hasError={!!errors.grievanceEndDate} />
                {errors.grievanceEndDate && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.grievanceEndDate}</p>}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (() => {
          const active = calendarEntries[activeIdx]
          return (
            <div className="fsm-layout">
              {/* Left sidebar — one entry per semester */}
              <div className="fsm-sidebar">
                <div style={{ padding: '14px 14px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Semesters <span style={{ color: 'var(--b500)' }}>({calendarEntries.length})</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                  {calendarEntries.map((entry, i) => (
                    <div
                      key={entry.id}
                      onClick={() => setActiveIdx(i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 10px', borderRadius: 'var(--rsm)', marginBottom: 2,
                        background: activeIdx === i ? 'var(--b500)' : 'transparent',
                        color: activeIdx === i ? '#fff' : 'var(--g700)',
                        cursor: 'pointer', transition: 'background .15s',
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: activeIdx === i ? 'rgba(255,255,255,.2)' : 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="lni lni-calendar" style={{ fontSize: 13, color: activeIdx === i ? '#fff' : 'var(--b600)' }}></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>Semester {i + 1}</div>
                        <div style={{ fontSize: 11, opacity: .65, lineHeight: 1.3 }}>{entry.semStart ? `Starts ${entry.semStart}` : 'No dates set'}</div>
                      </div>
                      {calendarEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removeSemester(entry.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: activeIdx === i ? 'rgba(255,255,255,.65)' : 'var(--g300)', display: 'flex', alignItems: 'center', borderRadius: 'var(--rxs)', flexShrink: 0 }}
                          title="Remove semester"
                        ><i className="lni lni-trash-can" style={{ fontSize: 12 }}></i></button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1.5px solid var(--g200)', padding: '6px 8px 10px' }}>
                  <button type="button" className="btn btn-neu btn-sm" style={{ width: '100%' }} onClick={addSemester}>
                    <i className="lni lni-plus"></i> Add Semester
                  </button>
                </div>
              </div>

              {/* Right panel — active semester's calendar fields */}
              <div className="fsm-main">
                {active && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: '12px 16px', background: 'var(--b50)', borderRadius: 'var(--rsm)', border: '1.5px solid var(--b100)' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--b100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="lni lni-calendar" style={{ color: 'var(--b600)', fontSize: 17 }}></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--b800)' }}>
                          {activeIdx === 0 ? '1st Semester Planning Calendar' : `Semester ${activeIdx + 1} Planning Calendar`}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--g400)' }}>
                          Semester {activeIdx + 1} of {calendarEntries.length}
                        </div>
                      </div>
                    </div>

                    <div style={CATEGORY_CARD_STYLE}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '3.5rem', rowGap: '1rem' }}>
                        <div className="fg"><div className="lbl">Admission Start Date</div><DatePicker value={active.admissionStartDate} onChange={v => updateEntry(active.id, 'admissionStartDate', v)} /></div>
                        <div className="fg"><div className="lbl">Admission End Date</div><DatePicker value={active.admissionEndDate} onChange={v => updateEntry(active.id, 'admissionEndDate', v)} hasError={!!errors[errKey(active.id, 'admissionEndDate')]} />{errors[errKey(active.id, 'admissionEndDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'admissionEndDate')]}</p>}</div>
                        <div className="fg"><div className="lbl">Admission Late Fee Date</div><DatePicker value={active.admissionLateFeeDate} onChange={v => updateEntry(active.id, 'admissionLateFeeDate', v)} hasError={!!errors[errKey(active.id, 'admissionLateFeeDate')]} />{errors[errKey(active.id, 'admissionLateFeeDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'admissionLateFeeDate')]}</p>}</div>
                        <div className="fg"><div className="lbl">Re-entry Start Date</div><DatePicker value={active.reentryStartDate} onChange={v => updateEntry(active.id, 'reentryStartDate', v)} /></div>
                        <div className="fg"><div className="lbl">Re-entry End Date</div><DatePicker value={active.reentryEndDate} onChange={v => updateEntry(active.id, 'reentryEndDate', v)} hasError={!!errors[errKey(active.id, 'reentryEndDate')]} />{errors[errKey(active.id, 'reentryEndDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'reentryEndDate')]}</p>}</div>
                        <div className="fg"><div className="lbl">Re-entry Late Fee Date</div><DatePicker value={active.reentryLateFeeDate} onChange={v => updateEntry(active.id, 'reentryLateFeeDate', v)} hasError={!!errors[errKey(active.id, 'reentryLateFeeDate')]} />{errors[errKey(active.id, 'reentryLateFeeDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'reentryLateFeeDate')]}</p>}</div>
                      </div>
                    </div>

                    <div style={{ ...CATEGORY_CARD_STYLE, marginTop: '1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '3.5rem', rowGap: '1rem' }}>
                        <div className="fg"><div className="lbl">Semester/Term 1 Start Date</div><DatePicker value={active.semStart} onChange={v => updateEntry(active.id, 'semStart', v)} hasError={!!errors[errKey(active.id, 'semStart')]} />{errors[errKey(active.id, 'semStart')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'semStart')]}</p>}</div>
                        <div className="fg"><div className="lbl">Term 1 End Date</div><DatePicker value={active.term1EndDate} onChange={v => updateEntry(active.id, 'term1EndDate', v)} hasError={!!errors[errKey(active.id, 'term1EndDate')]} />{errors[errKey(active.id, 'term1EndDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'term1EndDate')]}</p>}</div>
                        <div className="fg"><div className="lbl">Lump Sum Date</div><DatePicker value={active.lumpsumDate} onChange={v => updateEntry(active.id, 'lumpsumDate', v)} /></div>
                        <div className="fg"><div className="lbl">Term 2 Start Date</div><DatePicker value={active.term2StartDate} onChange={v => updateEntry(active.id, 'term2StartDate', v)} hasError={!!errors[errKey(active.id, 'term2StartDate')]} />{errors[errKey(active.id, 'term2StartDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'term2StartDate')]}</p>}</div>
                        <div className="fg"><div className="lbl">Semester/Term 2 End Date</div><DatePicker value={active.term2End} onChange={v => updateEntry(active.id, 'term2End', v)} hasError={!!errors[errKey(active.id, 'term2End')]} />{errors[errKey(active.id, 'term2End')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'term2End')]}</p>}</div>
                        {activeIdx === 0 && (
                          <div className="fg">
                            <div className="lbl">Duration (weeks)</div>
                            <input
                              className="ctrl"
                              style={{ background: 'var(--g100)', color: calcDuration() ? 'var(--g700)' : 'var(--g400)', cursor: 'not-allowed' }}
                              type="text"
                              value={calcDuration()}
                              readOnly
                              placeholder="Set semester dates below"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ ...CATEGORY_CARD_STYLE, marginTop: '1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '3.5rem', rowGap: '1rem' }}>
                        <div className="fg"><div className="lbl">Resit Start Date</div><DatePicker value={active.resitStartDate} onChange={v => updateEntry(active.id, 'resitStartDate', v)} /></div>
                        <div className="fg"><div className="lbl">Resit End Date</div><DatePicker value={active.resitEndDate} onChange={v => updateEntry(active.id, 'resitEndDate', v)} hasError={!!errors[errKey(active.id, 'resitEndDate')]} />{errors[errKey(active.id, 'resitEndDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'resitEndDate')]}</p>}</div>
                        <div className="fg"><div className="lbl">Clearance Date (80%)</div><DatePicker value={active.clearanceDate} onChange={v => updateEntry(active.id, 'clearanceDate', v)} /></div>
                        <div className="fg"><div className="lbl">Final Exam Start Date</div><DatePicker value={active.finalExamStartDate} onChange={v => updateEntry(active.id, 'finalExamStartDate', v)} /></div>
                        <div className="fg"><div className="lbl">Final Exam End Date</div><DatePicker value={active.finalExamEndDate} onChange={v => updateEntry(active.id, 'finalExamEndDate', v)} hasError={!!errors[errKey(active.id, 'finalExamEndDate')]} />{errors[errKey(active.id, 'finalExamEndDate')] && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[errKey(active.id, 'finalExamEndDate')]}</p>}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })()}

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <span className="flex-1"></span>
          {step === 2 && (
            <button className="btn btn-neu" onClick={() => setStep(1)}>
              <i className="lni lni-arrow-left"></i> Back
            </button>
          )}
          {step === 1 && (
            <button className="btn btn-primary" onClick={() => { if (validate()) setStep(2) }}>
              Continue <i className="lni lni-arrow-right"></i>
            </button>
          )}
          {step === 2 && (
            <button className="btn btn-primary" disabled={isPending} onClick={handleSave}>
              <i className="lni lni-checkmark"></i> {isPending ? 'Saving…' : (isEdit ? 'Update Intake' : 'Save Intake')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
