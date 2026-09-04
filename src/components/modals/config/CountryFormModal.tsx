'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { Country, CountryInput } from '@/lib/api/academic/country'
import { AuthError } from '@/lib/api/client'

interface CountryFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  country: Country | null
  createCountry: {
    mutate: (input: CountryInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateCountry: {
    mutate: (variables: { id: string; input: CountryInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function CountryFormModal({ isOpen, onClose, showToast, mode, country, createCountry, updateCountry }: CountryFormModalProps) {
  const isEdit = mode === 'edit'
  const [saved, setSaved]                   = useState(false)
  const [failure, setFailure]               = useState<string | null>(null)
  const [countryCode, setCountryCode]       = useState('')
  const [countryName, setCountryName]       = useState('')
  const [nationality, setNationality]       = useState('')
  const [countryPrefix, setCountryPrefix]   = useState('')
  const [defaultCountry, setDefaultCountry] = useState(false)
  const [errors, setErrors]                 = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && country) {
      setCountryCode(country.countryCode)
      setCountryName(country.countryName)
      setNationality(country.nationality)
      setCountryPrefix(country.countryPrefix)
      setDefaultCountry(country.defaultCountry === 1)
    } else if (!isEdit) {
      setCountryCode(''); setCountryName(''); setNationality(''); setCountryPrefix(''); setDefaultCountry(false)
    }
    setErrors({})
  }, [isOpen, isEdit, country])

  if (!isOpen || (isEdit && !country)) return null

  function handleClose() { setSaved(false); setFailure(null); onClose() }

  // Keep validation close to the form so errors appear immediately.
  function validate() {
    const e: Record<string, string> = {}
    if (!countryCode.trim())        e.countryCode   = 'Country Code is required'
    else if (countryCode.trim().length > 10) e.countryCode = 'Country Code must be 10 characters or fewer'
    if (!countryName.trim())        e.countryName   = 'Country Name is required'
    else if (countryName.trim().length > 100) e.countryName = 'Country Name must be 100 characters or fewer'
    if (!nationality.trim())        e.nationality   = 'Nationality is required'
    else if (nationality.trim().length > 100) e.nationality = 'Nationality must be 100 characters or fewer'
    if (!countryPrefix.trim())      e.countryPrefix = 'Dial Prefix is required'
    else if (countryPrefix.trim().length > 10) e.countryPrefix = 'Dial Prefix must be 10 characters or fewer'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Show field-level errors for known issues and use the popup for everything else.
  function handleMutateError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    if (code === 'bad_request') {
      setErrors(prev => ({ ...prev, countryCode: error.message || 'A country with this code already exists.' }))
      return
    }
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} country. Please try again.`)
  }

  function handleSubmit() {
    if (!validate()) return
    const input: CountryInput = { countryCode, countryName, nationality, countryPrefix, defaultCountry: defaultCountry ? 1 : 0 }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Country updated successfully' : 'Country added successfully') }

    if (isEdit && country) {
      updateCountry.mutate({ id: country.countryGuid, input }, { onSuccess, onError: handleMutateError })
    } else {
      createCountry.mutate(input, { onSuccess, onError: handleMutateError })
    }
  }

  const isPending = isEdit ? updateCountry.isPending : createCountry.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Country Updated!' : 'Country Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new country has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Country" : "Couldn't Add Country"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-country-modal' : 'new-country-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-world'}`}></i> {isEdit ? 'Edit Country' : 'Add Country'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Country Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. UG'}
              maxLength={10}
              value={countryCode}
              onChange={e => { setCountryCode(e.target.value); if (errors.countryCode) setErrors(p => ({ ...p, countryCode: '' })) }}
              style={errors.countryCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.countryCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.countryCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Dial Prefix <span className="req">*</span></div>
            <input
              className="ctrl font-mono"
              type="tel"
              inputMode="numeric"
              placeholder={isEdit ? undefined : 'e.g. +256'}
              maxLength={10}
              value={countryPrefix}
              onChange={e => { setCountryPrefix(e.target.value.replace(/[^0-9+]/g, '')); if (errors.countryPrefix) setErrors(p => ({ ...p, countryPrefix: '' })) }}
              style={errors.countryPrefix ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.countryPrefix && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.countryPrefix}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Country Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Uganda'}
              maxLength={100}
              value={countryName}
              onChange={e => { setCountryName(e.target.value); if (errors.countryName) setErrors(p => ({ ...p, countryName: '' })) }}
              style={errors.countryName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.countryName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.countryName}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Nationality <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Ugandan'}
              maxLength={100}
              value={nationality}
              onChange={e => { setNationality(e.target.value); if (errors.nationality) setErrors(p => ({ ...p, nationality: '' })) }}
              style={errors.nationality ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.nationality && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.nationality}</p>}
          </div>
          <div className="fg span2">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={defaultCountry}
                onChange={e => setDefaultCountry(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--b500)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)', fontWeight: 500 }}>Set as default country</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Country' : 'Add Country')}
          </button>
        </div>
      </div>
    </div>
  )
}
