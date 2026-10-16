'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { ProjectReviewFormModal } from '@/components/modals/assessment/ProjectReviewFormModal'
import {
  useProjectReviewUnits,
  useProjectReviewStudents,
  useProjectReviews,
  useDeleteProjectReview
} from '@/hooks/assessment/useProjectReviews'

export default function ProjectReviewsPage() {
  const router = useRouter()

  const [toastMessage, setToastMessage] = useState<{ msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' = 'success') => {
    setToastMessage({ msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Filters
  const [unitGuid, setUnitGuid] = useState('')
  const [proposalGuid, setProposalGuid] = useState('')

  const { data: units, isLoading: isLoadingUnits } = useProjectReviewUnits()
  const { data: students, isLoading: isLoadingStudents } = useProjectReviewStudents(unitGuid)
  
  const { data: reviewData, isLoading: isLoadingReviews } = useProjectReviews(proposalGuid || null)
  const deleteMut = useDeleteProjectReview()

  const unitOptions = useMemo(() => {
    if (!units) return []
    return units.map(u => ({ value: u.unitGuid, label: `${u.unitCode} - ${u.unitName}` }))
  }, [units])

  const studentOptions = useMemo(() => {
    if (!students) return []
    return students.map(s => ({ value: s.proposalGuid, label: `${s.studentNum} - ${s.studentName}` }))
  }, [students])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGuid, setEditingGuid] = useState<string | null>(null)

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [deletingGuid, setDeletingGuid] = useState<string | null>(null)

  const handleEdit = (guid: string) => {
    setEditingGuid(guid)
    setIsFormOpen(true)
  }

  const handleDeleteClick = (guid: string) => {
    setDeletingGuid(guid)
    setIsConfirmDeleteOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!deletingGuid) return
    deleteMut.mutate(deletingGuid, {
      onSuccess: () => {
        showToast('Review deleted successfully')
        setIsConfirmDeleteOpen(false)
        setDeletingGuid(null)
      },
      onError: (err: any) => {
        showToast(err?.message || 'Failed to delete review', 'error')
      }
    })
  }

  return (
    <div className="pg-cont">
      <Toast toast={toastMessage} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="pg-title flex items-center gap-2">
            <span>Project Reviews</span>
            <span className="badge badge-purple text-[11px] font-semibold">Assessment Ops</span>
          </div>
          <div className="pg-sub text-xs text-slate-500">
            Manage reviews and track progress of student project proposals
          </div>
        </div>
      </div>

      {/* Top Filters */}
      <div className="bg-white border border-slate-200/80 rounded-lg p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 shrink-0 w-24">
              Course Unit<span className="text-rose-600 font-bold">*</span>
            </label>
            <div className="flex-1 min-w-0">
              <SearchSelect
                placeholder="Select Course Unit..."
                options={unitOptions}
                value={unitGuid}
                onChange={(val) => {
                  setUnitGuid(val)
                  setProposalGuid('')
                }}
              />
            </div>
          </div>

          <div className="md:col-span-5 flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 shrink-0 w-16">
              Student<span className="text-rose-600 font-bold">*</span>
            </label>
            <div className="flex-1 min-w-0">
              <SearchSelect
                placeholder="Select Student..."
                options={studentOptions}
                value={proposalGuid}
                onChange={setProposalGuid}
                disabled={!unitGuid || isLoadingStudents}
              />
            </div>
          </div>
        </div>
      </div>

      {proposalGuid && reviewData && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-blue-900 mb-1">{reviewData.projectName}</h3>
            {reviewData.members && (
              <div className="text-xs text-blue-700 mb-1">Members: {reviewData.members}</div>
            )}
            {reviewData.synopsisFileName ? (
              <a href={reviewData.synopsisUrl || '#'} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <i className="lni lni-empty-file"></i> {reviewData.synopsisFileName}
              </a>
            ) : (
              <span className="text-xs text-slate-500 italic">No synopsis document attached</span>
            )}
          </div>
        </div>
      )}

      {/* Reviews Table */}
      <div className="card">
        <div className="card-hdr">
          <div className="font-semibold text-lg flex items-center gap-2">
            <span className="ctitle-icon"><i className="lni lni-list"></i></span> Review History
          </div>
          {proposalGuid && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditingGuid(null); setIsFormOpen(true) }}>
              <i className="lni lni-plus"></i> Add New Review
            </button>
          )}
        </div>
        
        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th className="w-16">Action</th>
                <th className="w-48 text-center">Review Date</th>
                <th>Current Status</th>
                <th>Recommendations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white">
              {!proposalGuid ? (
                <EmptyState colSpan={4} title="Select a Student" subtitle="Please select a course unit and a student to view their project reviews." />
              ) : isLoadingReviews || !reviewData ? (
                <TableLoadingState colSpan={4} title="Loading reviews..." />
              ) : !reviewData.reviews || reviewData.reviews.length === 0 ? (
                <EmptyState colSpan={4} title="No reviews found for this project proposal." />
              ) : (
                reviewData.reviews.map((row) => (
                  <tr key={row.reviewGuid} className="hover:bg-slate-50/70 transition-colors">
                    <td className="text-center">
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm w-full text-left" onClick={() => handleEdit(row.reviewGuid)}>
                          <i className="lni lni-pencil mr-2 text-slate-400"></i>Edit Review
                        </button>
                        <button className="btn btn-neu btn-sm w-full text-left text-rose-600" onClick={() => handleDeleteClick(row.reviewGuid)}>
                          <i className="lni lni-trash-can mr-2 text-rose-400"></i>Delete
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="text-center font-semibold text-slate-700">
                      {row.reviewDate ? new Date(row.reviewDate).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td className="text-slate-800">{row.currentStatus || '-'}</td>
                    <td className="text-slate-800">{row.recommendations || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      {/* Add / Edit Review Modal */}
      <ProjectReviewFormModal 
        isOpen={isFormOpen} 
        onClose={() => {
          setIsFormOpen(false)
          setEditingGuid(null)
        }} 
        proposalGuid={proposalGuid}
        reviewGuid={editingGuid}
        onSuccess={() => showToast(editingGuid ? 'Review updated successfully' : 'Review added successfully')}
      />

      {/* Delete Confirmation Overlay */}
      {isConfirmDeleteOpen && deletingGuid && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => { setIsConfirmDeleteOpen(false); setDeletingGuid(null) }}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete Review?</div>
            <div className="perm-delete-sub">
              Are you sure you want to delete this project review? This action cannot be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => { setIsConfirmDeleteOpen(false); setDeletingGuid(null) }}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteMut.isPending} onClick={handleConfirmDelete}>
                <i className="lni lni-trash-can"></i> {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
