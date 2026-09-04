'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { StreamFormModal } from '@/components/modals/config/StreamFormModal'
import { ViewStreamModal } from '@/components/modals/config/ViewStreamModal'
import { useStreams, useCreateStream, useUpdateStream, useDeleteStream, Stream } from '@/hooks/config/useStreams'
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
  const [editingStreamGuid, setEditingStreamGuid] = useState<string | null>(null)
  const [viewingStreamGuid, setViewingStreamGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Stream | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useStreams()
  const createStream = useCreateStream()
  const updateStream = useUpdateStream()
  const deleteStream = useDeleteStream()

  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.streamCode} ${r.streamName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.streamCode} ${r.streamName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingStreamGuid(guid)
    openModal('edit-stream-modal')
  }

  function openViewModal(guid: string) {
    setViewingStreamGuid(guid)
    openModal('view-stream-modal')
    setSearch('')
  }

  function confirmDeleteStream() {
    if (!deleteTarget) return
    deleteStream.mutate(deleteTarget.streamGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Stream deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete stream', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Specialization Master</div>
            <div className="pg-sub">Manage academic specialization streams</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-stream-modal')}>
              <i className="lni lni-plus"></i> Add Stream
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-certificate"></i></span> Specialization Streams</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.streamGuid, primary: r.streamCode, secondary: r.streamName }))}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(r) => openViewModal(r.id)}
              />
            </div>
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Stream Code</th>
                  <th>Stream Name</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.streamGuid}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.streamGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.streamGuid)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td className="font-mono font-bold">{r.streamCode}</td>
                    <td><strong>{r.streamName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="specializations" onPageChange={setPage} />
        </div>
      </div>
      <StreamFormModal
        mode="new"
        isOpen={openModals.has('new-stream-modal')}
        onClose={() => closeModal('new-stream-modal')}
        showToast={showToast}
        streamGuid={null}
        createStream={createStream}
        updateStream={updateStream}
      />
      <StreamFormModal
        mode="edit"
        isOpen={openModals.has('edit-stream-modal')}
        onClose={() => closeModal('edit-stream-modal')}
        showToast={showToast}
        streamGuid={editingStreamGuid}
        createStream={createStream}
        updateStream={updateStream}
      />
      <ViewStreamModal
        isOpen={openModals.has('view-stream-modal')}
        onClose={() => closeModal('view-stream-modal')}
        showToast={showToast}
        streamGuid={viewingStreamGuid}
        onEdit={() => {
          closeModal('view-stream-modal')
          openEditModal(viewingStreamGuid!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.streamName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this stream. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteStream.isPending} onClick={confirmDeleteStream}>
                <i className="lni lni-trash-can"></i> {deleteStream.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
