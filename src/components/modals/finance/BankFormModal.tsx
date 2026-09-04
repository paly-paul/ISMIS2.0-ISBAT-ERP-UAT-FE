'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { BankInput } from '@/lib/api/finance/bank'
import { ProcBankStatus, STATUS_LABELS, STATUS_VALUES } from '@/lib/api/finance/procBank'
import { useBank } from '@/hooks/finance/useBanks'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface BankFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  bankGuid: string | null
  createBank: {
    mutate: (input: BankInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateBank: {
    mutate: (variables: { guid: string; input: BankInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function BankFormModal({ isOpen, onClose, showToast, mode, bankGuid, createBank, updateBank }: BankFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: bank, isLoading, isError, error } = useBank(isEdit ? bankGuid : null, isEdit && isOpen)

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [shortCode, setShortCode]   = useState('')
  const [bankName, setBankName]     = useState('')
  const [compCode, setCompCode]     = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [status, setStatus]         = useState<ProcBankStatus>('Active')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && bank) {
      setShortCode(bank.shortCode)
      setBankName(bank.bankName)
      setCompCode(bank.compCode != null ? String(bank.compCode) : '')
      setBranchCode(bank.branchCode != null ? String(bank.branchCode) : '')
      setStatus(STATUS_LABELS[bank.status] ?? 'Active')
    } else if (!isEdit) {
      setShortCode(''); setBankName(''); setCompCode(''); setBranchCode(''); setStatus('Active')
    }
    setErrors({})
  }, [isOpen, isEdit, bank])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!shortCode.trim()) e.shortCode = 'Short Code is required'
    if (!bankName.trim()) e.bankName = 'Bank Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !bankGuid) return
    if (!validate()) return
    const input: BankInput = {
      shortCode,
      bankName,
      compCode: compCode ? +compCode : null,
      branchCode: branchCode ? +branchCode : null,
      status: STATUS_VALUES[status],
    }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Bank updated successfully' : 'Bank added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} bank. Please try again.`)

    if (isEdit && bankGuid) {
      updateBank.mutate({ guid: bankGuid, input }, { onSuccess, onError })
    } else {
      createBank.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateBank.isPending : createBank.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Bank Updated!' : 'Bank Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new bank has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Bank" : "Couldn't Add Bank"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Bank"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load bank details.') : 'Failed to load bank details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !bank)) {
    return (
      <div className="modal-overlay open" id="edit-bank-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Bank</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading bank details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-bank-modal' : 'new-bank-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-coin'}`}></i> {isEdit ? 'Edit Bank' : 'Add Bank'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Short Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. DTB'}
              maxLength={10}
              value={shortCode}
              onChange={e => { setShortCode(e.target.value.toUpperCase()); clearError('shortCode') }}
              style={errors.shortCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.shortCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.shortCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Bank Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Diamond Trust Bank'}
              maxLength={100}
              value={bankName}
              onChange={e => { setBankName(e.target.value); clearError('bankName') }}
              style={errors.bankName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.bankName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.bankName}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Company Code</div>
            <input
              className="ctrl"
              type="number"
              placeholder={isEdit ? undefined : 'Optional'}
              value={compCode}
              onChange={e => setCompCode(e.target.value)}
            />
          </div>
          <div className="fg">
            <div className="lbl">Branch Code</div>
            <input
              className="ctrl"
              type="number"
              placeholder={isEdit ? undefined : 'Optional'}
              value={branchCode}
              onChange={e => setBranchCode(e.target.value)}
            />
          </div>
          <div className="fg">
            <div className="lbl">Status</div>
            <SearchSelect
              options={['Active', 'Inactive']}
              value={status}
              onChange={val => setStatus(val as ProcBankStatus)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Bank' : 'Add Bank')}
          </button>
        </div>
      </div>
    </div>
  )
}
