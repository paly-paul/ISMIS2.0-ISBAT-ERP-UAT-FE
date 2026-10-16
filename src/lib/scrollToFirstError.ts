// Inline field-error messages carry this class (it's a marker only — the
// visual style still comes from each message's inline style).
export const FIELD_ERROR_CLASS = 'field-err'

// Smooth-scrolls the first visible field error into view — call it right
// after a failed validate() sets its errors. Does nothing when `errors` has
// no non-empty entry, so it's safe to call unconditionally.
//
// Waits a frame because the error messages only exist in the DOM once React
// has rendered the setErrors() that came just before this call. The lookup
// runs in document order, so "first" is the top-most error on screen; the
// whole `.fg` field group (label + control + message) is centred, not just
// the message line.
export function scrollToFirstError(errors: object) {
  if (!Object.values(errors).some(Boolean)) return
  if (typeof window === 'undefined') return

  requestAnimationFrame(() => {
    const message = document.querySelector<HTMLElement>(`.${FIELD_ERROR_CLASS}`)
    if (!message) return
    const target = message.closest<HTMLElement>('.fg') ?? message
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  })
}
