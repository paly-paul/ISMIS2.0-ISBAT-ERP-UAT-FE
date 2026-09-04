'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useLecturerSkill } from '@/hooks/academic/useLecturerSkills'
import { CreateLecturerSkillInput } from '@/lib/api/users/skills'
import { AuthError } from '@/lib/api/client'

const PROFICIENCY_OPTIONS = [
  { value: '1', label: 'Familiar' },
  { value: '2', label: 'Proficient' },
  { value: '3', label: 'Expert' },
]

interface ViewLecturerSkillModalProps extends ModalProps {
  lecturerSkillGuid: string | null
  onEdit?: () => void
  canEdit?: boolean
}

function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>{label}</div>
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

export function ViewLecturerSkillModal({ isOpen, onClose, showToast, lecturerSkillGuid, onEdit, canEdit }: ViewLecturerSkillModalProps) {
  const { data: skill, isLoading, isError, error } = useLecturerSkill(lecturerSkillGuid, isOpen)
  const { data: employees = [] } = useEmployees()
  const [employeeGuid, setEmployeeGuid] = useState('')
  const [skillName, setSkillName] = useState('')
  const [proficiency, setProficiency] = useState('1')
  const [approved, setApproved] = useState(true)

  useEffect(() => {
    if (!isOpen || !skill) return
    setEmployeeGuid(skill.employeeGuid || '')
    setSkillName(skill.skillName)
    setProficiency(String(skill.proficiency || 1))
    setApproved(skill.approvalStatus === 'Approved')
  }, [isOpen, skill])

  if (!isOpen) return null

  const employeeOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))

  function handleClose() {
    onClose()
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Skill"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load skill details.') : 'Failed to load skill details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !skill) {
    return (
      <div className="modal-overlay open" id="view-lecturer-skill-modal">
        <div className="modal modal-md modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Skill</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div className="modal-scroll" style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading skill details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-lecturer-skill-modal">
      <div className="modal modal-lg modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Skill</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll" style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Faculty Member" value={employeeOptions.find(o => o.value === employeeGuid)?.label ?? employeeGuid ?? '—'} />
            <Field label="Skill Name" value={skillName || '—'} />
            <Field label="Proficiency" value={PROFICIENCY_OPTIONS.find(p => p.value === proficiency)?.label || '—'} />
            <Field label="Status" value={approved ? <span className="badge badge-green">Approved</span> : <span className="badge badge-neu">Not Approved</span>} />
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--g200)' }}>
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={onEdit}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
