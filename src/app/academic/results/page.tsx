'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Results</div>
            <div className="pg-sub">Mark entry · Verification · Result generation · Publication</div>
          </div>
        </div>
        <div className="undefined-box">
          <div className="text-[var(--fs-stat)] mb-3"><i className="lni lni-bar-chart"></i></div>
          <div className="font-extrabold text-[var(--fs-2xl)] text-g900 mb-2">Results &amp; Mark Entry</div>
          <div className="text-[var(--fs-base)] text-g500 mb-4 max-w-[480px] mx-auto">This functionality is owned by the <strong>Assessment Module (Service 4)</strong>. Mark Entry → Mark Verification → Result Generation → Result Publication will be covered in the Assessment Module KT session.</div>
          <div className="badge badge-purple mb-4"><i className="lni lni-clipboard"></i> Pending KT Session — Assessment Module</div>
          <div className="text-[var(--fs-sm)] text-g400">For academic-side visibility, result publication triggers the next Session Movement cycle.</div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
