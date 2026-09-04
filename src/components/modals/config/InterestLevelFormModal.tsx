'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { InterestLevelInput } from '@/lib/api/admission/interestLevel'
import { useInterestLevel } from '@/hooks/admission/useInterestLevels'
import { AuthError } from '@/lib/api/client'

interface InterestLevelFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  interestLevelGuid: string | null
  createInterestLevel: {
    mutate: (input: InterestLevelInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateInterestLevel: {
    mutate: (variables: { guid: string; input: InterestLevelInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function InterestLevelFormModal({ isOpen, onClose, showToast, mode, interestLevelGuid, createInterestLevel, updateInterestLevel }: InterestLevelFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: level, isLoading, isError, error } = useInterestLevel(isEdit ? interestLevelGuid : null, isOpen && isEdit)

  const [saved, setSaved]                         = useState(false)
  const [failure, setFailure]                     = useState<string | null>(null)
  const [interestLevelName, setInterestLevelName] = useState('')
  const [errors, setErrors]                       = useState<Record<string, string>>({})

  // Prefill once the level loads; re-runs per guid since react-query resets `level` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && level) {
      setInterestLevelName(level.interestLevelName)
    } else if (!isEdit) {
      setInterestLevelName('')
    }
    setErrors({})
  }, [isOpen, isEdit, level])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!interestLevelName.trim()) e.interestLevelName = 'Interest Level Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: InterestLevelInput = { interestLevelName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Interest level updated successfully' : 'Interest level added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} interest level. Please try again.`)

    if (isEdit && interestLevelGuid) {
      updateInterestLevel.mutate({ guid: interestLevelGuid, input }, { onSuccess, onError })
    } else {
      createInterestLevel.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateInterestLevel.isPending : createInterestLevel.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Interest Level Updated!' : 'Interest Level Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new interest level has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Interest Level" : "Couldn't Add Interest Level"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Interest Level"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load interest level details.') : 'Failed to load interest level details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !level)) {
    return (
      <div className="modal-overlay open" id="edit-interest-level-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Interest Level</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading interest level details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-interest-level-modal' : 'new-interest-level-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-signal'}`}></i> {isEdit ? 'Edit Interest Level' : 'Add Interest Level'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Interest Level Name <span className="req">*</span></div>
          <input
            className="ctrl"
            type="text"
            placeholder={isEdit ? undefined : 'e.g. High'}
            value={interestLevelName}
            onChange={e => { setInterestLevelName(e.target.value); clearError('interestLevelName') }}
            style={errors.interestLevelName ? { borderColor: 'var(--red)' } : undefined}
          />
          {errors.interestLevelName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.interestLevelName}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Interest Level' : 'Add Interest Level')}
          </button>
        </div>
      </div>
    </div>
  )
}
