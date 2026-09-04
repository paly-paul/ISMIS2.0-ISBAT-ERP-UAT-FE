'use client'
import { useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { Pagination } from '@/components/Pagination'
import { FilterTh } from '@/components/FilterTh'
import { Toast } from '@/components/Toast'

export default function WeightConfigPage() {
  const [model, setModel] = useState('std')
  const [search, setSearch] = useState('')
  const [rawScore, setRawScore] = useState('')
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

  const raw = parseFloat(rawScore)
  const weightage = model === 'std' ? 15 : 20
  const prorated = !isNaN(raw) && raw >= 0 && raw <= 25 
    ? ((raw / 25) * weightage).toFixed(1) 
    : '—'

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Weight Configuration</div>
          <div className="pg-sub">Define assessment weightage per programme type — auto-applies 30/70 or 40/60 model</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-neu btn-sm" onClick={() => showToast('Configuration exported')}><i className="lni lni-download"></i> Export Config</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Selector */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-[14px] p-5 shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff]">
          <div className="card-title mb-4">Assessment Model Selector</div>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Programme</label>
              <SearchSelect
                options={[
                  '— Select Programme —',
                  'BMIT — BSc Medical IT (Engineering)',
                  'BSc Computer Engineering',
                  'BMLT — BSc Med Lab Technology',
                  'BSc Computer Science',
                  'BBA — Business Administration',
                  'BSc Information Technology',
                  'MSc Computer Science'
                ]}
                className="w-full"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Session</label>
                <SearchSelect
                  options={['2024/25 Semester 1']}
                  className="w-full"
                />
              </div>
              
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Course Unit</label>
                <SearchSelect
                  options={['CSE 1212 - Data Structures']}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Configured Programmes List */}
        <div className="bg-white border-[1.5px] border-slate-200 rounded-[14px] p-5 shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff]">
          <div className="card-title mb-4">Configured Programmes</div>
          
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse" style={{ fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th className="font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200" style={{ padding: '10px 8px', fontSize: '10px' }}>PROGRAMME</th>
                  <FilterTh 
                    label="MODEL" 
                    opts={['Standard', 'Engineering']} 
                    isOpen={openFilter === 'model'} 
                    activeFilter={filters['model'] || []} 
                    onToggle={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'model' ? null : 'model') }} 
                    onSelect={(vals) => handleFilterSelect('model', vals)} 
                    onClear={() => handleFilterSelect('model', [])} 
                    onClose={() => setOpenFilter(null)} 
                  />
                  <th className="font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 text-center" style={{ padding: '10px 8px', fontSize: '10px' }}>CW</th>
                  <th className="font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 text-center" style={{ padding: '10px 8px', fontSize: '10px' }}>CBT</th>
                  <th className="font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 text-center" style={{ padding: '10px 8px', fontSize: '10px' }}>UE</th>
                  <th className="font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 text-center" style={{ padding: '10px 8px', fontSize: '10px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>
                    <div style={{ minWidth: '100px', whiteSpace: 'normal', lineHeight: '1.3' }}>BSc Computer Science</div>
                  </td>
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>Standard</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>15m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>15m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>70m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}><span className="badge badge-green">Active</span></td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>BBA</td>
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>Standard</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>15m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>15m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>70m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}><span className="badge badge-green">Active</span></td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>BMIT</td>
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>Engineering</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>20m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>20m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>60m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}><span className="badge badge-green">Active</span></td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>BMLT</td>
                  <td className="border-b border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>Engineering</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>20m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>20m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>60m</td>
                  <td className="border-b border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}><span className="badge badge-green">Active</span></td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="border-b-0 border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>
                    <div style={{ minWidth: '100px', whiteSpace: 'normal', lineHeight: '1.3' }}>MSc Computer Science</div>
                  </td>
                  <td className="border-b-0 border-slate-200 text-slate-700" style={{ padding: '10px 8px' }}>Standard</td>
                  <td className="border-b-0 border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>15m</td>
                  <td className="border-b-0 border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>15m</td>
                  <td className="border-b-0 border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}>70m</td>
                  <td className="border-b-0 border-slate-200 text-slate-700 text-center" style={{ padding: '10px 8px' }}><span className="badge badge-green">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={3} totalCount={28} onPageChange={setPage} />
        </div>
      </div>

      {/* Proration Calculator */}
      <div className="bg-white border-[1.5px] border-slate-200 rounded-[14px] p-5 shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff]">
        <div className="card-title mb-4 flex items-center gap-2">
          <span className="text-[16px]">📐</span> Live Proration Calculator
        </div>
        
        <div className="text-[13px] text-slate-500 mb-4">
          Enter raw scores to see prorated values instantly. All coursework is issued universally out of 25 marks.
        </div>
        
        <div className="flex items-end gap-4 flex-wrap">
          <div style={{ maxWidth: 160, flex: 1 }}>
            <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Model</label>
            <SearchSelect
              options={[
                { value: 'std', label: 'Standard (15m)' },
                { value: 'eng', label: 'Engineering (20m)' }
              ]}
              value={model}
              onChange={setModel}
              className="w-full"
            />
          </div>
          <div style={{ maxWidth: 120, flex: 1 }}>
            <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Raw Score (/25)</label>
            <input type="number" className="ctrl w-full" placeholder="0–25" max={25} min={0} value={rawScore} onChange={e => setRawScore(e.target.value)} />
          </div>
          <div style={{ maxWidth: 140, flex: 1 }}>
            <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Prorated Mark</label>
            <div style={{ padding: '7px 12px', background: '#eef2ff', border: '1px solid #c4b5fd', borderRadius: '8px', fontSize: '18px', fontWeight: 700, color: '#4c1d95', textAlign: 'center' }}>
              {prorated}
            </div>
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label className="text-[12px] font-semibold text-slate-700 block mb-1.5">Formula</label>
            <div style={{ padding: '8px 12px', background: '#f0f4f8', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
              (raw / 25) × weightage
            </div>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
