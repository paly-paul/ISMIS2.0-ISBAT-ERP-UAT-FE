'use client'
import { useEffect, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { RichTextEditor, isHtmlEmpty } from '@/components/RichTextEditor'
import { useProgramDropdown } from '@/hooks/academic/useProgramMaster'
import { useAnnouncement, AnnouncementCreateInput, AnnouncementUpdateInput } from '@/hooks/student/useAnnouncementManagement'
import { AuthError } from '@/lib/api/client'
import { openDocumentForViewing } from '@/lib/documentViewer'
import { scrollToFirstError } from '@/lib/scrollToFirstError'

const SUBJECT_MAX = 150

// Add and Edit share this form — differ in prefill and which mutation runs.
// On edit the subject is read-only (immutable server-side) and an existing
// attachment can only be replaced, not removed — PUT has no way to clear it.
interface AnnouncementFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  announcementGuid: string | null
  createAnnouncement: {
    mutate: (input: AnnouncementCreateInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateAnnouncement: {
    mutate: (variables: { guid: string; input: AnnouncementUpdateInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function AnnouncementFormModal({ isOpen, onClose, showToast, mode, announcementGuid, createAnnouncement, updateAnnouncement }: AnnouncementFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: programs = [], isLoading: programsLoading } = useProgramDropdown(undefined, isOpen)
  const { data: announcement, isLoading, isError, error } = useAnnouncement(announcementGuid, isOpen && isEdit)

  const [subject, setSubject] = useState('')
  const [programGuid, setProgramGuid] = useState('')
  const [announceDate, setAnnounceDate] = useState('')
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fill the form when the announcement loads on edit; blank on fresh create.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && announcement) {
      setSubject(announcement.subject ?? '')
      setProgramGuid(announcement.isGlobal ? '' : announcement.programGuid ?? '')
      setAnnounceDate(announcement.announceDate)
      setBody(announcement.announcementBody ?? '')
      setAttachment(null)
      setErrors({})
    } else if (!isEdit) {
      setSubject(''); setProgramGuid(''); setAnnounceDate(''); setBody(''); setAttachment(null); setErrors({})
    }
  }, [isOpen, isEdit, announcement])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setSubject(''); setProgramGuid(''); setAnnounceDate(''); setBody(''); setAttachment(null); setErrors({})
    onClose()
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // The backend rejects files without an extension (see post-create-announcement.md).
    if (!/\.[^./\\]+$/.test(file.name)) {
      showToast('Attachment must have a file extension', 'error')
      return
    }
    setAttachment(file)
  }

  function viewExistingAttachment(url: string) {
    openDocumentForViewing(url).catch(() => showToast('Failed to open attachment', 'error'))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!isEdit) {
      if (!subject.trim()) e.subject = 'Subject is required'
      else if (subject.trim().length > SUBJECT_MAX) e.subject = `Subject must be ${SUBJECT_MAX} characters or fewer`
    }
    if (!announceDate) e.announceDate = 'Visible Upto is required'
    if (isHtmlEmpty(body)) e.body = 'Announcement is required'
    setErrors(e)
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: AnnouncementUpdateInput = { body, announceDate, programGuid: programGuid || null, attachment }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Announcement updated successfully' : 'Announcement added successfully') }
    const onError = (error: Error) => {
      const code = error instanceof AuthError ? error.code : undefined
      setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} announcement${code ? ` (${code})` : ''}. Please try again.`)
    }

    if (isEdit && announcementGuid) {
      updateAnnouncement.mutate({ guid: announcementGuid, input }, { onSuccess, onError })
    } else {
      createAnnouncement.mutate({ ...input, subject: subject.trim() }, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateAnnouncement.isPending : createAnnouncement.isPending
  const existingAttachmentUrl = isEdit ? announcement?.attachmentUrl ?? null : null

  const programOptions = [
    { value: '', label: 'All Programmes' },
    ...programs.map(p => ({ value: p.programGuid, label: `${p.programCode} — ${p.programName}` })),
  ]

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Announcement Updated!' : 'Announcement Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new announcement has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Announcement" : "Couldn't Add Announcement"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Announcement"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load announcement details.') : 'Failed to load announcement details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !announcement)) {
    return (
      <div className="modal-overlay open" id="edit-announcement-modal">
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Announcement</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading announcement details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-announcement-modal' : 'new-announcement-modal'}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-bullhorn'}`}></i> {isEdit ? 'Edit Announcement' : 'Add Announcement'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Subject {!isEdit && <span className="req">*</span>}</div>
            <input
              className="ctrl"
              type="text"
              placeholder="e.g. Board Chairman's Message"
              maxLength={SUBJECT_MAX}
              value={subject}
              readOnly={isEdit}
              title={isEdit ? 'Subject cannot be changed after creation' : undefined}
              onChange={e => { setSubject(e.target.value); clearError('subject') }}
              style={errors.subject ? { borderColor: 'var(--red)' } : isEdit ? { background: 'var(--g100)', color: 'var(--g500)' } : undefined}
            />
            {errors.subject && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.subject}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Visible Upto <span className="req">*</span></div>
            <DatePicker value={announceDate} onChange={v => { setAnnounceDate(v); clearError('announceDate') }} hasError={!!errors.announceDate} />
            {errors.announceDate && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.announceDate}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Programme</div>
            <SearchSelect
              placeholder="All Programmes"
              value={programGuid}
              onChange={setProgramGuid}
              options={programOptions}
              isLoading={programsLoading}
            />
          </div>
          <div className="fg span2">
            <div className="lbl">Announcement <span className="req">*</span></div>
            <RichTextEditor value={body} onChange={v => { setBody(v); clearError('body') }} placeholder="Type the announcement here…" minHeight={180} />
            {errors.body && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.body}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Attachment (optional)</div>
            {attachment ? (
              <div className="flex items-center gap-2" style={{ padding: '8px 12px', border: '1px solid var(--g200)', borderRadius: 'var(--rsm)' }}>
                <i className="lni lni-files" style={{ color: 'var(--g500)' }}></i>
                <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
                <button type="button" className="btn btn-neu btn-sm" onClick={() => fileInputRef.current?.click()}>Replace</button>
                <button type="button" className="btn btn-neu btn-sm" title={existingAttachmentUrl ? 'Keep the current attachment' : 'Remove'} onClick={() => setAttachment(null)}>
                  <i className="lni lni-trash-can"></i>
                </button>
              </div>
            ) : existingAttachmentUrl ? (
              <div className="flex items-center gap-2" style={{ padding: '8px 12px', border: '1px solid var(--g200)', borderRadius: 'var(--rsm)' }}>
                <i className="lni lni-paperclip" style={{ color: 'var(--g500)' }}></i>
                <span style={{ flex: 1, fontSize: 13 }}>Current attachment</span>
                <button type="button" className="btn btn-neu btn-sm" onClick={() => viewExistingAttachment(existingAttachmentUrl)}>View</button>
                <button type="button" className="btn btn-neu btn-sm" onClick={() => fileInputRef.current?.click()}>Replace</button>
              </div>
            ) : (
              <button type="button" className="btn btn-neu" onClick={() => fileInputRef.current?.click()}>
                <i className="lni lni-paperclip"></i> Choose file…
              </button>
            )}
            <input ref={fileInputRef} type="file" onChange={handleAttachmentChange} style={{ display: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Announcement' : 'Add Announcement')}
          </button>
        </div>
      </div>
    </div>
  )
}
