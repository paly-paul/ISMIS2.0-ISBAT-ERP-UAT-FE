'use client'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'
import { useState } from 'react'

export default function QuestionBankUploadPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
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
  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Question Bank Upload</div>
          <div className="pg-sub">Upload descriptive questions (DQ) via Excel template · Min. 4 questions required per subject</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary" onClick={() => showToast('Template downloaded')}>
            <i className="lni lni-download"></i> Download Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Side: Upload Form */}
        <div className="card">
          <div className="card-title mb-4">Upload Questions</div>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Subject</label>
              <SearchSelect
                options={[
                  'CSE 1212 – Data Structures',
                  'CSE 1301 – Algorithms'
                ]}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Assessment Type</label>
              <SearchSelect
                options={[
                  'Coursework (DQ)',
                  'Class Test (MCQ/SA)',
                  'University Examination'
                ]}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Term</label>
              <SearchSelect
                options={[
                  'Term 1',
                  'Term 2'
                ]}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Question Type</label>
              <SearchSelect
                options={[
                  'DQ – Descriptive Question',
                  'MCQ – Multiple Choice',
                  'SA – Short Answer'
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-7 text-center mb-4 cursor-pointer transition-colors hover:border-purple-400 group bg-slate-50">
            <div className="text-[28px] mb-2 text-slate-800 group-hover:text-purple-600 transition-colors"><i className="lni lni-paperclip"></i></div>
            <div className="text-[13px] font-semibold text-slate-900">Drop Excel file here or click to browse</div>
            <div className="text-[11px] text-slate-500 mt-1">.xlsx format · Uses common template for all exam types</div>
          </div>

          <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-md p-3 flex gap-3 text-[12.5px] text-[#1e40af] mb-4 items-start">
            <div className="mt-0.5 text-[#2563eb]"><i className="lni lni-information"></i></div>
            <div>System validates: minimum 4 questions per upload. Questions will be randomised — 2 drawn per student.</div>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => showToast('Questions imported successfully')}>
            Import Questions
          </button>
        </div>

        {/* Right Side: Pending Uploads & Alerts */}
        <div className="card">
          <div className="p-5 flex gap-2 items-center">
            <div className="text-[13.5px] font-bold text-slate-900">Pending Uploads</div>
            <span className="badge badge-red ml-1">3 overdue</span>
          </div>
          
          <div className="border-b border-slate-100 overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse whitespace-nowrap" style={{ fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200" style={{ fontSize: '10px' }}>FACULTY</th>
                  <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200" style={{ fontSize: '10px' }}>SUBJECT</th>
                  <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200" style={{ fontSize: '10px' }}>DEADLINE</th>
                  <FilterTh 
                    label="STATUS" 
                    opts={['Overdue', 'Pending']} 
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
                <tr>
                  <td className="px-5 py-3.5 border-b border-slate-100 text-slate-700">Tom Kizito</td>
                  <td className="px-5 py-3.5 border-b border-slate-100 font-mono text-[var(--blue)] font-medium">CSE 1212</td>
                  <td className="px-5 py-3.5 border-b border-slate-100 text-red-500 font-medium text-[12px]"><span className="flex items-center gap-1">5 Nov <i className="lni lni-warning text-[10px]"></i></span></td>
                  <td className="px-5 py-3.5 border-b border-slate-100 text-center">
                    <button className="badge badge-red" onClick={() => showToast('Reminder sent to faculty')}>Remind</button>
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 border-b border-slate-100 text-slate-700">Joseph Ayuma</td>
                  <td className="px-5 py-3.5 border-b border-slate-100 font-mono text-[var(--blue)] font-medium">BIO 2201</td>
                  <td className="px-5 py-3.5 border-b border-slate-100 text-red-500 font-medium text-[12px]"><span className="flex items-center gap-1">6 Nov <i className="lni lni-warning text-[10px]"></i></span></td>
                  <td className="px-5 py-3.5 border-b border-slate-100 text-center">
                    <button className="badge badge-red" onClick={() => showToast('Reminder sent to faculty')}>Remind</button>
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-3.5 border-b-0 border-slate-100 text-slate-700">Mary Nakato</td>
                  <td className="px-5 py-3.5 border-b-0 border-slate-100 font-mono text-[var(--blue)] font-medium">ACC 3101</td>
                  <td className="px-5 py-3.5 border-b-0 border-slate-100 text-amber-500 font-medium text-[12px]">10 Nov</td>
                  <td className="px-5 py-3.5 border-b-0 border-slate-100 text-center">
                    <button className="bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-[11px] font-semibold hover:bg-slate-100 transition-colors shadow-sm" onClick={() => showToast('Reminder sent to faculty')}>Remind</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 border-b border-slate-100">
            <Pagination page={page} totalPages={2} totalCount={12} onPageChange={setPage} />
          </div>

          <div className="p-5 pt-4">
            <div className="card-title mb-4">Uploaded Questions — CSE 1212</div>
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 flex gap-3 text-[12.5px] text-[#b91c1c] items-start">
              <div className="mt-0.5 text-[#dc2626]"><i className="lni lni-warning"></i></div>
              <div>No questions uploaded yet. CW launch is blocked until at least 4 DQ questions are available.</div>
            </div>
          </div>

        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
