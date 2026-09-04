'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { UnitTypeInput } from '@/lib/api/academic/unitType'
import { useUnitType } from '@/hooks/config/useUnitTypes'
import { AuthError } from '@/lib/api/client'

interface UnitTypeFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  unitTypeGuid: string | null
  createUnitType: {
    mutate: (input: UnitTypeInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateUnitType: {
    mutate: (variables: { guid: string; input: UnitTypeInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function UnitTypeFormModal({ isOpen, onClose, showToast, mode, unitTypeGuid, createUnitType, updateUnitType }: UnitTypeFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: unitType, isLoading, isError, error } = useUnitType(isEdit ? unitTypeGuid : null, isOpen && isEdit)

  const [saved, setSaved]               = useState(false)
  const [failure, setFailure]           = useState<string | null>(null)
  const [unitTypeName, setUnitTypeName] = useState('')
  const [errors, setErrors]             = useState<Record<string, string>>({})

  // Fill the form when the selected unit type loads.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && unitType) {
      setUnitTypeName(unitType.unitTypeName)
    } else if (!isEdit) {
      setUnitTypeName('')
    }
    setErrors({})
  }, [isOpen, isEdit, unitType])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!unitTypeName.trim()) e.unitTypeName = 'Unit Type Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: UnitTypeInput = { unitTypeName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Unit type updated successfully' : 'Unit type added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} unit type. Please try again.`)

    if (isEdit && unitTypeGuid) {
      updateUnitType.mutate({ guid: unitTypeGuid, input }, { onSuccess, onError })
    } else {
      createUnitType.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateUnitType.isPending : createUnitType.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Unit Type Updated!' : 'Unit Type Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new unit type has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Unit Type" : "Couldn't Add Unit Type"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Unit Type"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load unit type details.') : 'Failed to load unit type details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !unitType)) {
    return (
      <div className="modal-overlay open" id="edit-unit-type-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Unit Type</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading unit type details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-unit-type-modal' : 'new-unit-type-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-tag'}`}></i> {isEdit ? 'Edit Unit Type' : 'Add Unit Type'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Unit Type Name <span className="req">*</span></div>
          <input
            className="ctrl"
            type="text"
            placeholder={isEdit ? undefined : 'e.g. Theory'}
            value={unitTypeName}
            onChange={e => { setUnitTypeName(e.target.value); clearError('unitTypeName') }}
            style={errors.unitTypeName ? { borderColor: 'var(--red)' } : undefined}
          />
          {errors.unitTypeName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.unitTypeName}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Unit Type' : 'Add Unit Type')}
          </button>
        </div>
      </div>
    </div>
  )
}
