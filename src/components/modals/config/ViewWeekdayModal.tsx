'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useWeekday } from '@/hooks/config/useWeekdays'
import { AuthError } from '@/lib/api/client'

interface ViewWeekdayModalProps extends ModalProps {
  weekDayGuid: string | null
  onEdit: () => void
}

export function ViewWeekdayModal({ isOpen, onClose, weekDayGuid, onEdit }: ViewWeekdayModalProps) {
  const { data: weekday, isLoading, isError, error } = useWeekday(weekDayGuid, isOpen)

  const [dayCode, setDayCode] = useState('')
  const [dayName, setDayName] = useState('')

  // Fill the view when the selected weekday loads.
  useEffect(() => {
    if (!isOpen || !weekday) return
    setDayCode(weekday.dayCode)
    setDayName(weekday.dayName)
  }, [isOpen, weekday])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Weekday"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load weekday details.') : 'Failed to load weekday details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !weekday) {
    return (
      <div className="modal-overlay open" id="view-weekday-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Weekday</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading weekday details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-weekday-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Weekday</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Day Code </div>
            <div className="val font-mono uppercase">{dayCode || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Day Name </div>
            <div className="val">{dayName || '—'}</div>
          </div>
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
