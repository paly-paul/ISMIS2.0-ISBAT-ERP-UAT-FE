'use client'
import { ModalProps } from '../types'
import { useProcGlAccount } from '@/hooks/finance/useProcGlAccounts'
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/api/finance/procGlAccount'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewProcGlAccountModalProps extends ModalProps {
  procGlAccountGuid: string | null
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

export function ViewProcGlAccountModal({ isOpen, onClose, procGlAccountGuid, onEdit, canEdit }: ViewProcGlAccountModalProps) {
  const { data: account, isLoading, isError, error } = useProcGlAccount(procGlAccountGuid, isOpen)

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load GL Account"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load GL account details.') : 'Failed to load GL account details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !account) {
    return (
      <div className="modal-overlay open" id="view-proc-gl-account-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View GL Account</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading GL account details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-proc-gl-account-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View GL Account — <span className="font-mono">{account.shortCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Short Code" value={account.shortCode} mono />
            <Field label="Account Name" value={account.accName} />
            <Field label="Account Type" value={TYPE_LABELS[account.type] ?? '—'} />
            <Field label="Status" value={
              STATUS_LABELS[account.status] === 'Active'
                ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Active</span>
                : <span className="badge badge-grey">Inactive</span>
            } />
            <Field label="Blocked" value={
              account.blocked
                ? <span className="badge badge-red">Blocked</span>
                : <span className="badge badge-grey">No</span>
            } wide />
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
