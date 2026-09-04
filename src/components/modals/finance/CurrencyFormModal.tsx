'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { CurrencyInput } from '@/lib/api/finance/currencyMaster'
import { useCurrency } from '@/hooks/finance/useCurrencies'
import { AuthError } from '@/lib/api/client'

// Single form for both Add and Edit — the two only ever differed in title
// text, prefill, and which mutation fires.
interface CurrencyFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  currencyGuid: string | null
  createCurrency: {
    mutate: (input: CurrencyInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateCurrency: {
    mutate: (variables: { guid: string; input: CurrencyInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function CurrencyFormModal({ isOpen, onClose, showToast, mode, currencyGuid, createCurrency, updateCurrency }: CurrencyFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: currency, isLoading, isError, error } = useCurrency(isEdit ? currencyGuid : null, isEdit && isOpen)

  const [saved, setSaved]               = useState(false)
  const [failure, setFailure]           = useState<string | null>(null)
  const [currencyCode, setCurrencyCode] = useState('')
  const [currencyName, setCurrencyName] = useState('')
  const [isDefault, setIsDefault]       = useState(false)
  const [errors, setErrors]             = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && currency) {
      setCurrencyCode(currency.currencyCode)
      setCurrencyName(currency.currencyName)
      setIsDefault(currency.isDefault === 1)
    } else if (!isEdit) {
      setCurrencyCode(''); setCurrencyName(''); setIsDefault(false)
    }
    setErrors({})
  }, [isOpen, isEdit, currency])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!currencyCode.trim()) e.currencyCode = 'Currency Code is required'
    if (!currencyName.trim()) e.currencyName = 'Currency Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Map known backend failures to field errors on add — a bad_request there
  // usually means a duplicate currencyCode, which is actionable right on the
  // form; anything else (either mode) shows the failure popup instead.
  function handleError(error: Error) {
    if (!isEdit) {
      const code = error instanceof AuthError ? error.code : undefined
      if (code === 'bad_request') {
        setErrors(prev => ({ ...prev, currencyCode: error.message || 'A currency with this code already exists.' }))
        return
      }
    }
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} currency. Please try again.`)
  }

  function handleSubmit() {
    if (isEdit && !currencyGuid) return
    if (!validate()) return
    const input: CurrencyInput = { currencyCode, currencyName, isDefault: isDefault ? 1 : 0 }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Currency updated successfully' : 'Currency added successfully') }

    if (isEdit && currencyGuid) {
      updateCurrency.mutate({ guid: currencyGuid, input }, { onSuccess, onError: handleError })
    } else {
      createCurrency.mutate(input, { onSuccess, onError: handleError })
    }
  }

  const isPending = isEdit ? updateCurrency.isPending : createCurrency.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Currency Updated!' : 'Currency Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new currency has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Currency" : "Couldn't Add Currency"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Currency"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load currency details.') : 'Failed to load currency details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !currency)) {
    return (
      <div className="modal-overlay open" id="edit-currency-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Currency</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading currency details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-currency-modal' : 'new-currency-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-dollar'}`}></i> {isEdit ? 'Edit Currency' : 'Add Currency'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Currency Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. UGX'}
              maxLength={4}
              value={currencyCode}
              onChange={e => { setCurrencyCode(e.target.value); if (errors.currencyCode) setErrors(p => ({ ...p, currencyCode: '' })) }}
              style={errors.currencyCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.currencyCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.currencyCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Currency Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Uganda Shilling'}
              value={currencyName}
              onChange={e => { setCurrencyName(e.target.value); if (errors.currencyName) setErrors(p => ({ ...p, currencyName: '' })) }}
              style={errors.currencyName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.currencyName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.currencyName}</p>}
          </div>
          <div className="fg span2">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--b500)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)', fontWeight: 500 }}>Set as default currency</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Currency' : 'Add Currency')}
          </button>
        </div>
      </div>
    </div>
  )
}
