'use client'
import { useEffect, useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { Pagination } from '@/components/Pagination'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import {
  useTerminationReasons,
  useCreateTerminationReason,
  useUpdateTerminationReason,
  useDeleteTerminationReason,
  TerminationReasonDto,
} from '@/hooks/student/useTerminationReasons'

// M_TERMINATION_REASON master (termination-reasons/*.md) — the reason
// picker used by POST /students/{studentGuid}/terminate. A tiny resource
// (guid + name only, soft-deleted on remove), so the form is a single inline
// modal rather than a separate modal component file — same convention as
// Student Category Master (config/student-category-master/page.tsx).

const PAGE_SIZE = 20

export default function Page() {
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [page, setPage] = useState(1)

  // Debounced, same 400ms convention used by the other server-search boxes
  // in this app — avoids hitting the search endpoint on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setCommittedSearch(search.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError } = useTerminationReasons(page, PAGE_SIZE, committedSearch)
  // TerminationReasonListItemDto carries no created-date field and the list
  // endpoint documents no sort param (get-termination-reasons.md) — the
  // server's own order is assumed to be insertion order (oldest first, the
  // typical default for an unordered SQL query), so reversing it client-side
  // is the only way to show newest-first without a real timestamp to sort
  // by. Only reverses within the current page, not the full result set.
  const items = [...(data?.items ?? [])].reverse()
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const createReason = useCreateTerminationReason()
  const updateReason = useUpdateTerminationReason()
  const deleteReason = useDeleteTerminationReason()

  const [formModal, setFormModal] = useState<{ mode: 'add' | 'edit'; row?: TerminationReasonDto } | null>(null)
  const [reasonName, setReasonName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TerminationReasonDto | null>(null)

  function openAdd() { setFormModal({ mode: 'add' }); setReasonName('') }
  function openEdit(row: TerminationReasonDto) { setFormModal({ mode: 'edit', row }); setReasonName(row.reasonName) }

  function saveReason() {
    const name = reasonName.trim()
    if (!name) { showToast('Reason name is required.', 'warn'); return }
    if (name.length > 100) { showToast('Reason name must be 100 characters or fewer.', 'warn'); return }

    const onDone = {
      onSuccess: () => {
        showToast(formModal?.mode === 'add' ? 'Termination reason added.' : 'Termination reason updated.', 'success')
        setFormModal(null)
      },
      onError: (error: Error) => showToast(error.message || 'Could not save termination reason.', 'error'),
    }
    if (formModal?.mode === 'add') createReason.mutate({ reasonName: name }, onDone)
    else if (formModal?.row) updateReason.mutate({ guid: formModal.row.terminationReasonGuid, input: { reasonName: name } }, onDone)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteReason.mutate(deleteTarget.terminationReasonGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Termination reason deleted.', 'success') },
      onError: (error: Error) => showToast(error.message || 'Could not delete termination reason.', 'error'),
    })
  }

  const isSaving = createReason.isPending || updateReason.isPending

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Termination Reason Master</div>
            <div className="pg-sub">Reasons used when terminating a student (e.g. Fake Certificate)</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={openAdd}>
              <i className="lni lni-plus"></i> Add Termination Reason
            </button>
          )}
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-shield"></i></span> Termination Reasons</div>
            <div className="inp-wrap" style={{ width: 240 }}>
              <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
              <input
                className="ctrl"
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <ScrollTable>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Reason Name</th></tr></thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={2} className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading…</td></tr>
                ) : isError ? (
                  <tr><td colSpan={2} className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load termination reasons.</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={2} className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No termination reasons found.</td></tr>
                ) : items.map(r => (
                  <tr key={r.terminationReasonGuid}>
                    <td>
                      <ActionMenu>
                        {permissions.edit && (
                          <button className="btn btn-neu btn-sm" onClick={() => openEdit(r)}><i className="lni lni-pencil"></i> Edit</button>
                        )}
                        {permissions.delete && (
                          <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}><i className="lni lni-trash-can"></i> Delete</button>
                        )}
                      </ActionMenu>
                    </td>
                    <td className="font-bold">{r.reasonName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="termination reasons" onPageChange={setPage} />
        </div>
      </div>

      {formModal && (
        <div className="modal-overlay open">
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{formModal.mode === 'add' ? 'Add' : 'Edit'} Termination Reason</div>
              <button className="modal-close" onClick={() => setFormModal(null)}><i className="lni lni-close"></i></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="fg">
                <div className="lbl">Reason Name <span className="req">*</span></div>
                <input
                  className="ctrl"
                  placeholder="e.g. Fake Certificate"
                  maxLength={100}
                  value={reasonName}
                  onChange={e => setReasonName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setFormModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={isSaving} onClick={saveReason}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete &quot;{deleteTarget.reasonName}&quot;?</div>
            <div className="perm-delete-sub">
              This won&apos;t affect students already terminated with this reason — only removes it from the picker going forward.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteReason.isPending} onClick={confirmDelete}>
                <i className="lni lni-trash-can"></i> {deleteReason.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}
