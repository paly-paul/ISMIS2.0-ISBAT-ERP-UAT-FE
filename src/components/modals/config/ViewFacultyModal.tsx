'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { Faculty } from '@/lib/api/academic/faculty'
import { useCampusDropdown } from '@/hooks/config/useCampuses'
import { useEmployees } from '@/hooks/employee/useEmployees'

interface ViewFacultyModalProps extends ModalProps {
  faculty: Faculty | null
  onEdit: () => void
}

export function ViewFacultyModal({ isOpen, onClose, faculty, onEdit }: ViewFacultyModalProps) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [campusGuid, setCampusGuid] = useState('')
  const [deanEmployeeGuid, setDeanEmployeeGuid] = useState('')

  const { data: campusDropdown = [] } = useCampusDropdown(isOpen)
  const campusOptions = campusDropdown.map(c => ({ value: c.campusGuid, label: c.campusName }))

  const { data: employees = [] } = useEmployees(isOpen)
  const deanOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  useEffect(() => {
    if (isOpen && faculty) {
      setCode(faculty.facultyCode)
      setName(faculty.facultyName)
      setCampusGuid(faculty.campusGuid)
      setDeanEmployeeGuid(faculty.deanEmployeeGuid ?? '')
    }
  }, [isOpen, faculty])

  if (!isOpen || !faculty) return null

  function handleClose() {
    onClose()
  }

  return (
    <div className="modal-overlay open" id="view-faculty-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Faculty</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Faculty Code </div>
            <div className="val font-mono uppercase">{code || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Faculty Name </div>
            <div className="val">{name || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Campus </div>
            <div className="val">{campusOptions.find(o => o.value === campusGuid)?.label || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Dean </div>
            <div className="val">{deanOptions.find(o => o.value === deanEmployeeGuid)?.label || '—'}</div>
          </div>
        </div>
        <div className="modal-footer">
          <span className="flex-1"></span>
          <button className="btn btn-neu" onClick={onEdit} style={{ marginRight: 8 }}>
            <i className="lni lni-pencil"></i> Edit
          </button>
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
