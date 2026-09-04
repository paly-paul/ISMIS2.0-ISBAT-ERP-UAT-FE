'use client'
import { ModalProps } from '../types'
import { useLedger, Ledger } from '@/hooks/finance/useLedgers'
import { useProcGlAccounts } from '@/hooks/finance/useProcGlAccounts'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewLedgerModalProps extends ModalProps {
  ledgerGuid: string | null
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

export function ViewLedgerModal({ isOpen, onClose, ledgerGuid, onEdit, canEdit }: ViewLedgerModalProps) {
  const { data: ledger, isLoading, isError, error } = useLedger(ledgerGuid, isOpen)
  const { data: glAccounts = [] } = useProcGlAccounts()

  if (!isOpen) return null

  // procGlAccountGuid isn't confirmed present on the read shape (only
  // intGlAccount is documented) — same fallback logic as the page's own
  // glAccountLabel(), since GL Account has no names-by-id lookup to resolve
  // the legacy int against otherwise.
  function glAccountLabel(l: Ledger) {
    if (l.procGlAccountGuid) {
      const acc = glAccounts.find(a => a.procGlAccountGuid === l.procGlAccountGuid)
      if (acc) return `${acc.shortCode} — ${acc.accName}`
    }
    if (l.intGlAccount != null) return `GL #${l.intGlAccount}`
    return '—'
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Ledger"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load ledger details.') : 'Failed to load ledger details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !ledger) {
    return (
      <div className="modal-overlay open" id="view-ledger-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Ledger</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading ledger details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-ledger-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Ledger — <span className="font-mono">{ledger.ledgerCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Ledger Code" value={ledger.ledgerCode} mono />
            <Field label="Ledger Name" value={ledger.ledgerName} />
            <Field label="GL Account" value={glAccountLabel(ledger)} wide />
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
