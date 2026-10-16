// Shared state behind the header's Downloads icon (HeaderDownloads.tsx).
// The job list lives in react-query's cache under REPORT_JOBS_KEY, so a page
// that starts an export (e.g. the Discount Report) and the header see the
// same list. Two things the API doesn't keep live here as a tiny store:
// the short-lived download links pushed with a Completed event, and which
// finished files haven't been downloaded yet this session (the green dot).
import type { QueryClient } from '@tanstack/react-query'
import { fixLocalDownloadUrl, getReportJobDownload, type ReportJob } from '@/lib/api/finance/discountReport'

export const REPORT_JOBS_KEY = ['finance', 'report-jobs'] as const

type JobsCache = { items: ReportJob[]; totalCount: number }

// Add a job, or replace the one with the same reportJobGuid (an identical
// export clicked twice returns the job already running).
export function upsertReportJob(queryClient: QueryClient, job: ReportJob) {
  queryClient.setQueryData<JobsCache>(REPORT_JOBS_KEY, prev => {
    const items = prev?.items ?? []
    const exists = items.some(j => j.reportJobGuid === job.reportJobGuid)
    return exists
      ? { items: items.map(j => (j.reportJobGuid === job.reportJobGuid ? job : j)), totalCount: prev?.totalCount ?? items.length }
      : { items: [job, ...items], totalCount: (prev?.totalCount ?? items.length) + 1 }
  })
}

export function updateReportJob(queryClient: QueryClient, guid: string, update: (prev: ReportJob | undefined) => ReportJob) {
  const prev = queryClient.getQueryData<JobsCache>(REPORT_JOBS_KEY)?.items.find(j => j.reportJobGuid === guid)
  upsertReportJob(queryClient, update(prev))
}

// ── Live links + "not downloaded yet" ─────────────────────────────────────

const liveLinks = new Map<string, { url: string; expiresAt: number }>()
let unseen = new Set<string>()
const listeners = new Set<() => void>()
function emit() { listeners.forEach(l => l()) }

export function setLiveLink(guid: string, url: string, expiresAtUtc: string) {
  liveLinks.set(guid, { url, expiresAt: new Date(expiresAtUtc).getTime() })
}

// A pushed link still valid for at least 15 more seconds, else null.
export function getValidLiveLink(guid: string): string | null {
  const link = liveLinks.get(guid)
  return link && link.expiresAt - Date.now() > 15_000 ? link.url : null
}

export function markUnseen(guid: string) { unseen = new Set(unseen).add(guid); emit() }
export function markSeen(guid: string) {
  if (!unseen.has(guid)) return
  unseen = new Set(unseen); unseen.delete(guid); emit()
}

// For useSyncExternalStore.
export function subscribeUnseen(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function getUnseen() { return unseen }

// ── Jobs a page is already showing inline ─────────────────────────────────
// The Discount Report page turns its Export button into Processing… and then
// Download for the job it started, so the header skips its "ready"/"failed"
// toast for that job instead of announcing it twice.
const inlineTracked = new Set<string>()
export function trackInline(guid: string) { inlineTracked.add(guid); return () => { inlineTracked.delete(guid) } }
export function isTrackedInline(guid: string) { return inlineTracked.has(guid) }

// ── Download ──────────────────────────────────────────────────────────────

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Opens the finished file: the link pushed with the Completed event while
// it's still valid, otherwise a fresh ~10-minute link fetched for this click
// (get-report-job-download.md). Returns false in mock mode, where there's no
// real file. Throws the API error (e.g. AuthError 'report_expired') for the
// caller to show.
export async function downloadReportJob(guid: string): Promise<boolean> {
  const url = getValidLiveLink(guid) ?? (await getReportJobDownload(guid)).url
  markSeen(guid)
  if (MOCK_AUTH) return false
  window.location.href = fixLocalDownloadUrl(url)
  return true
}
