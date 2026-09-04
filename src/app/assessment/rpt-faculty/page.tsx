'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'

export default function FacultyAssessmentSummary() {
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
          <div className="pg-title">Faculty Assessment Summary</div>
          <div className="pg-sub">Pending actions and compliance status per faculty member</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary" onClick={() => showToast('Exporting summary report...')}>
            <i className="lni lni-download"></i> Export
          </button>
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
                <th>FACULTY</th>
                <th>SUBJECTS</th>
                <th>QP UPLOADED</th>
                <th>CW EVALUATED</th>
                <th>CBT SET</th>
                <th>REEVALS PENDING</th>
                <FilterTh 
                  label="COMPLIANCE" 
                  opts={['Action Needed', 'Reevals Pending', 'Evaluating', 'On Track']} 
                  isOpen={openFilter === 'compliance'} 
                  activeFilter={filters['compliance'] || []} 
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'compliance' ? null : 'compliance') }} 
                  onSelect={(vals) => handleFilterSelect('compliance', vals)} 
                  onClear={() => handleFilterSelect('compliance', [])} 
                  onClose={() => setOpenFilter(null)} 
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingState colSpan={8} />
              ) : (
                <>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                    <button className="btn btn-neu btn-sm" onClick={() => showToast('Reminder sent to faculty')}><i className="lni lni-bullhorn"></i> Send Reminder</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-900 font-bold">Tom Kizito</td>
                <td className="text-slate-700">2</td>
                <td><span className="badge badge-red">0 / 2</span></td>
                <td className="text-slate-400">—</td>
                <td><span className="badge badge-red">0 / 2</span></td>
                <td className="text-slate-700">0</td>
                <td><span className="badge badge-red">Action Needed</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-900 font-bold">Sarah Mugisha</td>
                <td className="text-slate-700">2</td>
                <td><span className="badge badge-green">2 / 2</span></td>
                <td><span className="badge badge-green">58 / 58</span></td>
                <td><span className="badge badge-green">2 / 2</span></td>
                <td className="text-slate-700">2</td>
                <td><span className="badge badge-amber">Reevals Pending</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-900 font-bold">James Ochieng</td>
                <td className="text-slate-700">1</td>
                <td><span className="badge badge-green">1 / 1</span></td>
                <td><span className="badge badge-amber">30 / 51</span></td>
                <td><span className="badge badge-green">1 / 1</span></td>
                <td className="text-slate-700">2</td>
                <td><span className="badge badge-amber">Evaluating</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-900 font-bold">Fatuma Wanjiku</td>
                <td className="text-slate-700">1</td>
                <td><span className="badge badge-green">1 / 1</span></td>
                <td><span className="badge badge-green">35 / 35</span></td>
                <td><span className="badge badge-green">1 / 1</span></td>
                <td className="text-slate-700">1</td>
                <td><span className="badge badge-green">On Track</span></td>
              </tr>
              <tr>
                <td>
                  <ActionMenu>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View Details</button>
                    <button className="btn btn-neu btn-sm"><i className="lni lni-bullhorn"></i> Send Reminder</button>
                  </ActionMenu>
                </td>
                <td className="text-slate-900 font-bold">Joseph Ayuma</td>
                <td className="text-slate-700">1</td>
                <td><span className="badge badge-red">0 / 1</span></td>
                <td className="text-slate-400">—</td>
                <td><span className="badge badge-amber">Partial</span></td>
                <td className="text-slate-700">0</td>
                <td><span className="badge badge-red">Action Needed</span></td>
              </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={1} totalCount={5} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
