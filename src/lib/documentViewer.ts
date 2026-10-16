import { apiGetBlob } from './api/client'
import { downloadBlob } from './downloadBlob'

// Presigned S3 URLs from this backend always carry
// response-content-disposition=attachment baked into the signed query
// string (confirmed via a real sample) — that's part of what the signature
// covers, so it can't be stripped/altered client-side without S3 rejecting
// the request as SignatureDoesNotMatch. Navigating directly to one always
// forces a download, regardless of file type.
//
// To offer a real in-browser "View":
//  - PDFs/images: fetched as a blob and opened via a local blob: URL, which
//    carries no Content-Disposition of its own (that's an HTTP response
//    header, not a property of the bytes) — the browser's native viewer
//    renders it inline instead of downloading.
//  - Office documents (Word/Excel/PowerPoint): no browser renders these
//    natively, even from a blob — routed through Microsoft's public Office
//    Online Viewer instead, which fetches the URL itself server-side (so
//    this one must stay the real https presigned URL, not a blob:, and
//    only works while the presign is still valid — same 5-minute window as
//    everything else here).
//  - Anything else: no in-browser viewer exists; falls back to Download.
//
// response-content-type is a real query param the backend already bakes
// into every presigned URL (confirmed via a real sample) — used here
// instead of guessing a MIME type from the file extension.

function extractContentType(url: string): string {
  try {
    return new URL(url).searchParams.get('response-content-type') ?? ''
  } catch {
    return ''
  }
}

const OFFICE_CONTENT_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

// Server builds (dev, Vercel) route remote documents through the
// same-origin /doc-proxy route (app/doc-proxy/route.server.ts), since the
// documents bucket has no CORS policy. The static S3 build has no server,
// so it fetches S3 directly — that bucket must allow GET from the frontend
// origin. blob: URLs (mock mode) are already local.
function documentFetchUrl(url: string): string {
  const viaProxy = process.env.NEXT_PUBLIC_DOC_PROXY === 'true' && !url.startsWith('blob:')
  return viaProxy ? `/doc-proxy?url=${encodeURIComponent(url)}` : url
}

// ---- Backend-hosted files ---------------------------------------------------
// Some documents are served by the backend itself (e.g. a course unit
// syllabus at /api/v1/local-files/…, ACD-027) rather than as a presigned S3
// URL. Those answer 401 without the login cookie, so a plain link, <iframe>,
// window.open or cookie-less fetch can't open them. The URL may name the
// backend's own host (not reachable with our cookie), so only its /api/…
// path is kept and fetched through the app's own origin with credentials
// (apiGetBlob, which also refreshes an expired session once).
function backendPath(url: string): string | null {
  if (url.startsWith('/api/')) return url
  try {
    const u = new URL(url)
    return u.pathname.startsWith('/api/') ? u.pathname + u.search : null
  } catch {
    return null
  }
}

async function fetchBackendDocument(path: string): Promise<{ blob: Blob; type: string; filename: string }> {
  const { blob, filename } = await apiGetBlob(path)
  const name = filename ?? decodeURIComponent(path.split('?')[0].split('/').pop() || 'document')
  const type = [blob.type, typeFromExtension(new URL(path, 'http://x').href)].find(isUsefulType) || (await sniffType(blob))
  return { blob: type && type !== blob.type ? new Blob([blob], { type }) : blob, type, filename: name }
}

// Opens the document for in-browser viewing where possible. Always opens
// something (never throws for an unsupported type) — worst case is the same
// as Download.
export async function openDocumentForViewing(url: string): Promise<void> {
  const path = backendPath(url)
  if (path) {
    const doc = await fetchBackendDocument(path)
    // Only PDFs and images render in a tab; anything else (Word etc.) can't
    // go through Office Online either, since that fetches without our cookie.
    if (doc.type === 'application/pdf' || doc.type.startsWith('image/')) window.open(URL.createObjectURL(doc.blob), '_blank', 'noopener')
    else downloadBlob(doc.blob, doc.filename)
    return
  }

  const contentType = extractContentType(url)

  if (contentType === 'application/pdf' || contentType.startsWith('image/')) {
    const res = await fetch(documentFetchUrl(url))
    if (!res.ok) throw new Error('Failed to load document')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank', 'noopener')
    // Deliberately not revoking the blob URL — the new tab needs it to stay
    // alive for as long as it's open; the browser reclaims it once that
    // tab/blob is garbage-collected.
    return
  }

  if (OFFICE_CONTENT_TYPES.includes(contentType)) {
    window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`, '_blank', 'noopener')
    return
  }

  // No in-browser viewer for this type (or content type wasn't present on
  // the URL at all) — same behavior as Download.
  window.open(url, '_blank', 'noopener')
}

// ---- In-page preview -------------------------------------------------------
// openDocumentForViewing above trusts response-content-type alone and opens a
// new tab after an await (popup blockers can eat that). For an in-page
// preview we resolve the type more defensively — URL param, then file
// extension, then the fetched blob's own type, then the file's magic bytes —
// and re-wrap the bytes in a Blob carrying that type, so an S3 object stored
// as application/octet-stream still renders instead of downloading.

export type DocumentPreview =
  | { kind: 'pdf' | 'image'; src: string; revoke: () => void }
  | { kind: 'office'; src: string; revoke: () => void }
  | { kind: 'text'; src: null; text: string; revoke: () => void }
  | { kind: 'unsupported'; src: null; revoke: () => void }

const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', log: 'text/plain', json: 'application/json',
}

const MAX_TEXT_BYTES = 2 * 1024 * 1024

function isTextType(t: string) {
  return t.startsWith('text/') || t === 'application/json'
}

// Last-resort check for untyped files: no NUL bytes and valid UTF-8 → text.
async function decodeIfText(blob: Blob): Promise<string | null> {
  if (blob.size > MAX_TEXT_BYTES) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.subarray(0, 4096).includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function typeFromExtension(url: string): string {
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? ''
    return EXTENSION_TYPES[ext] ?? ''
  } catch {
    return ''
  }
}

async function sniffType(blob: Blob): Promise<string> {
  const b = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf' // %PDF
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  return ''
}

function isUsefulType(t: string) {
  return !!t && t !== 'application/octet-stream' && t !== 'binary/octet-stream'
}

// Throws only if the document can't be fetched at all (expired presign, CORS,
// or a backend-hosted file the session can't read).
export async function resolveDocumentPreview(url: string): Promise<DocumentPreview> {
  const noop = () => {}
  const hinted = [extractContentType(url), typeFromExtension(url)].find(isUsefulType) ?? ''

  // Office Online fetches the file itself, so it needs the real https URL.
  if (OFFICE_CONTENT_TYPES.includes(hinted)) {
    return url.startsWith('https:')
      ? { kind: 'office', src: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`, revoke: noop }
      : { kind: 'unsupported', src: null, revoke: noop }
  }

  const path = backendPath(url)
  let raw: Blob
  if (path) {
    raw = (await apiGetBlob(path)).blob
  } else {
    const res = await fetch(documentFetchUrl(url))
    if (!res.ok) throw new Error('Failed to load document')
    raw = await res.blob()
  }
  const type = [hinted, raw.type].find(isUsefulType) || (await sniffType(raw))

  if (type === 'application/pdf' || type.startsWith('image/')) {
    const src = URL.createObjectURL(new Blob([raw], { type }))
    return { kind: type === 'application/pdf' ? 'pdf' : 'image', src, revoke: () => URL.revokeObjectURL(src) }
  }
  if (isTextType(type) || !type) {
    const text = await decodeIfText(raw)
    if (text !== null) return { kind: 'text', src: null, text, revoke: noop }
  }
  return { kind: 'unsupported', src: null, revoke: noop }
}

// Backend-hosted files are fetched with the login cookie and saved from a
// blob; presigned S3 URLs already force a download when opened.
export async function downloadDocument(url: string): Promise<void> {
  const path = backendPath(url)
  if (path) {
    const doc = await fetchBackendDocument(path)
    downloadBlob(doc.blob, doc.filename)
    return
  }
  window.open(url, '_blank', 'noopener')
}
