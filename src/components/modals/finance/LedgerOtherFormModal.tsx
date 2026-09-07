'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { LedgerOtherInput } from '@/lib/api/finance/ledgerOthersMaster'
import { useLedgerOther } from '@/hooks/finance/useLedgerOthersMaster'
import { useProcGlAccounts } from '@/hooks/finance/useProcGlAccounts'
import { AuthError } from '@/lib/api/client'

// Add and Edit share this form — differ in prefill and which mutation runs.
// Same structure as LedgerFormModal (tuition ledgers), adapted for
// ledger-others/put-ledger-other.md's own "full replacement" warning: the
// PUT clears procGlAccountGuid when it isn't sent, rather than leaving an
// existing mapping alone, so Edit always resends whatever the picker holds
// (including a blank/detached state) rather than omitting the field.
interface LedgerOtherFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  ledgerOthersGuid: string | null
  createLedgerOther: {
    mutate: (input: LedgerOtherInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateLedgerOther: {
    mutate: (variables: { guid: string; input: LedgerOtherInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function LedgerOtherFormModal({ isOpen, onClose, showToast, mode, ledgerOthersGuid, createLedgerOther, updateLedgerOther }: LedgerOtherFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: ledgerOther, isLoading, isError, error } = useLedgerOther(isEdit ? ledgerOthersGuid : null, isEdit && isOpen)
  const { data: glAccounts = [] } = useProcGlAccounts()

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [ledgerCode, setLedgerCode] = useState('')
  const [ledgerName, setLedgerName] = useState('')
  const [procGlAccountGuid, setProcGlAccountGuid] = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  const glAccountOptions = glAccounts.map(a => ({ value: a.procGlAccountGuid, label: `${a.shortCode} — ${a.accName}` }))

  // Fill the form when the selected other-ledger loads. procGlAccountGuid
  // may not actually be present on the read shape (only intGlAccount is
  // documented) — when it's missing but intGlAccount isn't, there's an
  // existing link we can't resolve, so the picker starts empty and saving
  // as-is will detach it (per put-ledger-other.md's full-replacement note).
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && ledgerOther) {
      setLedgerCode(ledgerOther.ledgerCode)
      setLedgerName(ledgerOther.ledgerName)
      setProcGlAccountGuid(ledgerOther.procGlAccountGuid ?? '')
    } else if (!isEdit) {
      setLedgerCode(''); setLedgerName(''); setProcGlAccountGuid('')
    }
    setErrors({})
  }, [isOpen, isEdit, ledgerOther])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!ledgerCode.trim()) e.ledgerCode = 'Ledger Code is required'
    else if (ledgerCode.trim().length > 20) e.ledgerCode = 'Ledger Code must be 20 characters or fewer'
    if (!ledgerName.trim()) e.ledgerName = 'Ledger Name is required'
    else if (ledgerName.trim().length > 100) e.ledgerName = 'Ledger Name must be 100 characters or fewer'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !ledgerOthersGuid) return
    if (!validate()) return
    const input: LedgerOtherInput = { ledgerCode: ledgerCode.trim(), ledgerName: ledgerName.trim(), procGlAccountGuid: procGlAccountGuid || null }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Other ledger updated successfully' : 'Other ledger added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} other ledger. Please try again.`)

    if (isEdit && ledgerOthersGuid) {
      updateLedgerOther.mutate({ guid: ledgerOthersGuid, input }, { onSuccess, onError })
    } else {
      createLedgerOther.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateLedgerOther.isPending : createLedgerOther.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Other Ledger Updated!' : 'Other Ledger Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new other ledger has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Other Ledger" : "Couldn't Add Other Ledger"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Other Ledger"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load other ledger details.') : 'Failed to load other ledger details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !ledgerOther)) {
    return (
      <div className="modal-overlay open" id="edit-ledger-other-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Other Ledger</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading other ledger details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-ledger-other-modal' : 'new-ledger-other-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-book'}`}></i> {isEdit ? 'Edit Other Ledger' : 'Add Other Ledger'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Ledger Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. LEF'}
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
              placeholder={isEdit ? undefined : 'e.g. Lateral Entry Fee'}
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
            {isEdit && (
              <div className="text-g400 mt-1" style={{ fontSize: 11 }}>
                Saving always sets this field exactly as shown here — leaving it blank clears any existing GL account link rather than leaving it alone.
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Other Ledger' : 'Add Other Ledger')}
          </button>
        </div>
      </div>
    </div>
  )
}
