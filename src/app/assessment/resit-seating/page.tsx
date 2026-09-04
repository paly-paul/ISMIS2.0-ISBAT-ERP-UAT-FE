'use client'
import { Toast } from '@/components/Toast'
import { TableSearch } from '@/components/TableSearch'
import { useState } from 'react'

export default function ResitSeatingPage() {
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null)
  const [search, setSearch] = useState('')

  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Resit Seating Allocator</div>
          <div className="pg-sub">Staggered scheduling grid · Drag-and-drop allocation · Real-time capacity indicators</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary whitespace-nowrap" onClick={() => showToast('Seating plan published successfully')}>
            Publish Seating Plan
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch gap-5 mb-5">
        
        {/* Module Volume by Subject */}
        <div className="w-full lg:w-1/2 bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff] p-5 flex flex-col">
          <div className="card-title mb-4">Module Volume by Subject</div>
          
          <div className="flex-1">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-md">SUBJECT</th>
                  <th className="py-2.5 px-3">IA RESIT</th>
                  <th className="py-2.5 px-3">UE RESIT</th>
                  <th className="py-2.5 px-3 rounded-r-md">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-3 text-slate-700">Algorithms</td>
                  <td className="py-3 px-3 text-slate-700">3</td>
                  <td className="py-3 px-3 text-slate-700">8</td>
                  <td className="py-3 px-3 font-bold text-slate-900">11</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-slate-700">Business Management</td>
                  <td className="py-3 px-3 text-slate-700">5</td>
                  <td className="py-3 px-3 text-slate-700">2</td>
                  <td className="py-3 px-3 font-bold text-slate-900">7</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-slate-700">Database Systems</td>
                  <td className="py-3 px-3 text-slate-700">2</td>
                  <td className="py-3 px-3 text-slate-700">3</td>
                  <td className="py-3 px-3 font-bold text-slate-900">5</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Venue Capacity */}
        <div className="w-full lg:w-1/2 bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[3px_3px_8px_#c8d4e0,-3px_-3px_8px_#ffffff] p-5 flex flex-col">
          <div className="card-title mb-4">Venue Capacity</div>
          
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="text-[13px] text-slate-700">Hall A — Computer Lab</div>
              <div className="badge badge-green">Cap: 30</div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="text-[13px] text-slate-700">Hall B — Exam Hall</div>
              <div className="badge badge-green">Cap: 50</div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="text-[13px] text-slate-700">Room 201 — Seminar</div>
              <div className="badge badge-amber">Cap: 20</div>
            </div>
          </div>
        </div>

      </div>

      <div className="card">
        <div className="p-5 pb-4 border-b border-slate-100">
          <div className="text-[13.5px] font-bold text-slate-900">Staggered Session Grid — December 2024</div>
        </div>
        
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            
            <div className="flex flex-col border border-slate-200 rounded-[10px] p-3 text-center">
              <div className="text-[11.5px] font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Mon 10 Dec · 9AM</div>
              <div className="bg-green-50 border border-green-100 text-green-700 rounded-md p-2 text-[11px] font-medium h-full flex flex-col justify-center">
                Algorithms UE<br/>11 seats
              </div>
            </div>

            <div className="flex flex-col border border-slate-200 rounded-[10px] p-3 text-center">
              <div className="text-[11.5px] font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Mon 10 Dec · 2PM</div>
              <div className="bg-green-50 border border-green-100 text-green-700 rounded-md p-2 text-[11px] font-medium h-full flex flex-col justify-center">
                Biz Mgmt IA<br/>5 seats
              </div>
            </div>

            <div className="flex flex-col border border-slate-200 rounded-[10px] p-3 text-center">
              <div className="text-[11.5px] font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Tue 11 Dec · 9AM</div>
              <div className="bg-green-50 border border-green-100 text-green-700 rounded-md p-2 text-[11px] font-medium h-full flex flex-col justify-center">
                DB Systems<br/>5 seats
              </div>
            </div>

            <div className="flex flex-col border border-slate-200 rounded-[10px] p-3 text-center">
              <div className="text-[11.5px] font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Tue 11 Dec · 2PM</div>
              <div className="text-slate-400 text-[11px] italic h-full flex flex-col justify-center">
                — Available —
              </div>
            </div>

            <div className="flex flex-col border border-slate-200 rounded-[10px] p-3 text-center">
              <div className="text-[11.5px] font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Wed 12 Dec · 9AM</div>
              <div className="text-slate-400 text-[11px] italic h-full flex flex-col justify-center">
                — Available —
              </div>
            </div>

            <div className="flex flex-col border border-slate-200 rounded-[10px] p-3 text-center">
              <div className="text-[11.5px] font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Thu 13 Dec · 9AM</div>
              <div className="text-slate-400 text-[11px] italic h-full flex flex-col justify-center">
                — Available —
              </div>
            </div>

            <div className="flex flex-col border border-slate-200 rounded-[10px] p-3 text-center">
              <div className="text-[11.5px] font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Fri 14 Dec · 9AM</div>
              <div className="text-slate-400 text-[11px] italic h-full flex flex-col justify-center">
                — Available —
              </div>
            </div>

          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
