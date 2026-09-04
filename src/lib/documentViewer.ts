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

// Opens the document for in-browser viewing where possible. Always opens
// something (never throws for an unsupported type) — worst case is the same
// as Download.
export async function openDocumentForViewing(url: string): Promise<void> {
  const contentType = extractContentType(url)

  if (contentType === 'application/pdf' || contentType.startsWith('image/')) {
    const res = await fetch(url)
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

export function downloadDocument(url: string): void {
  window.open(url, '_blank', 'noopener')
}
