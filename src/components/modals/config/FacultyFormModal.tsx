'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { Faculty, FacultyInput } from '@/lib/api/academic/faculty'
import { useCampusDropdown } from '@/hooks/config/useCampuses'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { AuthError } from '@/lib/api/client'

interface FacultyFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  faculty: Faculty | null
  createFaculty: {
    mutate: (input: FacultyInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateFaculty: {
    mutate: (variables: { id: string; input: FacultyInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function FacultyFormModal({ isOpen, onClose, showToast, mode, faculty, createFaculty, updateFaculty }: FacultyFormModalProps) {
  const isEdit = mode === 'edit'
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [campusGuid, setCampusGuid] = useState('')
  const [deanEmployeeGuid, setDeanEmployeeGuid] = useState('')
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const { data: campusDropdown = [] } = useCampusDropdown(isOpen)
  const campusOptions = campusDropdown.map(c => ({ value: c.campusGuid, label: c.campusName }))

  const { data: employees = [] } = useEmployees(isOpen)
  const deanOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && faculty) {
      setCode(faculty.facultyCode)
      setName(faculty.facultyName)
      setCampusGuid(faculty.campusGuid)
      setDeanEmployeeGuid(faculty.deanEmployeeGuid ?? '')
    } else if (!isEdit) {
      setCode(''); setName(''); setCampusGuid(''); setDeanEmployeeGuid('')
    }
  }, [isOpen, isEdit, faculty])

  if (!isOpen || (isEdit && !faculty)) return null

  function handleClose() {
    setSaved(false)
    setFailure(null)
    onClose()
  }

  function handleSubmit() {
    if (!code || !name || !campusGuid || !deanEmployeeGuid) return
    const input: FacultyInput = { facultyCode: code, facultyName: name, campusGuid, deanEmployeeGuid }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Faculty updated successfully' : 'Faculty added successfully') }
    const onError = (error: Error) => {
      // A missing record on edit usually means the faculty was deleted while the modal was open.
      const notFound = isEdit && error instanceof AuthError && error.code === 'not_found'
      const errCode = !isEdit && error instanceof AuthError ? error.code : undefined
      setFailure(
        notFound
          ? 'This faculty no longer exists — it may have been deleted.'
          : error.message || `Failed to ${isEdit ? 'update' : 'add'} faculty${errCode ? ` (${errCode})` : ''}. Please try again.`
      )
    }

    if (isEdit && faculty) {
      updateFaculty.mutate({ id: faculty.facultyGuid, input }, { onSuccess, onError })
    } else {
      createFaculty.mutate(input, { onSuccess, onError })
    }
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Faculty Updated!' : 'Faculty Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new faculty has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Faculty" : "Couldn't Add Faculty"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  const isPending = isEdit ? updateFaculty.isPending : createFaculty.isPending
  const disabled = !code || !name || !campusGuid || !deanEmployeeGuid || isPending

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-faculty-modal' : 'new-faculty-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-library'}`}></i> {isEdit ? 'Edit Faculty' : 'Add Faculty'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Faculty Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. FCT'}
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="fg">
            <div className="lbl">Faculty Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Faculty of Computing & Technology'}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="fg span2">
            <div className="lbl">Campus <span className="req">*</span></div>
            <SearchSelect
              placeholder="Select campus…"
              options={campusOptions}
              value={campusGuid}
              onChange={setCampusGuid}
            />
          </div>
          <div className="fg span2">
            <div className="lbl">Dean <span className="req">*</span></div>
            <SearchSelect
              placeholder="Select employee…"
              options={deanOptions}
              value={deanEmployeeGuid}
              onChange={setDeanEmployeeGuid}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={disabled} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Faculty' : 'Add Faculty')}
          </button>
        </div>
      </div>
    </div>
  )
}
