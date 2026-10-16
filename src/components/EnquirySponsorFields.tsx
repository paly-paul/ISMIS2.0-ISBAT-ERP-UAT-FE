'use client'
import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { useCountries, useSearchCountriesInfinite } from '@/hooks/config/useCountries'
import { countryPickerOptions, findDefaultCountry, phoneCountryOptions } from '@/lib/api/academic/country'
import { flattenUniquePages } from '@/lib/pagination'
import type { EnquiryInput } from '@/lib/api/admission/enquiry'

// Optional Sponsor section shared by the Online / Kiosk / On-Desk enquiry
// forms. Same shape as the student's own phone: a dial-code country picker
// (Country GUID → spPhoneCountryGuid) beside a digits-only box (spPhone).
// The page owns the values (so it can validate, reset and send them); this
// component owns only its two country pickers' search state.

export interface SponsorValues {
  spName: string
  spPhoneCountryGuid: string
  spPhone: string
  spEmail: string
  spCountryGuid: string
}

export const EMPTY_SPONSOR: SponsorValues = { spName: '', spPhoneCountryGuid: '', spPhone: '', spEmail: '', spCountryGuid: '' }

// post-enquiry.md: spPhone ^\d{7,15}$; spName and spEmail max 100 (the
// student's own email is capped at 50, so EMAIL_MAX doesn't apply here).
const PHONE_MIN = 7
const PHONE_MAX = 15
const SP_TEXT_MAX = 100
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Error keys match the field names, so they merge into the page's errors map
// and scrollToFirstError finds them.
export function validateSponsor(sp: SponsorValues): Record<string, string> {
  const e: Record<string, string> = {}
  if (sp.spPhone && sp.spPhone.length < PHONE_MIN) e.spPhone = `Sponsor phone must be ${PHONE_MIN} to ${PHONE_MAX} digits`
  else if (sp.spPhone && !sp.spPhoneCountryGuid) e.spPhone = 'Select the sponsor phone’s country code'
  if (sp.spEmail.trim() && !EMAIL_RE.test(sp.spEmail.trim())) e.spEmail = 'Enter a valid sponsor email'
  return e
}

// Field for a create error the server attributes to a sponsor field, so the
// pages can show it inline instead of in the failure popup. Checked before
// the pages' own /email/ and /mobile/ matches, which would otherwise claim it.
export function sponsorErrorField(msg: string): string | null {
  if (/sponsor phone/i.test(msg)) return 'spPhone'
  if (/sponsor email|sp ?email/i.test(msg)) return 'spEmail'
  return null
}

// Blank fields go out as null. The dial-code country is only sent alongside
// an actual number, since it defaults to Uganda before anything is typed.
export function sponsorPayload(sp: SponsorValues): Pick<EnquiryInput, 'spName' | 'spPhone' | 'spPhoneCountryGuid' | 'spEmail' | 'spCountryGuid'> {
  return {
    spName: sp.spName.trim().replace(/[’‘]/g, "'") || null,
    spPhone: sp.spPhone || null,
    spPhoneCountryGuid: sp.spPhone ? sp.spPhoneCountryGuid || null : null,
    spEmail: sp.spEmail.trim() || null,
    spCountryGuid: sp.spCountryGuid || null,
  }
}

const errStyle = { color: 'var(--red)', fontSize: 12, marginTop: 4 }

export function EnquirySponsorFields({ value, onChange, errors, onClearError }: {
  value: SponsorValues
  onChange: (next: SponsorValues) => void
  errors: Record<string, string>
  onClearError: (field: string) => void
}) {
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [phoneCodePickerOpen, setPhoneCodePickerOpen] = useState(false)
  useEffect(() => { const t = setTimeout(() => setCommittedSearch(search.trim()), 300); return () => clearTimeout(t) }, [search])

  const countryQuery = useSearchCountriesInfinite(committedSearch, 20, countryPickerOpen || phoneCodePickerOpen)
  const countries = useMemo(() => flattenUniquePages(countryQuery.data?.pages ?? [], c => c.countryGuid), [countryQuery.data])
  const { data: allCountries = [] } = useCountries()

  // Default the dial code to Uganda, like the student's phone.
  useEffect(() => {
    if (value.spPhoneCountryGuid || !allCountries.length) return
    const home = findDefaultCountry(allCountries)
    if (home) onChange({ ...value, spPhoneCountryGuid: home.countryGuid })
  }, [allCountries, value, onChange])

  const spCountryOptions = countryPickerOptions(countries, allCountries, value.spCountryGuid)
  const phoneCodeOptions = phoneCountryOptions(countries, allCountries, value.spPhoneCountryGuid)

  function set<K extends keyof SponsorValues>(key: K, v: string) {
    onChange({ ...value, [key]: v })
  }

  // Picking the sponsor's country also points their dial code at it — a UX
  // default only, still overridable from the dial-code picker.
  function selectCountry(guid: string) {
    onChange({ ...value, spCountryGuid: guid, ...(guid ? { spPhoneCountryGuid: guid } : {}) })
  }

  const pickerProps = {
    onSearch: setSearch,
    isLoading: countryQuery.isLoading,
    hasNextPage: countryQuery.hasNextPage,
    isFetchingNextPage: countryQuery.isFetchingNextPage,
    onLoadMore: () => countryQuery.fetchNextPage(),
  }

  return (
    <>
      <div className="sec-divider mt-5">Sponsor Details</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="fg">
          <label className="lbl">Sponsor Name</label>
          <input className="ctrl" placeholder="Person or organisation" maxLength={SP_TEXT_MAX} value={value.spName} onChange={e => set('spName', e.target.value)} />
        </div>
        <div className="fg">
          <label className="lbl">Sponsor Phone</label>
          <div className="flex gap-2">
            <SearchSelect options={phoneCodeOptions} value={value.spPhoneCountryGuid} onChange={v => { set('spPhoneCountryGuid', v); onClearError('spPhone') }} onOpenChange={setPhoneCodePickerOpen} {...pickerProps} style={{ width: 108, flexShrink: 0 }} />
            <input className="ctrl flex-1" type="tel" inputMode="numeric" placeholder="e.g. 772123456" maxLength={PHONE_MAX} value={value.spPhone} onChange={e => { set('spPhone', e.target.value.replace(/\D/g, '').slice(0, PHONE_MAX)); onClearError('spPhone') }} style={errors.spPhone ? { borderColor: 'var(--red)' } : undefined} />
          </div>
          {errors.spPhone && <p className="field-err" style={errStyle}>{errors.spPhone}</p>}
        </div>
        <div className="fg">
          <label className="lbl">Sponsor Email</label>
          <input className="ctrl" type="email" placeholder="sponsor@email.com" maxLength={SP_TEXT_MAX} value={value.spEmail} onChange={e => { set('spEmail', e.target.value); onClearError('spEmail') }} style={errors.spEmail ? { borderColor: 'var(--red)' } : undefined} />
          {errors.spEmail && <p className="field-err" style={errStyle}>{errors.spEmail}</p>}
        </div>
        <div className="fg">
          <label className="lbl">Sponsor Country</label>
          <SearchSelect placeholder="— select —" options={spCountryOptions} value={value.spCountryGuid} onChange={selectCountry} onOpenChange={setCountryPickerOpen} {...pickerProps} />
        </div>
      </div>
    </>
  )
}
