'use client'
import { useEffect, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { EnquiryFollowUpInput } from '@/lib/api/admission/enquiryFollowUp'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useFollowUpStatuses } from '@/hooks/config/useFollowUpStatuses'
import { useFollowUpModes } from '@/hooks/admission/useFollowUpModes'
import { useEnquiryStatuses } from '@/hooks/config/useEnquiryStatuses'
import { useInterestLevels } from '@/hooks/admission/useInterestLevels'
import { useEnquiryFollowUpsInfinite } from '@/hooks/admission/useEnquiryFollowUps'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import { AuthError } from '@/lib/api/client'
import { getSessionIdentity, getLoggedInUserGuid } from '@/lib/session'

export interface InitialFollowUpData {
  enquiryGuid?: string
  enquiryCode?: string
  studentName?: string
  enquiryStatusName?: string | null
  followUpStatusName?: string | null
  nextFollowDate?: string | null
}

interface NewFollowUpLogModalProps extends ModalProps {
  createFollowUp: {
    mutate: (input: EnquiryFollowUpInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  initialData?: InitialFollowUpData | null
}

const ENQUIRY_PICKER_PAGE_SIZE = 20

// Enquiry picker — scroll-to-load-more (via useEnquiryFollowUpsInfinite)
// instead of a SearchSelect over a capped 1000-row snapshot. The picker
// stores and submits the selected enquiry's real GUID. Reuses SearchSelect's
// own CSS classes (.ss-trigger, .ss-opts, etc.) for a matching look without
// duplicating its styles. The search box here only filters what's already
// loaded, client-side.
function EnquiryPicker({
  value,
  onChange,
  enabled,
  hasError,
  initialLabel,
}: {
  value: string
  onChange: (v: string) => void
  enabled: boolean
  hasError?: boolean
  initialLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useEnquiryFollowUpsInfinite(ENQUIRY_PICKER_PAGE_SIZE, enabled)

  const allItems = data?.pages.flatMap(p => p.items) ?? []
  const selected = value ? allItems.find(item => item.enquiryGuid === value) : undefined

  const term = filterText.trim().toLowerCase()
  const filtered = allItems
    .map((item, absIndex) => ({ item, absIndex }))
    .filter(({ item }) => !term || `${item.enquiryCode} ${item.studentName}`.toLowerCase().includes(term))

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  function pick(enquiryGuid: string) {
    onChange(enquiryGuid)
    setOpen(false)
    setFilterText('')
  }

  const label = selected
    ? `${selected.enquiryCode} — ${selected.studentName}`
    : (value && initialLabel ? initialLabel : '— select an enquiry —')

  const isPlaceholder = !selected && !(value && initialLabel)

  return (
    <div style={{ position: 'relative' }} ref={boxRef}>
      <button
        type="button"
        className="ctrl ss-trigger"
        onClick={() => setOpen(o => !o)}
        style={hasError ? { borderColor: 'var(--red)' } : undefined}
      >
        <span className={`ss-label${isPlaceholder ? ' ss-placeholder' : ''}`}>
          {label}
        </span>
        <i className="lni lni-chevron-down ss-chevron" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div
          className="ss-drop mt-1"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30 }}
        >
          <div className="ss-search">
            <input
              className="ctrl"
              style={{ fontSize: 12, height: 28, padding: '4px 8px' }}
              placeholder="Search loaded enquiries…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="ss-opts" style={{ maxHeight: 200 }} onScroll={handleScroll}>
            {isFetching && allItems.length === 0 ? (
              <div className="ss-no-match">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="ss-no-match">
                {term ? 'No matches among loaded enquiries — keep scrolling to load more.' : 'No enquiries found.'}
              </div>
            ) : (
              <>
                {filtered.map(({ item }) => (
                  <div
                    key={item.enquiryGuid}
                    className={`col-filter-opt${value === item.enquiryGuid ? ' fil-active' : ''}`}
                    onClick={() => pick(item.enquiryGuid)}
                  >
                    {item.enquiryCode} — {item.studentName}
                  </div>
                ))}
                {isFetchingNextPage && <div className="ss-no-match">Loading more…</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// The API checks follow-up dates against today's *UTC* date
// (post-enquiry-followup.md) — not the local one, which in Uganda (UTC+3) is
// a day ahead between midnight and 03:00.
function todayUtcYmd() {
  return new Date().toISOString().slice(0, 10)
}

const REMARKS_MAX = 300

export function NewFollowUpLogModal({ isOpen, onClose, showToast, createFollowUp, initialData }: NewFollowUpLogModalProps) {
  const { data: followUpStatuses = [] } = useFollowUpStatuses(isOpen)
  const { data: followUpModes = [] }   = useFollowUpModes(isOpen)
  const { data: enquiryStatuses = [] } = useEnquiryStatuses(isOpen)
  const { data: interestLevels = [] }  = useInterestLevels(isOpen)
  const { data: employees = [] }      = useEmployees(isOpen)

  const followUpStatusOptions = followUpStatuses.map(s => ({ value: s.followUpStatusGuid, label: s.followUpStatusName }))
  const followUpModeOptions   = followUpModes.map(m => ({ value: m.followUpModeGuid, label: m.followUpModeName }))
  const enquiryStatusOptions  = enquiryStatuses.map(s => ({ value: s.enquiryStatusGuid, label: s.enquiryStatusName }))
  const interestLevelOptions  = interestLevels.map(l => ({ value: l.interestLevelGuid, label: l.interestLevelName }))

  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [enquiryGuid, setEnquiryGuid]               = useState('')
  const [advisorGuid, setAdvisorGuid]               = useState('')
  const [advisorName, setAdvisorName]               = useState('')
  const [followUpStatusGuid, setFollowUpStatusGuid] = useState('')
  const [followUpModeGuid, setFollowUpModeGuid]     = useState('')
  const [enquiryStatusGuid, setEnquiryStatusGuid]   = useState('')
  const [interestLevelGuid, setInterestLevelGuid]   = useState('')
  const [nextFollowDate, setNextFollowDate]         = useState('')
  const [remarks, setRemarks]                       = useState('')
  const [errors, setErrors]                         = useState<Record<string, string>>({})

  // Follow-up date isn't a choice — the API only accepts today.
  const today = todayUtcYmd()
  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // Resolve advisor identity & UUID from session and employee list
  useEffect(() => {
    if (!isOpen) return
    const identity = getSessionIdentity()
    const name = identity?.displayName?.trim() || ''

    let guid =
      getLoggedInUserGuid() ||
      identity?.employeeGuid ||
      identity?.userGuid ||
      identity?.uuid ||
      identity?.userId ||
      ''

    if (employees.length > 0) {
      if (name) {
        const matched = employees.find(e =>
          e.empName?.trim().toLowerCase() === name.toLowerCase() ||
          e.empName?.trim().toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(e.empName?.trim().toLowerCase())
        )
        if (matched) {
          if (!guid) guid = matched.employeeGuid
          setAdvisorName(matched.empName)
        } else {
          setAdvisorName(name)
        }
      } else if (!guid) {
        guid = employees[0].employeeGuid
        setAdvisorName(employees[0].empName)
      }
    } else if (name) {
      setAdvisorName(name)
    }

    if (guid) {
      setAdvisorGuid(guid)
    }
  }, [isOpen, employees])

  // Handle initial data prefilling when opened from a row
  useEffect(() => {
    if (!isOpen) return
    if (initialData?.enquiryGuid) {
      setEnquiryGuid(initialData.enquiryGuid)
    }
    if (initialData?.nextFollowDate) {
      const ymd = initialData.nextFollowDate.slice(0, 10)
      if (ymd >= today) {
        setNextFollowDate(ymd)
      }
    }
  }, [isOpen, initialData, today])

  // Resolve matching enquiry status and follow-up status from initial data
  useEffect(() => {
    if (!isOpen || !initialData) return
    if (initialData.enquiryStatusName && enquiryStatuses.length > 0) {
      const matched = enquiryStatuses.find(s =>
        s.enquiryStatusName.trim().toLowerCase() === initialData.enquiryStatusName?.trim().toLowerCase()
      )
      if (matched) setEnquiryStatusGuid(matched.enquiryStatusGuid)
    }
    if (initialData.followUpStatusName && followUpStatuses.length > 0) {
      const matched = followUpStatuses.find(s =>
        s.followUpStatusName.trim().toLowerCase() === initialData.followUpStatusName?.trim().toLowerCase()
      )
      if (matched) setFollowUpStatusGuid(matched.followUpStatusGuid)
    }
  }, [isOpen, initialData, enquiryStatuses, followUpStatuses])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setEnquiryGuid('')
    setFollowUpStatusGuid(''); setFollowUpModeGuid(''); setEnquiryStatusGuid(''); setInterestLevelGuid('')
    setNextFollowDate(''); setRemarks(''); setErrors({})
    onClose()
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    // Any GUID shape: a version/variant-strict pattern rejected real
    // database GUIDs that aren't RFC v1–v5 (e.g. sequential ones).
    if (!enquiryGuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(enquiryGuid)) {
      e.enquiryIdx = 'Please select a valid Enquiry'
    }
    const finalAdvisorGuid = advisorGuid || (employees.length > 0 ? employees[0].employeeGuid : '')
    if (!finalAdvisorGuid) {
      e.advisorGuid = 'Advisor identity could not be resolved from your account'
    }
    if (!followUpStatusGuid) e.followUpStatusGuid = 'Please select a Follow-up Status'
    if (!followUpModeGuid)   e.followUpModeGuid = 'Please select a Follow-up Mode'
    if (!enquiryStatusGuid)  e.enquiryStatusGuid = 'Please select an Enquiry Status'
    if (nextFollowDate && nextFollowDate < today) e.nextFollowDate = `Next follow-up date can’t be before the follow-up date (${todayLabel})`
    if (!remarks.trim())     e.remarks = 'Remarks are required'
    else if (remarks.trim().length > REMARKS_MAX) e.remarks = `Remarks can be at most ${REMARKS_MAX} characters`
    setErrors(e)
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const finalAdvisorGuid = advisorGuid || (employees.length > 0 ? employees[0].employeeGuid : '')
    createFollowUp.mutate(
      {
        enquiryGuid,
        advisorGuid: finalAdvisorGuid,
        followUpDate: `${today}T00:00:00`,
        followUpStatusGuid,
        followUpModeGuid,
        enquiryStatusGuid,
        interestLevelGuid: interestLevelGuid || null,
        nextFollowDate: nextFollowDate ? `${nextFollowDate}T00:00:00` : null,
        remarks: remarks.trim(),
      },
      {
        onSuccess: () => { setSaved(true); showToast('Follow-up logged successfully') },
        onError: (error: Error) => {
          // Documented create errors that belong to one field, by message.
          const code = error instanceof AuthError ? error.code : undefined
          const msg = error.message || ''
          const field =
            code === 'not_found' && /^enquiry not found/i.test(msg) ? 'enquiryIdx'
            : code === 'not_found' && /^follow-up status/i.test(msg) ? 'followUpStatusGuid'
            : code === 'not_found' && /^follow-up mode/i.test(msg) ? 'followUpModeGuid'
            : code === 'not_found' && /^enquiry status/i.test(msg) ? 'enquiryStatusGuid'
            : code === 'not_found' && /^interest level/i.test(msg) ? 'interestLevelGuid'
            : code === 'validation_error' && /next follow-up date/i.test(msg) ? 'nextFollowDate'
            : code === 'validation_error' && /remarks/i.test(msg) ? 'remarks'
            : null
          if (field) {
            const e = { [field]: msg }
            setErrors(prev => ({ ...prev, ...e }))
            scrollToFirstError(e)
            return
          }
          // "Follow-up date must be today's date." can only happen if the
          // modal stayed open across midnight UTC; reopening fixes it.
          setFailure(/follow-up date must be today/i.test(msg)
            ? 'The day changed while this form was open. Close it, reopen, and save again.'
            : msg || 'Failed to log follow-up. Please try again.')
        },
      },
    )
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Follow-up Logged!" subtitle="The follow-up has been saved successfully." onClose={handleClose} />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Couldn't Log Follow-up" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="new-followup-log-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-phone"></i> Log Follow-up</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g2">
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <div className="lbl">Enquiry <span className="req">*</span></div>
            <EnquiryPicker
              value={enquiryGuid}
              onChange={v => { setEnquiryGuid(v); clearError('enquiryIdx') }}
              enabled={isOpen}
              hasError={!!errors.enquiryIdx}
              initialLabel={initialData?.enquiryCode && initialData?.studentName ? `${initialData.enquiryCode} — ${initialData.studentName}` : undefined}
            />
            {errors.enquiryIdx && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryIdx}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Advisor <span className="req">*</span></div>
            <div className="inp-wrap">
              <i className="lni lni-user inp-icon"></i>
              <input
                className="ctrl"
                value={advisorName || getSessionIdentity()?.displayName || '—'}
                readOnly
                tabIndex={-1}
                style={{ cursor: 'default', fontWeight: 600, background: '#f8fafc' }}
                title="Advisor is automatically set to your logged-in account"
              />
            </div>
            {errors.advisorGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.advisorGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Follow-up Date</div>
            {/* Locked to today — same read-only lock style as the current-intake fields. */}
            <div className="inp-wrap">
              <i className="lni lni-lock-alt inp-icon"></i>
              <input className="ctrl" value={todayLabel} readOnly tabIndex={-1} style={{ cursor: 'default', fontWeight: 600, background: '#f8fafc' }} title="A follow-up is always logged for today" />
            </div>
          </div>
          <div className="fg">
            <div className="lbl">Follow-up Status <span className="req">*</span></div>
            <SearchSelect placeholder="— select —" options={followUpStatusOptions} value={followUpStatusGuid} onChange={v => { setFollowUpStatusGuid(v); clearError('followUpStatusGuid') }} />
            {errors.followUpStatusGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followUpStatusGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Follow-up Mode <span className="req">*</span></div>
            <SearchSelect placeholder="— select —" options={followUpModeOptions} value={followUpModeGuid} onChange={v => { setFollowUpModeGuid(v); clearError('followUpModeGuid') }} />
            {errors.followUpModeGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followUpModeGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Enquiry Status <span className="req">*</span></div>
            <SearchSelect placeholder="— select —" options={enquiryStatusOptions} value={enquiryStatusGuid} onChange={v => { setEnquiryStatusGuid(v); clearError('enquiryStatusGuid') }} />
            {errors.enquiryStatusGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryStatusGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Interest Level</div>
            <SearchSelect placeholder="— optional —" options={interestLevelOptions} value={interestLevelGuid} onChange={v => { setInterestLevelGuid(v); clearError('interestLevelGuid') }} />
            {errors.interestLevelGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.interestLevelGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Next Follow-up Date</div>
            {/* Can't be before this follow-up's own date (always today — see
                followUpDate in handleSave). Same day is allowed. */}
            <DatePicker
              value={nextFollowDate}
              onChange={v => { setNextFollowDate(v); setErrors(p => ({ ...p, nextFollowDate: '' })) }}
              minYmd={today}
              rangeMessage={`Next follow-up date can’t be before the follow-up date (${todayLabel})`}
              hasError={!!errors.nextFollowDate}
            />
            {errors.nextFollowDate && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.nextFollowDate}</p>}
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <div className="lbl">Remarks <span className="req">*</span> <span className="text-g400" style={{ fontWeight: 400 }}>({remarks.trim().length}/{REMARKS_MAX})</span></div>
            <textarea className="ctrl" rows={3} maxLength={REMARKS_MAX} placeholder="e.g. Called student, interested in Diploma program." value={remarks} onChange={e => { setRemarks(e.target.value); clearError('remarks') }} />
            {errors.remarks && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.remarks}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={createFollowUp.isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {createFollowUp.isPending ? 'Saving…' : 'Save Follow-up'}
          </button>
        </div>
      </div>
    </div>
  )
}
