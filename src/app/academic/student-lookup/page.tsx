'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'

const PAGE_SIZE = 10

const STUDENT_ROWS = [
  { studentNo: 'ISB/2026/0142', name: 'Nakato Sarah Bridget',  email: 'nakato.s@students.isbatuniversity.ac.ug',    programme: 'BSc. Computer Science',          yearSem: 'Year 1 · Sem 1', intake: 'Spring 2026', ayBadge: 'badge-blue', ayText: '2025–2026', feeBadge: 'badge-green', feeText: 'Cleared 100%',      statusBadge: 'badge-green', statusText: 'Active' },
  { studentNo: 'ISB/2026/0141', name: 'Okello James Patrick',   email: 'okello.j@students.isbatuniversity.ac.ug',    programme: 'MBA Business Admin (ODL)',       yearSem: 'Year 1 · Sem 1', intake: 'Spring 2026', ayBadge: 'badge-blue', ayText: '2025–2026', feeBadge: 'badge-green', feeText: 'Cleared 100%',      statusBadge: 'badge-green', statusText: 'Active' },
  { studentNo: 'ISB/2026/0140', name: 'Tumukunde Alice Grace',  email: 'tumukunde.a@students.isbatuniversity.ac.ug', programme: 'Diploma in Nursing',             yearSem: 'Year 1 · Sem 1', intake: 'Spring 2026', ayBadge: 'badge-blue', ayText: '2025–2026', feeBadge: 'badge-amber', feeText: 'Partial 60%',       statusBadge: 'badge-green', statusText: 'Active' },
  { studentNo: 'ISB/2025/0089', name: 'Mugume Robert',          email: 'mugume.r@students.isbatuniversity.ac.ug',    programme: 'BSc. Information Technology',    yearSem: 'Year 1 · Sem 2', intake: 'Fall 2025',   ayBadge: 'badge-blue', ayText: '2025–2026', feeBadge: 'badge-red',   feeText: 'Outstanding 35%',   statusBadge: 'badge-amber', statusText: 'Access Blocked' },
  { studentNo: 'ISB/2024/0028', name: 'Akello Diana',           email: 'akello.d@students.isbatuniversity.ac.ug',    programme: 'BBA',                            yearSem: 'Year 2 · Sem 4', intake: 'Spring 2024', ayBadge: 'badge-grey', ayText: '2023–2024', feeBadge: 'badge-green', feeText: 'Cleared 100%',      statusBadge: 'badge-green', statusText: 'Active' },
]

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [search, setSearch] = useState('')

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const filteredRows = STUDENT_ROWS.filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${r.studentNo} ${r.name} ${r.email}`.toLowerCase().includes(q)
  })

  // Live preview shown in the search dropdown as the user types — same
  // studentNo/name/email test as filteredRows above, capped to a handful of rows.
  const searchMatches = search.trim()
    ? STUDENT_ROWS.filter(r => `${r.studentNo} ${r.name} ${r.email}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Student Lookup</div><div className="pg-sub">Cross-module shared page · Search any student · View academic and financial status</div></div>
          <span className="badge badge-purple self-center"><i className="lni lni-link"></i> Shared Across All Modules</span>
        </div>
        <div className="info-box mb-[18px]">
          <i className="lni lni-link"></i> <span>This is a <strong>cross-module shared page</strong> accessible from Academic, Admission, Finance, and Assessment modules. Full profile management lives in the <strong>Student Microservice (Service 10)</strong>.</span>
        </div>
        <div className="card">
          <div className="card-hdr"><div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Search Student</div></div>
          <div className="g3">
            <div className="fg"><div className="lbl">Search by Name, Student No., or Email</div>
              <TableSearch
                className="w-full"
                placeholder="e.g. ISB/2026/0142 or Nakato Sarah..."
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.studentNo, primary: r.studentNo, secondary: r.name }))}
              />
            </div>
            <div className="fg"><div className="lbl">Programme Filter</div>
              <SearchSelect
                placeholder="All Programmes"
                options={['BSc. Computer Science', 'BSc. Information Technology', 'BBA', 'MBA Business Admin', 'MBA Business Admin (ODL)', 'BEng. Civil Engineering', 'BCom. Accounting', 'Diploma in Nursing']}
              />
            </div>
            <div className="fg"><div className="lbl">Academic Year</div>
              <SearchSelect
                placeholder="All Academic Years"
                options={[
                  { value: '2025-2026', label: '2025–2026' },
                  { value: '2024-2025', label: '2024–2025' },
                  { value: '2023-2024', label: '2023–2024' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-users"></i></span> Registered Students — Academic Year 2025–2026</div>
            <span className="badge badge-blue"><i className="lni lni-graduation"></i> 8 of 1,247 shown</span>
          </div>
          <ScrollTable>
            <table>
              <thead><tr><th>Student No.</th><th>Name</th><th>Programme</th><th>Year / Sem</th><th>Intake</th><th>Academic Year</th><th>Fee Status</th><th>Status</th><th className="w-[160px]">Action</th></tr></thead>
              <tbody>
                {pageItems.map(r => (
                  <tr key={r.studentNo}>
                    <td><span className="text-blue font-bold font-mono">{r.studentNo}</span></td>
                    <td><strong>{r.name}</strong><div className="text-[var(--fs-xs)] text-g500">{r.email}</div></td>
                    <td>{r.programme}</td>
                    <td>{r.yearSem}</td>
                    <td>{r.intake}</td>
                    <td><span className={`badge ${r.ayBadge}`}>{r.ayText}</span></td>
                    <td><span className={`badge ${r.feeBadge}`}>{r.feeText}</span></td>
                    <td><span className={`badge ${r.statusBadge}`}><span className="bdot"></span>{r.statusText}</span></td>
                    <td><ActionMenu><button className="btn btn-neu btn-sm"><i className="lni lni-eye"></i> View</button><button className="btn btn-primary btn-sm"><i className="lni lni-pencil"></i> Edit</button></ActionMenu></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="students" onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
