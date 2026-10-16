'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { LecturerSkillFormModal } from '@/components/modals/academic/LecturerSkillFormModal'
import { ViewLecturerSkillModal } from '@/components/modals/academic/ViewLecturerSkillModal'
import { useLecturerSkills, useCreateLecturerSkill, useUpdateLecturerSkill, useDeleteLecturerSkill, LecturerSkill } from '@/hooks/academic/useLecturerSkills'
import { useEmployeeDropdown } from '@/hooks/employee/useEmployees'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { formatDate } from '@/lib/date'

const PAGE_SIZE = 10
// Don't hit the search endpoint (or open the results dropdown) until the
// user's typed at least this many characters.
const MIN_SEARCH_CHARS = 2

// Assumed reading of the wire's bare proficiency int — see the gotcha note
// on LecturerSkill in lib/api/users/skills.ts.
const PROFICIENCY_LABELS: Record<number, string> = { 1: 'Familiar', 2: 'Proficient', 3: 'Expert' }

function approvalBadge(status: string) {
  if (status === 'Approved') return <span className="badge badge-green"><i className="lni lni-checkmark"></i> Approved</span>
  if (status === 'Rejected') return <span className="badge badge-red"><i className="lni lni-close"></i> Rejected</span>
  if (status === 'Pending') return <span className="badge badge-amber"><i className="lni lni-timer"></i> Pending</span>
  return <span className="badge badge-grey">{status}</span>
}

/* ─────────────────────────────────────────────────────────────────────────
   Previous mock shape — kept for reference, not deleted. The old UI grouped
   fictional per-lecturer rows (faculty, eligible subjects, current load,
   check-ins, completion status) that have no equivalent in the real
   GET /api/v1/users/skills response, which is a flat list of individual
   skill entries (now resolved to a name via employeeGuid — see
   employeeLabel below — but still no faculty/eligible-subjects/load
   concept). The lecturer/dean role switcher also relied on matching a mock
   "current user" by name — there's no real endpoint here to resolve "who am
   I" against an employeeGuid, so that demo device was dropped along with it.

type Role = 'lecturer' | 'dean'
type ApprovalStatus = 'Approved' | 'Pending' | 'Rejected' | 'Details Requested'

const MOCK_USERS: Record<Role, { name: string; faculty: string }> = {
  lecturer: { name: 'Ms. Namutebi Joyce',   faculty: 'FCT' },
  dean:     { name: 'Dr. Ssekibuule Ronald', faculty: 'FCT' },
}

const BASE_ROWS = [
  { name: 'Dr. Ssekibuule Ronald', faculty: 'FCT', skills: ['Programming', 'Data Structures', 'OS'],        eligible: 8, load: '5 subjects', checkins: 1, completeStatus: 'Complete',   loadBadge: 'badge-green' },
  { name: 'Ms. Namutebi Joyce',    faculty: 'FCT', skills: ['Computer Org.', 'Networks'],                   eligible: 5, load: '6 subjects', checkins: 0, completeStatus: 'Complete',   loadBadge: 'badge-green' },
  { name: 'Dr. Kibira Moses',      faculty: 'FCT', skills: [],                                               eligible: 0, load: 'Unallocated', checkins: 0, completeStatus: 'Incomplete', loadBadge: 'badge-grey'  },
  { name: 'Prof. Mukasa Charles',  faculty: 'FBM', skills: ['Economics', 'Finance Mgmt', 'Strategy'],       eligible: 9, load: '5 subjects', checkins: 2, completeStatus: 'Complete',   loadBadge: 'badge-amber' },
  { name: 'Ms. Atim Grace',        faculty: 'FBM', skills: ['Accounting'],                                  eligible: 2, load: 'Unallocated', checkins: 0, completeStatus: 'Partial',    loadBadge: 'badge-grey'  },
]

const INITIAL_APPROVALS: Record<string, ApprovalStatus> = {
  'Dr. Ssekibuule Ronald': 'Approved',
  'Ms. Namutebi Joyce':    'Pending',
  'Dr. Kibira Moses':      'Pending',
  'Prof. Mukasa Charles':  'Approved',
  'Ms. Atim Grace':        'Details Requested',
}
───────────────────────────────────────────────────────────────────────── */

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]       = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch]     = useState('')
  const [filters, setFilters]   = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [editingSkillGuid, setEditingSkillGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LecturerSkill | null>(null)

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // The backend's own pagination is now trusted for this list: the page does
  // not need to pull a 1000-row snapshot just to render the current page.
  // Search is still server-side when the term is long enough; the table itself
  // stays page-scoped to the current page size.
  const [page, setPage] = useState(1)
  const searchTrimmed = search.trim()
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  const { data, isLoading, isFetching } = useLecturerSkills(page, PAGE_SIZE, activeSearch)
  const rows = data?.items ?? []
  // Dataset-wide count for the stat card below — independent of the column
  // filter/pagination math further down, which operates on filteredRows.
  const totalCount = data?.totalCount ?? 0
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && isFetching
  const { data: employees = [] } = useEmployeeDropdown()
  const employeeNameByGuid = useMemo(
    () => new Map(employees.map(e => [e.employeeGuid, e.displayName])),
    [employees],
  )
  function employeeLabel(guid: string) { return employeeNameByGuid.get(guid) ?? '—' }

  // The list is already ordered by the backend for the current page, so we
  // don't re-fetch a 1000-row snapshot just to reverse it client-side.
  const baseRows = rows

  const createSkill = useCreateLecturerSkill()
  const updateSkill = useUpdateLecturerSkill()
  const deleteSkill  = useDeleteLecturerSkill()

  function openEditModal(guid: string) {
    setEditingSkillGuid(guid)
    openModal('edit-lecturer-skill-modal')
  }

  function openViewModal(guid: string) {
    setEditingSkillGuid(guid)
    openModal('view-lecturer-skill-modal')
    setSearch('')
  }

  function confirmDeleteSkill() {
    if (!deleteTarget) return
    deleteSkill.mutate(deleteTarget.lecturerSkillGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Skill deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete skill', 'error'),
    })
  }

  // Text matching against skill name already happened server-side (baseRows
  // is search-scoped) — this only applies the column filters on top.
  const filteredRows = useMemo(() => {
    return baseRows.filter(s => Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((s as unknown as Record<string, unknown>)[k]))))
  }, [baseRows, filters])

  // Live preview shown in the search dropdown as the user types — reads the
  // same server-scoped baseRows, ignoring the column filters and capped to a
  // handful of rows. Empty below MIN_SEARCH_CHARS, matching TableSearch's own
  // minChars gate on when the dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? baseRows.slice(0, 8) : []

  // Paginated last, over the full filtered/sorted dataset — matches the
  // pre-rollback usePagination(filteredRows, PAGE_SIZE) semantics exactly.
  // filteredCount (not the dataset-wide totalCount above) is what
  // Pagination itself renders, same as that hook's own totalCount return —
  // it reflects the column filter, unlike the stat card's totalCount.
  const filteredCount = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Only reflects the current page now (server-paginated above), not the
  // whole table — same trade-off as everywhere else stats/filters were
  // derived from a now-paginated list. No dedicated counts endpoint exists
  // for this domain (unlike get-enquiries-counts.md) to keep these
  // dataset-wide instead.
  // Computed off allSkills (the full loaded list), not the current page's
  // own skills slice — accurate across the whole dataset now that the
  // client-side pagination rollback above means the full list is already
  // sitting in memory anyway.
  const stats = useMemo(() => ({
    total: totalCount,
    approved: rows.filter(s => s.approvalStatus === 'Approved').length,
    pending: rows.filter(s => s.approvalStatus === 'Pending').length,
    employees: new Set(rows.map(s => s.employeeGuid)).size,
  }), [rows, totalCount])

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
          <div>
            <div className="pg-title">Lecturer Skill Management</div>
            <div className="pg-sub">Employee skill profiles · Proficiency levels · Dean approval status</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-neu btn-sm" onClick={() => nav('course-allocation')}>→ Proceed to Allocation</button>
            {permissions.add && <button className="btn btn-primary" onClick={() => openModal('add-skill-modal')}><i className="lni lni-plus"></i> Add Skill</button>}
          </div>
        </div>

        <div className="g4 mb-[18px]">
          <div className="stat-card"><div className="stat-lbl">Total Skills Logged</div><div className="stat-num">{stats.total}</div><div className="stat-sub up">Across all employees</div></div>
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]"><div className="stat-lbl">Approved</div><div className="stat-num text-green">{stats.approved}</div><div className="stat-sub up">Ready for allocation</div></div>
          <div className="stat-card [--b700:var(--amber)] [--b400:#fbbf24]"><div className="stat-lbl">Pending Approval</div><div className="stat-num text-amber">{stats.pending}</div><div className="stat-sub warn">Awaiting Dean review</div></div>
          <div className="stat-card [--b700:var(--purple)] [--b400:#a78bfa]"><div className="stat-lbl">Employees</div><div className="stat-num text-clr-purple">{stats.employees}</div><div className="stat-sub">With skills logged</div></div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bulb"></i></span> Lecturer Skills</div>
            <TableSearch
              className="w-56"
              placeholder="Search skill or employee ID…"
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              results={searchMatches.map(s => ({ id: s.lecturerSkillGuid, primary: s.skillName || 'Unnamed skill' }))}
              loading={searchPending}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Employee</th>
                  <th>Skill Name</th>
                  <th>Proficiency</th>
                  {fth('Approval Status', 'approvalStatus', ['Approved', 'Pending', 'Rejected'])}
                  <th>Approved By</th>
                  <th>Approved Date</th>
                </tr>
              </thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search || Object.values(filters).some(v => v.length > 0)} onClearFilters={() => { setSearch(''); setFilters({}); setPage(1) }} />
                    : null}
                {!(isLoading || searchPending) && pageItems.map(s => (
                  <tr key={s.lecturerSkillGuid}>
                    <td>
                      {(permissions.edit || permissions.delete || true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(s.lecturerSkillGuid)}>
                            <i className="lni lni-eye"></i> View
                          </button>
                          {permissions.edit && (
                            <button className="btn btn-neu btn-sm" onClick={() => openEditModal(s.lecturerSkillGuid)}>
                              <i className="lni lni-pencil"></i> Edit
                            </button>
                          )}
                          {permissions.delete && (
                            <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(s)}>
                              <i className="lni lni-trash-can"></i> Delete
                            </button>
                          )}
                        </ActionMenu>
                      )}
                    </td>
                    <td className="text-blue">{employeeLabel(s.employeeGuid)}</td>
                    <td><strong>{s.skillName || <span className="text-muted">— Unnamed —</span>}</strong></td>
                    <td><span className="pill pill-blue">{PROFICIENCY_LABELS[s.proficiency] ?? `Level ${s.proficiency}`}</span></td>
                    <td>{approvalBadge(s.approvalStatus)}</td>
                    <td className="text-muted">{s.approvedByIntUser ?? '—'}</td>
                    <td className="text-muted">{formatDate(s.approvedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={safePage} totalPages={totalPages} totalCount={filteredCount} itemLabel="skills" onPageChange={setPage} />
        </div>
      </div>

      <LecturerSkillFormModal
        mode="new"
        isOpen={openModals.has('add-skill-modal')}
        onClose={() => closeModal('add-skill-modal')}
        showToast={showToast}
        lecturerSkillGuid={null}
        createSkill={createSkill}
        updateSkill={updateSkill}
      />
      <LecturerSkillFormModal
        mode="edit"
        isOpen={openModals.has('edit-lecturer-skill-modal')}
        onClose={() => closeModal('edit-lecturer-skill-modal')}
        showToast={showToast}
        lecturerSkillGuid={editingSkillGuid}
        createSkill={createSkill}
        updateSkill={updateSkill}
      />
      <ViewLecturerSkillModal canEdit={permissions.edit} onEdit={() => { closeModal('view-lecturer-skill-modal'); openEditModal(editingSkillGuid || '') }}
        isOpen={openModals.has('view-lecturer-skill-modal')}
        onClose={() => closeModal('view-lecturer-skill-modal')}
        showToast={showToast}
        lecturerSkillGuid={editingSkillGuid}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete &quot;{deleteTarget.skillName || 'this skill'}&quot;?</div>
            <div className="perm-delete-sub">
              This will permanently delete this skill entry. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteSkill.isPending} onClick={confirmDeleteSkill}>
                <i className="lni lni-trash-can"></i> {deleteSkill.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
