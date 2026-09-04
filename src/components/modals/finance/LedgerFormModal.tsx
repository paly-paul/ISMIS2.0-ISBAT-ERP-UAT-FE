'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { LedgerInput } from '@/lib/api/finance/ledger'
import { useLedger } from '@/hooks/finance/useLedgers'
import { useProcGlAccounts } from '@/hooks/finance/useProcGlAccounts'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
interface LedgerFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  ledgerGuid: string | null
  createLedger: {
    mutate: (input: LedgerInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateLedger: {
    mutate: (variables: { guid: string; input: LedgerInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function LedgerFormModal({ isOpen, onClose, showToast, mode, ledgerGuid, createLedger, updateLedger }: LedgerFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: ledger, isLoading, isError, error } = useLedger(isEdit ? ledgerGuid : null, isEdit && isOpen)
  const { data: glAccounts = [] } = useProcGlAccounts()

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [ledgerCode, setLedgerCode] = useState('')
  const [ledgerName, setLedgerName] = useState('')
  const [procGlAccountGuid, setProcGlAccountGuid] = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  const glAccountOptions = glAccounts.map(a => ({ value: a.procGlAccountGuid, label: `${a.shortCode} — ${a.accName}` }))

  // Fill the form when the selected ledger loads. procGlAccountGuid may not
  // actually be present on the read shape (only confirmed via intGlAccount) —
  // when it's missing but intGlAccount isn't, there's an existing link we
  // can't resolve, so the picker starts empty and the modal warns below.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && ledger) {
      setLedgerCode(ledger.ledgerCode)
      setLedgerName(ledger.ledgerName)
      setProcGlAccountGuid(ledger.procGlAccountGuid ?? '')
    } else if (!isEdit) {
      setLedgerCode(''); setLedgerName(''); setProcGlAccountGuid('')
    }
    setErrors({})
  }, [isOpen, isEdit, ledger])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!ledgerCode.trim()) e.ledgerCode = 'Ledger Code is required'
    if (!ledgerName.trim()) e.ledgerName = 'Ledger Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !ledgerGuid) return
    if (!validate()) return
    const input: LedgerInput = { ledgerCode, ledgerName, procGlAccountGuid: procGlAccountGuid || null }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Ledger updated successfully' : 'Ledger added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} ledger. Please try again.`)

    if (isEdit && ledgerGuid) {
      updateLedger.mutate({ guid: ledgerGuid, input }, { onSuccess, onError })
    } else {
      createLedger.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateLedger.isPending : createLedger.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Ledger Updated!' : 'Ledger Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new ledger has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Ledger" : "Couldn't Add Ledger"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Ledger"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load ledger details.') : 'Failed to load ledger details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !ledger)) {
    return (
      <div className="modal-overlay open" id="edit-ledger-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Ledger</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading ledger details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-ledger-modal' : 'new-ledger-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-book'}`}></i> {isEdit ? 'Edit Ledger' : 'Add Ledger'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Ledger Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. TF'}
              maxLength={20}
              value={ledgerCode}
              onChange={e => { setLedgerCode(e.target.value.toUpperCase()); clearError('ledgerCode') }}
              style={errors.ledgerCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.ledgerCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.ledgerCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Ledger Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Tuition Fee'}
              maxLength={100}
              value={ledgerName}
              onChange={e => { setLedgerName(e.target.value); clearError('ledgerName') }}
              style={errors.ledgerName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.ledgerName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.ledgerName}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">GL Account</div>
            <SearchSelect
              options={glAccountOptions}
              value={procGlAccountGuid}
              onChange={setProcGlAccountGuid}
              placeholder="Optional — link to a GL account"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Ledger' : 'Add Ledger')}
          </button>
        </div>
      </div>
    </div>
  )
}
