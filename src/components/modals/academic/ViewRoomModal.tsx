'use client'
import { ModalProps } from '../types'
import { useRoom } from '@/hooks/academic/useRooms'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewRoomModalProps extends ModalProps {
  roomGuid: string | null
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

export function ViewRoomModal({ isOpen, onClose, roomGuid, onEdit, canEdit }: ViewRoomModalProps) {
  const { data: room, isLoading, isError, error } = useRoom(roomGuid, isOpen)

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Room"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load room details.') : 'Failed to load room details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !room) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Room</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading room details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Room — <span className="font-mono">{room.roomCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          {/* view-detail-grid only reaches its 3-col breakpoint at >=820px
              (globals.css), but modal-md caps out at 580px — with just 3
              short fields that left Location's "wide" row half-empty next
              to Capacity. Force 3 columns here instead since the modal
              never needs to stack these three on a narrow screen. */}
          <div className="view-detail-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Field label="Room Code" value={room.roomCode} mono />
            <Field label="Capacity" value={room.capacity ?? '—'} />
            <Field label="Location" value={room.location || '—'} />
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
