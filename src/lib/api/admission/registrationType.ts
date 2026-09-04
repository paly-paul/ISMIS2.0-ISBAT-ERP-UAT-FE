import { apiGet, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via registrar-desk-api-docs.html — GET
// /api/v1/admissions/registration-types. Sits outside the registrar-desk
// group despite backing one of its forms. Submit intType (not
// registrationTypeGuid) as registrationTypeId on POST .../register — the
// guid is for display/keying only, the command still takes the legacy int id.
export interface RegistrationType {
  intType: number
  registrationTypeGuid: string
  registrationType: string
}

const mockRegistrationTypes: RegistrationType[] = [
  { intType: 1, registrationTypeGuid: 'reg-type-mock-1', registrationType: 'Regular' },
  { intType: 2, registrationTypeGuid: 'reg-type-mock-2', registrationType: 'Lateral Entry' },
  { intType: 3, registrationTypeGuid: 'reg-type-mock-3', registrationType: 'Credit Exemption' },
  { intType: 4, registrationTypeGuid: 'reg-type-mock-4', registrationType: 'Existing Students' },
]

export function getRegistrationTypes(): Promise<RegistrationType[]> {
  if (MOCK_AUTH) return Promise.resolve(mockRegistrationTypes)
  return apiGet<RegistrationType[] | null>('/api/v1/admissions/registration-types')
    .then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
    .catch(err => {
      // Confirmed via a real response: an empty Registration Type master
      // returns { success: false, code: "bad_request", errors: ["No
      // registration types found."] } instead of a 200 with data: [] — a
      // genuine "no rows configured yet" state, not a real failure. Without
      // this, a merely-empty master would surface as a hard query error
      // (and a FailurePopup, if any caller checked isError) for something
      // that isn't actually broken — normalize it the same way this app
      // already normalizes a null/empty response body elsewhere.
      if (err instanceof AuthError && err.code === 'bad_request') return []
      throw err
    })
}
