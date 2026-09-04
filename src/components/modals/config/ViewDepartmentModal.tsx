'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { Department } from '@/lib/api/academic/department'
import { useEmployees } from '@/hooks/employee/useEmployees'

interface ViewDepartmentModalProps extends ModalProps {
  department: Department | null
  onEdit: () => void
}

export function ViewDepartmentModal({ isOpen, onClose, department, onEdit }: ViewDepartmentModalProps) {
  const [shortCode, setShortCode] = useState('')
  const [deptName, setDeptName]   = useState('')
  const [hod, setHod]             = useState('')

  const { data: employees = [] } = useEmployees(isOpen)
  const hodOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  useEffect(() => {
    if (isOpen && department) {
      setShortCode(department.shortCode)
      setDeptName(department.deptName)
      setHod(department.employeeGuid ?? '')
    }
  }, [isOpen, department])

  if (!isOpen || !department) return null

  function handleClose() { onClose() }

  return (
    <div className="modal-overlay open" id="view-dept-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Department</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Short Code </div>
            <div className="val font-mono uppercase">{shortCode || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Department Name </div>
            <div className="val">{deptName || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Head of Department</div>
            <div className="val">{hodOptions.find(o => o.value === hod)?.label || '—'}</div>
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
