'use client'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Toast } from '@/components/Toast'
import { useState, useEffect } from 'react'
import { useAssessmentTypeDropdown } from '@/hooks/assessment/useAssessmentTypes'

export default function AssessmentSchedulePage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null)

  const { data: dropdownData = [] } = useAssessmentTypeDropdown()
  const assessmentOptions = dropdownData.map(d => ({ label: d.assessmentName, value: d.assessmentTypeGuid }))

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
          <div className="pg-title">Assessment Schedule</div>
          <div className="pg-sub">Unified scheduler — define CW and CBT windows by scope</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary btn-sm" onClick={() => showToast('New schedule window opened')}><i className="lni lni-plus"></i> New Schedule</button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-hdr">
          <div className="card-title">Filter & Scope</div>
        </div>
        <div className="p-4 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="form-label text-[var(--fs-xs)] font-bold text-g700 block mb-1">Assessment Type</label>
            <SearchSelect
              placeholder="— All Types —"
              options={assessmentOptions}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="form-label text-[var(--fs-xs)] font-bold text-g700 block mb-1">Scope</label>
            <SearchSelect
              options={[
                'All (Campus-wide)',
                'By Programme / Semester',
                'Individual Subject'
              ]}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="form-label text-[var(--fs-xs)] font-bold text-g700 block mb-1">Programme</label>
            <SearchSelect
              options={[
                '— All Programmes —',
                'BSc Computer Science',
                'BBA',
                'BMIT'
              ]}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="form-label text-[var(--fs-xs)] font-bold text-g700 block mb-1">Term</label>
            <SearchSelect
              options={[
                'Term 1',
                'Term 2'
              ]}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Scheduled Assessments</div>
        </div>

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
                <FilterTh
                  label="Type"
                  opts={['CW', 'CBT']}
                  isOpen={openFilter === 'type'}
                  activeFilter={filters['type'] || []}
                  onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'type' ? null : 'type') }}
                  onSelect={(vals) => handleFilterSelect('type', vals)}
                  onClear={() => handleFilterSelect('type', [])}
                  onClose={() => setOpenFilter(null)}
                />
                <th>Programme</th>
                <th>Start</th>
                <th>End</th>
                <th>Publish</th>
                <th>Rule</th>
                <th>Status</th>
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
                        <button className="btn btn-neu btn-sm"><i className="lni lni-pencil"></i> Edit</button>
                        <button className="btn btn-neu btn-sm text-red-600"><i className="lni lni-trash"></i> Delete</button>
                      </ActionMenu>
                    </td>
                    <td>
                      <span className="font-bold text-[var(--blue)] font-mono">CSE 1212</span><br />
                      <span className="text-[var(--fs-xs)] text-g500">Data Structures</span>
                    </td>
                    <td><span className="badge badge-purple">CW</span></td>
                    <td>BCS Sem 1</td>
                    <td className="text-g500">01 Nov 9:00 AM</td>
                    <td className="text-g500">15 Nov 11:59 PM</td>
                    <td><span className="badge badge-green">Published</span></td>
                    <td><span className="font-mono text-g700 font-bold">R3</span></td>
                    <td><span className="badge badge-green">Active</span></td>
                  </tr>
                  <tr>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm"><i className="lni lni-pencil"></i> Edit</button>
                        <button className="btn btn-neu btn-sm text-red-600"><i className="lni lni-trash"></i> Delete</button>
                      </ActionMenu>
                    </td>
                    <td>
                      <span className="font-bold text-[var(--blue)] font-mono">CSE 1301</span><br />
                      <span className="text-[var(--fs-xs)] text-g500">Algorithms</span>
                    </td>
                    <td><span className="badge badge-blue">CBT</span></td>
                    <td>BCS Sem 1</td>
                    <td className="text-g500">10 Nov 9:00 AM</td>
                    <td className="text-g500">10 Nov 11:00 AM</td>
                    <td><span className="badge badge-green">Published</span></td>
                    <td><span className="font-mono text-g700 font-bold">R1</span></td>
                    <td><span className="badge badge-green">Active</span></td>
                  </tr>
                  <tr>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm"><i className="lni lni-pencil"></i> Edit</button>
                        <button className="btn btn-neu btn-sm text-red-600"><i className="lni lni-trash"></i> Delete</button>
                      </ActionMenu>
                    </td>
                    <td>
                      <span className="font-bold text-[var(--blue)] font-mono">MGT 2101</span><br />
                      <span className="text-[var(--fs-xs)] text-g500">Business Mgmt</span>
                    </td>
                    <td><span className="badge badge-purple">CW</span></td>
                    <td>BBA Sem 3</td>
                    <td className="text-g500">05 Nov 9:00 AM</td>
                    <td className="text-g500">20 Nov 11:59 PM</td>
                    <td><span className="badge badge-amber">Hidden</span></td>
                    <td><span className="font-mono text-g700 font-bold">R3</span></td>
                    <td><span className="badge badge-amber">Pending</span></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </ScrollTable>
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={5} totalCount={42} onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
