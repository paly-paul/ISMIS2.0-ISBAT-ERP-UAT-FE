'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [showFcResult, setShowFcResult] = useState(false)

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Fee Clearance Check</div><div className="pg-sub">Read-only view · Clearance status consumed from Finance Service (Service 3)</div></div>
          <span className="badge badge-purple self-center"><i className="lni lni-link"></i> Shared — Read Only in Academic Module</span>
        </div>
        <div className="info-box mb-[18px]">
          <i className="lni lni-dollar"></i> <span>Fee clearance is <strong>owned and calculated by the Finance Module (Service 3)</strong>. The Academic Module consumes clearance status as a read-only API call to determine CW/CBT submission eligibility. <strong>Minimum 50% clearance</strong> is calculated on the <em>original tuition fee</em> (before discounts).</span>
        </div>
        <div className="card">
          <div className="card-hdr"><div className="card-title"><span className="ctitle-icon"><i className="lni lni-checkmark-circle"></i></span> Clearance Status Lookup</div></div>
          <div className="g2">
            <div className="fg"><div className="lbl">Student Number</div>
              <div className="inp-wrap"><span className="inp-icon"><i className="lni lni-search-alt"></i></span><input className="ctrl pl-[34px]" type="text" placeholder="ISB/2026/..." /></div>
            </div>
            <div className="fg justify-end pt-[18px]">
              <button className="btn btn-primary" onClick={() => setShowFcResult(true)}>Check Clearance</button>
            </div>
          </div>
          {showFcResult && (
            <div className="mt-[14px]">
              <div className="g3">
                <div className="p-[14px] bg-[var(--green-bg)] border border-[var(--green-bd)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] text-clr-green font-bold uppercase">Clearance %</div><div className="text-[var(--fs-stat)] font-extrabold text-clr-green">72%</div></div>
                <div className="p-[14px] bg-b50 border border-[var(--b100)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] text-b700 font-bold uppercase">CW Submission</div><div className="text-[var(--fs-2xl)] font-extrabold text-clr-green mt-1"><i className="lni lni-checkmark"></i> Allowed</div></div>
                <div className="p-[14px] bg-b50 border border-[var(--b100)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] text-b700 font-bold uppercase">CBT Submission</div><div className="text-[var(--fs-2xl)] font-extrabold text-clr-green mt-1"><i className="lni lni-checkmark"></i> Allowed</div></div>
              </div>
            </div>
          )}
        </div>
        <div className="undefined-box mt-1">
          <div className="text-[var(--fs-xl)] mb-2"><i className="lni lni-dollar"></i></div>
          <div className="font-bold text-[var(--fs-md)] mb-[6px]">Finance Module Integration</div>
          <div className="text-[var(--fs-sm)] text-g500 max-w-[500px] m-0 mx-auto">This page shows a read-only API response from Finance Service. Full fee management, payment processing, and clearance calculation are in the <strong>Finance Module (Service 3)</strong>.</div>
          <div className="badge badge-purple mt-[10px]"><i className="lni lni-link"></i> Cross-Module — Read Only View from Finance Service</div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
