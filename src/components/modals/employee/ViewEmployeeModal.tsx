'use client'
import { ModalProps } from '../types'
import { useEmployee } from '@/hooks/employee/useEmployees'
import { useDepartments } from '@/hooks/config/useDepartments'
import { useDesignations } from '@/hooks/config/useDesignations'
import { formatDate } from '@/lib/date'

const SEXES: Record<number, string> = { 1: 'Male', 2: 'Female', 3: 'Others' }
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widow', 'Widower', 'Separated']
const RELIGIONS = ['Christian', 'Muslim', 'Hindu', 'Other']

interface ViewEmployeeModalProps extends ModalProps {
  employeeGuid: string | null
  onEdit?: () => void
  canEdit?: boolean
}

function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>{label}</div>
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: mono ? '13px' : '14px', color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

export function ViewEmployeeModal({ isOpen, onClose, employeeGuid, onEdit, canEdit }: ViewEmployeeModalProps) {
  const { data: employee, isLoading } = useEmployee(employeeGuid)
  const { data: departments = [] } = useDepartments()
  const { data: designations = [] } = useDesignations()

  if (!isOpen) return null

  const deptName = employee?.intDept != null ? departments.find(d => String(d.intDept) === String(employee.intDept))?.deptName ?? '—' : '—'
  const designationName = employee?.intDesignation != null ? designations.find(d => String(d.intDesignation) === String(employee.intDesignation))?.designationName ?? '—' : '—'

  if (isLoading || !employee) {
    return (
      <div className="modal-overlay open" id="view-employee-modal">
        <div className="modal modal-80 modal-flex" style={{ height: 'auto', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Employee</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, flex: '1 1 auto' }}>
            <span style={{ color: 'var(--g400)' }}>Loading employee details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-employee-modal">
      {/* Same reasoning as ViewProgrammeModal/ViewFeeStructureModal: modal-80
          modal-flex for the sticky header/footer, but height overridden to
          auto (capped at 85vh) so this single-section form doesn't leave a
          big empty gap the way a fixed 85vh would for content this size. */}
      <div className="modal modal-80 modal-flex" style={{ height: 'auto', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Employee — <span className="font-mono">{employee.shortCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll" style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="sec-divider">Personal Details</div>
          <div className="view-detail-grid">
            <Field label="Short Code" value={employee.shortCode} mono />
            <Field label="Title" value={employee.title} />
            <Field label="First Name" value={employee.firstName} />
            <Field label="Surname" value={employee.surname} />
            <Field label="Other Name" value={employee.otherName || '—'} />
            <Field label="University Email" value={employee.emailId} />
            <Field label="Sex" value={SEXES[employee.sex] ?? '—'} />
            <Field label="Date of Birth" value={formatDate(employee.birthDate)} />
            <Field label="Place of Birth" value={employee.placeOfBirth} />
            <Field label="Country" value={employee.countryName || '—'} />
            <Field label="National ID Type" value={employee.natId} />
            <Field label="National ID Number" value={employee.nationalId || '—'} />
            <Field label="Religion" value={employee.intReligion ? RELIGIONS[employee.intReligion - 1] ?? '—' : '—'} />
            <Field label="Marital Status" value={MARITAL_STATUSES[employee.maritalStatus - 1] ?? '—'} />
            <Field label="Department" value={deptName} />
            <Field label="Designation" value={designationName} />
            <Field label="Approval Status" value={
              employee.isApproved
                ? <span className="badge badge-green"><span className="bdot"></span>Approved</span>
                : <span className="badge badge-amber"><span className="bdot"></span>Pending</span>
            } />
          </div>
        </div>

        <div className="modal-footer">
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={onEdit}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
