import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Older mock shape kept for reference.
// export interface Country {
//   id: string
//   countryCode: string
//   countryName: string
//   nationality: string
//   countryPrefix: string
//   defaultCountry: number
// }
//
// export type CountryInput = Omit<Country, 'id'>
//
// const mockCountries: Country[] = [
//   { id: '1', countryCode: 'UGA', countryName: 'Uganda',        nationality: 'Ugandan',        defaultCountry: 1, countryPrefix: '+256' },
//   { id: '2', countryCode: 'KEN', countryName: 'Kenya',          nationality: 'Kenyan',         defaultCountry: 0, countryPrefix: '+254' },
//   { id: '3', countryCode: 'TZA', countryName: 'Tanzania',       nationality: 'Tanzanian',      defaultCountry: 0, countryPrefix: '+255' },
//   { id: '4', countryCode: 'RWA', countryName: 'Rwanda',         nationality: 'Rwandan',        defaultCountry: 0, countryPrefix: '+250' },
//   { id: '5', countryCode: 'SSD', countryName: 'South Sudan',    nationality: 'South Sudanese', defaultCountry: 0, countryPrefix: '+211' },
//   { id: '6', countryCode: 'COD', countryName: 'DR Congo',       nationality: 'Congolese',      defaultCountry: 0, countryPrefix: '+243' },
//   { id: '7', countryCode: 'GBR', countryName: 'United Kingdom', nationality: 'British',        defaultCountry: 0, countryPrefix: '+44'  },
//   { id: '8', countryCode: 'IND', countryName: 'India',          nationality: 'Indian',         defaultCountry: 0, countryPrefix: '+91'  },
// ]
//
// export function getCountries(): Promise<Country[]> {
//   return Promise.resolve(mockCountries)
// }
//
// export function createCountry(input: CountryInput): Promise<Country> {
//   const country: Country = { id: String(mockCountries.length + 1), ...input }
//   mockCountries.push(country)
//   return Promise.resolve(country)
// }
//
// export function updateCountry(id: string, input: CountryInput): Promise<Country> {
//   const existing = mockCountries.find(c => c.id === id)
//   if (!existing) return Promise.reject(new Error('Country not found'))
//   Object.assign(existing, input)
//   return Promise.resolve(existing)
// }

// Confirmed via a real GET /api/v1/users/countries response — countryGuid
// is a real, confirmed guid (verified end-to-end: sending it as
// Application-Payments' countryGuid produced a successful payment). The
// previous intCountryCode field was a total fabrication — it never existed
// on this endpoint's response at all, silently breaking every consumer that
// relied on it (this page's own row key/delete id, and the Employee
// modals' country dropdown — see the notes there).
export interface Country {
  countryGuid: string
  countryCode: string
  countryName: string
  nationality: string
  defaultCountry: number
  countryPrefix: string
}

export type CountryInput = Omit<Country, 'countryGuid'>

// Confirmed via a real GET /api/v1/users/countries response (44 countries):
// despite the name, countryPrefix is NOT a dialing prefix — it's a mixed bag
// of 2-3 letter abbreviations ("UG", "ZM", "CBN", "IND", "US", ...), no two
// countries formatted the same way, useless for a phone country-code
// dropdown. countryCode is the real dialing code instead — every single
// value in that response matches the real ITU code (Uganda "256", Kenya
// "254", India "91", ...), the only oddity being the US/Russia rows padded
// to 3 digits ("001"/"007") for column alignment rather than an actual
// 3-digit code. Strips that padding back to the real code; used by the
// admission enquiry forms' phone-code dropdown (online/kiosk/ondesk-enquiry)
// instead of countryPrefix.
export function dialCode(country: Pick<Country, 'countryCode'>): string {
  return `+${country.countryCode.replace(/^0+(?=\d)/, '')}`
}

interface CountryListResponse {
  items: Country[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// This in-memory list is used only in mock mode.
const mockCountries: Country[] = [
  { countryGuid: 'mock-country-ug', countryCode: 'UGA', countryName: 'Uganda',        nationality: 'Ugandan',        defaultCountry: 1, countryPrefix: '+256' },
  { countryGuid: 'mock-country-ke', countryCode: 'KEN', countryName: 'Kenya',          nationality: 'Kenyan',         defaultCountry: 0, countryPrefix: '+254' },
  { countryGuid: 'mock-country-tz', countryCode: 'TZA', countryName: 'Tanzania',       nationality: 'Tanzanian',      defaultCountry: 0, countryPrefix: '+255' },
  { countryGuid: 'mock-country-rw', countryCode: 'RWA', countryName: 'Rwanda',         nationality: 'Rwandan',        defaultCountry: 0, countryPrefix: '+250' },
  { countryGuid: 'mock-country-ss', countryCode: 'SSD', countryName: 'South Sudan',    nationality: 'South Sudanese', defaultCountry: 0, countryPrefix: '+211' },
  { countryGuid: 'mock-country-cd', countryCode: 'COD', countryName: 'DR Congo',       nationality: 'Congolese',      defaultCountry: 0, countryPrefix: '+243' },
  { countryGuid: 'mock-country-gb', countryCode: 'GBR', countryName: 'United Kingdom', nationality: 'British',        defaultCountry: 0, countryPrefix: '+44'  },
  { countryGuid: 'mock-country-in', countryCode: 'IND', countryName: 'India',          nationality: 'Indian',         defaultCountry: 0, countryPrefix: '+91'  },
]

export function getCountries(page = 1, pageSize = 10): Promise<Country[]> {
  if (MOCK_AUTH) return Promise.resolve(mockCountries)
  return apiGet<CountryListResponse | null>(`/api/v1/users/countries?page=${page}&pageSize=${pageSize}`).then(data => data?.items ?? [])
}

export function createCountry(input: CountryInput): Promise<Country> {
  if (MOCK_AUTH) {
    const country: Country = { countryGuid: crypto.randomUUID(), ...input }
    mockCountries.push(country)
    return Promise.resolve(country)
  }
  return apiPost<Country>('/api/v1/users/countries', input)
}

export function updateCountry(id: string, input: CountryInput): Promise<Country> {
  if (MOCK_AUTH) {
    const existing = mockCountries.find(c => c.countryGuid === id)
    if (!existing) return Promise.reject(new Error('Country not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Country>(`/api/v1/users/countries/${id}`, input)
}

// DELETE /api/v1/users/countries/{id} — soft-delete (data: true on success).
export function deleteCountry(id: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockCountries.findIndex(c => c.countryGuid === id)
    if (index === -1) return Promise.reject(new Error('Country not found'))
    mockCountries.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/users/countries/${id}`)
}
