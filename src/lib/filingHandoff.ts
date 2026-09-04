// Carries the just-created application's reference number from Payment's
// "Proceed to Filing" button over to the Filing page's applicant search, so
// the counsellor doesn't have to manually retype/remember it (and possibly
// mistype it) right after generating the receipt. sessionStorage, same
// convention as src/lib/session.ts's login flow state — a plain query-string
// param would need Filing's page.tsx restructured behind a useSearchParams/
// Suspense boundary (see payment/page.tsx's own PaymentPageContent split)
// just for this one field, which isn't worth it for a single string.
const KEY = 'isbat_filing_prefill_ref'

export function setFilingPrefillRef(appRefNo: string) {
  if (typeof window === 'undefined' || !appRefNo) return
  sessionStorage.setItem(KEY, appRefNo)
}

// Read-once: clears the key immediately so a later manual visit to /admission/filing
// (or a page refresh while already there) doesn't keep re-triggering the auto-search.
export function consumeFilingPrefillRef(): string | null {
  if (typeof window === 'undefined') return null
  const ref = sessionStorage.getItem(KEY)
  if (ref) sessionStorage.removeItem(KEY)
  return ref
}
