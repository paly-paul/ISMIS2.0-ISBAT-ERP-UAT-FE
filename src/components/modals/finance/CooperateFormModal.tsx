'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { CooperateInput } from '@/lib/api/finance/cooperate'
import { useCooperate } from '@/hooks/finance/useCooperates'
import { AuthError } from '@/lib/api/client'
import { scrollToFirstError } from '@/lib/scrollToFirstError'

// Create/UpdateCooperateCommandValidator (post-cooperate.md, put-cooperate.md).
const CODE_MAX = 10
const NAME_MAX = 100

// Add and Edit share this form — differ in prefill and which mutation runs.
interface CooperateFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  cooperateGuid: string | null
  createCooperate: {
    mutate: (input: CooperateInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateCooperate: {
    mutate: (variables: { guid: string; input: CooperateInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function CooperateFormModal({ isOpen, onClose, showToast, mode, cooperateGuid, createCooperate, updateCooperate }: CooperateFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: cooperate, isLoading, isError, error } = useCooperate(isEdit ? cooperateGuid : null, isEdit && isOpen)

  const [saved, setSaved]                 = useState(false)
  const [failure, setFailure]             = useState<string | null>(null)
  const [cooperateCode, setCooperateCode] = useState('')
  const [cooperateName, setCooperateName] = useState('')
  const [errors, setErrors]               = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && cooperate) {
      setCooperateCode(cooperate.cooperateCode)
      setCooperateName(cooperate.cooperateName)
    } else if (!isEdit) {
      setCooperateCode(''); setCooperateName('')
    }
    setErrors({})
  }, [isOpen, isEdit, cooperate])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    const code = cooperateCode.trim()
    const name = cooperateName.trim()
    if (!code) e.cooperateCode = 'Cooperate Code is required'
    else if (code.length > CODE_MAX) e.cooperateCode = `Cooperate Code must be ${CODE_MAX} characters or fewer`
    if (!name) e.cooperateName = 'Cooperate Name is required'
    else if (name.length > NAME_MAX) e.cooperateName = `Cooperate Name must be ${NAME_MAX} characters or fewer`
    setErrors(e)
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !cooperateGuid) return
    if (!validate()) return
    // Sent trimmed: the server's uniqueness check runs on the untrimmed value
    // but saves it trimmed, so "MTN " would otherwise slip past it.
    const input: CooperateInput = { cooperateCode: cooperateCode.trim(), cooperateName: cooperateName.trim() }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Cooperate updated successfully' : 'Cooperate added successfully') }
    const onError = (error: Error) => {
      // "Cooperate already exists." — a duplicate code, fixable in the form.
      if (/already exists/i.test(error.message || '')) {
        const e = { cooperateCode: error.message }
        setErrors(prev => ({ ...prev, ...e }))
        scrollToFirstError(e)
        return
      }
      setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} cooperate. Please try again.`)
    }

    if (isEdit && cooperateGuid) {
      updateCooperate.mutate({ guid: cooperateGuid, input }, { onSuccess, onError })
    } else {
      createCooperate.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateCooperate.isPending : createCooperate.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Cooperate Updated!' : 'Cooperate Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new cooperate has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Cooperate" : "Couldn't Add Cooperate"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Cooperate"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load cooperate details.') : 'Failed to load cooperate details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !cooperate)) {
    return (
      <div className="modal-overlay open" id="edit-cooperate-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Cooperate</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading cooperate details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-cooperate-modal' : 'new-cooperate-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-handshake'}`}></i> {isEdit ? 'Edit Cooperate' : 'Add Cooperate'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Cooperate Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. CO-001'}
              maxLength={CODE_MAX}
              value={cooperateCode}
              onChange={e => { setCooperateCode(e.target.value.toUpperCase()); clearError('cooperateCode') }}
              style={errors.cooperateCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.cooperateCode && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.cooperateCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Cooperate Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. SYBYL'}
              maxLength={NAME_MAX}
              value={cooperateName}
              onChange={e => { setCooperateName(e.target.value); clearError('cooperateName') }}
              style={errors.cooperateName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.cooperateName && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.cooperateName}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Cooperate' : 'Add Cooperate')}
          </button>
        </div>
      </div>
    </div>
  )
}
