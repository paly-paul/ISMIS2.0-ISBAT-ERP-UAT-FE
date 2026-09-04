'use client'
import { useState, useEffect } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { AuthError } from '@/lib/api/client'
import { useIntake } from '@/hooks/academic/useIntakes'

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

interface ViewIntakeModalProps extends ModalProps {
  intakeGuid: string | null
  onEdit?: () => void
}

export function ViewIntakeModal({ isOpen, onClose, showToast, intakeGuid, onEdit }: ViewIntakeModalProps) {
  const { data: intake, isLoading, isError, error } = useIntake(intakeGuid, isOpen)

  const [description, setDescription]     = useState('')
  const [financialYear, setFinancialYear] = useState('')
  const [examYear, setExamYear]           = useState('')
  const [examMonth, setExamMonth]         = useState('')
  const [intakeSeq, setIntakeSeq]         = useState('')
  const [currentIntake, setCurrentIntake]                 = useState(false)
  const [currentAdmissionIntake, setCurrentAdmissionIntake] = useState(false)
  const [lastDateForReRegistration, setLastDateForReRegistration] = useState('')
  const [grievanceStartDate, setGrievanceStartDate] = useState('')
  const [grievanceEndDate, setGrievanceEndDate]     = useState('')

  const [calendarEntries, setCalendarEntries] = useState<CalendarEntryForm[]>([])
  const [activeSection, setActiveSection] = useState<'basic' | 'semesters'>('basic')
  const [semesterAccordion, setSemesterAccordion] = useState(0)

  // The API returns full datetime values, so the form strips the time portion for date fields.
  function toDateInputValue(value: string | null | undefined): string {
    if (!value) return ''
    return value.includes('T') ? value.split('T')[0] : value
  }

  // Fill the form when the intake data loads.
  useEffect(() => {
    if (!isOpen || !intake) return

    setDescription(intake.description)
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
    setActiveSection('basic')
    setSemesterAccordion(0)

  }, [isOpen, intake])

  // Estimate the visible duration in weeks from the first semester's dates
  function calcDurationWeeks(): number | null {
    const first = calendarEntries[0]
    if (!first?.semStart || !first?.term2End) return null
    const ms = new Date(first.term2End).getTime() - new Date(first.semStart).getTime()
    return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24 * 7)) : null
  }

  function calcDuration() {
    const weeks = calcDurationWeeks()
    return weeks === null ? '' : String(weeks)
  }

  if (!isOpen) return null

  function handleClose() {
    setActiveSection('basic')
    onClose()
  }

  if (isError) {
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

  if (isLoading || !intake) {
    return (
      <div className="modal-overlay open" id="intake-view-modal">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Intake</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div className="modal-scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <span style={{ color: 'var(--g400)' }}>Loading intake details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="intake-view-modal">
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Intake — <span className="font-mono">{intake.intakeCode}</span></div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Horizontal Tabs */}
          <div style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--g200)', 
            padding: '0 24px', 
            gap: 0,
            background: '#fafafa',
            flexShrink: 0
          }}>
            <div
              onClick={() => setActiveSection('basic')}
              style={{
                flex: 1, justifyContent: 'center',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '16px 0',
                background: activeSection === 'basic' ? 'var(--b50)' : 'transparent',
                borderBottom: activeSection === 'basic' ? '2px solid var(--b500)' : '2px solid transparent',
                color: activeSection === 'basic' ? 'var(--b700)' : 'var(--g600)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer', transition: 'all .15s'
              }}
            >
              <i className="lni lni-information" style={{ fontSize: 16 }}></i>
              Basic Details
            </div>
            
            <div
              onClick={() => setActiveSection('semesters')}
              style={{
                flex: 1, justifyContent: 'center',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '16px 0',
                background: activeSection === 'semesters' ? 'var(--b50)' : 'transparent',
                borderBottom: activeSection === 'semesters' ? '2px solid var(--b500)' : '2px solid transparent',
                color: activeSection === 'semesters' ? 'var(--b700)' : 'var(--g600)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer', transition: 'all .15s'
              }}
            >
              <i className="lni lni-calendar" style={{ fontSize: 16 }}></i>
              Planning Calendar
            </div>
          </div>

          <div className="modal-scroll" style={{ padding: '24px', flex: 1, overflowY: 'auto', background: '#fff' }}>
            {activeSection === 'basic' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: '20px', columnGap: '24px' }}>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Description</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{description || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Financial Year</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{financialYear || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Exam Year</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{examYear || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Exam Month</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{MONTHS.find(m => m.value === String(examMonth))?.label || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Intake Sequence</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{INTAKE_SEQUENCES.find(s => s.value === String(intakeSeq))?.label || '—'}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Set As</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    {currentIntake ? <span className="badge badge-green">Academic Intake</span> : <span className="badge badge-neu">Not Academic Intake</span>}
                    {currentAdmissionIntake ? <span className="badge badge-green">Admission Intake</span> : <span className="badge badge-neu">Not Admission Intake</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Last Date for Re-registration</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{lastDateForReRegistration || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Grievance Start Date</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{grievanceStartDate || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Grievance End Date</div>
                  <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{grievanceEndDate || '—'}</div>
                </div>
              </div>
            )}
            
            {activeSection === 'semesters' && (
              <div className="flex flex-col gap-2">
                {calendarEntries.length === 0 && (
                  <div className="text-g400 italic text-sm mt-4">No planning calendars set for this intake.</div>
                )}
                {calendarEntries.map((active, si) => {
                  const isOpen = semesterAccordion === si;
                  return (
                    <div key={active.id} style={{ border: '1.5px solid var(--b100)', borderRadius: 'var(--rsm)', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => setSemesterAccordion(isOpen ? -1 : si)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', background: isOpen ? 'var(--b50)' : 'var(--white)', border: 'none', borderBottom: isOpen ? '1px solid var(--b100)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                      >
                        <span className="badge badge-blue" style={{ flexShrink: 0 }}>Sem {si + 1}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--b700)' }}>Planning Calendar</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--g400)', marginRight: 8 }}>{active.semStart ? `Starts ${active.semStart}` : 'No dates set'}</span>
                        <i className="lni lni-chevron-down" style={{ fontSize: 11, color: 'var(--g400)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                      </button>
                      <div style={{ overflow: 'hidden', maxHeight: isOpen ? 1200 : 0, transition: 'max-height 0.3s ease' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: '20px', columnGap: '24px', padding: 24 }}>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Admission Start Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.admissionStartDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Admission Late Fee Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.admissionLateFeeDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Admission End Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.admissionEndDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Re-entry Start Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.reentryStartDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Re-entry Late Fee Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.reentryLateFeeDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Re-entry End Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.reentryEndDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Semester/Term 1 Start Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.semStart || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Lump Sum Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.lumpsumDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Term 1 End Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.term1EndDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Term 2 Start Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.term2StartDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Semester/Term 2 End Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.term2End || '—'}</div>
                          </div>
                          {si === 0 && (
                            <div>
                              <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Duration (weeks)</div>
                              <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{calcDuration() || '—'}</div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Resit Start Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.resitStartDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Resit End Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.resitEndDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Final Exam Start Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.finalExamStartDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Final Exam End Date</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.finalExamEndDate || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--g500)', letterSpacing: '0.04em', marginBottom: '4px' }}>Clearance Date (80%)</div>
                            <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{active.clearanceDate || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--g200)' }}>
          <span className="flex-1"></span>
          {onEdit && (
            <button className="btn btn-neu" onClick={onEdit} style={{ marginRight: 8 }}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
