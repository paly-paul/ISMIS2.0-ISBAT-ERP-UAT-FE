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
import { usePagination } from '@/hooks/usePagination'
import { useApplications, ApplicationListItem } from '@/hooks/admission/useApplicationFiling'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'

const PAGE_SIZE = 10
// This endpoint has no search param (unlike Filing's payment-search) — fetch
// a page large enough to cover the whole list once, then filter/paginate
// client-side, same pattern as batch-management/enquiry-followup-master.
const FETCH_ALL_PAGE_SIZE = 1000
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

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const { data, isLoading } = useApplications(1, FETCH_ALL_PAGE_SIZE)
  const allRows = data?.items ?? []

  // programName has no counterpart on this DTO at all — resolve it
  // client-side, same fallback pattern as enquiry-list/page.tsx.
  const { data: programs = [] } = useProgramMasters()
  function resolveProgramName(programGuid: string | null) {
    if (!programGuid) return '—'
    return programs.find(p => p.programGuid === programGuid)?.programName ?? '—'
  }

  function matchesSearch(a: ApplicationListItem, term: string) {
    return `${a.appRefNo} ${applicantName(a)} ${a.emailId ?? ''} ${a.phone ?? ''} ${a.intakeCode ?? ''} ${resolveProgramName(a.programGuid)}`
      .toLowerCase()
      .includes(term)
  }

  const searchTrimmed = search.trim()
  const filtered = allRows.filter(a => searchTrimmed.length < MIN_SEARCH_CHARS || matchesSearch(a, searchTrimmed.toLowerCase()))
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? allRows.filter(a => matchesSearch(a, searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filtered, PAGE_SIZE)

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
            onChange={setSearch}
            results={searchMatches.map(a => ({ id: a.applicationGuid, primary: a.appRefNo, secondary: applicantName(a) }))}
            minChars={MIN_SEARCH_CHARS}
            onSelect={() => router.push('/admission/registration')}
          />
          <button className="btn btn-outline" onClick={() => showToast('CSV exported successfully', 'success')}>
            <i className="lni lni-download mr-1" /> Export CSV
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
                : filtered.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                  : null}
              {pageItems.map((a, i) => (
                <tr key={a.applicationGuid} className="border-b border-g100 hover:bg-g50">
                  <td><ActionMenu><button className="btn btn-neu btn-sm" onClick={() => router.push('/admission/registration')}><i className="lni lni-eye" /> View</button></ActionMenu></td>
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

      <Toast toast={toast} />
    </div>
  )
}
