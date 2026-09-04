'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { MultiSelect } from '@/components/MultiSelect'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useSkillMasters } from '@/hooks/config/useSkillMaster'
import { useLecturerSkill } from '@/hooks/academic/useLecturerSkills'
import { CreateLecturerSkillInput } from '@/lib/api/users/skills'
import { AuthError } from '@/lib/api/client'

// Add and Edit both mutate the same CreateLecturerSkillInput shape, just
// with different UI: Add lets a user attach several skills to one faculty
// member at once (MultiSelect, one shared proficiency), Edit only ever has
// the single skill the record already carries (SearchSelect).
const PROFICIENCY_OPTIONS = [
  { value: '1', label: 'Familiar' },
  { value: '2', label: 'Proficient' },
  { value: '3', label: 'Expert' },
]

interface LecturerSkillFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  lecturerSkillGuid: string | null
  createSkill: {
    mutate: (input: CreateLecturerSkillInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateSkill: {
    mutate: (variables: { guid: string; input: CreateLecturerSkillInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function LecturerSkillFormModal({ isOpen, onClose, showToast, mode, lecturerSkillGuid, createSkill, updateSkill }: LecturerSkillFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: skill, isLoading, isError, error } = useLecturerSkill(lecturerSkillGuid, isOpen && isEdit)
  const { data: employees = [] } = useEmployees()
  const { data: skillMasterData } = useSkillMasters()
  const skillMasters = skillMasterData?.items ?? []

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [employeeGuid, setEmployeeGuid] = useState('')
  // New mode: multiple skills at once. Edit mode: exactly one (skillIds[0]).
  const [skillIds, setSkillIds]     = useState<string[]>([])
  const [proficiency, setProficiency] = useState('1')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  // GetByGuid returns a real employeeGuid, so it prefills directly.
  // skillId still has to be resolved indirectly — GetByGuid returns
  // skillName, not skillGuid, so it's matched back against the master list.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && skill) {
      setEmployeeGuid(skill.employeeGuid || '')
      const master = skillMasters.find(s => s.skillName === skill.skillName)
      setSkillIds(master ? [master.skillGuid] : [])
      setProficiency(String(skill.proficiency || 1))
      setErrors({})
    } else if (!isEdit) {
      setEmployeeGuid(''); setSkillIds([]); setProficiency('1'); setErrors({})
    }
  }, [isOpen, isEdit, skill, skillMasters])

  if (!isOpen) return null

  const employeeOptions = employees.map(e => ({ value: e.employeeGuid, label: `${e.empName} (${e.shortCode})` }))
  const skillOptions = skillMasters.map(s => ({ value: s.skillGuid, label: s.skillName }))

  function handleClose() {
    setSaved(false); setFailure(null)
    setEmployeeGuid(''); setSkillIds([]); setProficiency('1'); setErrors({})
    onClose()
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function handleSkillIdsChange(vals: string[]) {
    setSkillIds(vals)
    clearError('skillIds')
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!employeeGuid) e.employeeGuid = 'Faculty member is required'
    if (skillIds.length === 0) e[isEdit ? 'skillId' : 'skillIds'] = isEdit ? 'Skill / subject area is required' : 'At least one skill / subject area is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: CreateLecturerSkillInput = { employeeGuid, skillGuids: skillIds, proficiency: Number(proficiency) }

    if (isEdit && lecturerSkillGuid) {
      updateSkill.mutate(
        { guid: lecturerSkillGuid, input },
        { onSuccess: () => { setSaved(true); showToast('Skill updated successfully') }, onError: (error: Error) => setFailure(error.message || 'Failed to update skill. Please try again.') },
      )
    } else {
      createSkill.mutate(
        input,
        {
          onSuccess: () => { setSaved(true); showToast(`${skillIds.length} skill${skillIds.length !== 1 ? 's' : ''} added successfully`) },
          onError: (error: Error) => setFailure(error.message || 'Failed to add skill(s). Please try again.'),
        },
      )
    }
  }

  const isPending = isEdit ? updateSkill.isPending : createSkill.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Skill Updated!' : 'Skill Saved!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : "The skill(s) have been added to the lecturer's profile."}
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
          <FailurePopup title={isEdit ? "Couldn't Update Skill" : "Couldn't Add Skill"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
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

  if (isEdit && (isLoading || !skill)) {
    return (
      <div className="modal-overlay open" id="edit-lecturer-skill-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Skill</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading skill details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-lecturer-skill-modal' : 'add-skill-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-bulb'}`}></i> {isEdit ? 'Edit Skill' : 'Add Skill'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="fg mb-3">
          <div className="lbl">Faculty Member <span className="req">*</span></div>
          <SearchSelect
            placeholder="— Select faculty member —"
            options={employeeOptions}
            value={employeeGuid}
            onChange={v => { setEmployeeGuid(v); clearError('employeeGuid') }}
          />
          {errors.employeeGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.employeeGuid}</p>}
        </div>

        {isEdit ? (
          <>
            <div className="sec-divider">Skill / Subject Area</div>
            <div className="g2 mb-3">
              <div className="fg span2">
                <div className="lbl">Skill Name <span className="req">*</span></div>
                <SearchSelect
                  placeholder="— Select skill —"
                  options={skillOptions}
                  value={skillIds[0] ?? ''}
                  onChange={v => { setSkillIds([v]); clearError('skillId') }}
                />
                {errors.skillId && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.skillId}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Proficiency</div>
                <SearchSelect options={PROFICIENCY_OPTIONS} value={proficiency} onChange={setProficiency} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="sec-divider">Skills / Subject Areas</div>
            <div className="fg mb-3">
              <div className="lbl">Skills <span className="req">*</span></div>
              <MultiSelect
                placeholder="— Select skills —"
                options={skillOptions}
                value={skillIds}
                onChange={handleSkillIdsChange}
              />
              {errors.skillIds && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.skillIds}</p>}
            </div>

            {skillIds.length > 0 && (
              <div className="fg mb-3">
                <div className="lbl">Proficiency</div>
                <div style={{ fontSize: 12, color: 'var(--g400)', marginBottom: 6 }}>
                  Applies to all {skillIds.length} selected skill{skillIds.length !== 1 ? 's' : ''}.
                </div>
                <SearchSelect
                  style={{ width: 160 }}
                  options={PROFICIENCY_OPTIONS}
                  value={proficiency}
                  onChange={setProficiency}
                />
              </div>
            )}
          </>
        )}

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Saving…') : (isEdit ? 'Update Skill' : 'Save Skill')}
          </button>
        </div>
      </div>
    </div>
  )
}
