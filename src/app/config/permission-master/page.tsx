'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { PermissionFormModal } from '@/components/modals/config/PermissionFormModal'
import { ViewPermissionModal } from '@/components/modals/config/ViewPermissionModal'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { usePermissionGroups, useCreatePermissionGroup, useUpdatePermissionGroup, PermissionGroup } from '@/hooks/config/usePermissionGroups'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null)
  const [viewingGroup, setViewingGroup] = useState<PermissionGroup | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = usePermissionGroups()
  const sortedRows = [...rows].reverse()
  const createPermissionGroup = useCreatePermissionGroup()
  const updatePermissionGroup = useUpdatePermissionGroup()

  // Live preview shown in the search dropdown as the user types — matches
  // the same group/description test as the table's own search filter below.
  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? sortedRows.filter(r => `${r.group} ${r.description}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = sortedRows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.group} ${r.description}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(group: PermissionGroup) {
    setEditingGroup(group)
    openModal('edit-permission-modal')
  }

  function openViewModal(group: PermissionGroup) {
    setViewingGroup(group)
    openModal('view-permission-modal')
    setSearch('')
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Permission Master</div>
            <div className="pg-sub">Define permission groups and their access scope across the ERP</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-permission-modal')}>
              <i className="lni lni-plus"></i> Add Group
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-lock"></i></span> Permission Groups</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.id, primary: r.group, secondary: r.description }))}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(res) => { const row = sortedRows.find(x => x.id === res.id); if (row) openViewModal(row) }}
              />
            </div>
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Group Name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={3} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={3} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && (
                          <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>
                        )}
                      </ActionMenu>
                    </td>
                    <td><strong>{r.group}</strong></td>
                    <td className="text-g600">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="permission groups" onPageChange={setPage} />
        </div>
      </div>
      <PermissionFormModal
        mode="new"
        isOpen={openModals.has('new-permission-modal')}
        onClose={() => closeModal('new-permission-modal')}
        showToast={showToast}
        permissionGroup={null}
        createPermissionGroup={createPermissionGroup}
        updatePermissionGroup={updatePermissionGroup}
      />
      <PermissionFormModal
        mode="edit"
        isOpen={openModals.has('edit-permission-modal')}
        onClose={() => closeModal('edit-permission-modal')}
        showToast={showToast}
        permissionGroup={editingGroup}
        createPermissionGroup={createPermissionGroup}
        updatePermissionGroup={updatePermissionGroup}
      />
      <ViewPermissionModal
        isOpen={openModals.has('view-permission-modal')}
        onClose={() => closeModal('view-permission-modal')}
        showToast={showToast}
        permissionGroup={viewingGroup}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-permission-modal'); if (viewingGroup) openEditModal(viewingGroup) }}
      />
      <Toast toast={toast} />
    </>
  )
}
