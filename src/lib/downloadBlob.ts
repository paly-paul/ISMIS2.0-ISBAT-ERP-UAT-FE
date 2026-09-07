// Saves an in-memory Blob to disk via a throwaway <a download> click — the
// standard way to trigger a "Save As" for a file that only ever existed as
// a fetch() response body, as opposed to documentViewer.ts's
// downloadDocument(), which opens a real (often presigned S3) URL instead
// of a blob: one. Revokes the object URL right after the click; the browser
// has already captured what it needs to save by then.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
