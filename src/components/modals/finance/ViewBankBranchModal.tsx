'use client'
import { ModalProps } from '../types'
import { useBankBranch } from '@/hooks/finance/useBankBranches'
import { useBanks } from '@/hooks/finance/useBanks'
import { STATUS_LABELS } from '@/lib/api/finance/procBank'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewBankBranchModalProps extends ModalProps {
  bankBranchGuid: string | null
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

export function ViewBankBranchModal({ isOpen, onClose, bankBranchGuid, onEdit, canEdit }: ViewBankBranchModalProps) {
  const { data: branch, isLoading, isError, error } = useBankBranch(bankBranchGuid, isOpen)
  const { data: banks = [] } = useBanks()

  if (!isOpen) return null

  function bankName(guid: string) {
    return banks.find(b => b.bankGuid === guid)?.bankName ?? guid
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Bank Branch"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load bank branch details.') : 'Failed to load bank branch details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !branch) {
    return (
      <div className="modal-overlay open" id="view-bank-branch-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Bank Branch</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading bank branch details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-bank-branch-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Bank Branch — <span className="font-mono">{branch.shortCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Short Code" value={branch.shortCode} mono />
            <Field label="Branch Name" value={branch.branchName} />
            <Field label="Bank" value={bankName(branch.bankGuid)} />
            <Field label="Sort Code" value={branch.sortCode} mono />
            <Field label="Company Code" value={branch.compCode ?? '—'} />
            <Field label="Branch Code" value={branch.branchCode ?? '—'} />
            <Field label="Status" value={
              STATUS_LABELS[branch.status] === 'Active'
                ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Active</span>
                : <span className="badge badge-grey">Inactive</span>
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
