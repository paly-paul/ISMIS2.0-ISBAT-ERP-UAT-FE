'use client'
import { ModalProps } from '../types'
import { useProcBank } from '@/hooks/finance/useProcBanks'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { STATUS_LABELS } from '@/lib/api/finance/procBank'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewProcBankModalProps extends ModalProps {
  procBankGuid: string | null
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

export function ViewProcBankModal({ isOpen, onClose, procBankGuid, onEdit, canEdit }: ViewProcBankModalProps) {
  const { data: bank, isLoading, isError, error } = useProcBank(procBankGuid, isOpen)
  const { data: currencies = [] } = useFinanceCurrencies()

  if (!isOpen) return null

  const currencyLabel = bank?.currencyGuid
    ? (() => { const c = currencies.find(c => c.currencyGuid === bank.currencyGuid); return c ? `${c.currencyCode} — ${c.currencyName}` : '—' })()
    : '—'

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Bank"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load bank details.') : 'Failed to load bank details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !bank) {
    return (
      <div className="modal-overlay open" id="view-proc-bank-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Bank</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading bank details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-proc-bank-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Bank — <span className="font-mono">{bank.shortCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Short Code" value={bank.shortCode} mono />
            <Field label="Bank Name" value={bank.bankName} />
            <Field label="Company Code" value={bank.compCode} />
            <Field label="Branch Code" value={bank.branchCode} />
            <Field label="Account Code" value={bank.accountCode} mono />
            <Field label="Currency" value={currencyLabel} />
            <Field label="Status" value={
              STATUS_LABELS[bank.status] === 'Active'
                ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Active</span>
                : <span className="badge badge-grey">Inactive</span>
            } />
            <Field label="Blocked" value={
              bank.blocked
                ? <span className="badge badge-red">Blocked</span>
                : <span className="badge badge-grey">No</span>
            } />
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
