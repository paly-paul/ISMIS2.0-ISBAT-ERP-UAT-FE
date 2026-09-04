'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { ProcGlAccountInput, ProcGlAccountStatus, ProcGlAccountType, STATUS_LABELS, STATUS_VALUES, TYPE_LABELS, TYPE_VALUES } from '@/lib/api/finance/procGlAccount'
import { useProcGlAccount } from '@/hooks/finance/useProcGlAccounts'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface ProcGlAccountFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  procGlAccountGuid: string | null
  createProcGlAccount: {
    mutate: (input: ProcGlAccountInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateProcGlAccount: {
    mutate: (variables: { guid: string; input: ProcGlAccountInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function ProcGlAccountFormModal({ isOpen, onClose, showToast, mode, procGlAccountGuid, createProcGlAccount, updateProcGlAccount }: ProcGlAccountFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: account, isLoading, isError, error } = useProcGlAccount(isEdit ? procGlAccountGuid : null, isEdit && isOpen)

  const [saved, setSaved]         = useState(false)
  const [failure, setFailure]     = useState<string | null>(null)
  const [shortCode, setShortCode] = useState('')
  const [accName, setAccName]     = useState('')
  const [status, setStatus]       = useState<ProcGlAccountStatus>('Active')
  const [type, setType]           = useState<ProcGlAccountType | ''>('')
  const [blocked, setBlocked]     = useState(false)
  const [errors, setErrors]       = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && account) {
      setShortCode(account.shortCode)
      setAccName(account.accName)
      setStatus(STATUS_LABELS[account.status] ?? 'Active')
      setType(TYPE_LABELS[account.type] ?? '')
      setBlocked(account.blocked)
    } else if (!isEdit) {
      setShortCode(''); setAccName(''); setStatus('Active'); setType(''); setBlocked(false)
    }
    setErrors({})
  }, [isOpen, isEdit, account])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!shortCode.trim()) e.shortCode = 'Short Code is required'
    if (!accName.trim()) e.accName = 'Account Name is required'
    if (!type) e.type = 'Account Type is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !procGlAccountGuid) return
    if (!validate()) return
    const input: ProcGlAccountInput = {
      shortCode,
      accName,
      status: STATUS_VALUES[status],
      type: TYPE_VALUES[type as ProcGlAccountType],
      typeName: null,
      blocked,
    }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'GL account updated successfully' : 'GL account added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} GL account. Please try again.`)

    if (isEdit && procGlAccountGuid) {
      updateProcGlAccount.mutate({ guid: procGlAccountGuid, input }, { onSuccess, onError })
    } else {
      createProcGlAccount.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateProcGlAccount.isPending : createProcGlAccount.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'GL Account Updated!' : 'GL Account Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new GL account has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title={isEdit ? "Couldn't Update GL Account" : "Couldn't Add GL Account"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load GL Account"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load GL account details.') : 'Failed to load GL account details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !account)) {
    return (
      <div className="modal-overlay open" id="edit-proc-gl-account-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit GL Account</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading GL account details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-proc-gl-account-modal' : 'new-proc-gl-account-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-calculator'}`}></i> {isEdit ? 'Edit GL Account' : 'Add GL Account'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Short Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. 11111'}
              value={shortCode}
              onChange={e => { setShortCode(e.target.value); clearError('shortCode') }}
              style={errors.shortCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.shortCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.shortCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Account Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Test GL Account'}
              value={accName}
              onChange={e => { setAccName(e.target.value); clearError('accName') }}
              style={errors.accName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.accName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.accName}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Account Type <span className="req">*</span></div>
            <SearchSelect
              options={['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']}
              value={type}
              onChange={val => { setType(val as ProcGlAccountType); clearError('type') }}
              placeholder="Select type"
            />
            {errors.type && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.type}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Status</div>
            <SearchSelect
              options={['Active', 'Inactive']}
              value={status}
              onChange={val => setStatus(val as ProcGlAccountStatus)}
            />
          </div>
          <div className="fg span2">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={blocked}
                onChange={e => setBlocked(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--b500)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)', fontWeight: 500 }}>Block this GL account from use</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update GL Account' : 'Add GL Account')}
          </button>
        </div>
      </div>
    </div>
  )
}
