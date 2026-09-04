'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { CourseUnitFormModal } from '@/components/modals/academic/CourseUnitFormModal'
import { ViewCourseUnitModal } from '@/components/modals/academic/ViewCourseUnitModal'
import { ElectiveSelectModal } from '@/components/modals/academic/ElectiveSelectModal'
import { Toast } from '@/components/Toast'
// import { FilterTh } from '@/components/FilterTh' — unused now that no column has a real filterable categorical field (see fth() below)
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useCourseUnits, useAllCourseUnits, useCreateCourseUnit, useUpdateCourseUnit, useDeleteCourseUnit, CourseUnit } from '@/hooks/academic/useCourseUnits'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useProgramCourseUnits } from '@/hooks/academic/useProgramCourseUnits'
import { getCourseUnitById } from '@/lib/api/academic/courseUnit'
import { openDocumentForViewing, downloadDocument } from '@/lib/documentViewer'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't hit the search endpoint (or open the results dropdown) until the
// user's typed at least this many characters — same convention as
// Intake/Skill/Repetition Tag's search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  // The filter state is kept for future table filtering, but the current view does not need it yet.
  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editingCourseUnitGuid, setEditingCourseUnitGuid] = useState<string | null>(null)
  const [viewingCourseUnitGuid, setViewingCourseUnitGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CourseUnit | null>(null)

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingCourseUnitGuid(guid)
    openModal('cu-edit-modal')
  }

  function openViewModal(guid: string) {
    setViewingCourseUnitGuid(guid)
    openModal('view-course-unit-modal')
    setSearch('')
  }

  const [syllabusLoadingGuid, setSyllabusLoadingGuid] = useState<string | null>(null)

  // `syllabus` is a presigned S3 URL good for only 5 minutes (X-Amz-Expires=300
  // on a real response) — the table row's own copy comes from useCourseUnits,
  // which is cached with staleTime: Infinity for the rest of the session, so
  // it goes stale (S3 "Request has expired") within minutes of the page
  // loading. Fetch a genuinely fresh copy of just this one record — bypassing
  // the cached hook entirely — right at click time instead of trusting
  // whatever's already loaded, so the URL used is always brand new.
  async function handleSyllabus(guid: string, mode: 'view' | 'download') {
    setSyllabusLoadingGuid(guid)
    try {
      const fresh = await getCourseUnitById(guid)
      if (!fresh.syllabus) { showToast('Syllabus is no longer attached to this unit', 'error'); return }
      if (mode === 'view') await openDocumentForViewing(fresh.syllabus)
      else downloadDocument(fresh.syllabus)
    } catch {
      showToast('Failed to load the syllabus document. Please try again.', 'error')
    } finally {
      setSyllabusLoadingGuid(null)
    }
  }

  function confirmDeleteCourseUnit() {
    if (!deleteTarget) return
    deleteCourseUnit.mutate(deleteTarget.courseUnitGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Course unit deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete course unit', 'error'),
    })
  }

  // Debounced so the server-side search below isn't hit on every keystroke,
  // and held at '' (falling back to the unfiltered/paginated list) until
  // MIN_SEARCH_CHARS is met — same convention as Intake/Skill/Repetition
  // Tag's search boxes.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  // Real server-side pagination AND search — fetches PAGE_SIZE (10) rows at
  // a time instead of the whole table up front, refetching the next 10 only
  // when the user actually pages forward, and `debouncedSearch` is a real
  // server-side filter (get-courseunits.md), not a client-side one. Was
  // previously a single pageSize=1000 useCourseUnits() call backing a
  // client-side usePagination() slice, which made the initial load wait on
  // the entire table before showing anything — and, once the real table grew
  // past 1000 rows, silently missed anything past that cap when searching too
  // (confirmed live: a freshly created unit past row 1000 of 1500 never
  // showed up in search results until this switched to server-side search).
  const { data, isLoading, isFetching } = useCourseUnits(page, PAGE_SIZE, debouncedSearch)
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isFetching)

  // "All Programmes" dropdown — there's no programGuid filter on the
  // course-units endpoint itself (CourseUnit carries no programme field at
  // all), so a picked programme is resolved via program-course-units.ts's
  // GET /program-course-units/{programGuid} instead — the same endpoint
  // ProgrammeModal's Curriculum view uses — which lists exactly which
  // course-unit guids are actually assigned to that programme. Mock mode
  // always returns [] here (see programCourseUnits.ts), so the filter has
  // no matches to show under NEXT_PUBLIC_AUTH_MOCK=true.
  const { data: programs = [] } = useProgramMasters()
  const { data: programCourseUnits = [], isLoading: isProgramCourseUnitsLoading } = useProgramCourseUnits(programFilter || null, !!programFilter)
  const programCourseUnitGuids = useMemo(() => new Set(programCourseUnits.map(u => u.courseUnitGuid)), [programCourseUnits])

  // Only the programme filter still needs the whole table in memory — course
  // units carry no programme field of their own to filter by server-side,
  // so matching against a picked programme has to happen client-side against
  // every row. Search no longer needs this (see useCourseUnits above): it's
  // a real server-side filter now, so it stays correct and paginated no
  // matter how large the real table gets, without a client-side row cap.
  const usingFullList = !!programFilter

  // Fetched eagerly on mount (no `enabled` gate) so picking a programme
  // doesn't pay for a cold fetch on the first click — this list is still
  // capped at 1000 rows (ALL_COURSE_UNITS_PAGE_SIZE), which is a real,
  // known gap for programme filtering once the table exceeds that (same
  // class of bug search just had) — not fixed here since there's no
  // server-side "filter by programme" query param on this endpoint to
  // switch to instead.
  const { data: allCourseUnits = [], isLoading: isAllCourseUnitsLoading } = useAllCourseUnits()
  const rows = data?.items ?? []
  const searchRows = usingFullList ? allCourseUnits : rows
  const createCourseUnit = useCreateCourseUnit()
  const updateCourseUnit = useUpdateCourseUnit()
  const deleteCourseUnit = useDeleteCourseUnit()
  const loading = isLoading || searchPending || (usingFullList && isAllCourseUnitsLoading) || (!!programFilter && isProgramCourseUnitsLoading)

  // Reset back to page 1 whenever the (debounced) search term or programme
  // filter changes — the previous page offset almost never lands on a valid
  // page of the newly-filtered result set. Depends on debouncedSearch (not
  // the raw keystroke-by-keystroke search) since that's what actually
  // changes the server query.
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, programFilter])

  const filteredRows = searchRows.filter(r =>
    Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as unknown as Record<string, unknown>)[k])))
    && (searchTrimmed.length < MIN_SEARCH_CHARS || `${r.courseUnitCode} ${r.courseUnitName}`.toLowerCase().includes(searchTrimmed.toLowerCase()))
    && (!programFilter || programCourseUnitGuids.has(r.courseUnitGuid))
  )

  // Only re-slice by page offset while working off the full list —
  // allCourseUnits (searchRows' source in that case) is unpaginated.
  // Outside of that, filteredRows is already just this page's 10 rows
  // straight from the server (useCourseUnits(page, PAGE_SIZE)); re-slicing
  // it by `(page - 1) * PAGE_SIZE` was double-paginating an array that only
  // ever has PAGE_SIZE items in it — correct by coincidence on page 1
  // (.slice(0, 10)), but .slice(10, 20) on a 10-item array is always empty,
  // which is why every page past the first showed a blank table.
  const pageItems = usingFullList ? filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : filteredRows

  // totalCount must reflect the actually-matched rows, not the whole table,
  // once a search/programme filter narrows searchRows down via filteredRows
  // — otherwise Pagination renders phantom pages past the real matches.
  const totalCount = usingFullList ? filteredRows.length : data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? searchRows.filter(r => `${r.courseUnitCode} ${r.courseUnitName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  // Flag badges for mid/cw/ca — these are 0/1 numeric flags on the real
  // response (same convention as isClose/defaultCountry elsewhere), not the
  // old mock's Yes/No strings.
  function flagBadge(val: number) {
    return val
      ? <span className="badge badge-green"><i className="lni lni-checkmark"></i></span>
      : <span className="badge badge-red"><i className="lni lni-close"></i></span>
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Course Units Master (Curriculum)</div><div className="pg-sub">Define subjects per semester · Set Unit Type and Category · Attach approved syllabus · Configure assessment components</div></div>
          <div className="flex items-center gap-3">
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.courseUnitGuid, primary: r.courseUnitCode, secondary: r.courseUnitName }))}
              loading={searchPending || (usingFullList && isAllCourseUnitsLoading)}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
            {permissions.add && <button className="btn btn-primary" onClick={() => openModal('cu-new-modal')}><i className="lni lni-plus"></i> Add Course Unit</button>}
          </div>
        </div>
        <div className="card mb-[14px]">
          <div className="card-hdr"><div className="card-title"><span className="ctitle-icon"><i className="lni lni-key"></i></span> Unit Type → Assessment Component Rules</div></div>
          <div className="g4">
            <div className="p-3 bg-b50 border-b100 rounded-[var(--rsm)]" style={{ border: '1.5px solid' }}><div className="font-bold text-b700 mb-[6px]" style={{ fontSize: 'var(--fs-xs)' }}><i className="lni lni-book"></i> THEORY</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>Internal Assessment: <strong>CW + CBT</strong></div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>University Assessment: <strong>UE Paper</strong></div></div>
            <div className="p-3 bg-[var(--green-bg)] rounded-[var(--rsm)]" style={{ border: '1.5px solid var(--green-bd)' }}><div className="font-bold text-clr-green mb-[6px]" style={{ fontSize: 'var(--fs-xs)' }}><i className="lni lni-microscope"></i> PRACTICAL</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>Internal Assessment: <strong>CW only</strong> (no CBT)</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>University Assessment: <strong>Practical Exam</strong></div></div>
            <div className="p-3 bg-[var(--amber-bg)] rounded-[var(--rsm)]" style={{ border: '1.5px solid var(--amber-bd)' }}><div className="font-bold text-clr-amber mb-[6px]" style={{ fontSize: 'var(--fs-xs)' }}><i className="lni lni-bulb"></i> COMBINED</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>Theory IA: <strong>CW + CBT</strong></div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>Practical: <strong>No IA</strong>, separate exam only</div></div>
            <div className="p-3 bg-[var(--purple-bg)] rounded-[var(--rsm)]" style={{ border: '1.5px solid var(--purple-bd)' }}><div className="font-bold mb-[6px]" style={{ fontSize: 'var(--fs-xs)', color: 'var(--purple)' }}><i className="lni lni-rocket"></i> PROJECT</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>Student-led work (internship / project)</div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)' }}>Evaluated after set timeframe (e.g. 2 months)</div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-book"></i></span> Course Unit Master</div>
            <div className="flex gap-2">
              <SearchSelect
                className="w-auto text-[var(--fs-sm)]"
                placeholder="All Programmes"
                value={programFilter}
                onChange={setProgramFilter}
                options={programs.map(p => ({ value: p.programGuid, label: p.programName }))}
              />
              <SearchSelect
                className="w-auto text-[var(--fs-sm)]"
                placeholder="All Semesters"
                options={['Semester 1', 'Semester 2', 'Semester 3']}
              />
              <SearchSelect
                className="w-auto text-[var(--fs-sm)]"
                placeholder="All Types"
                options={['Theory', 'Practical', 'Combined', 'Project']}
              />
              <button className="btn btn-neu btn-sm"><i className="lni lni-upload"></i> Export</button>
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Code</th>
                  <th>Unit Name</th>
                  <th>Credits</th>
                  <th>Chapters</th>
                  <th>Mid</th>
                  <th>CW</th>
                  <th>CA</th>
                  <th>Syllabus</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <TableLoadingState colSpan={999} />
                  : pageItems.length === 0
                    ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0) || !!programFilter} onClearFilters={() => { setFilters({}); setProgramFilter('') }} />
                    : null}
                {!loading && pageItems.map((r) => (
                  <tr key={r.courseUnitGuid}>
                    <td>
                      {(permissions.edit || permissions.delete) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.courseUnitGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.courseUnitGuid)}><i className="lni lni-pencil"></i> Edit</button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}><i className="lni lni-trash-can"></i> Delete</button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td className="font-mono text-b700" style={{ fontSize: 'var(--fs-xs)' }}>{r.courseUnitCode}</td>
                    <td><strong>{r.courseUnitName}</strong></td>
                    <td>{r.maxCredits}</td>
                    <td>{r.chapterCount}</td>
                    <td>{flagBadge(r.mid)}</td>
                    <td>{r.cw}</td>
                    <td>{r.ca}</td>
                    <td>
                      {r.syllabus
                        ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSyllabus(r.courseUnitGuid, 'view')}
                              disabled={syllabusLoadingGuid === r.courseUnitGuid}
                              className="badge badge-green"
                              style={{ border: 'none', cursor: 'pointer' }}
                              title="View uploaded syllabus document"
                            >
                              <i className="lni lni-eye"></i> {syllabusLoadingGuid === r.courseUnitGuid ? 'Loading…' : 'Attached'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSyllabus(r.courseUnitGuid, 'download')}
                              disabled={syllabusLoadingGuid === r.courseUnitGuid}
                              className="btn btn-neu"
                              style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              title="Download syllabus document"
                            >
                              <i className="lni lni-download" style={{ fontSize: 12 }}></i>
                            </button>
                          </div>
                        )
                        : <span className="badge badge-red"><i className="lni lni-warning"></i> Missing</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="course units" onPageChange={setPage} />
        </div>
      </div>
      <CourseUnitFormModal
        mode="new"
        isOpen={openModals.has('cu-new-modal')}
        onClose={() => closeModal('cu-new-modal')}
        showToast={showToast}
        courseUnitGuid={null}
        createCourseUnit={createCourseUnit}
        updateCourseUnit={updateCourseUnit}
      />
      <CourseUnitFormModal
        mode="edit"
        isOpen={openModals.has('cu-edit-modal')}
        onClose={() => closeModal('cu-edit-modal')}
        showToast={showToast}
        courseUnitGuid={editingCourseUnitGuid}
        createCourseUnit={createCourseUnit}
        updateCourseUnit={updateCourseUnit}
      />
      <ViewCourseUnitModal
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-course-unit-modal'); openEditModal(viewingCourseUnitGuid || '') }}
        isOpen={openModals.has('view-course-unit-modal')}
        onClose={() => closeModal('view-course-unit-modal')}
        showToast={showToast}
        courseUnitGuid={viewingCourseUnitGuid}
      />
      <ElectiveSelectModal isOpen={openModals.has('elective-select-modal')} onClose={() => closeModal('elective-select-modal')} showToast={showToast} />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.courseUnitCode}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this course unit. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteCourseUnit.isPending} onClick={confirmDeleteCourseUnit}>
                <i className="lni lni-trash-can"></i> {deleteCourseUnit.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
