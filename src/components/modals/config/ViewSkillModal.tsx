'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SkillMaster } from '@/lib/api/academic/skillMaster'

interface ViewSkillModalProps extends ModalProps {
  skill: SkillMaster | null
  onEdit: () => void
}

// No GetByGuid/GetById endpoint was given for this resource — same
// row-passed exception receiptBook.ts's edit flow uses: seeded straight
// from the already-loaded row instead of a fetch-by-guid.
export function ViewSkillModal({ isOpen, onClose, skill, onEdit }: ViewSkillModalProps) {
  const [skillName, setSkillName] = useState('')

  useEffect(() => {
    if (isOpen && skill) {
      setSkillName(skill.skillName)
    }
  }, [isOpen, skill])

  if (!isOpen || !skill) return null

  function handleClose() { onClose() }

  return (
    <div className="modal-overlay open" id="view-skill-modal" onClick={handleClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Skill</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Skill Name </div>
          <div className="val">{skillName || '—'}</div>
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
