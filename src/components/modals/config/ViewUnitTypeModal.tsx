'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useUnitType } from '@/hooks/config/useUnitTypes'
import { AuthError } from '@/lib/api/client'

interface ViewUnitTypeModalProps extends ModalProps {
  unitTypeGuid: string | null
  onEdit: () => void
}

export function ViewUnitTypeModal({ isOpen, onClose, unitTypeGuid, onEdit }: ViewUnitTypeModalProps) {
  const { data: unitType, isLoading, isError, error } = useUnitType(unitTypeGuid, isOpen)

  const [unitTypeName, setUnitTypeName] = useState('')

  // Fill the view when the selected unit type loads.
  useEffect(() => {
    if (!isOpen || !unitType) return
    setUnitTypeName(unitType.unitTypeName)
  }, [isOpen, unitType])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Unit Type"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load unit type details.') : 'Failed to load unit type details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !unitType) {
    return (
      <div className="modal-overlay open" id="view-unit-type-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Unit Type</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading unit type details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-unit-type-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Unit Type</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Unit Type Name </div>
          <div className="val">{unitTypeName || '—'}</div>
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
