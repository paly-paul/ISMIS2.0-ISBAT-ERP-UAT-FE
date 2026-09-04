'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { FailurePopup } from '@/components/modals/shared/FailurePopup'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useCountries } from '@/hooks/config/useCountries'
import { dialCode } from '@/lib/api/academic/country'
import { useProgramMastersByCampus } from '@/hooks/academic/useProgramMaster'
import { useEnquirySourceMasters } from '@/hooks/admission/useEnquirySourceMasters'
import { useCreateEnquiry } from '@/hooks/admission/useEnquiries'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { AuthError } from '@/lib/api/client'
import { sanitizePhoneInput } from '@/lib/errorMessages'

// Today's date at midnight, formatted the same way the confirmed payload
// sample uses (no timezone offset) — matches enquiryDate/dob's "T00:00:00" shape.
function todayAtMidnight() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00`
}

export default function KioskEnquiryPage() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const { data: intakes = [] }        = useIntakes()
  const { data: campuses = [] }       = useCampuses()
  const { data: enquirySources = [] } = useEnquirySourceMasters()
  const { data: countries = [] }      = useCountries()
  const createEnquiry = useCreateEnquiry()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  // Split the same way Payment's own Phone field does — a cosmetic
  // country-code dropdown sourced from the same countries master, plus a
  // raw-digits box. phoneCode is NOT concatenated into `mobile` on save —
  // confirmed via a real validation_error ("Mobile number must contain 7 to
  // 15 digits.") when it was: the backend's mobile field is plain-digits-
  // only (no '+', and apparently no embedded dial code either), matching
  // Payment's own confirmed "raw digits, no country prefix" contract. The
  // dropdown here is purely so the phone number reads naturally next to
  // the box, same as Payment's own COUNTRY_CODES comment already says.
  const [phoneCode, setPhoneCode] = useState('+256')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [dob, setDob]             = useState('')
  const [enquiryDate, setEnquiryDate] = useState(() => todayAtMidnight().slice(0, 10))
  const [intakeGuid, setIntakeGuid]   = useState('')
  const [campusGuid, setCampusGuid]   = useState('')
  const [programGuid, setProgramGuid] = useState('')
  const [sourceGuid, setSourceGuid]   = useState('')
  // Country used to be hardcoded to 'UG' on every create — now a real
  // required field (POST rejects with "'Request Country Guid' must not be
  // empty." otherwise), sourced from the same GET /api/v1/users/countries
  // master Application-Payments and Filing already use (see the note on
  // EnquiryInput.countryGuid in lib/api/admission/enquiry.ts).
  const [countryGuid, setCountryGuid] = useState('')
  const [notes, setNotes]         = useState('')
  const [errors, setErrors]       = useState<Record<string, string>>({})

  // Same "programmes scoped to the selected campus" convention as Payment,
  // Filing, and the On-Desk/Online Enquiry forms — a programme belongs to
  // one campus, so the list is empty/disabled until a Campus is chosen.
  const { data: programsByCampus = [] } = useProgramMastersByCampus(campusGuid, !!campusGuid)

  // Only offer intakes that are actually "live" right now — flagged as the
  // current academic intake and/or the current admission intake — rather
  // than every intake the backend has ever recorded (which includes past
  // ones like "2024 Semester 1"). Falls back to the full list if nothing
  // is currently flagged either way — confirmed the dropdown otherwise goes
  // silently empty (no error, no options) whenever the backend doesn't have
  // any intake marked current, which fully blocks this form with no
  // indication why. Preferring the flagged rows when they exist, but never
  // leaving the picker with zero options, matches the original intent
  // without making the form's usability depend on that flag always being set.
  const currentIntakes = intakes.filter(i => i.currentIntake || i.currentAdmissionIntake)
  const intakeOptions  = (currentIntakes.length ? currentIntakes : intakes).map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` }))
  const campusOptions  = campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))
  const programOptions = programsByCampus.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` }))
  const sourceOptions  = enquirySources.map(s => ({ value: s.enquirySourceGuid, label: s.enquirySourceName }))
  const countryOptions = countries.map(c => ({ value: c.countryGuid, label: c.countryName }))
  // dialCode(), not countryPrefix — see the note on dialCode in
  // lib/api/academic/country.ts for why (countryPrefix isn't a phone
  // prefix at all despite the name). Deduped by dial code (a handful of
  // countries can share one, e.g. +1).
  const phoneCodeOptions = Array.from(
    new Map(countries.map(c => [dialCode(c), `${dialCode(c)} · ${c.countryName}`])).entries(),
  ).map(([value, label]) => ({ value, label }))

  function setCampus(v: string) { setCampusGuid(v); setProgramGuid(''); clearError('campusGuid') }

  // Selecting a Country also points the phone code at that country's own
  // dial code — still just a UX default, freely overridable via the phone
  // code dropdown itself afterwards.
  function selectCountry(guid: string) {
    setCountryGuid(guid)
    clearError('countryGuid')
    const match = countries.find(c => c.countryGuid === guid)
    if (match) setPhoneCode(dialCode(match))
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = 'First Name is required'
    if (!lastName.trim())  e.lastName  = 'Last Name is required'
    if (!phone.trim())     e.phone     = 'Phone is required'
    if (!email.trim())     e.email     = 'Email is required'
    if (!dob)               e.dob       = 'Date of Birth is required'
    if (!enquiryDate)       e.enquiryDate = 'Enquiry Date is required'
    if (!intakeGuid)        e.intakeGuid = 'Please select an Intake'
    if (!campusGuid)        e.campusGuid = 'Please select a Campus'
    if (!sourceGuid)        e.sourceGuid = 'Please select an Enquiry Source'
    if (!countryGuid)       e.countryGuid = 'Please select a Country'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function resetForm() {
    setFirstName(''); setLastName(''); setPhoneCode('+256'); setPhone(''); setEmail(''); setDob('')
    setEnquiryDate(todayAtMidnight().slice(0, 10))
    setIntakeGuid(''); setCampusGuid(''); setProgramGuid(''); setSourceGuid(''); setCountryGuid(''); setNotes('')
    setErrors({})
  }

  function handleSave() {
    if (!validate()) return
    const selectedSource = enquirySources.find(s => s.enquirySourceGuid === sourceGuid)
    createEnquiry.mutate(
      {
        intakeGuid,
        campusGuid,
        enquirySourceGuid: sourceGuid,
        studentName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        enquiryDate: `${enquiryDate}T00:00:00`,
        mobile: phone.trim(),
        email: email.trim() || null,
        countryGuid,
        dob: `${dob}T00:00:00`,
        remarks: notes.trim() || null,
        programGuid: programGuid || null,
        // No Isbat Enquiry Source picker on this form yet — see the note in
        // lib/api/admission/enquiry.ts.
        isbatSourceGuid: null,
        sourceName: selectedSource?.enquirySourceName ?? null,
        enquiryTag: null,
      },
      {
        onSuccess: () => setSaved(true),
        onError: (error: Error) => {
          const code = error instanceof AuthError ? error.code : undefined
          setFailure(error.message || `Failed to save enquiry${code ? ` (${code})` : ''}. Please try again.`)
        },
      },
    )
  }

  function handleSavedClose() {
    setSaved(false)
    resetForm()
  }

  return (
    <div id="page-kiosk-enquiry">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Self-Service Kiosk Enquiry</h1>
          <p className="text-sm text-g500 mt-0.5">Captured at the campus self-service kiosk — candidate-entered</p>
        </div>
        <button className="btn btn-ghost" onClick={() => router.push('/admission/enquiry-list')}><i className="lni lni-arrow-left" /> Enquiry List</button>
      </div>

      <div className="card max-w-3xl">
        <div className="g2">
          <div className="fg">
            <label className="lbl">First Name <span className="text-clr-red">*</span></label>
            <input className="ctrl" placeholder="e.g. Brian" value={firstName} onChange={e => { setFirstName(e.target.value); clearError('firstName') }} style={errors.firstName ? { borderColor: 'var(--red)' } : undefined} />
            {errors.firstName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.firstName}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Last Name <span className="text-clr-red">*</span></label>
            <input className="ctrl" placeholder="e.g. Kamya" value={lastName} onChange={e => { setLastName(e.target.value); clearError('lastName') }} style={errors.lastName ? { borderColor: 'var(--red)' } : undefined} />
            {errors.lastName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.lastName}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Phone <span className="text-clr-red">*</span></label>
            <div className="flex gap-2">
              <SearchSelect options={phoneCodeOptions} value={phoneCode} onChange={setPhoneCode} style={{ width: 108, flexShrink: 0 }} />
              <input className="ctrl flex-1" type="tel" inputMode="numeric" placeholder="7XX XXX XXX" value={phone} onChange={e => { setPhone(sanitizePhoneInput(e.target.value, false)); clearError('phone') }} style={errors.phone ? { borderColor: 'var(--red)' } : undefined} />
            </div>
            {errors.phone && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.phone}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Email <span className="text-clr-red">*</span></label>
            <input className="ctrl" type="email" placeholder="candidate@example.com" value={email} onChange={e => { setEmail(e.target.value); clearError('email') }} style={errors.email ? { borderColor: 'var(--red)' } : undefined} />
            {errors.email && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.email}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Date of Birth <span className="text-clr-red">*</span></label>
            <DatePicker value={dob} onChange={v => { setDob(v); clearError('dob') }} hasError={!!errors.dob} />
            {errors.dob && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.dob}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Enquiry Date <span className="text-clr-red">*</span></label>
            <DatePicker value={enquiryDate} onChange={v => { setEnquiryDate(v); clearError('enquiryDate') }} hasError={!!errors.enquiryDate} />
            {errors.enquiryDate && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryDate}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Campus <span className="text-clr-red">*</span></label>
            <SearchSelect placeholder="— select —" options={campusOptions} value={campusGuid} onChange={setCampus} />
            {errors.campusGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.campusGuid}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Enquiry Source <span className="text-clr-red">*</span></label>
            <SearchSelect placeholder="— select —" options={sourceOptions} value={sourceGuid} onChange={val => { setSourceGuid(val); clearError('sourceGuid') }} />
            {errors.sourceGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.sourceGuid}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Country <span className="text-clr-red">*</span></label>
            <SearchSelect placeholder="— select —" options={countryOptions} value={countryGuid} onChange={selectCountry} />
            {errors.countryGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.countryGuid}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Programme Interest</label>
            <SearchSelect
              placeholder={campusGuid ? '— select —' : 'Select a campus first'}
              options={programOptions}
              value={programGuid}
              onChange={setProgramGuid}
              disabled={!campusGuid}
            />
          </div>
          <div className="fg">
            <label className="lbl">Preferred Intake <span className="text-clr-red">*</span></label>
            <SearchSelect placeholder="— select —" options={intakeOptions} value={intakeGuid} onChange={val => { setIntakeGuid(val); clearError('intakeGuid') }} />
            {errors.intakeGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.intakeGuid}</p>}
          </div>
          {/* Preferred Study Mode had no counterpart on POST /api/v1/admissions/enquiries
              (Full-time/Weekend/Evening/ODL) — dropped rather than collecting data that
              goes nowhere, same as Online Enquiry's own note. */}
          <div className="fg span2">
            <label className="lbl">Enquiry Notes</label>
            <textarea className="ctrl" rows={3} placeholder="Additional notes about the enquiry..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="sec-divider" />
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => router.push('/admission/enquiry-list')}>Cancel</button>
          {permissions.add && (
            <button className="btn btn-primary" disabled={createEnquiry.isPending} onClick={handleSave}>
              {createEnquiry.isPending ? 'Saving…' : 'Save Enquiry'}
            </button>
          )}
        </div>
      </div>

      {saved && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <SuccessPopup title="Enquiry Saved!" subtitle="The enquiry has been recorded successfully." onClose={handleSavedClose} />
          </div>
        </div>
      )}

      {failure && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <FailurePopup title="Couldn't Save Enquiry" subtitle={failure} onClose={() => setFailure(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
