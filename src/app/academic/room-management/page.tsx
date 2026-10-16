'use client'
import { useState, useEffect } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { RoomFormModal } from '@/components/modals/academic/RoomFormModal'
import { ViewRoomModal } from '@/components/modals/academic/ViewRoomModal'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useRoomsPaged, useRoomSearch, useCreateRoom, useUpdateRoom, useDeleteRoom, Room } from '@/hooks/academic/useRooms'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [editingRoomGuid, setEditingRoomGuid] = useState<string | null>(null)
  const [viewingRoomGuid, setViewingRoomGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Debounced so the backend's confirmed ?search= (get-rooms.md) isn't hit
  // on every keystroke, and held at '' (falling back to the unfiltered list)
  // until MIN_SEARCH_CHARS is met — same convention as Intake/Skill's
  // search boxes.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])
  // A new term starts from its own first page.
  useEffect(() => { setPage(1) }, [debouncedSearch])

  // The table now shows the search results (it used to ignore the search
  // box entirely and only the dropdown preview reacted).
  const { data, isLoading, isFetching, isPlaceholderData } = useRoomsPaged(true, page, PAGE_SIZE, debouncedSearch)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const { data: searchResults, isFetching: isSearching } = useRoomSearch(debouncedSearch)
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isSearching)
  // Show the loading state only while a *new search term's* results are on
  // the way — not on plain page changes, which keep the current rows up.
  const tableSearchPending = searchPending || (isFetching && isPlaceholderData && page === 1)

  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const deleteRoom = useDeleteRoom()

  function matchesSearch(r: Room, term: string) {
    return `${r.roomCode} ${r.location ?? ''}`.toLowerCase().includes(term)
  }

  // Live preview shown in the search dropdown as the user types.
  // Reads from searchResults if server search completed, otherwise falls back
  // to filtering the full list client-side.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? (debouncedSearch ? (searchResults ?? []) : rows)
        .filter(r => matchesSearch(r, searchTrimmed.toLowerCase()))
        .slice(0, 8)
    : []

  // Pull the page back in range (e.g. after deleting the last room on the
  // last page) — but only from a real response. While a page is loading
  // there's no totalCount yet, and clamping against that snapped every
  // "Next" straight back to page 1.
  useEffect(() => {
    if (data && page !== safePage) setPage(safePage)
  }, [data, page, safePage])

  function openEditModal(guid: string) {
    setEditingRoomGuid(guid)
    openModal('edit-room-modal')
  }

  function openViewModal(guid: string) {
    setViewingRoomGuid(guid)
    openModal('view-room-modal')
    setSearch('')
  }

  function confirmDeleteRoom() {
    if (!deleteTarget) return
    deleteRoom.mutate(deleteTarget.roomGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Room deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete room', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Room Management</div>
            <div className="pg-sub">Manage rooms and venues for academic scheduling</div>
          </div>
          {permissions.add && <button className="btn btn-primary" onClick={() => openModal('new-room-modal')}>
            <i className="lni lni-plus"></i> Add Room
          </button>}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">
              <span className="ctitle-icon"><i className="lni lni-home"></i></span>
              Rooms &amp; Venues
            </div>
            <TableSearch
              className="w-56"
              placeholder="Search by room code or location…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.roomGuid, primary: r.roomCode, secondary: r.location ?? '' }))}
              loading={searchPending}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Room Code</th>
                  <th>Location</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {(isLoading || tableSearchPending)
                  ? <TableLoadingState colSpan={999} />
                  : rows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                    : null}
                {!(isLoading || tableSearchPending) && rows.map((r) => (
                  <tr key={r.roomGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.roomGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.roomGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold text-b700">{r.roomCode}</td>
                    <td>{r.location || '—'}</td>
                    <td>{r.capacity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={safePage} totalPages={totalPages} totalCount={totalCount} itemLabel="rooms" onPageChange={setPage} />
        </div>
      </div>

      <ViewRoomModal
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-room-modal'); openEditModal(viewingRoomGuid || '') }}
        isOpen={openModals.has('view-room-modal')}
        onClose={() => closeModal('view-room-modal')}
        showToast={showToast}
        roomGuid={viewingRoomGuid}
      />
      <RoomFormModal
        mode="new"
        isOpen={openModals.has('new-room-modal')}
        onClose={() => closeModal('new-room-modal')}
        showToast={showToast}
        roomGuid={null}
        createRoom={createRoom}
        updateRoom={updateRoom}
      />
      <RoomFormModal
        mode="edit"
        isOpen={openModals.has('edit-room-modal')}
        onClose={() => closeModal('edit-room-modal')}
        showToast={showToast}
        roomGuid={editingRoomGuid}
        createRoom={createRoom}
        updateRoom={updateRoom}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.roomCode}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this room. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteRoom.isPending} onClick={confirmDeleteRoom}>
                <i className="lni lni-trash-can"></i> {deleteRoom.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
