import { downloadBlob } from '@/lib/downloadBlob'

// Opens a server-rendered PDF (e.g. a receipt) in a new tab. The tab is
// opened synchronously, before the fetch, because popup blockers drop a
// window.open that happens after an await; the PDF loads into it once it
// arrives. If the popup was blocked, the PDF downloads instead. On an error
// the blank tab is closed and the error re-thrown for the caller to show.
// Call it straight from a click handler.
export async function openPdfInNewTab(
  load: () => Promise<{ blob: Blob; filename: string | null }>,
  fallbackFileName: string,
): Promise<void> {
  const tab = window.open('', '_blank')
  try {
    const { blob, filename } = await load()
    const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
    if (tab && !tab.closed) {
      // Not revoked — the tab needs the blob URL for as long as it's open.
      tab.location.href = URL.createObjectURL(pdf)
    } else {
      downloadBlob(pdf, filename ?? fallbackFileName)
    }
  } catch (err) {
    tab?.close()
    throw err
  }
}
