'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { Toast } from '@/components/Toast'
import { ActionMenu } from '@/components/ActionMenu'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import {
  useSearchModerationStudents,
  useModerationStudentDetail,
  useStudentModerationRows,
  useUpdateModeration
} from '@/hooks/assessment/useModeration'

export default function ModerationPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [studentGuid, setStudentGuid] = useState<string | null>(null)
  
  // Queries
  const { data: searchResults, isLoading: searching } = useSearchModerationStudents(searchTerm)
  const { data: studentDetail, isLoading: loadingDetail } = useModerationStudentDetail(studentGuid)
  const { data: rows, isLoading: loadingRows } = useStudentModerationRows(studentGuid)
  
  // Options for SearchSelect
  const searchOptions = (searchResults || []).map(s => ({
    value: s.studentGuid,
    label: `${s.studentNumber} - ${s.studentName} (${s.programName})`
  }))

  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Result & Moderation</div>
          <div className="pg-sub">Search students and apply IA/UE grace marks to individual units</div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="p-5 flex flex-col md:flex-row gap-5 items-start">
          <div className="w-full md:w-[400px]">
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Search Student</label>
            <SearchSelect
              options={searchOptions}
              value={studentGuid || undefined}
              onChange={(val) => setStudentGuid(val)}
              onSearch={setSearchTerm}
              isLoading={searching}
              placeholder="Type name or student number..."
            />
          </div>
          
          {studentDetail && (
            <div className="flex-1 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200 p-4 lg:p-5 flex items-center gap-4 lg:gap-6 transition-all duration-300 hover:shadow-[0_4px_15px_-3px_rgba(6,81,237,0.15)]">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center text-blue-600 text-lg lg:text-xl font-bold flex-shrink-0 shadow-inner">
                {studentDetail.studentName.charAt(0)}
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div>
                  <div className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Student</div>
                  <div className="text-[13px] lg:text-[14px] font-extrabold text-slate-800 truncate" title={studentDetail.studentName}>{studentDetail.studentName}</div>
                  <div className="text-[11px] lg:text-[12px] text-slate-500 font-mono mt-0.5 bg-slate-100 inline-block px-1.5 py-0.5 rounded uppercase tracking-wider">{studentDetail.studentNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Program</div>
                  <div className="text-[12px] lg:text-[13px] font-semibold text-slate-700 leading-tight line-clamp-2" title={studentDetail.programName}>{studentDetail.programName}</div>
                </div>
                <div>
                  <div className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Batch</div>
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] lg:text-[12px] font-bold border border-slate-200">
                    {studentDetail.batchName}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Semester</div>
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] lg:text-[12px] font-bold border border-indigo-100">
                    {studentDetail.currentSemester}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title">
            <span className="ctitle-icon"><i className="lni lni-list"></i></span> Unit Results
          </div>
        </div>
        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>SEMESTER</th>
                <th>UNIT CODE</th>
                <th>UNIT NAME</th>
                <th>IA</th>
                <th>UE</th>
                <th>TOTAL</th>
                <th>STATUS</th>
                <th>IA MOD</th>
                <th>UE MOD</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <TableLoadingState colSpan={10} title="Loading unit results..." subtitle="Fetching results for the selected student." />
              ) : !studentGuid ? (
                <EmptyState 
                  colSpan={10} 
                  title="No Student Selected" 
                  subtitle="Search and select a student from the dropdown above to view and moderate their unit results." 
                />
              ) : rows && rows.length > 0 ? (
                rows.map(row => (
                  <ModerationRowItem 
                    key={row.examResultGuid} 
                    row={row} 
                    studentGuid={studentGuid} 
                    onSuccess={() => showToast('Moderation saved successfully')}
                    onError={(err) => showToast(err || 'Failed to save moderation', 'error')}
                  />
                ))
              ) : (
                <EmptyState 
                  colSpan={10} 
                  title="No results found" 
                  subtitle="There are no recorded results for this student." 
                />
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>
      
      {toast && <Toast toast={toast} />}
    </div>
  )
}

function ModerationRowItem({ row, studentGuid, onSuccess, onError }: { 
  row: any, 
  studentGuid: string, 
  onSuccess: () => void, 
  onError: (msg: string) => void 
}) {
  const [isViewModalOpen, setViewModalOpen] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  
  // iaTotal / ueTotal already include the moderation (the update re-derives
  // the base as total - currentMod — result-moderation-page.md), so it is
  // not added again here.
  const computedTotal = (row.iaTotal || 0) + (row.ueTotal || 0)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pass': return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[11px] font-bold">Pass</span>
      case 'Fail': return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[11px] font-bold">Fail</span>
      case 'RL': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[11px] font-bold">RL</span>
      default: return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-bold">{status}</span>
    }
  }

  return (
    <>
      <tr>
        <td>
          <ActionMenu>
            <button className="btn btn-neu btn-sm" onClick={() => setViewModalOpen(true)}>
              <i className="lni lni-eye"></i> View Details
            </button>
            <button className="btn btn-neu btn-sm" onClick={() => setEditModalOpen(true)}>
              <i className="lni lni-pencil"></i> Edit Moderation
            </button>
          </ActionMenu>
        </td>
        <td className="text-[12px] text-slate-500 whitespace-nowrap">{row.semesterName}</td>
        <td className="font-mono text-slate-700 text-[12px]">{row.unitCode}</td>
        <td className="font-medium text-slate-900">{row.unitName}</td>
        <td>
          <div className="flex flex-col">
            <span className="font-medium text-slate-800">{row.iaTotal} <span className="text-slate-400 font-normal">/ {row.iaMax}</span></span>
          </div>
        </td>
        <td>
          <div className="flex flex-col">
            <span className="font-medium text-slate-800">{row.ueTotal} <span className="text-slate-400 font-normal">/ {row.ueMax}</span></span>
          </div>
        </td>
        <td className="font-bold text-slate-900">{computedTotal.toFixed(1)}</td>
        <td>{getStatusBadge(row.passStatus)}</td>
        <td>
          <div className="flex flex-col">
            {row.iaMod > 0 ? <span className="text-[12px] text-purple-600 font-bold">+{row.iaMod}</span> : <span className="text-slate-400">-</span>}
          </div>
        </td>
        <td>
          <div className="flex flex-col">
            {row.ueMod > 0 ? <span className="text-[12px] text-purple-600 font-bold">+{row.ueMod}</span> : <span className="text-slate-400">-</span>}
          </div>
        </td>
      </tr>

      {isViewModalOpen && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-hdr modal-hdr-blue">
              <div className="modal-title">View Result Details</div>
              <button className="modal-close" onClick={() => setViewModalOpen(false)}>
                <i className="lni lni-close"></i>
              </button>
            </div>
            <div className="modal-body p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Unit Code</div>
                  <div className="font-mono font-medium">{row.unitCode}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Unit Name</div>
                  <div className="font-medium">{row.unitName}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">IA Total</div>
                  <div className="font-bold text-lg">{row.iaTotal} <span className="text-sm text-slate-400 font-normal">/ {row.iaMax}</span></div>
                  {row.iaMod > 0 && <div className="text-[11px] text-purple-600">incl. +{row.iaMod} grace</div>}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">UE Total</div>
                  <div className="font-bold text-lg">{row.ueTotal} <span className="text-sm text-slate-400 font-normal">/ {row.ueMax}</span></div>
                  {row.ueMod > 0 && <div className="text-[11px] text-purple-600">incl. +{row.ueMod} grace</div>}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Status</div>
                  <div className="mt-1">{getStatusBadge(row.passStatus)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <EditModerationModal 
          row={row} 
          studentGuid={studentGuid} 
          onClose={() => setEditModalOpen(false)} 
          onSuccess={onSuccess} 
          onError={onError} 
        />
      )}
    </>
  )
}

function EditModerationModal({ row, studentGuid, onClose, onSuccess, onError }: any) {
  const [iaMod, setIaMod] = useState<string>(row.iaMod?.toString() || '0')
  const [ueMod, setUeMod] = useState<string>(row.ueMod?.toString() || '0')
  const updateMut = useUpdateModeration()
  const isPending = updateMut.isPending
  const [saveError, setSaveError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const handleSave = () => {
    setSaveError(null)
    const payload = {
      iaMod: parseFloat(iaMod) || 0,
      ueMod: parseFloat(ueMod) || 0
    }
    updateMut.mutate({ studentGuid, examResultGuid: row.examResultGuid, data: payload }, {
      onSuccess: () => {
        onSuccess()
        onClose()
      },
      onError: (err: any) => {
        if (err?.code === 'not_found') {
          // The row no longer exists: close and re-fetch the grid.
          onError(err?.message || 'This result no longer exists.')
          queryClient.invalidateQueries({ queryKey: ['moderation-student-rows', studentGuid] })
          onClose()
          return
        }
        // 400 "Unable to apply this moderation." — the row is unchanged;
        // keep the modal open so the value can be corrected.
        setSaveError(err?.message || 'Unable to apply this moderation.')
      }
    })
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 450 }}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">Edit Grace Marks</div>
          <button className="modal-close" onClick={onClose} disabled={isPending}><i className="lni lni-close"></i></button>
        </div>
        <div className="modal-body p-5">
           <div className="mb-5">
             <div className="text-[12px] text-slate-500">Unit</div>
             <div className="font-semibold text-[14px]">{row.unitCode} - {row.unitName}</div>
           </div>
           
           <div className="grid grid-cols-2 gap-5">
             <div>
               <label className="block text-[12px] font-semibold text-slate-700 mb-1">IA Moderation</label>
               <input type="number" className="ctrl w-full" value={iaMod} onChange={e => setIaMod(e.target.value)} min="0" step="0.5" disabled={isPending} />
             </div>
             <div>
               <label className="block text-[12px] font-semibold text-slate-700 mb-1">UE Moderation</label>
               <input type="number" className="ctrl w-full" value={ueMod} onChange={e => setUeMod(e.target.value)} min="0" step="0.5" disabled={isPending} />
             </div>
           </div>
           <div className="text-xs text-g500 mt-3">Moderation can't take a component above 50% of its max. Set 0 to remove it.</div>
           {saveError && <div className="danger-box mt-3 text-sm"><i className="lni lni-warning"></i> {saveError}</div>}
        </div>
        <div className="modal-ftr">
           <button className="btn btn-neu" onClick={onClose} disabled={isPending}>Cancel</button>
           <button className="btn btn-primary" onClick={handleSave} disabled={isPending}>
             {isPending ? 'Saving...' : 'Save Changes'}
           </button>
        </div>
      </div>
    </div>
  )
}
