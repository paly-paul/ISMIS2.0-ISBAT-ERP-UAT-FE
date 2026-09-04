'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { ProcBankInput, ProcBankStatus, STATUS_LABELS, STATUS_VALUES } from '@/lib/api/finance/procBank'
import { useProcBank } from '@/hooks/finance/useProcBanks'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface ProcBankFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  procBankGuid: string | null
  createProcBank: {
    mutate: (input: ProcBankInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateProcBank: {
    mutate: (variables: { guid: string; input: ProcBankInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function ProcBankFormModal({ isOpen, onClose, showToast, mode, procBankGuid, createProcBank, updateProcBank }: ProcBankFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: bank, isLoading, isError, error } = useProcBank(isEdit ? procBankGuid : null, isEdit && isOpen)
  const { data: currencies = [] } = useFinanceCurrencies()

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [shortCode, setShortCode]   = useState('')
  const [bankName, setBankName]     = useState('')
  const [compCode, setCompCode]     = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [status, setStatus]         = useState<ProcBankStatus>('Active')
  const [accountCode, setAccountCode] = useState('')
  const [blocked, setBlocked]       = useState(false)
  const [currencyGuid, setCurrencyGuid] = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  const currencyOptions = currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && bank) {
      setShortCode(bank.shortCode)
      setBankName(bank.bankName)
      setCompCode(String(bank.compCode))
      setBranchCode(String(bank.branchCode))
      setStatus(STATUS_LABELS[bank.status] ?? 'Active')
      setAccountCode(bank.accountCode)
      setBlocked(bank.blocked)
      setCurrencyGuid(bank.currencyGuid ?? '')
    } else if (!isEdit) {
      setShortCode(''); setBankName(''); setCompCode(''); setBranchCode(''); setStatus('Active')
      setAccountCode(''); setBlocked(false); setCurrencyGuid('')
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
    if (!compCode.trim()) e.compCode = 'Company Code is required'
    if (!branchCode.trim()) e.branchCode = 'Branch Code is required'
    if (!accountCode.trim()) e.accountCode = 'Account Code is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !procBankGuid) return
    if (!validate()) return
    const input: ProcBankInput = {
      shortCode,
      bankName,
      compCode: +compCode || 0,
      branchCode: +branchCode || 0,
      status: STATUS_VALUES[status],
      accountCode,
      blocked,
      currencyGuid: currencyGuid || null,
    }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Bank updated successfully' : 'Bank added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} bank. Please try again.`)

    if (isEdit && procBankGuid) {
      updateProcBank.mutate({ guid: procBankGuid, input }, { onSuccess, onError })
    } else {
      createProcBank.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateProcBank.isPending : createProcBank.isPending

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
      <div className="modal-overlay open" id="edit-proc-bank-modal">
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
    <div className="modal-overlay open" id={isEdit ? 'edit-proc-bank-modal' : 'new-proc-bank-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-wallet'}`}></i> {isEdit ? 'Edit Bank' : 'Add Bank'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Short Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. BNK001'}
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
              placeholder={isEdit ? undefined : 'e.g. DTB-USH'}
              value={bankName}
              onChange={e => { setBankName(e.target.value); clearError('bankName') }}
              style={errors.bankName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.bankName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.bankName}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Company Code <span className="req">*</span></div>
            <input
              className="ctrl"
              type="number"
              placeholder={isEdit ? undefined : 'e.g. 10'}
              value={compCode}
              onChange={e => { setCompCode(e.target.value); clearError('compCode') }}
              style={errors.compCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.compCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.compCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Branch Code <span className="req">*</span></div>
            <input
              className="ctrl"
              type="number"
              placeholder={isEdit ? undefined : 'e.g. 1'}
              value={branchCode}
              onChange={e => { setBranchCode(e.target.value); clearError('branchCode') }}
              style={errors.branchCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.branchCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.branchCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Account Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. 0107927927'}
              value={accountCode}
              onChange={e => { setAccountCode(e.target.value); clearError('accountCode') }}
              style={errors.accountCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.accountCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.accountCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Currency</div>
            <SearchSelect
              options={currencyOptions}
              value={currencyGuid}
              onChange={setCurrencyGuid}
              placeholder="Select currency"
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
          <div className="fg" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={blocked}
                onChange={e => setBlocked(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--b500)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)', fontWeight: 500 }}>Block this bank from use</span>
            </label>
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
