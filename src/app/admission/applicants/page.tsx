'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { useApplications, useExportApplicationsCsv, ApplicationListItem } from '@/hooks/admission/useApplicationFiling'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { ViewApplicantModal } from '@/components/modals/admission/ViewApplicantModal'
import { downloadBlob } from '@/lib/downloadBlob'
import { AuthError } from '@/lib/api/client'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

function applicantName(a: ApplicationListItem) {
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || '—'
}

// saveStatus has no confirmed label mapping anywhere (see the note on
// ApplicationListItem in lib/api/admission/applicationFiling.ts) — display
// the raw number rather than guessing a Pending/Approved-style label, same
// caution as enquiry-list's old statusBadge before enquiryStatusGuid was
// confirmed resolvable.
function saveStatusBadge(status: number | null) {
  if (status === null) return <span className="badge badge-grey">—</span>
  return <span className="badge badge-blue">Status {status}</span>
}

export default function ApplicantsPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicationListItem | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openViewModal(applicant: ApplicationListItem) {
    setSelectedApplicant(applicant)
    setIsViewModalOpen(true)
  }

  const searchTrimmed = search.trim()
  // Server-side search (see getApplications) — only actually queried once
  // the term clears MIN_SEARCH_CHARS, same gate TableSearch's own dropdown
  // uses. Real per-page fetches now too (was a single FETCH_ALL_PAGE_SIZE =
  // 1000 fetch, paginated/searched entirely client-side — silently dropped
  // anything past row 1000 once the real table grew past that), same fix as
  // enquiry-list's page.
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  const { data, isLoading } = useApplications(page, PAGE_SIZE, activeSearch)
  const pageItems = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // programName has no counterpart on this DTO at all — resolve it
  // client-side, same fallback pattern as enquiry-list/page.tsx.
  const { data: programs = [] } = useProgramMasters()
  function resolveProgramName(programGuid: string | null) {
    if (!programGuid) return '—'
    return programs.find(p => p.programGuid === programGuid)?.programName ?? '—'
  }

  // Search itself now happens server-side — pageItems already only contains
  // matches for activeSearch, so the dropdown just reuses them directly
  // (capped to 8) instead of re-filtering a full unpaginated list.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? pageItems.slice(0, 8) : []

  // No filter UI on this page yet (see FETCH_ALL_PAGE_SIZE's own note) — the
  // export always pulls the full, unfiltered dataset, same "everything the
  // table itself shows" scope get-export-csv.md's optional intake/programme/
  // date params would otherwise narrow.
  const exportCsv = useExportApplicationsCsv()
  function handleExport() {
    exportCsv.mutate({}, {
      onSuccess: ({ blob, filename }) => {
        downloadBlob(blob, filename)
        showToast('CSV exported successfully', 'success')
      },
      onError: (error: Error) => {
        showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to export CSV. Please try again.'), 'error')
      },
    })
  }

  return (
    <div id="page-applicants">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">All Applicants</h1>
          <p className="text-sm text-g500 mt-0.5">Complete list of all applications on file</p>
        </div>
        <div className="flex items-center gap-3">
          <TableSearch
            className="w-56"
            placeholder="Search applicants…"
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            results={searchMatches.map(a => ({ id: a.applicationGuid, primary: a.appRefNo, secondary: applicantName(a) }))}
            minChars={MIN_SEARCH_CHARS}
            onSelect={item => {
              const found = pageItems.find(a => a.applicationGuid === item.id)
              if (found) openViewModal(found)
            }}
          />
          <button className="btn btn-outline" disabled={exportCsv.isPending} onClick={handleExport}>
            <i className="lni lni-download mr-1" /> {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="card">
        <ScrollTable>
          <table>
            <thead>
              <tr className="text-left text-g500 border-b border-g200">
                <th style={{ width: 48 }}></th>
                <th className="pb-2 font-medium w-8">#</th>
                <th className="pb-2 font-medium">App. Ref</th>
                <th className="pb-2 font-medium">Applicant Name</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Programme</th>
                <th className="pb-2 font-medium">Intake</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? <TableLoadingState colSpan={999} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                  : null}
              {pageItems.map((a, i) => (
                <tr key={a.applicationGuid} className="border-b border-g100 hover:bg-g50">
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm" onClick={() => openViewModal(a)}>
                        <i className="lni lni-eye" /> View
                      </button>
                    </ActionMenu>
                  </td>
                  <td className="py-2.5 text-g400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="py-2.5 font-mono text-xs text-b600">{a.appRefNo}</td>
                  <td className="py-2.5 text-g800 font-medium">{applicantName(a)}</td>
                  <td className="py-2.5 text-g600">{a.phone || '—'}</td>
                  <td className="py-2.5 text-g600">{a.emailId || '—'}</td>
                  <td className="py-2.5">{resolveProgramName(a.programGuid)}</td>
                  <td className="py-2.5 text-g600">{a.intakeCode || '—'}</td>
                  <td className="py-2.5">{saveStatusBadge(a.saveStatus)}</td>
                  <td className="py-2.5 text-g500 text-xs">{a.createdDate.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="applicants" onPageChange={setPage} />
      </div>

      <ViewApplicantModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedApplicant(null)
        }}
        applicant={selectedApplicant}
      />
      <Toast toast={toast} />
    </div>
  )
}
