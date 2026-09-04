'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'

export default function UeSchedulePage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null)

  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleFilterSelect = (col: string, vals: string[]) => {
    setFilters(prev => ({ ...prev, [col]: vals }))
    setOpenFilter(null)
  }

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">University Examination Schedule</div>
          <div className="pg-sub">Configure physical exam timetable · Displays on student portal (no Launch button)</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => showToast('UE Slot creation opened')}>
            + Add UE Slot
          </button>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-md p-3 flex gap-3 text-[12.5px] text-[#3b82f6] items-start">
          <div className="mt-0.5 text-[#2563eb]"><i className="lni lni-information"></i></div>
          <div>The physical timetable is created externally by the Registrar to manage seating capacity. Enter each subject's date/time slot here to display it on student portals. <strong className="font-semibold text-[#1e40af]">No Launch button is enabled</strong> — UE is a physical examination.</div>
        </div>
      </div>

      <div className="card">
        
        <div className="card-hdr">
          <div className="card-title">
            <span className="ctitle-icon"><i className="lni lni-list"></i></span> Records
          </div>
          <TableSearch
            className="w-64"
            placeholder="Search records..."
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
                <th>Subject</th>
                <th>Programme</th>
                <th>Level</th>
                <th>Date</th>
                <th>Time</th>
                <th>Venue</th>
                <th>Students</th>
                <FilterTh 
                  label="QP Status" 
                  opts={['QP Pending', 'QP Verified', 'Under Vetting']} 
                  isOpen={openFilter === 'status'} 
                  activeFilter={filters['status'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status' ? null : 'status') }} 
                  onSelect={(vals) => handleFilterSelect('status', vals)} 
                  onClear={() => handleFilterSelect('status', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingState colSpan={9} />
              ) : (
                <>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm" onClick={() => showToast('Slot edit dialog opened')}><i className="lni lni-pencil"></i> Edit Slot</button>
                  </ActionMenu>
                </td>
                <td>
                  <span className="font-bold text-[var(--blue)] font-mono">CSE 1212</span><br/>
                  <span className="text-slate-500 text-[12px]">Data Structures</span>
                </td>
                <td className="text-slate-700">BCS Sem 1</td>
                <td><span className="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">UG</span></td>
                <td className="text-slate-700 font-mono text-[12px]">15 Jan 2025</td>
                <td className="text-slate-700 font-mono text-[12px]">9:00 AM</td>
                <td className="text-slate-800">Hall A</td>
                <td className="text-slate-700 font-semibold">62</td>
                <td><span className="badge badge-red">QP Pending</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-pencil"></i> Edit Slot</button>
                  </ActionMenu>
                </td>
                <td>
                  <span className="font-bold text-[var(--blue)] font-mono">CSE 1301</span><br/>
                  <span className="text-slate-500 text-[12px]">Algorithms</span>
                </td>
                <td className="text-slate-700">BCS Sem 1</td>
                <td><span className="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">UG</span></td>
                <td className="text-slate-700 font-mono text-[12px]">17 Jan 2025</td>
                <td className="text-slate-700 font-mono text-[12px]">2:00 PM</td>
                <td className="text-slate-800">Hall B</td>
                <td className="text-slate-700 font-semibold">62</td>
                <td><span className="badge badge-green">QP Verified</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-pencil"></i> Edit Slot</button>
                  </ActionMenu>
                </td>
                <td>
                  <span className="font-bold text-[var(--blue)] font-mono">MGT 2101</span><br/>
                  <span className="text-slate-500 text-[12px]">Business Mgmt</span>
                </td>
                <td className="text-slate-700">BBA Sem 3</td>
                <td><span className="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">UG</span></td>
                <td className="text-slate-700 font-mono text-[12px]">20 Jan 2025</td>
                <td className="text-slate-700 font-mono text-[12px]">9:00 AM</td>
                <td className="text-slate-800">Hall C</td>
                <td className="text-slate-700 font-semibold">55</td>
                <td><span className="badge badge-amber">Under Vetting</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-pencil"></i> Edit Slot</button>
                  </ActionMenu>
                </td>
                <td>
                  <span className="font-bold text-[var(--blue)] font-mono">CS 5101</span><br/>
                  <span className="text-slate-500 text-[12px]">Advanced Algorithms</span>
                </td>
                <td className="text-slate-700">MSc CS Sem 1</td>
                <td><span className="bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">PG</span></td>
                <td className="text-slate-700 font-mono text-[12px]">16 Jan 2025</td>
                <td className="text-slate-700 font-mono text-[12px]">9:00 AM</td>
                <td className="text-slate-800">Room 301</td>
                <td className="text-slate-700 font-semibold">22</td>
                <td><span className="badge badge-green">QP Verified</span></td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={4} totalCount={32} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
