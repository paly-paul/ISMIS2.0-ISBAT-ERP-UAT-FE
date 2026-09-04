'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { ProgrammeModal } from '@/components/modals/academic/ProgrammeModal'
import { ViewProgrammeModal } from '@/components/modals/academic/ViewProgrammeModal'
import { SpecializationModal } from '@/components/modals/academic/SpecializationModal'
import { CurriculumModal } from '@/components/modals/academic/CurriculumModal'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useCreateProgramMaster, useDeleteProgramMasterComplete, useProgramMasters, useProgramMasterSearch, useUpdateProgramMasterComplete } from '@/hooks/academic/useProgramMaster'
import { useProgramGroups } from '@/hooks/academic/useProgramGroups'
import { useProgramLevels } from '@/hooks/academic/useProgramLevels'
import { useFaculties } from '@/hooks/config/useFaculties'
import { useStreams } from '@/hooks/config/useStreams'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { formatDate } from '@/lib/date'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// academic master pages' search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  // '' means no filter — SearchSelect's placeholder state, not a literal "All ..." option.
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [progMode, setProgMode] = useState<'add' | 'edit'>('add')
  const [editingProgramGuid, setEditingProgramGuid] = useState<string | null>(null)
  const [viewingProgramGuid, setViewingProgramGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ programGuid: string; progName: string } | null>(null)
  // Which programme the Home Page "Specialization"/"Curriculum" three-dot
  // actions are scoped to — see Program_Master_Change_Requests_Final.md.
  const [selectedProgram, setSelectedProgram] = useState<{ programGuid: string; progName: string } | null>(null)
  const createProgramMaster = useCreateProgramMaster()
  const updateProgramMasterComplete = useUpdateProgramMasterComplete()
  const deleteProgramMasterComplete = useDeleteProgramMasterComplete()

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openViewModal(guid: string) {
    setViewingProgramGuid(guid)
    openModal('view-prog-modal')
    setSearch('')
  }

  function confirmDeleteProgram() {
    if (!deleteTarget) return
    deleteProgramMasterComplete.mutate(deleteTarget.programGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Programme deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete programme', 'error'),
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

  // Previous hardcoded rows (pre GET /api/v1/academic/program-master
  // integration) — kept for reference. The real response has no accreditation
  // expiry date at all, and no per-row "variant" concept (edit/view/renew/
  // editspec) — those were simulated purely for the mock UI, so the table
  // below always shows the same action set instead.
  // const rows = [
  //   { progCode: 'BCA-2026',    progName: 'Bachelor of Computer Appl. 2026',       group: 'BCA', level: "Bachelor's · 3yr / 6sem", faculty: 'FCT → Main Campus', accredDate: 'Jan 2026', expires: 'Jan 2031',         expiresBadge: 'badge-green', expiresIcon: '',                        noIA: 'No',  specializations: '—',                    admissionStatus: 'Active',   admissionBadge: 'badge-green', rowClass: '', variant: 'edit' },
  //   { progCode: 'BCA-2021',    progName: 'Bachelor of Computer Appl. 2021',       group: 'BCA', level: "Bachelor's · 3yr / 6sem", faculty: 'FCT → Main Campus', accredDate: 'Jan 2021', expires: 'Jan 2026 — Retired', expiresBadge: 'badge-grey',  expiresIcon: '',                        noIA: 'No',  specializations: '—',                    admissionStatus: 'Inactive',  admissionBadge: 'badge-grey',  rowClass: '', variant: 'view' },
  //   { progCode: 'BBA-2021',    progName: 'BBA Business Administration 2021',      group: 'BBA', level: "Bachelor's · 3yr / 6sem", faculty: 'FBM → Main Campus', accredDate: 'Oct 2021', expires: 'Oct 2026 — Expiring Soon', expiresBadge: 'badge-red', expiresIcon: 'lni lni-warning',  noIA: 'No',  specializations: '—',                    admissionStatus: 'Active',   admissionBadge: 'badge-green', rowClass: 'flagged', variant: 'renew' },
  //   { progCode: 'MBA-2024',    progName: 'MBA Business Administration 2024',      group: 'MBA', level: "Master's · 2yr / 4sem",  faculty: 'FBM → Main Campus', accredDate: 'Mar 2024', expires: 'Mar 2029',         expiresBadge: 'badge-green', expiresIcon: '',                        noIA: 'No',  specializations: '3 Specializations',   admissionStatus: 'Active',   admissionBadge: 'badge-green', rowClass: '', variant: 'editspec' },
  //   { progCode: 'PHD-CS-2023', progName: 'Doctor of Philosophy — CS 2023',       group: '—',   level: 'PhD · 3yr / 6sem',       faculty: 'FCT → Main Campus', accredDate: 'Jun 2023', expires: 'Jun 2028',         expiresBadge: 'badge-green', expiresIcon: '',                        noIA: 'Yes', specializations: '—',                    admissionStatus: 'Active',   admissionBadge: 'badge-green', rowClass: '', variant: 'edit' },
  // ]

  // Real list + the lookups needed to resolve the guids it returns into
  // display names (the list endpoint itself only echoes back guids).
  const { data: programs = [], isLoading } = useProgramMasters()
  const { data: programGroups = [] } = useProgramGroups()
  const { data: programLevels = [] } = useProgramLevels()
  const { data: faculties = [] } = useFaculties()
  const { data: streams = [] } = useStreams()

  // Debounced so the backend's ?search= isn't hit on every keystroke, and
  // held at '' (falling back to the unfiltered list) until MIN_SEARCH_CHARS
  // is met — same convention as the other academic master pages.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: searchResults, isFetching: isSearching } = useProgramMasterSearch(debouncedSearch)
  const basePrograms = debouncedSearch ? (searchResults ?? []) : programs
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isSearching)

  const rows = basePrograms.map(p => {
    const group = programGroups.find(g => g.programGroupGuid === p.programGroupGuid)
    const level = programLevels.find(l => l.programLevelGuid === p.programLevelGuid)
    const faculty = faculties.find(f => f.facultyGuid === p.facultyGuid)
    const specializationNames = (p.streamGuids || [])
      .map(guid => streams.find(s => s.streamGuid === guid)?.streamName)
      .filter((name): name is string => !!name)
    return {
      programGuid: p.programGuid,
      progCode: p.programCode,
      progName: p.programName,
      group: group?.groupCode ?? '—',
      level: level ? `${level.levelName} · ${p.yearCount}yr / ${p.semCount}sem` : `${p.yearCount}yr / ${p.semCount}sem`,
      faculty: faculty ? `${faculty.facultyCode} → ${faculty.campusName}` : '—',
      // Kept alongside the display string below — dateAcc is the only real
      // date field the list endpoint returns (no created/updated timestamp),
      // so it's what "newest to oldest" sorts on.
      dateAccRaw: p.dateAcc,
      accredDate: formatDate(p.dateAcc),
      noIA: p.noIa ? 'Yes' : 'No',
      specializations: specializationNames.length > 0 ? specializationNames.join(', ') : '—',
      admissionStatus: p.pgmStatus ? 'Active' : 'Inactive',
    }
  }).sort((a, b) => new Date(b.dateAccRaw).getTime() - new Date(a.dateAccRaw).getTime())

  const groupFilterOpts = Array.from(new Set(rows.map(r => r.group)))
  const levelFilterOpts = Array.from(new Set(rows.map(r => r.level)))
  const levelDropdownOpts = Array.from(new Set(programLevels.map(l => l.levelName)))

  // Live preview shown in the search dropdown as the user types — matches
  // the same code/name test as the table's own search filter below, just
  // capped to a handful of rows and ignoring the Level/Status dropdowns so
  // it always reflects "what search alone would find". Empty below
  // MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on when the
  // dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.progCode} ${r.progName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    // The dropdown only offers the bare level name (Bachelor/Master/…), while
    // r.level is that name plus the "· Nyr / Nsem" suffix — match on prefix
    // rather than exact equality so this stays in sync with the column filter.
    if (levelFilter && !r.level.startsWith(levelFilter)) return false
    if (statusFilter && r.admissionStatus !== statusFilter) return false
    // Re-filter client-side on top of whatever the server sent back — rows
    // is already search-scoped via basePrograms, but this keeps results
    // correct even if the backend doesn't actually honor ?search=.
    if (searchTrimmed.length >= MIN_SEARCH_CHARS && !`${r.progCode} ${r.progName}`.toLowerCase().includes(searchTrimmed.toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as Record<string, unknown>)[k])))
  })

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

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Programme Master</div><div className="pg-sub">Define programme versions · Manage active/inactive status · Accreditation tracking · Specializations</div></div>
          {permissions.add && <button className="btn btn-primary" onClick={() => { setProgMode('add'); setEditingProgramGuid(null); openModal('new-prog-modal') }}><i className="lni lni-plus"></i> Add Programme</button>}
        </div>

        <Breadcrumb items={[
          { label: 'Programme Level', icon: 'lni lni-graduation', id: 'programme-level' },
          { label: 'Programme Group', icon: 'lni lni-folder', id: 'programme-group' },
          { label: 'Programme Master', icon: 'lni lni-graduation' },
          { label: 'Programme Approval', icon: 'lni lni-check-box', id: 'programme-approval' },
          { label: 'Course Units', icon: 'lni lni-book', id: 'course-units' },
        ]} />

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-graduation"></i></span> All Programme Versions</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.programGuid, primary: r.progCode, secondary: r.progName }))}
                loading={searchPending}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(r) => openViewModal(r.id)}
              />
              <SearchSelect
                className="w-auto text-[var(--fs-sm)]"
                placeholder="All Levels"
                options={levelDropdownOpts}
                value={levelFilter}
                onChange={setLevelFilter}
              />
              <SearchSelect
                className="w-auto text-[var(--fs-sm)]"
                placeholder="All Statuses"
                options={['Active', 'Inactive']}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <button className="btn btn-neu btn-sm"><i className="lni lni-upload"></i> Export</button>
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              {/* Previous header (pre GET integration) — kept for reference; the Expires column
                  has no backing field in the real response, so it's dropped rather than left blank.
              <thead><tr><th style={{ width: 48 }}></th><th>Prog. Code</th><th>Programme Name</th>{fth('Group', 'group', ['BCA', 'BBA', 'MBA', '—'])}{fth('Programme Level', 'level', ["Bachelor's · 3yr / 6sem", "Master's · 2yr / 4sem", 'PhD · 3yr / 6sem'])}<th>Faculty → Campus</th><th>Accreditation Date</th><th>Expires</th><th>No IA</th><th>Specializations</th>{fth('Admission Status', 'admissionStatus', ['Active', 'Inactive'])}</tr></thead>
              */}
              <thead><tr><th style={{ width: 48 }}></th><th>Prog. Code</th><th>Programme Name</th>{fth('Group', 'group', groupFilterOpts)}{fth('Programme Level', 'level', levelFilterOpts)}<th>Faculty → Campus</th><th>Accreditation Date</th><th>No IA</th><th>Specializations</th>{fth('Admission Status', 'admissionStatus', ['Active', 'Inactive'])}</tr></thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                    : null}
                {!(isLoading || searchPending) && pageItems.map(r => (
                  <tr key={r.programGuid}>
                    <td>
                      {/* Previous per-row action variants (edit/view/renew/editspec) — simulated
                          for the mock UI; the real list has no signal to pick between them, so
                          every row gets the same action set now.
                      {r.variant === 'edit' && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => { setProgMode('edit'); openModal('new-prog-modal') }}><i className="lni lni-pencil"></i> Edit</button>
                          <button className="btn btn-neu btn-sm" onClick={() => nav('course-units')}><i className="lni lni-book"></i> Curriculum</button>
                        </ActionMenu>
                      )}
                      {r.variant === 'view' && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button>
                        </ActionMenu>
                      )}
                      {r.variant === 'renew' && (
                        <ActionMenu>
                          <button className="btn btn-amber btn-sm" onClick={() => { setProgMode('edit'); openModal('new-prog-modal') }}><i className="lni lni-warning"></i> Renew</button>
                          <button className="btn btn-primary btn-sm" onClick={() => { setProgMode('add'); openModal('new-prog-modal') }}><i className="lni lni-plus"></i> New Version</button>
                        </ActionMenu>
                      )}
                      {r.variant === 'editspec' && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => { setProgMode('edit'); openModal('new-prog-modal') }}><i className="lni lni-pencil"></i> Edit</button>
                          <button className="btn btn-neu btn-sm" onClick={() => openModal('specialization-modal')}><i className="lni lni-target"></i> Specializations</button>
                        </ActionMenu>
                      )}
                      */}
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.programGuid)}><i className="lni lni-eye"></i> View</button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => { setProgMode('edit'); setEditingProgramGuid(r.programGuid); openModal('new-prog-modal') }}><i className="lni lni-pencil"></i> Edit</button>}
                        <button className="btn btn-neu btn-sm" onClick={() => { setSelectedProgram({ programGuid: r.programGuid, progName: r.progName }); openModal('curriculum-modal') }}><i className="lni lni-book"></i> Curriculum</button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => { setSelectedProgram({ programGuid: r.programGuid, progName: r.progName }); openModal('specialization-modal') }}><i className="lni lni-target"></i> Specializations</button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget({ programGuid: r.programGuid, progName: r.progName })}><i className="lni lni-trash-can"></i> Delete</button>}
                      </ActionMenu>
                    </td>
                    <td className={`font-mono text-[var(--fs-xs)] ${r.admissionStatus === 'Inactive' ? 'text-g400' : 'text-b700'}`}>{r.progCode}</td>
                    <td>{r.admissionStatus === 'Active' ? <strong>{r.progName}</strong> : r.progName}</td>
                    <td>{r.group}</td>
                    <td>{r.level}</td>
                    <td>{r.faculty}</td>
                    <td>{r.accredDate}</td>
                    {/* Expires column — no accreditation expiry field exists in the real
                        response, so there's nothing to compute this badge from.
                    <td>
                      <span className={`badge ${r.expiresBadge}`}>
                        {r.expiresIcon && <i className={r.expiresIcon}></i>} {r.expires}
                      </span>
                    </td>
                    */}
                    <td>
                      {r.noIA === 'Yes'
                        ? <span className="badge badge-amber"><i className="lni lni-checkmark"></i> No Internal Assessment</span>
                        : <span className="badge badge-grey">No</span>
                      }
                    </td>
                    <td>
                      {r.specializations === '—' ? '—' : <span className="badge badge-blue">{r.specializations}</span>}
                    </td>
                    <td>
                      {/* Label text is just "Active"/"Inactive" — no "(New Admissions)"/
                          "(Existing Students Only)" qualifier, per the Program Master
                          requirements doc (req. 3). */}
                      {r.admissionStatus === 'Active'
                        ? <span className="badge badge-green"><span className="bdot"></span>Active</span>
                        : <span className="badge badge-grey">Inactive</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="programmes" onPageChange={setPage} />
        </div>
      </div>
      <ProgrammeModal
        isOpen={openModals.has('new-prog-modal')}
        onClose={() => closeModal('new-prog-modal')}
        showToast={showToast}
        mode={progMode === 'edit' ? 'edit' : undefined}
        programGuid={editingProgramGuid}
        initialCurrencyGuid={programs.find(p => p.programGuid === editingProgramGuid)?.currencyGuid ?? null}
        createProgramMaster={createProgramMaster}
        updateProgramMasterComplete={updateProgramMasterComplete}
      />
      <ViewProgrammeModal
        isOpen={openModals.has('view-prog-modal')}
        onClose={() => closeModal('view-prog-modal')}
        showToast={showToast}
        programGuid={viewingProgramGuid}
        onEdit={(guid) => {
          closeModal('view-prog-modal')
          setProgMode('edit')
          setEditingProgramGuid(guid)
          openModal('new-prog-modal')
        }}
      />
      <SpecializationModal
        isOpen={openModals.has('specialization-modal')}
        onClose={() => closeModal('specialization-modal')}
        showToast={showToast}
        programGuid={selectedProgram?.programGuid ?? null}
        programName={selectedProgram?.progName}
      />
      <CurriculumModal
        isOpen={openModals.has('curriculum-modal')}
        onClose={() => closeModal('curriculum-modal')}
        showToast={showToast}
        programGuid={selectedProgram?.programGuid ?? null}
        programName={selectedProgram?.progName}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.progName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this programme version and all its course units and fee structures. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteProgramMasterComplete.isPending} onClick={confirmDeleteProgram}>
                <i className="lni lni-trash-can"></i> {deleteProgramMasterComplete.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
