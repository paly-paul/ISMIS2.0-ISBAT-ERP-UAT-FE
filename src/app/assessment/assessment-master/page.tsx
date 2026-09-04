'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { usePagination } from '@/hooks/usePagination'
import { AssessmentTypeFormModal } from './_components/AssessmentTypeFormModal'
import { AssessmentTypeViewModal } from './_components/AssessmentTypeViewModal'
import { useAssessmentTypes, useDeleteAssessmentType } from '@/hooks/assessment/useAssessmentTypes'

const FETCH_SIZE = 12000
const DISPLAY_PAGE_SIZE = 10

export default function AssessmentTypesPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGuid, setEditingGuid] = useState<string | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ guid: string; name: string } | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading: loading } = useAssessmentTypes(1, FETCH_SIZE)
  const deleteMut = useDeleteAssessmentType()
  
  const rows = (data?.items ?? []).filter(r => 
    !search.trim() || 
    r.assessmentName?.toLowerCase().includes(search.toLowerCase()) ||
    r.assessmentCode?.toLowerCase().includes(search.toLowerCase())
  )
  
  // Client-side pagination over the fetched batch
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
      await deleteMut.mutateAsync(deleteTarget.guid)
      showToast('Assessment Type deleted', 'success')
      setDeleteTarget(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error')
      setDeleteTarget(null)
    }
  }

  return (
    <div id="page-assessment-types">
      <div className="flex items-center justify-between mt-3 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-g900 leading-tight">Fee Clearance Master</h1>
          <p className="text-[13.5px] text-g500 mt-0.5">Manage assessment categories and fee clearances</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-neu btn-sm flex items-center gap-1.5" onClick={() => router.back()}>
            <i className="lni lni-arrow-left font-bold" /> Back
          </button>
          <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={handleAddNew}>
            <i className="lni lni-plus font-bold" /> Add Fee Clearance
          </button>
        </div>
      </div>

      <div className="card pt-5 pb-5">
        <div className="px-6 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-g900">Fee Clearances</h2>
            <div className="text-[12.5px] text-g500">{totalCount} total active clearances</div>
          </div>
          <TableSearch
            className="w-full sm:w-64"
            placeholder="Search by code or name…"
            value={search}
            onChange={setSearch}
            results={[]}
          />
        </div>
        
        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Code</th>
                <th>Name</th>
                <th className="text-right">Fee Clearance</th>
                <th className="text-right">Display Fee Clearance</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <TableLoadingState colSpan={5} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={5} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                  : null}
              {pageItems.map(r => (
                <tr key={r.assessmentTypeGuid}>
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm" onClick={() => handleView(r.assessmentTypeGuid)}>
                        <i className="lni lni-eye" /> View
                      </button>
                      <button className="btn btn-neu btn-sm" onClick={() => handleEdit(r.assessmentTypeGuid)}>
                        <i className="lni lni-pencil" /> Edit Fee
                      </button>
                      <button className="btn btn-neu btn-sm text-clr-red" onClick={() => setDeleteTarget({ guid: r.assessmentTypeGuid, name: r.assessmentName || '' })}>
                        <i className="lni lni-trash-can" /> Delete
                      </button>
                    </ActionMenu>
                  </td>
                  <td className="font-mono text-sm">{r.assessmentCode}</td>
                  <td className="font-medium">{r.assessmentName}</td>
                  <td className="text-right font-mono">
                    {r.feeClearance !== null ? r.feeClearance.toFixed(2) : <span className="text-g400">—</span>}
                  </td>
                  <td className="text-right font-mono text-g600">
                    {r.displayFeeClearance !== null ? r.displayFeeClearance.toFixed(2) : <span className="text-g400">—</span>}
                  </td>
                </tr>
              ))}
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

      <AssessmentTypeFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        showToast={showToast} 
        editingGuid={editingGuid} 
      />

      <AssessmentTypeViewModal 
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
            <div className="perm-delete-title">Delete {deleteTarget.name}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this assessment type. This can&apos;t be undone.
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
