'use client'
import { ModalProps } from '../types'
import { useDiscount } from '@/hooks/finance/useDiscounts'
import { CALC_TYPE_LABELS, CALC_TYPE_VALUES } from '@/lib/api/finance/discount'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewDiscountModalProps extends ModalProps {
  discountGuid: string | null
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

export function ViewDiscountModal({ isOpen, onClose, discountGuid, onEdit, canEdit }: ViewDiscountModalProps) {
  const { data: discount, isLoading, isError, error } = useDiscount(discountGuid, isOpen)

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Discount"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load discount details.') : 'Failed to load discount details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !discount) {
    return (
      <div className="modal-overlay open" id="view-discount-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Discount</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading discount details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-discount-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Discount — <span className="font-mono">{discount.discountCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Discount Code" value={discount.discountCode} mono />
            <Field label="Discount Name" value={discount.discountName} />
            <Field label="Calculation Type" value={discount.calcType != null ? CALC_TYPE_LABELS[discount.calcType] : '—'} />
            <Field label="Amount / Percentage" value={
              discount.amtPer != null
                ? discount.calcType === CALC_TYPE_VALUES.Percentage ? `${discount.amtPer}%` : discount.amtPer
                : '—'
            } />
            <Field label="Carry Forward" value={
              discount.carry === 1
                ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Yes</span>
                : <span className="badge badge-grey">No</span>
            } />
            <Field label="COP" value={discount.cop ?? '—'} />
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
