export interface ApplicantProfileLinkData {
  ref: string
  name: string
  programme?: string
  type?: string
  dob?: string
  gender?: string
  nationality?: string
  nationalId?: string
  phone?: string
  email?: string
  intake?: string
  campus?: string
  submitted?: string
}

export function applicantProfileHref(data: ApplicantProfileLinkData): string {
  const params = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return `/admission/applicant-profile?${params.toString()}`
}
