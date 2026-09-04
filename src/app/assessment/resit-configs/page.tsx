'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { SearchSelect } from '@/components/SearchSelect'
import { usePagination } from '@/hooks/usePagination'
import { ResitConfigFormModal } from './_components/ResitConfigFormModal'
import { ResitConfigViewModal } from './_components/ResitConfigViewModal'
import { useResitConfigs, useDeleteResitConfig } from '@/hooks/assessment/useResitConfigs'
import { useIntakes } from '@/hooks/academic/useIntakes'

const FETCH_SIZE = 12000
const DISPLAY_PAGE_SIZE = 10

export default function ResitConfigsPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGuid, setEditingGuid] = useState<string | null>(null)
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)
  
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [filterIntake, setFilterIntake] = useState('')

  const { data: intakes } = useIntakes()
  const { data, isLoading: loading } = useResitConfigs(1, FETCH_SIZE, filterIntake)
  const deleteMut = useDeleteResitConfig()

  const rows = data?.items ?? []
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(rows, DISPLAY_PAGE_SIZE)

  function showToast(msg: string, type = '') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleAddNew() {
    setEditingGuid(null)
    setIsModalOpen(true)
  }

  function handleEdit(guid: string) {
    setEditingGuid(guid)
    setIsModalOpen(true)
  }

  function handleView(guid: string) {
    setViewingGuid(guid)
    setIsViewModalOpen(true)
  }

  function handleEditFromView() {
    setIsViewModalOpen(false)
    setEditingGuid(viewingGuid)
    setIsModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget)
      showToast('Resit Config deleted successfully', 'success')
      setDeleteTarget(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error')
      setDeleteTarget(null)
    }
  }

  return (
    <div id="page-resit-configs">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Resit Configs Master</h1>
          <p className="text-sm text-g500 mt-0.5">Manage resit exam windows and supplementary schedules</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button className="btn btn-ghost flex-1 sm:flex-none justify-center" onClick={() => router.push('/assessment/dashboard')}>
            <i className="lni lni-arrow-left" /> Back
          </button>
          <button className="btn btn-primary flex-1 sm:flex-none justify-center whitespace-nowrap" onClick={handleAddNew}>
            <i className="lni lni-plus" /> Create Resit Window
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-g800">Resit Configurations</h2>
            <p className="text-xs text-g400 mt-0.5">{totalCount.toLocaleString()} total entries</p>
          </div>
          
          <div className="flex items-center gap-2">
            <SearchSelect 
              options={intakes?.map(i => ({ value: i.intakeGuid, label: i.description })) || []}
              value={filterIntake || undefined}
              onChange={val => setFilterIntake(val)}
              placeholder="All Intakes"
              style={{ width: 200, margin: 0 }}
            />
          </div>
        </div>

        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Reference Code</th>
                <th>Academic Intake</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th style={{ width: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <TableLoadingState colSpan={6} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={6} hasFilters={!!filterIntake} onClearFilters={() => setFilterIntake('')} />
                  : null}
              {pageItems.map(r => {
                const intakeDesc = intakes?.find(i => i.intakeGuid === r.academicIntakeGuid)?.description || 'Unknown'
                return (
                  <tr key={r.resitConfigGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => handleView(r.resitConfigGuid)}>
                          <i className="lni lni-eye" /> View
                        </button>
                        <button className="btn btn-neu btn-sm" onClick={() => handleEdit(r.resitConfigGuid)}>
                          <i className="lni lni-pencil" /> Edit
                        </button>
                        <button className="btn btn-neu btn-sm text-clr-red" onClick={() => setDeleteTarget(r.resitConfigGuid)}>
                          <i className="lni lni-trash-can" /> Delete
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="font-medium text-g800">{r.refCode}</td>
                    <td className="text-g600">{intakeDesc}</td>
                    <td className="font-mono text-sm text-g600">{r.startDate ? new Date(r.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="font-mono text-sm text-g600">{r.endDate ? new Date(r.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>
                      {r.isActive 
                        ? <span className="badge badge-green">Active Window</span> 
                        : <span className="badge badge-red">Inactive</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollTable>

        {totalCount > 0 && (
          <div className="flex items-center justify-between mt-3" style={{ fontSize: 12.5, color: 'var(--g500)' }}>
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn btn-neu btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <i className="lni lni-chevron-left" /> Previous
              </button>
              <button className="btn btn-neu btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Next <i className="lni lni-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ResitConfigFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        showToast={showToast}
        editingGuid={editingGuid}
      />

      <ResitConfigViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onEdit={handleEditFromView}
        viewingGuid={viewingGuid}
      />

      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete Resit Config?</div>
            <div className="perm-delete-sub">
              This will remove the resit configuration entry. This action cannot be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteMut.isPending} onClick={confirmDelete}>
                <i className="lni lni-trash-can"></i> {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
