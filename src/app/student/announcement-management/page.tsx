'use client'
import { useMemo, useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { RichTextDisplay } from '@/components/RichTextEditor'
import { AnnouncementFormModal } from '@/components/modals/student/AnnouncementFormModal'
import {
  useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement, AnnouncementItem,
} from '@/hooks/student/useAnnouncementManagement'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { openDocumentForViewing } from '@/lib/documentViewer'
import { formatDate } from '@/lib/date'

// programName is null both for global announcements and for ones whose
// programme has since been deactivated (see get-admin-announcements.md).
function programLabel(a: AnnouncementItem): string {
  if (a.isGlobal) return 'All Programmes'
  return a.programName ?? 'Programme unavailable'
}

export default function Page() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]       = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch]     = useState('')
  const [editingAnnouncementGuid, setEditingAnnouncementGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null)

  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Unpaginated — the endpoint returns every announcement in one response
  // (see get-admin-announcements.md), so search/sort run client-side.
  const { data, isLoading } = useAnnouncements()
  const allAnnouncements = data ?? []

  const searchTrimmed = search.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    const base = searchTrimmed
      ? allAnnouncements.filter(a =>
          (a.subject ?? '').toLowerCase().includes(searchTrimmed) ||
          programLabel(a).toLowerCase().includes(searchTrimmed) ||
          (a.announcementBody ?? '').toLowerCase().includes(searchTrimmed),
        )
      : allAnnouncements
    // Newest Visible Upto first — matches the endpoint's own ordering.
    return [...base].sort((a, b) => b.announceDate.localeCompare(a.announceDate))
  }, [allAnnouncements, searchTrimmed])

  const searchMatches = useMemo(
    () => (searchTrimmed ? filteredRows.slice(0, 8) : []),
    [filteredRows, searchTrimmed],
  )

  const createAnnouncement = useCreateAnnouncement()
  const updateAnnouncement = useUpdateAnnouncement()
  const deleteAnnouncement = useDeleteAnnouncement()

  function openEditModal(guid: string) {
    setEditingAnnouncementGuid(guid)
    openModal('edit-announcement-modal')
  }

  function viewAttachment(url: string) {
    openDocumentForViewing(url).catch(() => showToast('Failed to open attachment', 'error'))
  }

  function confirmDeleteAnnouncement() {
    if (!deleteTarget) return
    deleteAnnouncement.mutate(deleteTarget.announcementGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Announcement deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete announcement', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Announcement Management</div>
            <div className="pg-sub">Campus-wide and programme-specific announcements for students</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {permissions.add && <button className="btn btn-primary" onClick={() => openModal('add-announcement-modal')}><i className="lni lni-plus"></i> Add Announcement</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bullhorn"></i></span> Announcements</div>
            <TableSearch
              className="w-56"
              placeholder="Search subject, programme or content…"
              value={search}
              onChange={v => setSearch(v)}
              results={searchMatches.map(a => ({ id: a.announcementGuid, primary: a.subject || 'Untitled announcement', secondary: programLabel(a) }))}
              minChars={1}
              onSelect={() => {}}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Announcement</th>
                  <th>Programme</th>
                  <th>Visible Upto</th>
                  <th style={{ width: 90 }}>Attachment</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {!isLoading && filteredRows.map(a => (
                  <tr key={a.announcementGuid}>
                    <td>
                      {(permissions.edit || permissions.delete) && (
                        <ActionMenu>
                          {permissions.edit && (
                            <button className="btn btn-neu btn-sm" onClick={() => openEditModal(a.announcementGuid)}>
                              <i className="lni lni-pencil"></i> Edit
                            </button>
                          )}
                          {permissions.delete && (
                            <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(a)}>
                              <i className="lni lni-trash-can"></i> Delete
                            </button>
                          )}
                        </ActionMenu>
                      )}
                    </td>
                    <td style={{ maxWidth: 480 }}>
                      <strong>{a.subject || <span className="text-muted">— Untitled —</span>}</strong>
                      <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4, maxHeight: 60, overflow: 'hidden' }}>
                        <RichTextDisplay content={a.announcementBody ?? ''} />
                      </div>
                    </td>
                    <td className="text-muted">{programLabel(a)}</td>
                    <td className="text-muted">{formatDate(a.announceDate)}</td>
                    <td>
                      {a.attachmentUrl ? (
                        <button
                          type="button"
                          className="btn btn-neu btn-sm"
                          title="View attachment"
                          onClick={() => viewAttachment(a.attachmentUrl as string)}
                        >
                          <i className="lni lni-paperclip"></i>
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </div>

      <AnnouncementFormModal
        mode="new"
        isOpen={openModals.has('add-announcement-modal')}
        onClose={() => closeModal('add-announcement-modal')}
        showToast={showToast}
        announcementGuid={null}
        createAnnouncement={createAnnouncement}
        updateAnnouncement={updateAnnouncement}
      />
      <AnnouncementFormModal
        mode="edit"
        isOpen={openModals.has('edit-announcement-modal')}
        onClose={() => closeModal('edit-announcement-modal')}
        showToast={showToast}
        announcementGuid={editingAnnouncementGuid}
        createAnnouncement={createAnnouncement}
        updateAnnouncement={updateAnnouncement}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete &quot;{deleteTarget.subject || 'this announcement'}&quot;?</div>
            <div className="perm-delete-sub">
              This will permanently delete this announcement and its attachment. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteAnnouncement.isPending} onClick={confirmDeleteAnnouncement}>
                <i className="lni lni-trash-can"></i> {deleteAnnouncement.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
