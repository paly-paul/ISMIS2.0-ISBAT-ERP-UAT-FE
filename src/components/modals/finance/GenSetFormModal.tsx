'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { GenSetInput } from '@/lib/api/finance/genSet'
import { useGenSet } from '@/hooks/finance/useGenSets'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface GenSetFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  genSetGuid: string | null
  createGenSet: {
    mutate: (input: GenSetInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateGenSet: {
    mutate: (variables: { guid: string; input: GenSetInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function GenSetFormModal({ isOpen, onClose, showToast, mode, genSetGuid, createGenSet, updateGenSet }: GenSetFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: genSet, isLoading, isError, error } = useGenSet(isEdit ? genSetGuid : null, isEdit && isOpen)

  const [saved, setSaved]         = useState(false)
  const [failure, setFailure]     = useState<string | null>(null)
  const [type, setType]           = useState('')
  const [condition, setCondition] = useState('')
  const [errors, setErrors]       = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && genSet) {
      setType(genSet.type)
      setCondition(genSet.condition)
    } else if (!isEdit) {
      setType(''); setCondition('')
    }
    setErrors({})
  }, [isOpen, isEdit, genSet])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!type.trim()) e.type = 'Type is required'
    if (!condition.trim()) e.condition = 'Condition is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !genSetGuid) return
    if (!validate()) return
    const input: GenSetInput = { type, condition }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'General setting updated successfully' : 'General setting added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} general setting. Please try again.`)

    if (isEdit && genSetGuid) {
      updateGenSet.mutate({ guid: genSetGuid, input }, { onSuccess, onError })
    } else {
      createGenSet.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateGenSet.isPending : createGenSet.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'General Setting Updated!' : 'General Setting Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new general setting has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update General Setting" : "Couldn't Add General Setting"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load General Setting"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load general setting details.') : 'Failed to load general setting details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !genSet)) {
    return (
      <div className="modal-overlay open" id="edit-genset-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit General Setting</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading general setting details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-genset-modal' : 'new-genset-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-cog'}`}></i> {isEdit ? 'Edit General Setting' : 'Add General Setting'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Type <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. CCY'}
              maxLength={10}
              value={type}
              onChange={e => { setType(e.target.value.toUpperCase()); clearError('type') }}
              style={errors.type ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.type && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.type}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Condition <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. UGX'}
              maxLength={100}
              value={condition}
              onChange={e => { setCondition(e.target.value); clearError('condition') }}
              style={errors.condition ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.condition && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.condition}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update General Setting' : 'Add General Setting')}
          </button>
        </div>
      </div>
    </div>
  )
}
