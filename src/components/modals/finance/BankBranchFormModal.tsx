'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { BankBranchInput } from '@/lib/api/finance/bankBranch'
import { ProcBankStatus, STATUS_LABELS, STATUS_VALUES } from '@/lib/api/finance/procBank'
import { useBankBranch } from '@/hooks/finance/useBankBranches'
import { useBanks } from '@/hooks/finance/useBanks'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface BankBranchFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  bankBranchGuid: string | null
  createBankBranch: {
    mutate: (input: BankBranchInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateBankBranch: {
    mutate: (variables: { guid: string; input: BankBranchInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function BankBranchFormModal({ isOpen, onClose, showToast, mode, bankBranchGuid, createBankBranch, updateBankBranch }: BankBranchFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: branch, isLoading, isError, error } = useBankBranch(isEdit ? bankBranchGuid : null, isEdit && isOpen)
  const { data: banks = [] } = useBanks()

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [shortCode, setShortCode]   = useState('')
  const [branchName, setBranchName] = useState('')
  const [bankGuid, setBankGuid]     = useState('')
  const [compCode, setCompCode]     = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [status, setStatus]         = useState<ProcBankStatus>('Active')
  const [sortCode, setSortCode]     = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  const bankOptions = banks.map(b => ({ value: b.bankGuid, label: `${b.shortCode} — ${b.bankName}` }))

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && branch) {
      setShortCode(branch.shortCode)
      setBranchName(branch.branchName)
      setBankGuid(branch.bankGuid)
      setCompCode(branch.compCode != null ? String(branch.compCode) : '')
      setBranchCode(branch.branchCode != null ? String(branch.branchCode) : '')
      setStatus(STATUS_LABELS[branch.status] ?? 'Active')
      setSortCode(branch.sortCode)
    } else if (!isEdit) {
      setShortCode(''); setBranchName(''); setBankGuid(''); setCompCode(''); setBranchCode('')
      setStatus('Active'); setSortCode('')
    }
    setErrors({})
  }, [isOpen, isEdit, branch])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!shortCode.trim()) e.shortCode = 'Short Code is required'
    if (!branchName.trim()) e.branchName = 'Branch Name is required'
    if (!bankGuid) e.bankGuid = 'Bank is required'
    if (!sortCode.trim()) e.sortCode = 'Sort Code is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !bankBranchGuid) return
    if (!validate()) return
    const input: BankBranchInput = {
      shortCode,
      branchName,
      bankGuid,
      compCode: compCode ? +compCode : null,
      branchCode: branchCode ? +branchCode : null,
      status: STATUS_VALUES[status],
      sortCode,
    }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Bank branch updated successfully' : 'Bank branch added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} bank branch. Please try again.`)

    if (isEdit && bankBranchGuid) {
      updateBankBranch.mutate({ guid: bankBranchGuid, input }, { onSuccess, onError })
    } else {
      createBankBranch.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateBankBranch.isPending : createBankBranch.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Bank Branch Updated!' : 'Bank Branch Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new bank branch has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Bank Branch" : "Couldn't Add Bank Branch"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Bank Branch"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load bank branch details.') : 'Failed to load bank branch details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !branch)) {
    return (
      <div className="modal-overlay open" id="edit-bank-branch-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Bank Branch</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading bank branch details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-bank-branch-modal' : 'new-bank-branch-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-map-marker'}`}></i> {isEdit ? 'Edit Bank Branch' : 'Add Bank Branch'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Bank <span className="req">*</span></div>
            <SearchSelect
              options={bankOptions}
              value={bankGuid}
              onChange={val => { setBankGuid(val); clearError('bankGuid') }}
              placeholder="Select bank"
            />
            {errors.bankGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.bankGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Short Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. STBC-KLA'}
              maxLength={10}
              value={shortCode}
              onChange={e => { setShortCode(e.target.value.toUpperCase()); clearError('shortCode') }}
              style={errors.shortCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.shortCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.shortCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Branch Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Kampala Main Branch'}
              maxLength={100}
              value={branchName}
              onChange={e => { setBranchName(e.target.value); clearError('branchName') }}
              style={errors.branchName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.branchName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.branchName}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Sort Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. 080122'}
              maxLength={10}
              value={sortCode}
              onChange={e => { setSortCode(e.target.value.toUpperCase()); clearError('sortCode') }}
              style={errors.sortCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.sortCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.sortCode}</p>}
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
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Bank Branch' : 'Add Bank Branch')}
          </button>
        </div>
      </div>
    </div>
  )
}
