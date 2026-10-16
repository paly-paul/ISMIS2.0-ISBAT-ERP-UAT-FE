
'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import DatePicker from '@/components/DatePicker'
import { EventInput, eventDateToYmd, ymdToEventDate } from '@/lib/api/student/eventManagement'
import { useEvent } from '@/hooks/student/useEventManagement'
import { AuthError } from '@/lib/api/client'
import { scrollToFirstError } from '@/lib/scrollToFirstError'

const SUBJECT_MAX = 100
const BODY_MAX = 5000

// Add and Edit share this form — differ in prefill and which mutation runs.
// Field labels follow the legacy "Event Management" screen ("Topic"/"Event")
// even though the real API's field names are subject/eventBody — see
// events/get-events.md etc.
interface EventFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  eventGuid: string | null
  createEvent: {
    mutate: (input: EventInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateEvent: {
    mutate: (variables: { guid: string; input: EventInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function EventFormModal({ isOpen, onClose, showToast, mode, eventGuid, createEvent, updateEvent }: EventFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: event, isLoading, isError, error } = useEvent(eventGuid, isOpen && isEdit)

  const [subject, setSubject] = useState('')
  const [eventDateYmd, setEventDateYmd] = useState('')
  const [eventBody, setEventBody] = useState('')
  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  // Fill the form when the event loads on edit; blank on fresh create.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && event) {
      setSubject(event.subject ?? '')
      setEventDateYmd(eventDateToYmd(event.eventDate))
      setEventBody(event.eventBody ?? '')
      setErrors({})
    } else if (!isEdit) {
      setSubject(''); setEventDateYmd(''); setEventBody(''); setErrors({})
    }
  }, [isOpen, isEdit, event])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setSubject(''); setEventDateYmd(''); setEventBody(''); setErrors({})
    onClose()
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!subject.trim()) e.subject = 'Topic is required'
    else if (subject.trim().length > SUBJECT_MAX) e.subject = `Topic must be ${SUBJECT_MAX} characters or fewer`
    if (!eventDateYmd) e.eventDateYmd = 'Event Date is required'
    if (!eventBody.trim()) e.eventBody = 'Event is required'
    else if (eventBody.trim().length > BODY_MAX) e.eventBody = `Event must be ${BODY_MAX} characters or fewer`
    setErrors(e)
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: EventInput = { subject: subject.trim(), eventBody: eventBody.trim(), eventDate: ymdToEventDate(eventDateYmd) }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Event updated successfully' : 'Event added successfully') }
    const onError = (error: Error) => {
      const code = error instanceof AuthError ? error.code : undefined
      setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} event${code ? ` (${code})` : ''}. Please try again.`)
    }

    if (isEdit && eventGuid) {
      updateEvent.mutate({ guid: eventGuid, input }, { onSuccess, onError })
    } else {
      createEvent.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateEvent.isPending : createEvent.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Event Updated!' : 'Event Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new event has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Event" : "Couldn't Add Event"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Event"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load event details.') : 'Failed to load event details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !event)) {
    return (
      <div className="modal-overlay open" id="edit-event-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Event</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading event details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-event-modal' : 'new-event-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-calendar'}`}></i> {isEdit ? 'Edit Event' : 'Add Event'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Topic <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder="e.g. Commencement of Term II Examinations"
              maxLength={SUBJECT_MAX}
              value={subject}
              onChange={e => { setSubject(e.target.value); clearError('subject') }}
              style={errors.subject ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.subject && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.subject}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Event Date <span className="req">*</span></div>
            <DatePicker value={eventDateYmd} onChange={v => { setEventDateYmd(v); clearError('eventDateYmd') }} hasError={!!errors.eventDateYmd} />
            {errors.eventDateYmd && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.eventDateYmd}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Event <span className="req">*</span></div>
            <textarea
              className="ctrl"
              rows={4}
              placeholder="e.g. Commencement of Term II Examinations"
              maxLength={BODY_MAX}
              value={eventBody}
              onChange={e => { setEventBody(e.target.value); clearError('eventBody') }}
              style={errors.eventBody ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.eventBody && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.eventBody}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Event' : 'Add Event')}
          </button>
        </div>
      </div>
    </div>
  )
}
