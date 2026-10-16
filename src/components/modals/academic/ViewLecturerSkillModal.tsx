'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { useEmployeeDropdown } from '@/hooks/employee/useEmployees'
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

// Same badges as the Skill Management list, so a status reads identically in
// the table and here.
function approvalBadge(status: string) {
  if (status === 'Approved') return <span className="badge badge-green"><i className="lni lni-checkmark"></i> Approved</span>
  if (status === 'Rejected') return <span className="badge badge-red"><i className="lni lni-close"></i> Rejected</span>
  if (status === 'Pending') return <span className="badge badge-amber"><i className="lni lni-timer"></i> Pending</span>
  return <span className="badge badge-grey">{status || '—'}</span>
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
  const { data: employees = [] } = useEmployeeDropdown(isOpen)
  const [employeeGuid, setEmployeeGuid] = useState('')
  const [skillName, setSkillName] = useState('')
  const [proficiency, setProficiency] = useState('1')
  const [approvalStatus, setApprovalStatus] = useState('')

  useEffect(() => {
    if (!isOpen || !skill) return
    setEmployeeGuid(skill.employeeGuid || '')
    setSkillName(skill.skillName)
    setProficiency(String(skill.proficiency || 1))
    setApprovalStatus(skill.approvalStatus || '')
  }, [isOpen, skill])

  if (!isOpen) return null

  const employeeOptions = employees.map(e => ({ value: e.employeeGuid, label: e.displayName }))

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
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Skill</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
            <span style={{ color: 'var(--g400)' }}>Loading skill details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-lecturer-skill-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Skill</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          {/* Three short fields per row at modal-md width (Status wraps
              below), stacking on phones instead of squeezing long faculty
              names into a third of the screen. */}
          <div className="view-detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <Field label="Faculty Member" value={employeeOptions.find(o => o.value === employeeGuid)?.label ?? employeeGuid ?? '—'} />
            <Field label="Skill Name" value={skillName || '—'} />
            <Field label="Proficiency" value={PROFICIENCY_OPTIONS.find(p => p.value === proficiency)?.label || '—'} />
            <Field label="Status" value={approvalBadge(approvalStatus)} />
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
