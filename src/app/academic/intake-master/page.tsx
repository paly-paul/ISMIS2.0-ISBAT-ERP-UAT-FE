'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { IntakeFormModal } from '@/components/modals/academic/IntakeFormModal'
import { ViewIntakeModal } from '@/components/modals/academic/ViewIntakeModal'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useIntakes, useIntakeSearch, useCreateIntake, useUpdateIntake, useDeleteIntake, useCurrentAcademicIntake, useCurrentAdmissionIntake, Intake } from '@/hooks/academic/useIntakes'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { formatDate } from '@/lib/date'

const PAGE_SIZE = 10
// Don't hit the search endpoint (or open the results dropdown) until the
// user's typed at least this many characters.
const MIN_SEARCH_CHARS = 2

// Convert the backend year into the display format used on the page.
function formatFinancialYear(startYear: number): string {
  return `${startYear}–${String(startYear + 1).slice(-2)}`
}

// Read the real intake code from the API instead of deriving it by hand.
// function deriveIntakeCode(intake: Intake): string {
//   return `${intake.financialYear}${intake.intakes}`
// }
function displayIntakeCode(intake: Intake): string {
  return String(intake.intakeCode)
}

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingIntakeGuid, setEditingIntakeGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Intake | null>(null)

  // Debounced so the backend's ?search= isn't hit on every keystroke — same
  // convention as payment-console's debouncedAmount/committedSearch. Stays
  // '' (falling back to the unfiltered list) until MIN_SEARCH_CHARS is met,
  // so a single stray keystroke doesn't fire a request either.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function confirmDeleteIntake() {
    if (!deleteTarget) return
    deleteIntake.mutate(deleteTarget.intakeGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Intake deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete intake', 'error'),
    })
  }

  useEffect(() => {
    function closeFilter(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('th')) setOpenFilter(null)
    }
    document.addEventListener('click', closeFilter)
    return () => document.removeEventListener('click', closeFilter)
  }, [])

  // The old table shape is kept as a reference to the earlier mock version.
  // const rows = [
  //   { code: '20261', desc: 'Spring 2026', finYear: '2025–26', semStart: '01 Feb 2026', term1End: '30 Mar 2026', term2End: '31 May 2026', grievEnd: '10 Jun 2026', reentry: '15 Jun 2026', academic: 'Current', admission: '—', rowClass: 'selected-row', editBtn: true },
  //   { code: '20262', desc: 'Fall 2026',   finYear: '2026–27', semStart: '01 Aug 2026', term1End: '30 Sep 2026', term2End: '30 Nov 2026', grievEnd: '10 Dec 2026', reentry: '15 Dec 2026', academic: '—',       admission: 'Current', rowClass: '', editBtn: true },
  //   { code: '20253', desc: 'Autumn 2025', finYear: '2025–26', semStart: '01 Sep 2025', term1End: '31 Oct 2025', term2End: '31 Dec 2025', grievEnd: '10 Jan 2026', reentry: '15 Jan 2026', academic: 'Closed',  admission: 'Closed',  rowClass: '', editBtn: false },
  // ]

  // The table reads the live intake data directly and only formats a few fields for display.
  const { data: intakes = [], isLoading } = useIntakes()

  // Server-side search (contains-match against Description, Month, and
  // IntakeCode — see useIntakeSearch) takes over from the unfiltered list
  // above once the user has typed something; falls back to that same shared
  // full list while the search box is empty instead of issuing a redundant
  // identical request.
  const { data: searchResults, isFetching: isSearching } = useIntakeSearch(debouncedSearch)
  const baseRows = debouncedSearch ? (searchResults ?? []) : intakes
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isSearching)

  // Used to build a stand-in row key (financialYear + examYear + intakes +
  // examMonth) back when we thought the backend had no real identifier for
  // an intake. The POST /api/v1/academic/intakes response confirmed there's
  // a proper intakeGuid, so the table now keys rows on that directly instead
  // — see the JSX below.
  // function rowKey(intake: Intake): string {
  //   return `${intake.financialYear}-${intake.examYear}-${intake.intakes}-${intake.examMonth}`
  // }

  const createIntake = useCreateIntake()
  const updateIntake = useUpdateIntake()
  const deleteIntake = useDeleteIntake()

  // Use the first calendar entry for the table view and keep the rest for the detail view.
  function firstCalendarEntry(intake: Intake) {
    return intake.academicCalendar?.[0]
  }

  // Text matching against Description/Month/IntakeCode already happened
  // server-side (baseRows is search-scoped) — this only applies the column
  // filters on top.
  const filteredRows = baseRows.filter(r => {
    return Object.entries(filters).every(([k, v]) => {
      if (!v.length) return true
      if (k === 'finYear') return v.includes(formatFinancialYear(r.financialYear))
      if (k === 'academic') return v.includes(r.currentIntake ? 'Current' : '—')
      if (k === 'admission') return v.includes(r.currentAdmissionIntake ? 'Current' : '—')
      return true
    })
  })

  // Live preview shown in the search dropdown as the user types — reads the
  // same server-scoped baseRows, ignoring the column filters and capped to a
  // handful of rows. Empty below MIN_SEARCH_CHARS, matching TableSearch's own
  // minChars gate on when the dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? baseRows.slice(0, 8) : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function fth(label: string, col: string, opts: string[]) {
    return (
      <FilterTh
        label={label}
        opts={opts}
        isOpen={openFilter === col}
        activeFilter={filters[col] ?? []}
        onToggle={(e) => { e.stopPropagation(); setOpenFilter(p => p === col ? null : col) }}
        onSelect={(vals) => { setFilters(f => ({ ...f, [col]: vals })); setOpenFilter(null) }}
        onClear={() => { setFilters(f => ({ ...f, [col]: [] })); setOpenFilter(null) }}
        onClose={() => setOpenFilter(null)}
      />
    )
  }

  function statusBadge(isCurrent: boolean) {
    if (isCurrent) return <span className="badge badge-green"><i className="lni lni-checkmark"></i> Current</span>
    return <>—</>
  }

  // Whichever intake the backend has flagged as the current one for teaching
  // and for admissions — these back the two hero cards below. Fetched via
  // their own GET /api/v1/academic/intakes?...&currentIntake=/&currentAdmissionIntake=
  // filtered calls rather than scanned out of the full (pageSize=1000) table
  // list, so the cards reflect the backend's own filter instead of a client
  // guess. There isn't always a current admission intake (or even a current
  // teaching intake), so both can come back undefined and the cards fall
  // back to a neutral "not set" message instead of crashing.
  const { data: currentAcademicIntake } = useCurrentAcademicIntake()
  const { data: currentAdmissionIntake } = useCurrentAdmissionIntake()

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Intake Master</div><div className="pg-sub">Configure academic sessions · Set all semester and term dates · Manage current intakes</div></div>
          {permissions.add && <button className="btn btn-primary" onClick={() => openModal('new-intake-modal')}><i className="lni lni-plus"></i> New Intake</button>}
        </div>
        <div className="g2 mb-[18px]">
          {/* Previous hard-coded hero cards (before GET /api/v1/academic/intakes
              was wired up) — kept for reference. The cards below now pull from
              whichever intake the API marks as currentIntake / currentAdmissionIntake.
          <div className="bg-[linear-gradient(135deg,var(--b800),var(--b600))] rounded-xl p-5 text-white shadow-[var(--neu-out)]">
            <div className="text-[var(--fs-xs)] font-bold uppercase tracking-[.08em] opacity-[.7] mb-1">Current Academic Intake</div>
            <div className="text-[var(--fs-xl)] font-extrabold">Spring 2026</div>
            <div className="text-[var(--fs-sm)] opacity-[.8] mt-[2px]">Code: 20261 · Teaching in progress</div>
            <div className="mt-[14px] flex gap-[10px] flex-wrap">
              <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Sem Start</div><div className="font-bold">01 Feb 2026</div></div>
              <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Term 1 End</div><div className="font-bold">30 Mar 2026</div></div>
              <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Sem End</div><div className="font-bold">31 May 2026</div></div>
            </div>
          </div>
          <div className="bg-[linear-gradient(135deg,#047857,var(--green))] rounded-xl p-5 text-white shadow-[var(--neu-out)]">
            <div className="text-[var(--fs-xs)] font-bold uppercase tracking-[.08em] opacity-[.7] mb-1">Current Admission Intake</div>
            <div className="text-[var(--fs-xl)] font-extrabold">Fall 2026</div>
            <div className="text-[var(--fs-sm)] opacity-[.8] mt-[2px]">Code: 20262 · Admissions open</div>
            <div className="mt-[14px] flex gap-[10px] flex-wrap">
              <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Open Date</div><div className="font-bold">01 Mar 2026</div></div>
              <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Close Date</div><div className="font-bold">15 Jul 2026</div></div>
            </div>
          </div>
          */}
          <div className="bg-[linear-gradient(135deg,var(--b800),var(--b600))] rounded-xl p-5 text-white shadow-[var(--neu-out)]">
            <div className="text-[var(--fs-xs)] font-bold uppercase tracking-[.08em] opacity-[.7] mb-1">Current Academic Intake</div>
            {currentAcademicIntake ? (
              <>
                <div className="text-[var(--fs-xl)] font-extrabold">{currentAcademicIntake.description}</div>
                <div className="text-[var(--fs-sm)] opacity-[.8] mt-[2px]">Code: {displayIntakeCode(currentAcademicIntake)} · Teaching in progress</div>
                <div className="mt-[14px] flex gap-[10px] flex-wrap">
                  <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Sem Start</div><div className="font-bold">{formatDate(firstCalendarEntry(currentAcademicIntake)?.semesterStartDate)}</div></div>
                  <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Term 1 End</div><div className="font-bold">{formatDate(firstCalendarEntry(currentAcademicIntake)?.term1EndDate)}</div></div>
                  <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Sem End</div><div className="font-bold">{formatDate(firstCalendarEntry(currentAcademicIntake)?.semesterEndDate)}</div></div>
                </div>
              </>
            ) : (
              <div className="text-[var(--fs-sm)] opacity-[.8] mt-[6px]">No intake is currently flagged as the active academic intake.</div>
            )}
          </div>
          <div className="bg-[linear-gradient(135deg,#047857,var(--green))] rounded-xl p-5 text-white shadow-[var(--neu-out)]">
            <div className="text-[var(--fs-xs)] font-bold uppercase tracking-[.08em] opacity-[.7] mb-1">Current Admission Intake</div>
            {currentAdmissionIntake ? (
              <>
                <div className="text-[var(--fs-xl)] font-extrabold">{currentAdmissionIntake.description}</div>
                <div className="text-[var(--fs-sm)] opacity-[.8] mt-[2px]">Code: {displayIntakeCode(currentAdmissionIntake)} · Admissions open</div>
                {/* The API doesn't give us dedicated admission open/close dates
                    yet, so the two chips here use the closest confirmed fields
                    we do have instead of inventing ones that don't exist. */}
                <div className="mt-[14px] flex gap-[10px] flex-wrap">
                  <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Grievance Window</div><div className="font-bold">{formatDate(currentAdmissionIntake.grievanceStartDate)} – {formatDate(currentAdmissionIntake.grievanceEndDate)}</div></div>
                  <div className="bg-[rgba(255,255,255,.15)] rounded-md p-[6px_10px] text-[var(--fs-xs)]"><div className="opacity-[.7]">Last Re-registration Date</div><div className="font-bold">{formatDate(currentAdmissionIntake.lastDateForReRegistration)}</div></div>
                </div>
              </>
            ) : (
              <div className="text-[var(--fs-sm)] opacity-[.8] mt-[6px]">No intake is currently flagged as the active admission intake.</div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> All Intakes</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or description…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.intakeGuid, primary: displayIntakeCode(r), secondary: r.description }))}
              loading={searchPending}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => { setEditingIntakeGuid(r.id); openModal('intake-view-modal'); setSearch('') }}
            />
            {/* <button className="btn btn-neu btn-sm"><i className="lni lni-upload"></i> Export</button> */}
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Code</th><th>Description</th>{fth('Fin. Year', 'finYear', Array.from(new Set(intakes.map(i => formatFinancialYear(i.financialYear)))))}{/* <th>Sem Start</th><th>Term1 End</th><th>Term2 End</th> */}<th>Grievance End</th><th>Last Re-registration</th>{fth('Academic', 'academic', ['Current', '—'])}{fth('Admission', 'admission', ['Current', '—'])}</tr></thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={8} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={8} hasFilters={!!search || Object.values(filters).some(v => v.length > 0)} onClearFilters={() => { setSearch(''); setFilters({}) }} />
                    : null}
                {/* Previous row markup (before GET /api/v1/academic/intakes was
                    wired up) — kept for reference; it read from the old `rows`
                    array further up, which is also commented out above.
                {filteredRows.map((r, i) => (
                  <tr key={i} className={r.rowClass}>
                    <td>
                      <ActionMenu>
                        {r.editBtn
                          ? <button className="btn btn-neu btn-sm" onClick={() => openModal('intake-edit-modal')}><i className="lni lni-pencil"></i> Edit</button>
                          : <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                        }
                      </ActionMenu>
                    </td>
                    <td>
                      {r.editBtn
                        ? <span className="font-bold text-blue font-mono">{r.code}</span>
                        : <span className="font-bold font-mono text-g400">{r.code}</span>
                      }
                    </td>
                    <td>{r.editBtn ? <strong>{r.desc}</strong> : r.desc}</td>
                    <td>{r.finYear}</td>
                    <td>{r.semStart}</td>
                    <td>{r.term1End}</td>
                    <td>{r.term2End}</td>
                    <td>{r.grievEnd}</td>
                    <td>{r.reentry}</td>
                    <td>{statusBadge(r.academic)}</td>
                    <td>{statusBadge(r.admission)}</td>
                  </tr>
                ))}
                */}
                {/* Gated on the same loading flag as the TableLoadingState row above it
                    — otherwise, while searchPending is true (debouncing/in flight), these
                    still render the *previous* debouncedSearch's stale pageItems underneath
                    the "Loading records…" row instead of being replaced by it. */}
                {!(isLoading || searchPending) && pageItems.map((r) => {
                  // const calendar = firstCalendarEntry(r) // only used by the Sem Start / Term1 End / Term2 End columns, commented out below
                  return (
                    <tr key={r.intakeGuid} className={r.currentIntake ? 'selected-row' : ''}>
                      <td>
                        {(permissions.edit || permissions.delete || true) && (
                          <ActionMenu>
                            <button className="btn btn-neu btn-sm" onClick={() => { setEditingIntakeGuid(r.intakeGuid); openModal('intake-view-modal') }}><i className="lni lni-eye"></i> View</button>
                            {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => { setEditingIntakeGuid(r.intakeGuid); openModal('intake-edit-modal') }}><i className="lni lni-pencil"></i> Edit</button>}
                            {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}><i className="lni lni-trash-can"></i> Delete</button>}
                          </ActionMenu>
                        )}
                      </td>
                      <td><span className="font-bold text-blue font-mono">{displayIntakeCode(r)}</span></td>
                      <td><strong>{r.description}</strong></td>
                      <td>{formatFinancialYear(r.financialYear)}</td>
                      {/* <td>{formatDate(calendar?.semesterStartDate)}</td>
                      <td>{formatDate(calendar?.term1EndDate)}</td>
                      <td>{formatDate(calendar?.term2EndDate)}</td> */}
                      <td>{formatDate(r.grievanceEndDate)}</td>
                      <td>{formatDate(r.lastDateForReRegistration)}</td>
                      <td>{statusBadge(r.currentIntake)}</td>
                      <td>{statusBadge(r.currentAdmissionIntake)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="intakes" onPageChange={setPage} />
        </div>
      </div>
      <IntakeFormModal
        mode="new"
        isOpen={openModals.has('new-intake-modal')}
        onClose={() => closeModal('new-intake-modal')}
        showToast={showToast}
        intakeGuid={null}
        createIntake={createIntake}
        updateIntake={updateIntake}
      />
      <IntakeFormModal
        mode="edit"
        isOpen={openModals.has('intake-edit-modal')}
        onClose={() => closeModal('intake-edit-modal')}
        showToast={showToast}
        intakeGuid={editingIntakeGuid}
        createIntake={createIntake}
        updateIntake={updateIntake}
      />
      <ViewIntakeModal
        isOpen={openModals.has('intake-view-modal')}
        onClose={() => closeModal('intake-view-modal')}
        showToast={showToast}
        intakeGuid={editingIntakeGuid}
        onEdit={permissions.edit ? () => { closeModal('intake-view-modal'); openModal('intake-edit-modal'); } : undefined}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.description}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this intake. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteIntake.isPending} onClick={confirmDeleteIntake}>
                <i className="lni lni-trash-can"></i> {deleteIntake.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
