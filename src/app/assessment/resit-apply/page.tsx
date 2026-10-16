'use client'
import { useState, useEffect } from 'react'
import {
  useResitEligibleStudents,
  useResitDropdownUnits,
  useResitCheckboxState,
  useResitAppliedUnits,
  useResitApplicationForEdit,
  useSubmitResitApplication,
  useDeleteResitApplication
} from '@/hooks/assessment/useResitApply'
import { ResitEligibleStudentDto, ResitApplicationListItemDto } from '@/lib/api/assessment/resitApply'
import { Toast } from '@/components/Toast'
import { TableSearch } from '@/components/TableSearch'
import { Pagination } from '@/components/Pagination'
import { ScrollTable } from '@/components/ScrollTable'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'

export default function ResitApplyPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  // Toast doesn't dismiss itself; clear each one after 3.5s.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // View state
  const [selectedStudent, setSelectedStudent] = useState<ResitEligibleStudentDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ResitApplicationListItemDto | null>(null)

  // List view state
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Search / Clear buttons (resit-apply-page.md, View 1). Only spaces = no search.
  function doSearch() { setSearch(searchInput.trim()); setPage(1) }
  function doClear() { setSearchInput(''); setSearch(''); setPage(1) }

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useResitEligibleStudents({ page, pageSize: 10, search })

  // Page beyond the last page → back to the last page.
  useEffect(() => {
    if (listData && listData.items.length === 0 && listData.totalCount > 0 && page > 1) setPage(Math.ceil(listData.totalCount / 10))
  }, [listData, page])

  // Form view state
  const [editingGuid, setEditingGuid] = useState<string | null>(null)
  const [courseUnitGuid, setCourseUnitGuid] = useState('')
  const [cw, setCw] = useState(false)
  const [ue, setUe] = useState(false)
  const [ueType, setUeType] = useState<0 | 1>(0)

  const { data: dropdownUnits, refetch: refetchDropdown } = useResitDropdownUnits(selectedStudent?.studentGuid || null)
  const { data: checkboxState } = useResitCheckboxState(selectedStudent?.studentGuid || null, courseUnitGuid || null)
  const { data: appliedUnits, refetch: refetchApplied } = useResitAppliedUnits(selectedStudent?.studentGuid || null)
  const { data: editData, isError: editFailed, error: editError } = useResitApplicationForEdit(editingGuid)
  // Set when submit says the resit period is closed — the form stays disabled.
  const [periodClosed, setPeriodClosed] = useState<string | null>(null)

  // 404 on edit: deleted meanwhile — leave edit mode and reload the grid.
  useEffect(() => {
    if (!editFailed) return
    setToast({ msg: (editError as { message?: string } | null)?.message || 'Resit application not found.', type: 'error' })
    handleCancelEdit()
    refetchApplied()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFailed])

  const submitMutation = useSubmitResitApplication()
  const deleteMutation = useDeleteResitApplication()

  // Reset form when dropdown changes
  useEffect(() => {
    if (!editingGuid) {
      setCw(false)
      setUe(false)
      setUeType(0)
    }
  }, [courseUnitGuid, editingGuid])

  // Populate form when edit data loads
  useEffect(() => {
    if (editData) {
      setCourseUnitGuid(editData.courseUnitGuid)
      setCw(editData.cw)
      setUe(editData.ue)
      setUeType(editData.ueType as 0 | 1)
    }
  }, [editData])

  // UI Rules based on checkboxState
  const iaPassed = checkboxState?.iaPassed ?? false
  const uePassed = checkboxState?.uePassed ?? false
  const hasResult = checkboxState?.hasResult ?? false
  const isTheoryPracticalUnit = checkboxState?.isTheoryPracticalUnit ?? false

  const handleTheoryPracticalChange = (type: 0 | 1) => {
    setUeType(type)
    if (type === 1) {
      setCw(false) // Practical is UE only
    }
  }

  const handleApply = () => {
    if (!selectedStudent || !courseUnitGuid) return
    if (!cw && !ue) {
      setToast({ msg: 'Select at least one of IA or UE.', type: 'error' })
      return
    }
    
    submitMutation.mutate({
      studentGuid: selectedStudent.studentGuid,
      data: { courseUnitGuid, cw, ue, ueType }
    }, {
      onSuccess: () => {
        setToast({ msg: editingGuid ? 'Application updated.' : 'Resit applied successfully.', type: 'success' })
        handleCancelEdit()
      },
      onError: (err) => {
        // AuthError: message = errors[0]; validation_error carries them all.
        const e = err as { code?: string; message?: string; errors?: string[] } | null
        const msg = e?.code === 'validation_error' && e.errors?.length ? e.errors.join(' ') : e?.message || 'Failed to submit'
        setToast({ msg, type: 'error' })
        // bad_request cases (resit-apply-page.md, step 5.5).
        if (/no current intake|no active resit/i.test(msg)) setPeriodClosed(msg)
        else if (/not eligible/i.test(msg)) refetchDropdown()
        else if (/could not be retrieved/i.test(msg)) { refetchApplied(); handleCancelEdit() }
      }
    })
  }

  const handleDelete = (app: ResitApplicationListItemDto) => {
    if (app.feePaid) return
    setDeleteTarget(app)
  }

  const confirmDelete = () => {
    if (!deleteTarget || !selectedStudent) return
    // Grid and dropdown are reloaded by the mutation's invalidation.
    deleteMutation.mutate({ resitApplicationGuid: deleteTarget.resitApplicationGuid, studentGuid: selectedStudent.studentGuid }, {
      onSuccess: (res) => {
        if (res.deleted) {
          setToast({ msg: res.message, type: 'success' })
          if (editingGuid === deleteTarget.resitApplicationGuid) handleCancelEdit()
        } else {
          setToast({ msg: res.message, type: 'error' })
        }
        setDeleteTarget(null)
      },
      onError: (err) => {
        setToast({ msg: (err as { message?: string } | null)?.message || 'Failed to delete', type: 'error' })
        setDeleteTarget(null)
      }
    })
  }

  const handleCancelEdit = () => {
    setEditingGuid(null)
    setCourseUnitGuid('')
    setCw(false)
    setUe(false)
    setUeType(0)
  }

  const handleCloseModal = () => {
    setSelectedStudent(null)
    setPeriodClosed(null)
    handleCancelEdit()
    refetchList()
  }

  // Both parts already passed (possible in edit mode after results change).
  const nothingLeft = !!courseUnitGuid && iaPassed && uePassed

  return (
    <div className="page active">
      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title">Resit Apply</h1>
          <p className="pg-sub">Apply for resit on behalf of students</p>
        </div>
      </div>

      <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-users"></i></span> Eligible Students</div>
          </div>
          <div className="flex flex-wrap gap-2 mb-[14px]">
            <TableSearch
                className="w-full sm:w-96"
                placeholder="Student Number / Registration Number / Student Name"
                value={searchInput}
                onChange={setSearchInput}
                onEnter={doSearch}
                results={[]}
                minChars={999}
              />
              <button className="btn btn-neu" onClick={doSearch}>Search</button>
              <button className="btn btn-neu" onClick={doClear} disabled={!searchInput && !search}>Clear</button>
            </div>
          
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Student No</th>
                  <th>Student Name</th>
                  <th>Program</th>
                  <th>Batch</th>
                  <th>Semester</th>
                </tr>
              </thead>
              <tbody>
                {listLoading 
                  ? <TableLoadingState colSpan={6} />
                  : (!listData?.items || listData.items.length === 0) 
                    ? <EmptyState colSpan={6} title="No students have pending resit units." hasFilters={!!search} onClearFilters={doClear} />
                    : listData.items.map(s => (
                      <tr key={s.studentGuid}>
                        <td>
                          <ActionMenu>
                            <button 
                              className="btn btn-neu btn-sm"
                              onClick={() => setSelectedStudent(s)}
                            >
                              <i className="lni lni-eye"></i> View
                            </button>
                            <button 
                              className="btn btn-neu btn-sm"
                              onClick={() => setSelectedStudent(s)}
                            >
                              <i className="lni lni-circle-plus"></i> Apply Resit
                            </button>
                          </ActionMenu>
                        </td>
                        <td className="text-blue font-bold font-mono">{s.studentRegNo || '—'}</td>
                        <td><strong>{s.studentName || '—'}</strong></td>
                        <td>{s.programName || '—'}</td>
                        <td>{s.batchCode || '—'}</td>
                        <td>{s.semesterName || '—'}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </ScrollTable>
          {listData && listData.totalCount > 10 && (
            <Pagination 
              page={page} 
              totalPages={Math.ceil(listData.totalCount / 10)} 
              totalCount={listData.totalCount} 
              itemLabel="students"
              onPageChange={setPage} 
            />
          )}
        </div>

      {selectedStudent && (
        <div className="modal-overlay open">
          {/* .modal-flex fixes height at 85vh; size to content instead, capped there. */}
          <div className="modal modal-flex" style={{ maxWidth: 900, borderRadius: 12, height: 'auto', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
              <div className="modal-title text-white font-medium text-base" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="lni lni-reload" style={{ fontSize: 18 }}></i> Resit Application
              </div>
              <button className="modal-close text-white hover:text-white/80 transition-colors" onClick={handleCloseModal} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <i className="lni lni-close" style={{ fontSize: 18 }}></i>
              </button>
            </div>

            {/* Content */}
            <div className="modal-scroll p-6 bg-white flex-1 overflow-y-auto">
              {/* Student (from the list row — resit-apply-page.md, View 2 header) */}
              {/* Header row (avatar + name), then the details at full width below
                  — not indented under the avatar, which squeezed them on mobile. */}
              <div className="p-4 mb-6 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0"
                    style={{ width: 40, height: 40, background: 'var(--b500)', fontSize: 15 }}
                  >
                    {(selectedStudent.studentName || '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-900 truncate">{selectedStudent.studentName || '—'}</div>
                    <div className="font-mono text-sm text-slate-500">{selectedStudent.studentRegNo || '—'}</div>
                  </div>
                </div>
                {/* Mobile: 2 columns, Programme spans both. 768px+: 2:1:1 in one row. */}
                <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr] gap-x-6 gap-y-3 mt-4 pt-4 border-t border-slate-200">
                  <div className="min-w-0 col-span-2 md:col-span-1">
                    <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-0.5">Programme</div>
                    <div className="text-sm text-g900">{selectedStudent.programName || '—'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-0.5">Batch</div>
                    <div className="text-sm text-g900 font-mono break-all">{selectedStudent.batchCode || '—'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-0.5">Semester</div>
                    <div className="text-sm text-g900">{selectedStudent.semesterName || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Apply / Edit form */}
              <div className="border border-slate-200 rounded-xl p-5 mb-6" style={{ background: editingGuid ? 'var(--b50)' : undefined }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="font-semibold text-slate-800">{editingGuid ? 'Edit Resit Application' : 'Apply for Resit'}</div>
                  {editingGuid && <span className="badge badge-blue">Editing</span>}
                </div>

                {periodClosed ? (
                  <div className="warn-box text-sm"><i className="lni lni-lock mt-0.5"></i><span>{periodClosed} Applications can't be made or changed now.</span></div>
                ) : (!dropdownUnits || dropdownUnits.length === 0) && !editingGuid ? (
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <i className="lni lni-checkmark-circle" style={{ color: 'var(--green)' }}></i> No units left to apply for.
                  </div>
                ) : (
                  <>
                    {/* One row, bottom-aligned: unit · part · resit for · buttons. The
                        option groups get the button's height so their centres line up. */}
                    <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
                      <div className="flex-1 min-w-0">
                        <label className="lbl">Course Unit <span className="text-red-500">*</span></label>
                        <SearchSelect
                          placeholder="Select Course Unit..."
                          value={courseUnitGuid}
                          onChange={setCourseUnitGuid}
                          disabled={!!editingGuid}
                          className="w-full mt-1"
                          options={
                            editingGuid && editData
                              ? [{ value: editData.courseUnitGuid, label: editData.displayName }]
                              : (dropdownUnits?.map(u => ({ value: u.courseUnitGuid, label: u.displayName })) || [])
                          }
                        />
                      </div>

                      {isTheoryPracticalUnit && (
                        <div className="flex-shrink-0">
                          <label className="lbl">Part <span className="text-red-500">*</span></label>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1" style={{ minHeight: 36 }}>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="radio" name="resitApplyPart" checked={ueType === 0} onChange={() => handleTheoryPracticalChange(0)} />
                              Theory
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="radio" name="resitApplyPart" checked={ueType === 1} onChange={() => handleTheoryPracticalChange(1)} />
                              Practical
                            </label>
                          </div>
                        </div>
                      )}

                      <div className="flex-shrink-0">
                        <label className="lbl">Resit For <span className="text-red-500">*</span></label>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1" style={{ minHeight: 36 }}>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cw}
                              onChange={e => setCw(e.target.checked)}
                              disabled={!courseUnitGuid || iaPassed || (!hasResult && !editingGuid && !courseUnitGuid) || (ueType === 1)}
                            />
                            IA (Coursework)
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ue}
                              onChange={e => setUe(e.target.checked)}
                              disabled={!courseUnitGuid || uePassed || (!hasResult && !editingGuid && !courseUnitGuid)}
                            />
                            UE (Exam)
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0 w-full md:w-auto">
                        {editingGuid && (
                          <button className="btn btn-neu flex-1 md:flex-none justify-center" onClick={handleCancelEdit} disabled={submitMutation.isPending}>Cancel</button>
                        )}
                        <button
                          className="btn btn-primary flex-1 md:flex-none justify-center"
                          onClick={handleApply}
                          disabled={!courseUnitGuid || (!cw && !ue) || nothingLeft || submitMutation.isPending}
                        >
                          {submitMutation.isPending ? 'Saving...' : editingGuid ? 'Update' : 'Apply'}
                        </button>
                      </div>
                    </div>

                    {/* Why something is locked — one muted line under the row. */}
                    {(() => {
                      const hints = [
                        editingGuid && "The unit can't be changed while editing.",
                        nothingLeft && 'Nothing left to resit for this unit.',
                        courseUnitGuid && iaPassed && !uePassed && 'IA is passed — only UE can be resat.',
                        courseUnitGuid && uePassed && !iaPassed && 'UE is passed — only IA can be resat.',
                        isTheoryPracticalUnit && ueType === 1 && 'A practical resit is UE only.',
                      ].filter(Boolean)
                      return hints.length > 0 && (
                        <div className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                          <i className="lni lni-information"></i> {hints.join(' ')}
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* Applied units */}
              <div className="flex items-center gap-2 mb-3">
                <div className="font-semibold text-slate-800">Applied Units</div>
                <span className="badge badge-grey">{appliedUnits?.length ?? 0}</span>
              </div>
              <ScrollTable>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>Actions</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th className="text-center">IA</th>
                      <th className="text-center">UE</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!appliedUnits || appliedUnits.length === 0) ? (
                      <EmptyState colSpan={8} hasFilters={false} title="No applications yet" subtitle="Units applied for this student will appear here." />
                    ) : (
                      appliedUnits.map(app => (
                        <tr key={app.resitApplicationGuid} style={editingGuid === app.resitApplicationGuid ? { background: 'var(--b50)' } : undefined}>
                          <td>
                            <ActionMenu>
                              <button
                                className="btn btn-neu btn-sm"
                                disabled={app.feePaid}
                                title={app.feePaid ? 'Paid applications cannot be edited.' : ''}
                                onClick={() => setEditingGuid(app.resitApplicationGuid)}
                              >
                                <i className="lni lni-pencil-alt"></i> Edit
                              </button>
                              <button
                                className="btn btn-neu btn-sm"
                                style={{ color: 'var(--red)' }}
                                disabled={app.feePaid || deleteMutation.isPending}
                                title={app.feePaid ? 'Paid applications cannot be deleted.' : ''}
                                onClick={() => handleDelete(app)}
                              >
                                <i className="lni lni-trash-can"></i> Delete
                              </button>
                            </ActionMenu>
                          </td>
                          <td className="text-blue font-bold font-mono">{app.unitCode}</td>
                          <td><strong>{app.unitName}</strong></td>
                          <td>{app.unitTypeName}</td>
                          <td className="text-center">{app.cw ? <span className="badge badge-blue">Yes</span> : <span className="text-slate-400">No</span>}</td>
                          <td className="text-center">{app.ue ? <span className="badge badge-blue">Yes</span> : <span className="text-slate-400">No</span>}</td>
                          <td className="text-center">
                            {app.status === 2 ? <span className="badge badge-amber">Pending</span> : <span className="badge badge-grey">{app.status}</span>}
                          </td>
                          <td className="text-center">
                            {app.feePaid ? <span className="badge badge-green">Paid</span> : <span className="badge badge-red">Not Paid</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollTable>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete Application?</div>
            <div className="perm-delete-sub">
              Delete the resit application for {deleteTarget.unitName}?
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteMutation.isPending} onClick={confirmDelete}>
                <i className="lni lni-trash-can"></i> {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
