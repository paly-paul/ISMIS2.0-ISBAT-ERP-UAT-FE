'use client'

import React, { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { ProjectProposalFormModal } from '@/components/modals/assessment/ProjectProposalFormModal'
import { ProjectProposalViewModal } from '@/components/modals/assessment/ProjectProposalViewModal'
import { ProjectProposalUploadModal } from '@/components/modals/assessment/ProjectProposalUploadModal'
import { TableSearch } from '@/components/TableSearch'
import { Pagination } from '@/components/Pagination'
import { 
  useProjectProposals, 
  useDeleteProjectProposal 
} from '@/hooks/assessment/useProjectProposals'
import { getProjectProposalSynopsis, ProjectProposalRow } from '@/lib/api/assessment/projectProposals'

export default function ProjectProposalsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGuid, setEditingGuid] = useState<string | null>(null)
  
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadingGuid, setUploadingGuid] = useState<string | null>(null)
  const [uploadingRow, setUploadingRow] = useState<ProjectProposalRow | null>(null)

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [deletingGuid, setDeletingGuid] = useState<string | null>(null)

  const [toastMessage, setToastMessage] = useState<{ msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' } | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: proposals, isLoading: isLoadingProposals } = useProjectProposals()
  const deleteMut = useDeleteProjectProposal()

  const filteredProposals = proposals?.filter(p => 
    !search || 
    p.projectName.toLowerCase().includes(search.toLowerCase()) || 
    (p.studentName && p.studentName.toLowerCase().includes(search.toLowerCase())) ||
    (p.studentNum && p.studentNum.toLowerCase().includes(search.toLowerCase())) ||
    (p.unitCode && p.unitCode.toLowerCase().includes(search.toLowerCase()))
  ) || []
  
  const itemsPerPage = 10
  const totalCount = filteredProposals.length
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))
  const paginatedProposals = filteredProposals.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const showToast = (msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' = 'success') => {
    setToastMessage({ msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleAdd = () => {
    setEditingGuid(null)
    setIsFormOpen(true)
  }

  const handleOpenUpload = (row?: ProjectProposalRow | null) => {
    if (row) {
      setUploadingGuid(row.proposalGuid)
      setUploadingRow(row)
    } else {
      setUploadingGuid(null)
      setUploadingRow(null)
    }
    setIsUploadOpen(true)
  }

  const handleEdit = (guid: string) => {
    setEditingGuid(guid)
    setIsFormOpen(true)
  }
  
  const handleView = (guid: string) => {
    setViewingGuid(guid)
    setIsViewOpen(true)
  }

  const handleDeleteRequest = (guid: string) => {
    setDeletingGuid(guid)
    setIsConfirmDeleteOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!deletingGuid) return
    deleteMut.mutate(deletingGuid, {
      onSuccess: () => {
        showToast('Project proposal deleted successfully.')
        setIsConfirmDeleteOpen(false)
        setDeletingGuid(null)
      },
      onError: (err: any) => {
        showToast(err?.message || 'Failed to delete proposal.', 'error')
        setIsConfirmDeleteOpen(false)
        setDeletingGuid(null)
      }
    })
  }

  const handleDownloadSynopsis = async (guid: string, studentName: string) => {
    try {
      const data = await getProjectProposalSynopsis(guid)
      if (data && data.url) {
        window.open(data.url, '_blank')
        showToast(`Synopsis download started for ${studentName || 'student'}`)
      } else {
        showToast('No synopsis file found for this proposal.', 'warn')
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to download synopsis.', 'error')
    }
  }

  return (
    <div className="page active">
      <Toast toast={toastMessage} />

      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title">Project Proposals</h1>
          <p className="pg-sub">Manage and track student project proposals for the current intake.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-neu" onClick={() => handleOpenUpload(null)}>
            <i className="lni lni-cloud-upload"></i> Upload Document
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="lni lni-plus"></i> Add New Proposal
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="font-semibold text-lg flex items-center gap-2">
            <span className="ctitle-icon"><i className="lni lni-list"></i></span> Records
          </div>
          <div className="flex gap-2">
            <TableSearch
              className="w-64"
              placeholder="Search records..."
              value={searchInput}
              onChange={setSearchInput}
              onEnter={() => { setSearch(searchInput); setPage(1) }}
            />
            {search && <button className="btn btn-neu" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>Clear</button>}
          </div>
        </div>
        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}>Action</th>
                <th>Student No</th>
                <th>Student Name</th>
                <th>Unit Code</th>
                <th>Unit Name</th>
                <th>Project Name</th>
                <th>Lecturer</th>
                <th className="w-24 text-center">Group</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingProposals ? (
                <TableLoadingState colSpan={8} title="Loading project proposals..." />
              ) : paginatedProposals.length === 0 ? (
                <EmptyState colSpan={8} title={search ? "No project proposals match your search." : "No project proposals found in this intake."} hasFilters={!!search} onClearFilters={() => { setSearchInput(''); setSearch(''); setPage(1) }} />
              ) : (
                paginatedProposals.map((row) => (
                  <tr key={row.proposalGuid}>
                    <td className="text-center">
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => handleView(row.proposalGuid)}>
                          <i className="lni lni-eye"></i> View Details
                        </button>
                        <button className="btn btn-neu btn-sm" onClick={() => handleOpenUpload(row)}>
                          <i className="lni lni-cloud-upload"></i> Upload Document
                        </button>
                        <button className="btn btn-neu btn-sm" onClick={() => handleDownloadSynopsis(row.proposalGuid, row.studentName || 'Student')}>
                          <i className="lni lni-download"></i> Download Synopsis
                        </button>
                        {row.canEdit && (
                          <>
                            <button className="btn btn-neu btn-sm" onClick={() => handleEdit(row.proposalGuid)}>
                              <i className="lni lni-pencil-alt"></i> Edit
                            </button>
                            <button className="btn btn-neu btn-sm text-rose-600 hover:text-rose-700" onClick={() => handleDeleteRequest(row.proposalGuid)}>
                              <i className="lni lni-trash-can"></i> Delete
                            </button>
                          </>
                        )}
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-slate-700">{row.studentNum || '-'}</td>
                    <td className="font-medium text-slate-800">{row.studentName || '-'}</td>
                    <td className="font-mono text-slate-700">{row.unitCode || '-'}</td>
                    <td className="text-slate-800">{row.unitName || '-'}</td>
                    <td>{row.projectName}</td>
                    <td className="text-slate-700">{row.facultyName || '-'}</td>
                    <td className="text-center">
                      {row.isGroup ? (
                        <span className="badge badge-indigo" title={`Group of ${row.studentCount || '?'}`}>Group</span>
                      ) : (
                        <span className="badge badge-slate">Solo</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination 
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setPage}
        />
      </div>

      <ProjectProposalFormModal 
        isOpen={isFormOpen} 
        onClose={() => {
          setIsFormOpen(false)
          setEditingGuid(null)
        }} 
        proposalGuid={editingGuid}
        onSuccess={() => showToast(editingGuid ? 'Proposal updated successfully' : 'Proposal created successfully')}
      />

      <ProjectProposalViewModal
        isOpen={isViewOpen}
        onClose={() => {
          setIsViewOpen(false)
          setViewingGuid(null)
        }}
        proposalGuid={viewingGuid}
        row={proposals?.find(p => p.proposalGuid === viewingGuid) || null}
        onToast={showToast}
      />

      <ProjectProposalUploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false)
          setUploadingGuid(null)
          setUploadingRow(null)
        }}
        proposalGuid={uploadingGuid}
        initialRow={uploadingRow}
        onSuccess={() => showToast('Document uploaded successfully')}
      />

      {isConfirmDeleteOpen && deletingGuid && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => { setIsConfirmDeleteOpen(false); setDeletingGuid(null) }}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete Proposal?</div>
            <div className="perm-delete-sub">
              Are you sure you want to delete this project proposal? This action cannot be undone.
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
