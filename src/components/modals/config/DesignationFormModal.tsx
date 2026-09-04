'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { Designation, DesignationInput } from '@/lib/api/academic/designation'
import { useDepartments } from '@/hooks/config/useDepartments'
import { AuthError } from '@/lib/api/client'

// Not part of the real GET /api/v1/users/designations response (which
// references departments by numeric intDept, not a name string) — kept for
// reference. The Department dropdown below is now backed by the real
// departments list (useDepartments) instead of this hardcoded set.
// const DEPARTMENT_OPTIONS = [
//   { value: 'Computer Science',        label: 'Computer Science' },
//   { value: 'Information Technology',  label: 'Information Technology' },
//   { value: 'Business Administration', label: 'Business Administration' },
//   { value: 'Accounting & Finance',    label: 'Accounting & Finance' },
//   { value: 'Civil Engineering',       label: 'Civil Engineering' },
//   { value: 'Nursing Sciences',        label: 'Nursing Sciences' },
// ]

interface DesignationFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  designation: Designation | null
  createDesignation: {
    mutate: (input: DesignationInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateDesignation: {
    mutate: (variables: { id: string; input: DesignationInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function DesignationFormModal({ isOpen, onClose, showToast, mode, designation, createDesignation, updateDesignation }: DesignationFormModalProps) {
  const isEdit = mode === 'edit'
  const [saved, setSaved]                     = useState(false)
  const [failure, setFailure]                 = useState<string | null>(null)
  const [designationName, setDesignationName] = useState('')
  const [department, setDepartment]           = useState('')
  const [errors, setErrors]                   = useState<Record<string, string>>({})

  const { data: departments = [] } = useDepartments()
  const departmentOptions = departments.map(d => ({ value: String(d.intDept), label: d.deptName }))

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && designation) {
      setDesignationName(designation.designationName)
      setDepartment(String(designation.intDept))
    } else if (!isEdit) {
      setDesignationName(''); setDepartment('')
    }
    setErrors({})
  }, [isOpen, isEdit, designation])

  if (!isOpen || (isEdit && !designation)) return null

  function handleClose() { setSaved(false); setFailure(null); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!designationName.trim()) e.designationName = 'Designation Name is required'
    if (!department)             e.department      = 'Please select a department'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Maps the backend's { code, errors } failure shape (see
  // departments-and-designations.md) to inline field errors where the cause
  // is actionable right there (duplicate designationName); validation_error
  // and not_found (bad intDept reference) show the failure popup instead.
  function handleMutateError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    if (code === 'bad_request') {
      setErrors(prev => ({ ...prev, designationName: error.message || 'A designation with this name already exists.' }))
      return
    }
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} designation. Please try again.`)
  }

  function handleSubmit() {
    if (!validate()) return
    const input: DesignationInput = { designationName, intDept: Number(department) }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Designation updated successfully' : 'Designation added successfully') }

    if (isEdit && designation) {
      updateDesignation.mutate({ id: String(designation.intDesignation), input }, { onSuccess, onError: handleMutateError })
    } else {
      createDesignation.mutate(input, { onSuccess, onError: handleMutateError })
    }
  }

  const isPending = isEdit ? updateDesignation.isPending : createDesignation.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Designation Updated!' : 'Designation Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new designation has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Designation" : "Couldn't Add Designation"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-designation-modal' : 'new-designation-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-tag'}`}></i> {isEdit ? 'Edit Designation' : 'Add Designation'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg span2">
            <div className="lbl">Designation Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Senior Lecturer'}
              value={designationName}
              onChange={e => { setDesignationName(e.target.value); if (errors.designationName) setErrors(p => ({ ...p, designationName: '' })) }}
              style={errors.designationName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.designationName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.designationName}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Department <span className="req">*</span></div>
            <SearchSelect
              placeholder="Select department…"
              value={department}
              onChange={v => { setDepartment(v); if (errors.department) setErrors(p => ({ ...p, department: '' })) }}
              options={departmentOptions}
            />
            {errors.department && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.department}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Designation' : 'Add Designation')}
          </button>
        </div>
      </div>
    </div>
  )
}
