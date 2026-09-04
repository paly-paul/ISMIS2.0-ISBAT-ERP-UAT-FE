'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { Designation } from '@/lib/api/academic/designation'
import { useDepartments } from '@/hooks/config/useDepartments'

interface ViewDesignationModalProps extends ModalProps {
  designation: Designation | null
  onEdit: () => void
}

export function ViewDesignationModal({ isOpen, onClose, designation, onEdit }: ViewDesignationModalProps) {
  const [designationName, setDesignationName] = useState('')
  const [department, setDepartment]           = useState('')

  const { data: departments = [] } = useDepartments()
  const departmentOptions = departments.map(d => ({ value: String(d.intDept), label: d.deptName }))

  useEffect(() => {
    if (isOpen && designation) {
      setDesignationName(designation.designationName)
      setDepartment(String(designation.intDept))
    }
  }, [isOpen, designation])

  if (!isOpen || !designation) return null

  function handleClose() { onClose() }

  return (
    <div className="modal-overlay open" id="view-designation-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Designation</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Designation Name </div>
            <div className="val">{designationName || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Department </div>
            <div className="val">{departmentOptions.find(o => o.value === department)?.label || '—'}</div>
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
