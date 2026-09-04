'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { Country } from '@/lib/api/academic/country'

interface ViewCountryModalProps extends ModalProps {
  country: Country | null
  onEdit: () => void
}

export function ViewCountryModal({ isOpen, onClose, country, onEdit }: ViewCountryModalProps) {
  const [countryCode, setCountryCode]       = useState('')
  const [countryName, setCountryName]       = useState('')
  const [nationality, setNationality]       = useState('')
  const [countryPrefix, setCountryPrefix]   = useState('')
  const [defaultCountry, setDefaultCountry] = useState(false)

  useEffect(() => {
    if (isOpen && country) {
      setCountryCode(country.countryCode)
      setCountryName(country.countryName)
      setNationality(country.nationality)
      setCountryPrefix(country.countryPrefix)
      setDefaultCountry(country.defaultCountry === 1)
    }
  }, [isOpen, country])

  if (!isOpen || !country) return null

  function handleClose() { onClose() }

  return (
    <div className="modal-overlay open" id="view-country-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Country</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Country Code </div>
            <div className="val font-mono uppercase">{countryCode || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Dial Prefix </div>
            <div className="val">{countryPrefix || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Country Name </div>
            <div className="val">{countryName || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Nationality </div>
            <div className="val">{nationality || '—'}</div>
          </div>
          <div className="fg">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
              <div className="val">{defaultCountry ? 'Yes' : 'No'}</div>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)', fontWeight: 500 }}>Set as default country</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <span className="flex-1"></span>
          <button className="btn btn-neu" onClick={onEdit} style={{ marginRight: 8 }}>
            <i className="lni lni-pencil"></i> Edit
          </button>
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
