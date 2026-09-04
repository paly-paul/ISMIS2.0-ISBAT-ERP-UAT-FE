'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { DesignationFormModal } from '@/components/modals/config/DesignationFormModal'
import { ViewDesignationModal } from '@/components/modals/config/ViewDesignationModal'
import { useDesignations, useCreateDesignation, useUpdateDesignation, useDeleteDesignation, Designation } from '@/hooks/config/useDesignations'
import { useDepartments } from '@/hooks/config/useDepartments'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

// TEMPORARY BOOTSTRAP OVERRIDE: after a DB reset there is no permission
// group yet, so /me/menu correctly comes back with add:false/edit:false for
// this page - nobody has been granted the right to create one yet. Force
// both on here, same convention as src/app/config/permission-master/page.tsx
// and the "TEMPORARY" overrides in src/lib/api/users/menu.ts. Remove once
// real permission groups exist and normal /me/menu-driven gating can take
// back over.
const BOOTSTRAP_FORCE_PERMISSIONS = true

export default function Page() {
  const router = useRouter()
  const realPermissions = usePagePermissions()
  const permissions = BOOTSTRAP_FORCE_PERMISSIONS
    ? { ...realPermissions, add: true, edit: true }
    : realPermissions
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]           = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters]       = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null)
  const [viewingDesignation, setViewingDesignation] = useState<Designation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Designation | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useDesignations()
  const { data: departments = [] } = useDepartments()
  const createDesignation = useCreateDesignation()
  const updateDesignation = useUpdateDesignation()
  const deleteDesignation = useDeleteDesignation()

  // The real GET /api/v1/users/designations response only returns intDept
  // (a numeric department reference), not a department name — resolve it
  // against the departments list for display.
  const departmentNameByIntDept = Object.fromEntries(departments.map(d => [d.intDept, d.deptName]))

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(designation: Designation) {
    setEditingDesignation(designation)
    openModal('edit-designation-modal')
  }

  function openViewModal(designation: Designation) {
    setViewingDesignation(designation)
    openModal('view-designation-modal')
    setSearch('')
  }

  function confirmDeleteDesignation() {
    if (!deleteTarget) return
    deleteDesignation.mutate(String(deleteTarget.intDesignation), {
      onSuccess: () => { setDeleteTarget(null); showToast('Designation deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete designation', 'error'),
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

  // Live preview shown in the search dropdown as the user types — matches
  // the same designation-name/department test as the table's own search
  // filter below, just capped to a handful of rows and ignoring the column
  // filters so it always reflects "what search alone would find".
  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.designationName} ${departmentNameByIntDept[r.intDept] ?? ''}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (searchTrimmed.length >= MIN_SEARCH_CHARS && !`${r.designationName} ${departmentNameByIntDept[r.intDept] ?? ''}`.toLowerCase().includes(searchTrimmed.toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => {
      if (!v.length) return true
      const cell = k === 'department' ? (departmentNameByIntDept[r.intDept] ?? '') : String((r as unknown as Record<string, unknown>)[k])
      return v.includes(cell)
    })
  })

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function fth(label: string, col: string, opts: string[]) {
    return (
      <FilterTh
        label={label}
        opts={opts}
        isOpen={openFilter === col}
        activeFilter={filters[col] ?? []}
        onToggle={e => { e.stopPropagation(); setOpenFilter(p => p === col ? null : col) }}
        onSelect={vals => { setFilters(f => ({ ...f, [col]: vals })); setOpenFilter(null) }}
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
            <div className="pg-title">Designation Master</div>
            <div className="pg-sub">Manage staff designations and their department assignments</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-designation-modal')}>
              <i className="lni lni-plus"></i> Add Designation
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-tag"></i></span> Designations</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: String(r.intDesignation), primary: r.designationName, secondary: departmentNameByIntDept[r.intDept] }))}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(res) => { const row = rows.find(x => String(x.intDesignation) === res.id); if (row) openViewModal(row) }}
              />
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              {/* Previous header (pre GET /api/v1/users/designations integration) — kept for reference.
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Designation Name</th>
                  {fth('Department', 'department', ['Computer Science', 'Information Technology', 'Business Administration', 'Civil Engineering', 'Nursing Sciences'])}
                </tr>
              </thead>
              */}
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Designation Name</th>
                  {fth('Department', 'department', departments.map(d => d.deptName))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                    : null}
                {/* Previous row markup (pre GET /api/v1/users/designations integration) — kept for reference.
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>
                      </ActionMenu>
                    </td>
                    <td><strong>{r.designationName}</strong></td>
                    <td>{r.department}</td>
                  </tr>
                ))}
                */}
                {pageItems.map((r) => (
                  <tr key={r.intDesignation}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td><strong>{r.designationName}</strong></td>
                    <td>{departmentNameByIntDept[r.intDept] ?? `Dept #${r.intDept}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="designations" onPageChange={setPage} />
        </div>
      </div>
      <DesignationFormModal
        mode="new"
        isOpen={openModals.has('new-designation-modal')}
        onClose={() => closeModal('new-designation-modal')}
        showToast={showToast}
        designation={null}
        createDesignation={createDesignation}
        updateDesignation={updateDesignation}
      />
      <DesignationFormModal
        mode="edit"
        isOpen={openModals.has('edit-designation-modal')}
        onClose={() => closeModal('edit-designation-modal')}
        showToast={showToast}
        designation={editingDesignation}
        createDesignation={createDesignation}
        updateDesignation={updateDesignation}
      />
      <ViewDesignationModal
        isOpen={openModals.has('view-designation-modal')}
        onClose={() => closeModal('view-designation-modal')}
        showToast={showToast}
        designation={viewingDesignation}
        onEdit={() => {
          closeModal('view-designation-modal')
          openEditModal(viewingDesignation!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.designationName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this designation. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteDesignation.isPending} onClick={confirmDeleteDesignation}>
                <i className="lni lni-trash-can"></i> {deleteDesignation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
