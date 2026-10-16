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
import { useApplicants, useExportApplicationsCsv, ApplicantListItem, ApplicantStatus, ApplicationListItem } from '@/hooks/admission/useApplicationFiling'
import { ViewApplicantModal } from '@/components/modals/admission/ViewApplicantModal'
import { downloadBlob } from '@/lib/downloadBlob'
import { AuthError } from '@/lib/api/client'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

// get-applicants.md statuses. null = application still being filled in,
// shown blank per the ADM-027 handoff.
const STATUS_BADGE: Record<ApplicantStatus, string> = {
  Waiting: 'badge-amber',
  Submitted: 'badge-blue',
  Vetted: 'badge-cyan',
  Rejected: 'badge-red',
  Registered: 'badge-green',
}

function renderApplicantStatus(a: ApplicantListItem) {
  if (!a.status) return null
  return <span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-grey'}`}>{a.status}</span>
}

// The View modal takes the older ApplicationListItem shape. It loads the full
// record by applicationGuid itself; these fields are only its fallback for an
// application still being filled in (which has no full record yet).
function toModalRow(a: ApplicantListItem): ApplicationListItem {
  return {
    applicationGuid: a.applicationGuid,
    appRefNo: a.appRefNo,
    firstName: a.name,
    lastName: null,
    phone: a.phone,
    emailId: a.email,
    programName: a.programName,
    intakeCode: a.intakeCode,
    createdDate: a.applicationDate,
    actionLabel: a.status,
  } as ApplicationListItem
}

export default function ApplicantsPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicationListItem | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openViewModal(applicant: ApplicantListItem) {
    setSelectedApplicant(toModalRow(applicant))
    setIsViewModalOpen(true)
  }

  const searchTrimmed = search.trim()
  // Server-side search and paging (get-applicants.md, ADM-027) — every
  // application whatever its status, so vetted and registered applicants
  // stay listed. Only queried once the term clears MIN_SEARCH_CHARS, the same
  // gate TableSearch's dropdown uses.
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  const { data, isLoading, isPlaceholderData: isRefetching } = useApplicants(page, PAGE_SIZE, activeSearch)
  const pageItems = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Search itself now happens server-side — pageItems already only contains
  // matches for activeSearch, so the dropdown just reuses them directly
  // (capped to 8) instead of re-filtering a full unpaginated list.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS && !isRefetching ? pageItems.slice(0, 8) : []

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
            placeholder="Ref no., name, phone, email or reg no."
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            results={searchMatches.map(a => ({ id: a.applicationGuid, primary: a.appRefNo, secondary: a.name ?? undefined }))}
            loading={isRefetching}
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
                      {/* studentGuid is only set once the applicant is registered. */}
                      {a.studentGuid && (
                        <button className="btn btn-neu btn-sm" onClick={() => router.push('/student/profile?studentGuid=' + a.studentGuid)}>
                          <i className="lni lni-user" /> Student Profile
                        </button>
                      )}
                    </ActionMenu>
                  </td>
                  <td className="py-2.5 text-g400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="py-2.5 font-mono text-xs text-b600">{a.appRefNo}</td>
                  <td className="py-2.5 text-g800 font-medium">{a.name || '—'}</td>
                  <td className="py-2.5 text-g600">{a.phone || '—'}</td>
                  <td className="py-2.5 text-g600">{a.email || '—'}</td>
                  <td className="py-2.5">{a.programName || '—'}</td>
                  <td className="py-2.5 text-g600">{a.intakeCode || '—'}</td>
                  <td className="py-2.5">{renderApplicantStatus(a)}</td>
                  <td className="py-2.5 text-g500 text-xs">{a.applicationDate ? a.applicationDate.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="applicants" onPageChange={setPage} />
      </div>

      {isViewModalOpen && (
        <ViewApplicantModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false)
            setSelectedApplicant(null)
          }}
          applicant={selectedApplicant}
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}
