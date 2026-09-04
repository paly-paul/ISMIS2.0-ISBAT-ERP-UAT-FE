const NEXT_PUBLIC_API_BASE = (process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '').trim()
const SERVER_API_GATEWAY_URL = (process.env.API_GATEWAY_URL ?? '').trim()
const API_BASE = SERVER_API_GATEWAY_URL || NEXT_PUBLIC_API_BASE
const USE_API_PROXY = Boolean(API_BASE)

// Skip ngrok's browser warning page for local gateway requests.
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' }

function buildUrl(path: string): string {
  // When the gateway URL is configured in Next.js, `/api/*` is rewritten by
  // next.config.mjs through the dev server to the real backend. Keep browser
  // requests same-origin so httpOnly cookies like erp_refresh can be sent.
  if (USE_API_PROXY && path.startsWith('/api/')) return path
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'AuthError'
  }
}

// These auth routes should not trigger a refresh loop.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout']

function isAuthEndpoint(path: string): boolean {
  return AUTH_ENDPOINTS.some(endpoint => path.includes(endpoint))
}

interface RefreshData {
  displayName?: string
}

// Prevent duplicate refresh calls when several requests fail at once.
// This only dedupes calls made *within this tab* — every caller that needs
// a fresh access token (both the reactive 401 handler below and
// src/lib/auth.ts's refreshSession(), used on layout mount) must go through
// this same function rather than posting to /auth/refresh directly, or the
// dedup silently stops covering them.
let refreshInFlight: Promise<RefreshData> | null = null

export function refreshAccessToken(): Promise<RefreshData> {
  if (!refreshInFlight) {
    refreshInFlight = apiPost<RefreshData | null>('/api/v1/users/auth/refresh', {})
      .then(data => data ?? {})
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

function redirectToLogin(triggeredBy: string, cause: unknown) {
  // Logged before navigating away — once the redirect fires, the tab reloads
  // and this context would otherwise be lost, making a "why did I get logged
  // out on this page" report impossible to root-cause after the fact.
  if (typeof window !== 'undefined') {
    console.warn(
      `[auth] Redirecting to /login — refresh failed after a 401 from "${triggeredBy}".`,
      cause,
    )
    window.location.href = '/login'
  }
}

// Only a real refresh failure should log the user out. The backend's
// erp_refresh cookie is single-use (rotates on every call, confirmed via a
// real concurrent-request test: two /auth/refresh calls with the same
// still-valid token raced 200/401) — so a 401 here doesn't necessarily mean
// the session is actually gone. If the user has a second tab open (each tab
// runs its own independent proactive refresh timer — see the module
// layouts' SESSION_REFRESH_INTERVAL_MS — so this isn't a rare edge case),
// or an unrelated refresh from elsewhere in this same tab slipped past the
// dedup above, it may have already rotated the cookie a moment before this
// attempt reached the server. Give that a brief window to land in the
// browser's cookie store and try once more before concluding the session is
// genuinely gone. Shared by both the reactive 401 handler below AND the
// proactive keep-alive (via refreshSession() in auth.ts) — every caller
// needs this same tolerance, not just the reactive path; a previous version
// of the proactive timer skipped it and logged users out on the very first
// racy collision instead of retrying, which is exactly the failure this was
// built to prevent.
export async function refreshAccessTokenWithRetry(): Promise<RefreshData> {
  try {
    return await refreshAccessToken()
  } catch (err) {
    if (!(err instanceof AuthError)) throw err
    await new Promise(resolve => setTimeout(resolve, 500))
    return await refreshAccessToken()
  }
}

// `triggeredBy` is the path of the original request whose 401 kicked this
// off — purely for diagnostics, see redirectToLogin() above.
async function handleUnauthorized(triggeredBy: string): Promise<void> {
  try {
    await refreshAccessTokenWithRetry()
  } catch (err) {
    if (err instanceof AuthError) redirectToLogin(triggeredBy, err)
    throw err
  }
}

// Some auth endpoints still use the older plain JSON format.
export async function post<T>(path: string, body: unknown, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
    credentials: 'include',
    body: JSON.stringify(body),
  })

  if (res.status === 401 && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return post<T>(path, body, true)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: 'unknown' }))
    throw new AuthError(err.code ?? 'unknown', err.message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function get<T>(path: string, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: NGROK_HEADERS,
    credentials: 'include',
  })

  if (res.status === 401 && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return get<T>(path, true)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: 'unknown' }))
    throw new AuthError(err.code ?? 'unknown', err.message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Envelope used by the real backend: { success, data, message, code, errors }
interface ApiEnvelope<T> {
  success: boolean
  data: T | null
  message: string | null
  code: string | null
  errors: string[] | null
}

// A raw ASP.NET model-binding failure (e.g. a Guid?-typed field getting an
// empty string, caught by the framework before the controller — and one's
// own custom validation — ever runs) returns its built-in
// ValidationProblemDetails shape instead: { title, errors: { field: [msg] } }.
// `errors` there is a DICTIONARY keyed by field name, not the app's own
// `string[]`, and there's no `code` at all. Without this fallback, every
// such failure surfaced as a bare `AuthError('unknown')` with no usable
// message — confirmed on a real 400 from program-master's update-complete
// where an empty-string UnitTypeGuid/UnitCatGuid hit exactly this shape.
function extractErrorInfo(envelope: unknown): { code: string; message?: string } {
  const e = envelope as (Partial<ApiEnvelope<unknown>> & { title?: string; errors?: unknown }) | null
  if (!e) return { code: 'unknown' }
  if (e.code) return { code: e.code, message: (Array.isArray(e.errors) ? e.errors[0] : undefined) ?? e.message ?? undefined }
  if (e.errors && !Array.isArray(e.errors) && typeof e.errors === 'object') {
    const fieldErrors = e.errors as Record<string, string[]>
    const firstField = Object.keys(fieldErrors)[0]
    return { code: 'validation_error', message: (firstField ? fieldErrors[firstField]?.[0] : undefined) ?? e.title ?? undefined }
  }
  return { code: 'unknown', message: e.title ?? undefined }
}

export async function apiPost<T>(path: string, body: unknown, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
    credentials: 'include',
    body: JSON.stringify(body),
  })

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  const unauthorized = res.status === 401 || (envelope != null && !envelope.success && envelope.code === 'unauthorized')

  if (unauthorized && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return apiPost<T>(path, body, true)
  }

  if (res.ok) {
    // Some endpoints (e.g. login) authenticate purely via Set-Cookie and
    // respond 2xx with no parseable JSON body — that's a legitimate success,
    // not an error, so resolve with null data rather than throwing.
    if (!envelope) return null as T
    if (!envelope.success) {
      throw new AuthError(envelope.code ?? 'unknown', envelope.errors?.[0] ?? envelope.message ?? undefined)
    }
    return envelope.data as T
  }

  const { code, message } = extractErrorInfo(envelope)
  throw new AuthError(code, message)
}

// multipart/form-data variant of apiPost — for endpoints that accept a file
// alongside regular fields (e.g. course unit syllabus upload). No
// Content-Type header: the browser sets the multipart boundary itself when
// FormData is passed straight through to fetch.
export async function apiPostForm<T>(path: string, formData: FormData, retried = false): Promise<T> {
  // Debug: log FormData keys before sending
  console.log(`📡 apiPostForm to ${path}`)
  console.log('📦 FormData entries:')
  for (const key of (formData as any).keys()) {
    const value = formData.get(key)
    if (value instanceof File) {
      console.log(`   ${key}: [File] ${value.name} (${value.size} bytes, ${value.type})`)
    } else {
      console.log(`   ${key}: "${value}"`)
    }
  }

  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: NGROK_HEADERS,
    credentials: 'include',
    body: formData,
  })

  console.log(`📥 Response status: ${res.status}`)
  
  const responseText = await res.text()
  console.log(`📄 Response body: ${responseText || '(empty)'}`)
  
  const envelope = responseText ? (JSON.parse(responseText) as ApiEnvelope<T>) : null
  const unauthorized = res.status === 401 || (envelope != null && !envelope.success && envelope.code === 'unauthorized')

  if (unauthorized && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return apiPostForm<T>(path, formData, true)
  }

  if (res.ok) {
    if (!envelope) return null as T
    if (!envelope.success) {
      throw new AuthError(envelope.code ?? 'unknown', envelope.errors?.[0] ?? envelope.message ?? undefined)
    }
    return envelope.data as T
  }

  const { code, message } = extractErrorInfo(envelope)
  throw new AuthError(code, message)
}

// multipart/form-data variant of apiPut — mirrors apiPostForm for endpoints
// that accept an optional file on update too (e.g. course unit syllabus
// replace).
export async function apiPutForm<T>(path: string, formData: FormData, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: NGROK_HEADERS,
    credentials: 'include',
    body: formData,
  })

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  const unauthorized = res.status === 401 || (envelope != null && !envelope.success && envelope.code === 'unauthorized')

  if (unauthorized && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return apiPutForm<T>(path, formData, true)
  }

  if (res.ok) {
    if (!envelope) return null as T
    if (!envelope.success) {
      throw new AuthError(envelope.code ?? 'unknown', envelope.errors?.[0] ?? envelope.message ?? undefined)
    }
    return envelope.data as T
  }

  const { code, message } = extractErrorInfo(envelope)
  throw new AuthError(code, message)
}

export async function apiPut<T>(path: string, body: unknown, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
    credentials: 'include',
    body: JSON.stringify(body),
  })

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  const unauthorized = res.status === 401 || (envelope != null && !envelope.success && envelope.code === 'unauthorized')

  if (unauthorized && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return apiPut<T>(path, body, true)
  }

  if (res.ok) {
    if (!envelope) return null as T
    if (!envelope.success) {
      throw new AuthError(envelope.code ?? 'unknown', envelope.errors?.[0] ?? envelope.message ?? undefined)
    }
    return envelope.data as T
  }

  const { code, message } = extractErrorInfo(envelope)
  throw new AuthError(code, message)
}

export async function apiPatch<T>(path: string, body: unknown, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
    credentials: 'include',
    body: JSON.stringify(body),
  })

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  const unauthorized = res.status === 401 || (envelope != null && !envelope.success && envelope.code === 'unauthorized')

  if (unauthorized && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return apiPatch<T>(path, body, true)
  }

  if (res.ok) {
    if (!envelope) return null as T
    if (!envelope.success) {
      throw new AuthError(envelope.code ?? 'unknown', envelope.errors?.[0] ?? envelope.message ?? undefined)
    }
    return envelope.data as T
  }

  const { code, message } = extractErrorInfo(envelope)
  throw new AuthError(code, message)
}

export async function apiDelete<T>(path: string, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: NGROK_HEADERS,
    credentials: 'include',
  })

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  const unauthorized = res.status === 401 || (envelope != null && !envelope.success && envelope.code === 'unauthorized')

  if (unauthorized && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return apiDelete<T>(path, true)
  }

  if (res.ok) {
    if (!envelope) return null as T
    if (!envelope.success) {
      throw new AuthError(envelope.code ?? 'unknown', envelope.errors?.[0] ?? envelope.message ?? undefined)
    }
    return envelope.data as T
  }

  const { code, message } = extractErrorInfo(envelope)
  throw new AuthError(code, message)
}

export async function apiGet<T>(path: string, retried = false): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: NGROK_HEADERS,
    credentials: 'include',
  })

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  const unauthorized = res.status === 401 || (envelope != null && !envelope.success && envelope.code === 'unauthorized')

  if (unauthorized && !isAuthEndpoint(path) && !retried) {
    await handleUnauthorized(path)
    return apiGet<T>(path, true)
  }

  if (res.ok) {
    if (!envelope) return null as T
    if (!envelope.success) {
      throw new AuthError(envelope.code ?? 'unknown', envelope.errors?.[0] ?? envelope.message ?? undefined)
    }
    return envelope.data as T
  }

  const { code, message } = extractErrorInfo(envelope)
  throw new AuthError(code, message)
}
