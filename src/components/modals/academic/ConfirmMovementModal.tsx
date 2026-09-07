'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'

export interface MovementTarget {
  intake: string
  programme: string
  // The real API's SessionListItemDto.semesterCode is a string (e.g. "2"),
  // not an int — kept loose here rather than coercing, since it's
  // display-only.
  semester: string | number
}

interface ConfirmMovementModalProps extends ModalProps {
  target: MovementTarget | null
  onConfirm: () => void
  // True while executeSessionMove's own mutation is in flight — disables
  // Execute Movement so a slow request can't be double-submitted by a
  // second click, and swaps its label to show it's working.
  isSubmitting?: boolean
}

const CONFIRM_WORD = 'CONFIRM'

// Session Movement's own single-row confirmation, gating the irreversible
// POST .../move call behind typing the word — same "type the word to unlock
// a destructive button" convention used elsewhere in this app (e.g. Ledger
// Adjustments' own danger-box actions). Bulk movement (move-all) has no
// pre-known per-row target list to show here — that's the whole point of
// the server deciding eligibility itself — so it gets its own
// BulkSessionMovementModal instead of reusing this one.
export function ConfirmMovementModal({ isOpen, onClose, showToast, target, onConfirm, isSubmitting }: ConfirmMovementModalProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (isOpen) setTyped('')
  }, [isOpen])

  if (!isOpen || !target) return null

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

  function handleExecute() {
    if (!confirmed) { showToast(`Type ${CONFIRM_WORD} to proceed.`, 'warn'); return }
    onConfirm()
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-sm" id="confirm-movement-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-warning"></i> Confirm Session Movement</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="p-[7px_10px] bg-[var(--b50)] border border-[var(--b200)] rounded-md mb-4" style={{ fontSize: 'var(--fs-sm)' }}>
          <div><span className="text-muted">Admission Intake</span> <strong>{target.intake}</strong></div>
          <div><span className="text-muted">Programme</span> <strong>{target.programme}</strong></div>
          <div><span className="text-muted">Semester</span> <strong>{target.semester}</strong></div>
        </div>

        <div className="danger-box mb-4">
          <i className="lni lni-volume-high"></i> <span>This action is <strong>irreversible</strong>. Eligible students in this batch will be moved to the next semester.</span>
        </div>

        <div className="fg mb-4">
          <div className="lbl">Type {CONFIRM_WORD} to proceed</div>
          <input
            className="ctrl"
            type="text"
            placeholder={`Type ${CONFIRM_WORD}`}
            value={typed}
            onChange={e => setTyped(e.target.value)}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn btn-danger" disabled={!confirmed || isSubmitting} onClick={handleExecute}>
            <i className="lni lni-reload"></i> {isSubmitting ? 'Executing…' : 'Execute Movement'}
          </button>
        </div>
      </div>
    </div>
  )
}
