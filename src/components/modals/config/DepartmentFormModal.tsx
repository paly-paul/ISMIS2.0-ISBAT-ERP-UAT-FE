'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { Department, DepartmentInput } from '@/lib/api/academic/department'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { AuthError } from '@/lib/api/client'

// Not part of the real GET /api/v1/users/departments response (which only
// has shortCode/deptName/employeeGuid) — kept for reference until a
// confirmed create/update payload says whether Faculty/Status still apply.
// const FACULTY_OPTIONS = [
//   { value: 'Faculty of Computing',       label: 'Faculty of Computing' },
//   { value: 'Faculty of Business',        label: 'Faculty of Business' },
//   { value: 'Faculty of Engineering',     label: 'Faculty of Engineering' },
//   { value: 'Faculty of Health Sciences', label: 'Faculty of Health Sciences' },
//   { value: 'Faculty of Education',       label: 'Faculty of Education' },
// ]

interface DepartmentFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  department: Department | null
  createDepartment: {
    mutate: (input: DepartmentInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateDepartment: {
    mutate: (variables: { id: string; input: DepartmentInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function DepartmentFormModal({ isOpen, onClose, showToast, mode, department, createDepartment, updateDepartment }: DepartmentFormModalProps) {
  const isEdit = mode === 'edit'
  const [saved, setSaved]         = useState(false)
  const [failure, setFailure]     = useState<string | null>(null)
  const [shortCode, setShortCode] = useState('')
  const [deptName, setDeptName]   = useState('')
  const [hod, setHod]             = useState('')
  const [errors, setErrors]       = useState<Record<string, string>>({})

  const { data: employees = [] } = useEmployees(isOpen)
  const hodOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && department) {
      setShortCode(department.shortCode)
      setDeptName(department.deptName)
      setHod(department.employeeGuid ?? '')
    } else if (!isEdit) {
      setShortCode(''); setDeptName(''); setHod('')
    }
    setErrors({})
  }, [isOpen, isEdit, department])

  if (!isOpen || (isEdit && !department)) return null

  function handleClose() { setSaved(false); setFailure(null); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!shortCode.trim()) e.shortCode = 'Short Code is required'
    else if (shortCode.trim().length > 10) e.shortCode = 'Short Code must be 10 characters or fewer'
    if (!deptName.trim())  e.deptName  = 'Department Name is required'
    else if (deptName.trim().length > 100) e.deptName = 'Department Name must be 100 characters or fewer'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Map known backend failures to field errors and use the popup for anything else.
  function handleMutateError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    if (code === 'bad_request') {
      setErrors(prev => ({ ...prev, shortCode: error.message || 'A department with this Short Code already exists.' }))
      return
    }
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} department. Please try again.`)
  }

  function handleSubmit() {
    if (!validate()) return
    const input: DepartmentInput = { shortCode, deptName, employeeGuid: hod || null }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Department updated successfully' : 'Department added successfully') }

    if (isEdit && department) {
      updateDepartment.mutate({ id: String(department.intDept), input }, { onSuccess, onError: handleMutateError })
    } else {
      createDepartment.mutate(input, { onSuccess, onError: handleMutateError })
    }
  }

  const isPending = isEdit ? updateDepartment.isPending : createDepartment.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Department Updated!' : 'Department Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new department has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Department" : "Couldn't Add Department"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-dept-modal' : 'new-dept-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-apartment'}`}></i> {isEdit ? 'Edit Department' : 'Add Department'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Short Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. CS'}
              maxLength={10}
              value={shortCode}
              onChange={e => { setShortCode(e.target.value); if (errors.shortCode) setErrors(p => ({ ...p, shortCode: '' })) }}
              style={errors.shortCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.shortCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.shortCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Department Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Computer Science'}
              value={deptName}
              onChange={e => { setDeptName(e.target.value); if (errors.deptName) setErrors(p => ({ ...p, deptName: '' })) }}
              style={errors.deptName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.deptName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.deptName}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Head of Department</div>
            <SearchSelect
              placeholder="Select employee… (optional)"
              value={hod}
              onChange={setHod}
              options={hodOptions}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Department' : 'Add Department')}
          </button>
        </div>
      </div>
    </div>
  )
}
