'use client'
import { useState, useMemo } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { BatchFormModal } from '@/components/modals/academic/BatchFormModal'
import { ViewBatchModal } from '@/components/modals/academic/ViewBatchModal'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useBatches, useCreateBatch, useUpdateBatch, useDeleteBatch, useBatchStudentCount, Batch } from '@/hooks/academic/useBatches'
import { useEmployeeDropdown } from '@/hooks/employee/useEmployees'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// bStartDate/bEndDate come back as "2024-02-12T00:00:00" — display as
// "12 Feb 2024" rather than the raw ISO date.
function formatDisplayDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// 10 rows/page — same convention as the other master pages (Intake
// Master, Programme Group, Repetition Tag), not the 20 this used while it
// was still client-paginating a 1000-row full fetch.
const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as Intake Master /
// Skill Master's search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingBatchGuid, setEditingBatchGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null)

  // Real server-side pagination (2026-09-09) — only PAGE_SIZE rows are ever
  // requested for the page on screen, not the whole 333+-row table fetched
  // at once the way this page used to (useBatches(1, 1000)). Search is real
  // server-side too (see useBatches), only
  // actually queried once the term clears MIN_SEARCH_CHARS, same gate
  // TableSearch's own dropdown uses. Trade-off: "newest to oldest" sorting
  // (Batch has no createdAt, only bStartDate) can now only sort the rows
  // already on the current page, not the full dataset — same "server
  // search/paging, client work stays page-scoped" trade-off enquiry-list's
  // own filters made.
  const searchTrimmed = search.trim()
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  const { data, isLoading, isFetching } = useBatches(page, PAGE_SIZE, activeSearch)
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && isFetching

  const sortedRows = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => (b.bStartDate ?? '').localeCompare(a.bStartDate ?? '')),
    [data],
  )
  const filteredRows = sortedRows
  const pageItems = filteredRows

  const createBatch = useCreateBatch()
  const updateBatch = useUpdateBatch()
  const deleteBatch = useDeleteBatch()

  const needsEmployeeLookup = pageItems.some(r => r.bInCharge || r.pHead)
  const { data: employees = [] } = useEmployeeDropdown(needsEmployeeLookup)

  function programName(r: Batch) {
    return r.programName ?? '—'
  }
  function streamName(r: Batch) {
    return r.streamName ?? '—'
  }
  function batchTimeName(r: Batch) {
    return r.batchTimeName ?? '—'
  }
  // No client-side fallback needed — semesterName is always present on the
  // row (see the Batch type's own comment). This replaces what used to be a
  // genuinely N+1 fetch (one GET .../semesters/dropdownforprogram request
  // per distinct programme on the page, since there's no global semester
  // list) with zero extra requests at all.
  function semesterName(r: Batch) {
    return r.semesterName ?? '—'
  }
  function employeeName(guid?: string | null) {
    if (!guid || guid === '00000000-0000-0000-0000-000000000000') return '—'
    return employees.find(e => e.employeeGuid === guid)?.displayName || '—'
  }

  // Rows are already server-filtered by activeSearch — this just previews
  // up to 8 of what's already loaded (same convention as enquiry-list's own
  // searchMatches).
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? filteredRows.slice(0, 8) : []

  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingBatchGuid(guid)
    openModal('edit-batch-modal')
  }

  function openViewModal(guid: string) {
    setEditingBatchGuid(guid)
    openModal('view-batch-modal')
    setSearch('')
  }

  // Confirmed bug fix: the delete confirmation used to say nothing about
  // whether the batch actually had students in it — students/counts-by-
  // batch.md is explicit this endpoint exists "to display student counts on
  // batch management screens", but nothing on this page ever called it.
  // Scoped to just the batch actually being deleted (enabled only while the
  // dialog is open), not the whole visible page.
  const { data: deleteTargetStudentCount } = useBatchStudentCount(deleteTarget?.batchGuid ?? null, !!deleteTarget)

  function confirmDeleteBatch() {
    if (!deleteTarget) return
    deleteBatch.mutate(deleteTarget.batchGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Batch deleted successfully', 'success') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete batch', 'danger'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Batch Management</div><div className="pg-sub">Create batches per intake · Assign Batch In-Charge</div></div>
          <div className="flex items-center gap-3">
            {permissions.add && <button className="btn btn-primary" onClick={() => openModal('new-batch-modal')}><i className="lni lni-plus"></i> Create Batch</button>}
          </div>
        </div>



        <div className="card">
          <div className="card-hdr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-users"></i></span> Batches</div>
            <TableSearch
              className="w-56"
              placeholder="Search by batch code…"
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              results={searchMatches.map(r => ({ id: r.batchGuid, primary: r.batchCode, secondary: programName(r) }))}
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
                  <th>Batch Code</th>
                  <th>Programme</th>
                  <th>Semester</th>
                  <th>Specialization</th>
                  <th>Batch Time</th>
                  <th>Batch In-Charge</th>
                  <th>Programme Head</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : pageItems.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                    : null}
                {!isLoading && pageItems.map(r => (
                  <tr key={r.batchGuid}>
                    <td>
                      {(permissions.edit || permissions.delete || true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.batchGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.batchGuid)}><i className="lni lni-pencil"></i> Edit</button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}><i className="lni lni-trash-can"></i> Delete</button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td><span className="font-bold font-mono text-blue">{r.batchCode}</span></td>
                    <td>{programName(r)}</td>
                    <td>{semesterName(r)}</td>
                    <td>{streamName(r)}</td>
                    <td>{batchTimeName(r)}</td>
                    <td>{employeeName(r.bInCharge)}</td>
                    <td>{employeeName(r.pHead)}</td>
                    <td className="text-sm text-g600">{formatDisplayDate(r.bStartDate)}</td>
                    <td className="text-sm text-g600">{formatDisplayDate(r.bEndDate)}</td>
                    <td><span className={`badge ${r.active ? 'badge-green' : 'badge-grey'}`}>{r.active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>

          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="batches" onPageChange={setPage} />
        </div>
      </div>
      {openModals.has('new-batch-modal') && (
        <BatchFormModal
          mode="new"
          isOpen
          onClose={() => closeModal('new-batch-modal')}
          showToast={showToast}
          batchGuid={null}
          createBatch={createBatch}
          updateBatch={updateBatch}
        />
      )}
      {openModals.has('edit-batch-modal') && (
        <BatchFormModal
          mode="edit"
          isOpen
          onClose={() => closeModal('edit-batch-modal')}
          showToast={showToast}
          batchGuid={editingBatchGuid}
          createBatch={createBatch}
          updateBatch={updateBatch}
        />
      )}
      {openModals.has('view-batch-modal') && (
        <ViewBatchModal canEdit={permissions.edit} onEdit={() => { closeModal('view-batch-modal'); openEditModal(editingBatchGuid || '') }}
          isOpen
          onClose={() => closeModal('view-batch-modal')}
          showToast={showToast}
          batchGuid={editingBatchGuid}
        />
      )}
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.batchCode}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this batch. This can&apos;t be undone.
            </div>
            {!!deleteTargetStudentCount && (
              <div className="warn-box mt-2 mb-1" style={{ textAlign: 'left' }}>
                <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i>
                <div>
                  {deleteTargetStudentCount} student{deleteTargetStudentCount !== 1 ? 's are' : ' is'} currently enrolled in this batch. Deleting it won&apos;t remove them, but they&apos;ll be left without a valid batch.
                </div>
              </div>
            )}
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteBatch.isPending} onClick={confirmDeleteBatch}>
                <i className="lni lni-trash-can"></i> {deleteBatch.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
