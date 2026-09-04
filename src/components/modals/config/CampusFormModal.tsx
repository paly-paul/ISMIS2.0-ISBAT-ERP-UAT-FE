'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { Campus, CampusInput } from '@/lib/api/academic/campus'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface CampusFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  campus: Campus | null
  createCampus: {
    mutate: (input: CampusInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateCampus: {
    mutate: (variables: { id: string; input: CampusInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function CampusFormModal({ isOpen, onClose, showToast, mode, campus, createCampus, updateCampus }: CampusFormModalProps) {
  const isEdit = mode === 'edit'
  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [campusCode, setCampusCode] = useState('')
  const [campusName, setCampusName] = useState('')
  const [location, setLocation] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && campus) {
      setCampusCode(campus.campusCode)
      setCampusName(campus.campusName)
      setLocation(campus.location)
      setAddress(campus.address ?? '')
      setContact(campus.contact ?? '')
    } else if (!isEdit) {
      setCampusCode(''); setCampusName(''); setLocation(''); setAddress(''); setContact('')
    }
    setErrors({})
  }, [isOpen, isEdit, campus])

  if (!isOpen || (isEdit && !campus)) return null

  function handleClose() { setSaved(false); setFailure(null); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!campusCode.trim()) e.campusCode = 'Campus Code is required'
    if (!campusName.trim()) e.campusName = 'Campus Name is required'
    if (!location.trim())   e.location   = 'Location is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: CampusInput = {
      campusCode,
      campusName,
      location,
      address: address.trim() ? address.trim() : '',
      contact: contact.trim() ? contact.trim() : '',
    }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Campus updated successfully' : 'Campus added successfully') }
    const onError = (error: Error) => {
      // A missing record on edit usually means the campus was deleted while the modal was open.
      const notFound = isEdit && error instanceof AuthError && error.code === 'not_found'
      const code = !isEdit && error instanceof AuthError ? error.code : undefined
      setFailure(
        notFound
          ? 'This campus no longer exists — it may have been deleted.'
          : error.message || `Failed to ${isEdit ? 'update' : 'add'} campus${code ? ` (${code})` : ''}. Please try again.`
      )
    }

    if (isEdit && campus) {
      updateCampus.mutate({ id: campus.campusGuid, input }, { onSuccess, onError })
    } else {
      createCampus.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateCampus.isPending : createCampus.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Campus Updated!' : 'Campus Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new campus has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Campus" : "Couldn't Add Campus"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-campus-modal' : 'new-campus-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-home'}`}></i> {isEdit ? 'Edit Campus' : 'Add Campus'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Campus Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. MKL'}
              maxLength={6}
              value={campusCode}
              onChange={e => { setCampusCode(e.target.value); if (errors.campusCode) setErrors(p => ({ ...p, campusCode: '' })) }}
              style={errors.campusCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.campusCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.campusCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Campus Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Makerere Campus'}
              value={campusName}
              onChange={e => { setCampusName(e.target.value); if (errors.campusName) setErrors(p => ({ ...p, campusName: '' })) }}
              style={errors.campusName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.campusName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.campusName}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Location <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Kampala'}
              value={location}
              onChange={e => { setLocation(e.target.value); if (errors.location) setErrors(p => ({ ...p, location: '' })) }}
              style={errors.location ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.location && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.location}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Address</div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Plot 5, Makerere Hill Road'}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>
          <div className="fg span2">
            <div className="lbl">Contact</div>
            <input
              className="ctrl"
              type="tel"
              inputMode="numeric"
              placeholder={isEdit ? undefined : 'e.g. +256 414 530 000'}
              value={contact}
              onChange={e => setContact(e.target.value.replace(/[^0-9+\s-]/g, ''))}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Campus' : 'Add Campus')}
          </button>
        </div>
      </div>
    </div>
  )
}
