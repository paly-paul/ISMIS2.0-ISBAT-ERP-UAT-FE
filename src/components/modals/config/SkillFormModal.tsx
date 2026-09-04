'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SkillMaster, SkillMasterInput } from '@/lib/api/academic/skillMaster'

interface SkillFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  skill: SkillMaster | null
  createSkill: {
    mutate: (input: SkillMasterInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateSkill: {
    mutate: (variables: { skillGuid: string; input: SkillMasterInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

// No GetByGuid/GetById endpoint was given for this resource — same
// row-passed exception receiptBook.ts's edit flow uses: seeded straight
// from the already-loaded row instead of a fetch-by-guid.
export function SkillFormModal({ isOpen, onClose, showToast, mode, skill, createSkill, updateSkill }: SkillFormModalProps) {
  const isEdit = mode === 'edit'
  const [saved, setSaved]         = useState(false)
  const [failure, setFailure]     = useState<string | null>(null)
  const [skillName, setSkillName] = useState('')
  const [errors, setErrors]       = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && skill) {
      setSkillName(skill.skillName)
    } else if (!isEdit) {
      setSkillName('')
    }
    setErrors({})
  }, [isOpen, isEdit, skill])

  if (!isOpen || (isEdit && !skill)) return null

  function handleClose() { setSaved(false); setFailure(null); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!skillName.trim()) e.skillName = 'Skill Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: SkillMasterInput = { skillName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Skill updated successfully' : 'Skill added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} skill. Please try again.`)

    if (isEdit && skill) {
      updateSkill.mutate({ skillGuid: skill.skillGuid, input }, { onSuccess, onError })
    } else {
      createSkill.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateSkill.isPending : createSkill.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Skill Updated!' : 'Skill Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new skill has been saved successfully.'}
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

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-skill-modal' : 'new-skill-modal'} onClick={handleClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-bulb'}`}></i> {isEdit ? 'Edit Skill' : 'Add Skill'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Skill Name <span className="req">*</span></div>
          <input
            className="ctrl"
            type="text"
            placeholder={isEdit ? undefined : 'e.g. C#'}
            value={skillName}
            onChange={e => { setSkillName(e.target.value); if (errors.skillName) setErrors(p => ({ ...p, skillName: '' })) }}
            style={errors.skillName ? { borderColor: 'var(--red)' } : undefined}
          />
          {errors.skillName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.skillName}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Skill' : 'Add Skill')}
          </button>
        </div>
      </div>
    </div>
  )
}
