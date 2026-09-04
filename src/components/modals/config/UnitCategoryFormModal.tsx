'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { UnitCategoryInput } from '@/lib/api/academic/unitCategory'
import { useUnitCategory } from '@/hooks/config/useUnitCategories'
import { AuthError } from '@/lib/api/client'

interface UnitCategoryFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  unitCatGuid: string | null
  createUnitCategory: {
    mutate: (input: UnitCategoryInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateUnitCategory: {
    mutate: (variables: { guid: string; input: UnitCategoryInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function UnitCategoryFormModal({ isOpen, onClose, showToast, mode, unitCatGuid, createUnitCategory, updateUnitCategory }: UnitCategoryFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: unitCategory, isLoading, isError, error } = useUnitCategory(isEdit ? unitCatGuid : null, isOpen && isEdit)

  const [saved, setSaved]             = useState(false)
  const [failure, setFailure]         = useState<string | null>(null)
  const [unitCatName, setUnitCatName] = useState('')
  const [errors, setErrors]           = useState<Record<string, string>>({})

  // Fill the form when the selected unit category loads.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && unitCategory) {
      setUnitCatName(unitCategory.unitCatName)
    } else if (!isEdit) {
      setUnitCatName('')
    }
    setErrors({})
  }, [isOpen, isEdit, unitCategory])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!unitCatName.trim()) e.unitCatName = 'Unit Category Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: UnitCategoryInput = { unitCatName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Unit category updated successfully' : 'Unit category added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} unit category. Please try again.`)

    if (isEdit && unitCatGuid) {
      updateUnitCategory.mutate({ guid: unitCatGuid, input }, { onSuccess, onError })
    } else {
      createUnitCategory.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateUnitCategory.isPending : createUnitCategory.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Unit Category Updated!' : 'Unit Category Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new unit category has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Unit Category" : "Couldn't Add Unit Category"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Unit Category"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load unit category details.') : 'Failed to load unit category details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !unitCategory)) {
    return (
      <div className="modal-overlay open" id="edit-unit-category-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Unit Category</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading unit category details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-unit-category-modal' : 'new-unit-category-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-tag'}`}></i> {isEdit ? 'Edit Unit Category' : 'Add Unit Category'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Unit Category Name <span className="req">*</span></div>
          <input
            className="ctrl"
            type="text"
            placeholder={isEdit ? undefined : 'e.g. Elective'}
            value={unitCatName}
            onChange={e => { setUnitCatName(e.target.value); clearError('unitCatName') }}
            style={errors.unitCatName ? { borderColor: 'var(--red)' } : undefined}
          />
          {errors.unitCatName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.unitCatName}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Unit Category' : 'Add Unit Category')}
          </button>
        </div>
      </div>
    </div>
  )
}
