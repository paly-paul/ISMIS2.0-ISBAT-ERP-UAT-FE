// Carries the just-created application payment from Payment's "Proceed to
// Filing" button over to the Filing page, so Filing can open it directly
// instead of the counsellor having to search for it. sessionStorage, same
// convention as src/lib/session.ts's login flow state — a plain query-string
// param would need Filing's page.tsx restructured behind a useSearchParams/
// Suspense boundary (see payment/page.tsx's own PaymentPageContent split).
//
// The whole payment record travels, not just its appRefNo: a just-paid
// applicant has no application row yet, so looking it up by appRefNo on the
// Filing side couldn't find it.
import type { NewPaymentHandoff } from '@/lib/api/admission/applicationFiling'

const KEY = 'isbat_filing_prefill_payment'

export function setFilingPrefill(payment: NewPaymentHandoff) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(KEY, JSON.stringify(payment))
}

// Read-once: clears the key immediately so a later manual visit to /admission/filing
// (or a page refresh while already there) doesn't keep re-opening it.
export function consumeFilingPrefill(): NewPaymentHandoff | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  sessionStorage.removeItem(KEY)
  try {
    const parsed = JSON.parse(raw) as NewPaymentHandoff
    return parsed?.paymentGuid && parsed.appRefNo ? parsed : null
  } catch {
    return null
  }
}
