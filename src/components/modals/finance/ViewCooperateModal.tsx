'use client'
import { ModalProps } from '../types'
import { useCooperate } from '@/hooks/finance/useCooperates'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewCooperateModalProps extends ModalProps {
  cooperateGuid: string | null
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

export function ViewCooperateModal({ isOpen, onClose, cooperateGuid, onEdit, canEdit }: ViewCooperateModalProps) {
  const { data: cooperate, isLoading, isError, error } = useCooperate(cooperateGuid, isOpen)

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Cooperate"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load cooperate details.') : 'Failed to load cooperate details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !cooperate) {
    return (
      <div className="modal-overlay open" id="view-cooperate-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Cooperate</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading cooperate details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-cooperate-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Cooperate — <span className="font-mono">{cooperate.cooperateCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Cooperate Code" value={cooperate.cooperateCode} mono />
            <Field label="Cooperate Name" value={cooperate.cooperateName} />
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
