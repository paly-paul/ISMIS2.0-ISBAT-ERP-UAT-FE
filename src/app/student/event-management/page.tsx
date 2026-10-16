'use client'
import { useMemo, useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EventFormModal } from '@/components/modals/student/EventFormModal'
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, EventItem } from '@/hooks/student/useEventManagement'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { formatDate } from '@/lib/date'

export default function Page() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]       = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch]     = useState('')
  const [editingEventGuid, setEditingEventGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null)

  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // The endpoint returns every event in one response, unpaginated — no
  // pageNumber/pageSize/totalCount on the wire (see get-events.md) — so the
  // whole list is rendered as-is, just filtered and re-sorted client-side.
  const { data, isLoading } = useEvents()
  const allEvents = data ?? []

  const searchTrimmed = search.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    const base = searchTrimmed
      ? allEvents.filter(e =>
          (e.subject ?? '').toLowerCase().includes(searchTrimmed) ||
          (e.eventBody ?? '').toLowerCase().includes(searchTrimmed),
        )
      : allEvents
    // Newest event date first — matches the real endpoint's own ordering,
    // re-applied client-side so a freshly added/edited event sorts correctly
    // without waiting on a refetch.
    return [...base].sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? ''))
  }, [allEvents, searchTrimmed])

  const searchMatches = useMemo(
    () => (searchTrimmed ? filteredRows.slice(0, 8) : []),
    [filteredRows, searchTrimmed],
  )

  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent  = useDeleteEvent()

  function openEditModal(guid: string) {
    setEditingEventGuid(guid)
    openModal('edit-event-modal')
  }

  function confirmDeleteEvent() {
    if (!deleteTarget) return
    deleteEvent.mutate(deleteTarget.eventGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Event deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete event', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Event Management</div>
            <div className="pg-sub">Academic calendar events · Announcements for students</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {permissions.add && <button className="btn btn-primary" onClick={() => openModal('add-event-modal')}><i className="lni lni-plus"></i> Add Event</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> Events</div>
            <TableSearch
              className="w-56"
              placeholder="Search topic or event…"
              value={search}
              onChange={v => setSearch(v)}
              results={searchMatches.map(e => ({ id: e.eventGuid, primary: e.subject || 'Untitled event', secondary: formatDate(e.eventDate) }))}
              minChars={1}
              onSelect={() => {}}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Topic</th>
                  <th>Event Date</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {!isLoading && filteredRows.map(e => (
                  <tr key={e.eventGuid}>
                    <td>
                      {(permissions.edit || permissions.delete) && (
                        <ActionMenu>
                          {permissions.edit && (
                            <button className="btn btn-neu btn-sm" onClick={() => openEditModal(e.eventGuid)}>
                              <i className="lni lni-pencil"></i> Edit
                            </button>
                          )}
                          {permissions.delete && (
                            <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(e)}>
                              <i className="lni lni-trash-can"></i> Delete
                            </button>
                          )}
                        </ActionMenu>
                      )}
                    </td>
                    <td><strong>{e.subject || <span className="text-muted">— Untitled —</span>}</strong></td>
                    <td className="text-muted">{formatDate(e.eventDate)}</td>
                    <td>{e.eventBody}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </div>

      <EventFormModal
        mode="new"
        isOpen={openModals.has('add-event-modal')}
        onClose={() => closeModal('add-event-modal')}
        showToast={showToast}
        eventGuid={null}
        createEvent={createEvent}
        updateEvent={updateEvent}
      />
      <EventFormModal
        mode="edit"
        isOpen={openModals.has('edit-event-modal')}
        onClose={() => closeModal('edit-event-modal')}
        showToast={showToast}
        eventGuid={editingEventGuid}
        createEvent={createEvent}
        updateEvent={updateEvent}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete &quot;{deleteTarget.subject || 'this event'}&quot;?</div>
            <div className="perm-delete-sub">
              This will permanently delete this event entry. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteEvent.isPending} onClick={confirmDeleteEvent}>
                <i className="lni lni-trash-can"></i> {deleteEvent.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
