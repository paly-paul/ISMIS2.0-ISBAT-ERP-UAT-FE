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
import { CampusFormModal } from '@/components/modals/config/CampusFormModal'
import { ViewCampusModal } from '@/components/modals/config/ViewCampusModal'
import { useCampuses, useCampusDropdown, useCreateCampus, useUpdateCampus, useDeleteCampus, Campus } from '@/hooks/config/useCampuses'
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
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null)
  const [viewingCampus, setViewingCampus] = useState<Campus | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campus | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useCampuses()
  const { data: campusDropdown = [] } = useCampusDropdown()
  const createCampus = useCreateCampus()
  const updateCampus = useUpdateCampus()
  const deleteCampus = useDeleteCampus()

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(campus: Campus) {
    setEditingCampus(campus)
    openModal('edit-campus-modal')
  }

  function openViewModal(campus: Campus) {
    setViewingCampus(campus)
    openModal('view-campus-modal')
    setSearch('')
  }

  function confirmDeleteCampus() {
    if (!deleteTarget) return
    deleteCampus.mutate(deleteTarget.campusGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Campus deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete campus', 'error'),
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
  // the same code/name test as the table's own search filter below, just
  // capped to a handful of rows and ignoring the column filters so it always
  // reflects "what search alone would find".
  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? (rows as Campus[]).filter(r => `${r.campusCode} ${r.campusName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = (rows as Campus[]).filter((r: Campus) => {
    if (searchTrimmed.length >= MIN_SEARCH_CHARS && !`${r.campusCode} ${r.campusName}`.toLowerCase().includes(searchTrimmed.toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as unknown as Record<string, unknown>)[k])))
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
            <div className="pg-title">Campus Master</div>
            <div className="pg-sub">Manage university campuses and their contact details</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-campus-modal')}>
              <i className="lni lni-plus"></i> Add Campus
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-home"></i></span> Campuses</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.campusGuid, primary: r.campusCode, secondary: r.campusName }))}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(res) => { const row = (rows as Campus[]).find(x => x.campusGuid === res.id); if (row) openViewModal(row) }}
              />
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Campus Code</th>
                  {fth('Campus Name', 'campusName', campusDropdown.map(c => c.campusName))}
                  {fth('Location', 'location', ['Kampala', 'Mbarara', 'Gulu'])}
                  <th>Address</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                    : null}
                {/* Previous row markup (pre GET /api/v1/academic/campus integration) —
                    kept for reference. Columns are unchanged; only the row key
                    moved from the old mock `id` to the real API's `campusGuid`.
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold">{r.campusCode}</td>
                    <td><strong>{r.campusName}</strong></td>
                    <td>{r.location}</td>
                    <td>{r.address}</td>
                    <td>{r.contact}</td>
                  </tr>
                ))}
                */}
                {pageItems.map((r) => (
                  <tr key={r.campusGuid}>
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
                    <td className="font-mono font-bold">{r.campusCode}</td>
                    <td><strong>{r.campusName}</strong></td>
                    <td>{r.location}</td>
                    <td>{r.address}</td>
                    <td>{r.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="campuses" onPageChange={setPage} />
        </div>
      </div>
      <CampusFormModal
        mode="new"
        isOpen={openModals.has('new-campus-modal')}
        onClose={() => closeModal('new-campus-modal')}
        showToast={showToast}
        campus={null}
        createCampus={createCampus}
        updateCampus={updateCampus}
      />
      <CampusFormModal
        mode="edit"
        isOpen={openModals.has('edit-campus-modal')}
        onClose={() => closeModal('edit-campus-modal')}
        showToast={showToast}
        campus={editingCampus}
        createCampus={createCampus}
        updateCampus={updateCampus}
      />
      <ViewCampusModal
        isOpen={openModals.has('view-campus-modal')}
        onClose={() => closeModal('view-campus-modal')}
        showToast={showToast}
        campus={viewingCampus}
        onEdit={() => {
          closeModal('view-campus-modal')
          openEditModal(viewingCampus!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.campusName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this campus. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteCampus.isPending} onClick={confirmDeleteCampus}>
                <i className="lni lni-trash-can"></i> {deleteCampus.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
