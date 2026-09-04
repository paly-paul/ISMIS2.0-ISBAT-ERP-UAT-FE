'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { EmployeeFormModal } from '@/components/modals/employee/EmployeeFormModal'
import { ViewEmployeeModal } from '@/components/modals/employee/ViewEmployeeModal'
import { EmployeePermissionsFormModal } from '@/components/modals/employee/EmployeePermissionsFormModal'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useEmployees, useEmployeeSearch } from '@/hooks/employee/useEmployees'
import { EmployeeListItem } from '@/lib/api/employee/employee'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  // Assigning/editing permission groups isn't one of the base four actions —
  // fall back to the edit flag when the menu leaf doesn't carry its own
  // "assign" key (confirmed present on Permission Master's leaf, not yet
  // confirmed here), same "loose bag of booleans" caution as MenuPermissions.
  const canAssignPermissions = permissions.assign ?? permissions.edit
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingEmployeeGuid, setEditingEmployeeGuid] = useState<string | null>(null)
  const [viewingEmployeeGuid, setViewingEmployeeGuid] = useState<string | null>(null)
  const [assigningPermissionsEmployee, setAssigningPermissionsEmployee] = useState<EmployeeListItem | null>(null)
  const [editingPermissionsEmployee, setEditingPermissionsEmployee] = useState<EmployeeListItem | null>(null)

  function nav(id: string) { router.push('/employee/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(employeeGuid: string) {
    setEditingEmployeeGuid(employeeGuid)
    openModal('edit-employee-modal')
  }

  function openViewModal(employeeGuid: string) {
    setViewingEmployeeGuid(employeeGuid)
    openModal('view-employee-modal')
    setSearch('')
  }

  function openAssignPermissionsModal(employee: EmployeeListItem) {
    setAssigningPermissionsEmployee(employee)
    openModal('assign-employee-permissions-modal')
  }

  function openEditPermissionsModal(employee: EmployeeListItem) {
    setEditingPermissionsEmployee(employee)
    openModal('edit-employee-permissions-modal')
  }

  useEffect(() => {
    function closeFilter(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('th')) setOpenFilter(null)
    }
    document.addEventListener('click', closeFilter)
    return () => document.removeEventListener('click', closeFilter)
  }, [])

  // Keep the old mock table shape as a reference for the earlier UI version.
  // const rows = [
  //   { id: 'EMP-0001', name: 'Dr. Nakimuli Sarah',  email: 'snakimuli@isbatuniversity.ac.ug', qualification: 'PhD', qualDetail: 'PhD Computer Science',    qualSub: 'Makerere University · 2018',         specialisation: 'Machine Learning, Algorithms',     faculty: 'FCT', designation: 'Senior Lecturer', statusBadge: 'badge-green', statusLabel: 'Active' },
  //   { id: 'EMP-0002', name: 'Prof. Mukasa Charles', email: 'cmukasa@isbatuniversity.ac.ug', qualification: "Master's", qualDetail: 'PhD Business Administration', qualSub: 'University of Cape Town · 2012',      specialisation: 'Strategic Management, Finance',    faculty: 'FBM', designation: 'Senior Lecturer', statusBadge: 'badge-green', statusLabel: 'Active' },
  //   { id: 'EMP-0003', name: 'Dr. Tendo Patrick',   email: 'ptendo@isbatuniversity.ac.ug',  qualification: 'PhD', qualDetail: 'PhD Civil Engineering',     qualSub: 'Kyambogo University · 2016',         specialisation: 'Structural Design, Geotechnics',   faculty: 'FEN', designation: 'Senior Lecturer', statusBadge: 'badge-green', statusLabel: 'Active' },
  //   { id: 'EMP-0004', name: 'Ms. Acen Lillian',    email: 'lacen@isbatuniversity.ac.ug',   qualification: "Master's", qualDetail: 'MSc Information Technology',  qualSub: 'Makerere University · 2021',         specialisation: 'Web Development, Databases',       faculty: 'FCT', designation: 'Lecturer',        statusBadge: 'badge-green', statusLabel: 'Active' },
  //   { id: 'EMP-0005', name: 'Mr. Okello Brian',    email: 'bokello@isbatuniversity.ac.ug', qualification: "Bachelor's", qualDetail: 'MBA Finance',               qualSub: 'Strathmore University · 2020',       specialisation: 'Corporate Finance, Accounting',    faculty: 'FBM', designation: 'Assistant Lecturer', statusBadge: 'badge-amber', statusLabel: 'On Leave' },
  // ]

  // Use the live API list and refresh it after create/update actions.
  const { data: rows = [], isLoading } = useEmployees()

  // Debounced so the backend's ?search= isn't hit on every keystroke, and
  // held at '' (falling back to the unfiltered list) until MIN_SEARCH_CHARS
  // is met — same convention as Skill/Batch/Intake Master's search boxes.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: searchResults, isFetching: isSearching } = useEmployeeSearch(debouncedSearch)
  const baseRows = debouncedSearch ? (searchResults ?? []) : rows
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isSearching)

  // Sort newest first by the numeric short-code suffix, which is the best available proxy for creation order.
  const sortedRows = [...baseRows].sort((a, b) => {
    const numA = Number(a.shortCode.split('/').pop())
    const numB = Number(b.shortCode.split('/').pop())
    return numB - numA
  })

  // Name/code matching already happened server-side (sortedRows is
  // search-scoped) — this only applies the column filters on top.
  const filteredRows = sortedRows.filter(r => Object.entries(filters).every(([k, v]) => {
    if (!v.length) return true
    const cell = k === 'sex' ? (r.sex === 1 ? 'Male' : 'Female')
      : k === 'status' ? (r.isApproved ? 'Approved' : 'Pending')
      : String((r as unknown as Record<string, unknown>)[k])
    return v.includes(cell)
  }))

  // Live preview shown in the search dropdown as the user types — reads the
  // same server-scoped sortedRows, capped to a handful of rows. Empty below
  // MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on when the
  // dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? sortedRows.slice(0, 8) : []

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
          <div><div className="pg-title">Employee Master</div><div className="pg-sub">All employees · Captures qualification details · Linked to Faculty &amp; Course Allocation</div></div>
          <div className="flex items-center gap-3">
            <TableSearch
              className="w-56"
              placeholder="Search by name or code…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.employeeGuid, primary: r.shortCode, secondary: r.empName }))}
              loading={searchPending}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
            {permissions.add && <button className="btn btn-primary" onClick={() => openModal('new-employee-modal')}><i className="lni lni-plus"></i> Add Employee</button>}
          </div>
        </div>

        {/* <div className="info-box mb-[14px]">
          <i className="lni lni-information"></i> Add the basic identity + qualifications here. Subject expertise (per-unit skills) is captured in <strong>Skill Management</strong> and feeds into Course Allocation.
        </div> */}

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-user"></i></span> Employees</div>
            <span className="badge badge-blue"><i className="lni lni-users"></i> {rows.length} total</span>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              {/* Previous header (pre GET /api/v1/users/employees integration) — kept for reference.
              <thead><tr><th style={{ width: 48 }}></th><th>ID</th><th>Name</th>{fth('Highest Qualification', 'qualification', ["PhD", "Master's", "Bachelor's"])}<th>Specialisation</th>{fth('Faculty', 'faculty', ['FCT', 'FBM', 'FEN'])}{fth('Designation', 'designation', ['Senior Lecturer', 'Lecturer', 'Assistant Lecturer', 'Adjunct'])}{fth('Status', 'status', ['Active', 'Inactive'])}</tr></thead>
              */}
              <thead><tr><th style={{ width: 48 }}></th><th>Short Code</th><th>Name</th>{fth('Sex', 'sex', ['Male', 'Female'])}{fth('Status', 'status', ['Approved', 'Pending'])}</tr></thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0) || !!search} onClearFilters={() => { setFilters({}); setSearch('') }} />
                    : null}
                {/* Previous row markup (pre GET /api/v1/users/employees integration) — kept for reference.
                {filteredRows.map((r, i) => (
                  <tr key={i}>
                    <td><ActionMenu><button className="btn btn-neu btn-sm" onClick={() => openModal('edit-employee-modal')}><i className="lni lni-pencil"></i> Edit</button></ActionMenu></td>
                    <td className="font-mono text-b700">{r.id}</td>
                    <td><strong>{r.name}</strong><div className="text-[var(--fs-xs)] text-g500">{r.email}</div></td>
                    <td>{r.qualDetail}<div className="text-[var(--fs-xs)] text-g500">{r.qualSub}</div></td>
                    <td>{r.specialisation}</td>
                    <td>{r.faculty === 'FCT' ? 'Faculty of Computing & Technology' : r.faculty === 'FBM' ? 'Faculty of Business & Management' : 'Faculty of Engineering'}</td>
                    <td><span className="badge badge-blue">{r.designation}</span></td>
                    <td><span className={`badge ${r.statusBadge}`}><span className="bdot"></span>{r.statusLabel}</span></td>
                  </tr>
                ))}
                */}
                {!(isLoading || searchPending) && pageItems.map(r => (
                  <tr key={r.employeeGuid}>
                    <td>
                      {(permissions.edit || canAssignPermissions || true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.employeeGuid)}>
                            <i className="lni lni-eye"></i> View
                          </button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.employeeGuid)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {canAssignPermissions && <button className="btn btn-neu btn-sm" onClick={() => openAssignPermissionsModal(r)}>
                            <i className="lni lni-lock"></i> Assign Permissions
                          </button>}
                          {canAssignPermissions && <button className="btn btn-neu btn-sm" onClick={() => openEditPermissionsModal(r)}>
                            <i className="lni lni-pencil-alt"></i> Edit Permissions
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td className="font-mono text-b700">{r.shortCode}</td>
                    <td><strong>{r.title} {r.firstName} {r.surname}</strong></td>
                    <td>{r.sex === 1 ? 'Male' : 'Female'}</td>
                    <td><span className={`badge ${r.isApproved ? 'badge-green' : 'badge-amber'}`}><span className="bdot"></span>{r.isApproved ? 'Approved' : 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="employees" onPageChange={setPage} />
        </div>
      </div>
      <EmployeeFormModal
        mode="new"
        isOpen={openModals.has('new-employee-modal')}
        onClose={() => closeModal('new-employee-modal')}
        showToast={showToast}
        employeeGuid={null}
      />
      <EmployeeFormModal
        mode="edit"
        isOpen={openModals.has('edit-employee-modal')}
        onClose={() => closeModal('edit-employee-modal')}
        showToast={showToast}
        employeeGuid={editingEmployeeGuid}
      />
      <ViewEmployeeModal
        isOpen={openModals.has('view-employee-modal')}
        onClose={() => closeModal('view-employee-modal')}
        showToast={showToast}
        employeeGuid={viewingEmployeeGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-employee-modal'); if (viewingEmployeeGuid) openEditModal(viewingEmployeeGuid) }}
      />
      <EmployeePermissionsFormModal
        mode="new"
        isOpen={openModals.has('assign-employee-permissions-modal')}
        onClose={() => closeModal('assign-employee-permissions-modal')}
        showToast={showToast}
        employee={assigningPermissionsEmployee}
      />
      <EmployeePermissionsFormModal
        mode="edit"
        isOpen={openModals.has('edit-employee-permissions-modal')}
        onClose={() => closeModal('edit-employee-permissions-modal')}
        showToast={showToast}
        employee={editingPermissionsEmployee}
      />
      <Toast toast={toast} />
    </>
  )
}
