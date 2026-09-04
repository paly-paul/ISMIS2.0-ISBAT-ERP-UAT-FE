'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { useRepetitionTag } from '@/hooks/academic/useRepetitionTags'
import { useProgramLevels } from '@/hooks/academic/useProgramLevels'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewRepTagModalProps extends ModalProps {
  courseUnitRepetitionGuid: string | null
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

export function ViewRepTagModal({ isOpen, onClose, courseUnitRepetitionGuid, onEdit, canEdit }: ViewRepTagModalProps) {
  const { data: tag, isLoading, isError, error } = useRepetitionTag(courseUnitRepetitionGuid, isOpen)
  const { data: programLevels = [] } = useProgramLevels()

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Repetition Tag"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load details.') : 'Failed to load details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !tag) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-lg modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Repetition Tag</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div className="modal-scroll" style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading repetition tag details…</span>
          </div>
        </div>
      </div>
    )
  }

  const levelName = programLevels.find(p => p.levelCode === tag.levelCode)?.levelName || '—'

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Repetition Tag — <span className="font-mono">{tag.tagCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll" style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Repetition Tag Code" value={tag.tagCode} mono />
            <Field label="Programme Level" value={levelName} />
            <Field label="Description" value={tag.tagName} />
          </div>
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid var(--g200)' }}>
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
