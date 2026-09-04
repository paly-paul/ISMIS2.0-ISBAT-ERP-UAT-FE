'use client'
import { ModalProps } from '../types'
import { useProgramGroup } from '@/hooks/academic/useProgramGroups'
import { useProgramLevels } from '@/hooks/academic/useProgramLevels'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewProgrammeGroupModalProps extends ModalProps {
  programGroupGuid: string | null
  onEdit?: () => void
  canEdit?: boolean
}

function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>{label}</div>
      {/* Monospace renders visually larger than the app's usual sans body
          text at the same px size — dial it down a notch so the Code field
          doesn't read as oversized next to the other plain-text fields. */}
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: mono ? '13px' : '14px', color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

export function ViewProgrammeGroupModal({ isOpen, onClose, programGroupGuid, onEdit, canEdit }: ViewProgrammeGroupModalProps) {
  const { data: programGroup, isLoading, isError, error } = useProgramGroup(programGroupGuid, isOpen)
  const { data: programLevels = [] } = useProgramLevels()

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Programme Group"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load programme group details.') : 'Failed to load programme group details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !programGroup) {
    return (
      <div className="modal-overlay open" id="view-proggroup-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Programme Group</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading programme group details…</span>
          </div>
        </div>
      </div>
    )
  }

  const levelName = programLevels.find(l => l.programLevelGuid === programGroup.programLevelGuid)?.levelName || '—'

  return (
    <div className="modal-overlay open" id="view-proggroup-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Programme Group — <span className="font-mono">{programGroup.groupCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Group Code" value={programGroup.groupCode} mono />
            <Field label="Group Name" value={programGroup.groupName} />
            <Field label="Programme Level" value={levelName} />
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
