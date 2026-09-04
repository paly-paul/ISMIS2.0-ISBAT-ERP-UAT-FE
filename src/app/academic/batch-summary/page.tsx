'use client'
import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useCampusDropdown } from '@/hooks/config/useCampuses'
import { useBatchSummary } from '@/hooks/academic/useBatchSummary'

// Ported from isbat_student_module.html's Batch Summary page. Campus
// dropdown loads from GET /academic/campus/dropdown on mount
// (useCampusDropdown, same source Campus Master/Faculty Master use). The
// grid itself comes from GET /academic/batch-summary — no campusGuid for the
// unfiltered "All Campuses" view, ?campusGuid={guid} once one's selected —
// see getBatchSummary in lib/api/academic/batchSummary.ts for the field-name
// caveat (names aren't confirmed against a real response yet).
//
// The top stat tiles used to be a hardcoded STATS constant; Total
// Batches/Total Students/Avg Batch Size are all derivable from the same
// `rows` this page already fetches, so they're computed live below instead
// (see statsFromRows). "Full Batches" was dropped rather than faked — there
// is no capacity/maxSize field anywhere in BatchSummaryItem, so "at
// capacity" isn't something this endpoint can answer.
function statsFromRows(rows: { headCount: number }[]) {
  const totalStudents = rows.reduce((sum, r) => sum + r.headCount, 0)
  return {
    totalBatches: rows.length,
    totalStudents,
    avgBatchSize: rows.length ? Math.round(totalStudents / rows.length) : 0,
  }
}

// The real endpoint returns semCode — a bare int counting semesters
// across the whole programme (1, 2, 3…), not a resolved name and not
// per-year — rather than a semesterName string, confirmed against a real
// response (2026-08-31). No lookup/name mapping exists anywhere for this
// code, so it's turned into a "Year N - Semester M" label by simple
// arithmetic (two semesters per year, the convention every other real
// semester name in this app already follows) instead of showing the raw
// number or leaving the column blank.
function semesterLabelFromCode(semCode: number): string {
  const year = Math.ceil(semCode / 2)
  const sem = semCode % 2 === 0 ? 2 : 1
  return `Year ${year} - Semester ${sem}`
}

const PAGE_SIZE = 10

export default function Page() {
  const [intake, setIntake] = useState('Spring 2026')
  const [campusGuid, setCampusGuid] = useState('')
  const { data: campuses = [] } = useCampusDropdown()
  const { data: rows = [], isLoading } = useBatchSummary(campusGuid || null)
  const stats = useMemo(() => statsFromRows(rows), [rows])

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(rows, PAGE_SIZE)

  // Land back on page 1 whenever the campus filter changes — the previous
  // page offset almost never lands on a valid page of the newly-filtered set.
  useEffect(() => { setPage(1) }, [campusGuid, setPage])

  return (
    <div className="page active" id="page-batch-summary">
      <div className="pg-hdr">
        <div><div className="pg-title">Batch Summary</div><div className="pg-sub">Student counts and status breakdown by batch</div></div>
        <div className="flex gap-2">
          <SearchSelect
            style={{ width: 200 }}
            placeholder="All Campuses"
            options={campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))}
            value={campusGuid}
            onChange={setCampusGuid}
          />
          <SearchSelect
            style={{ width: 200 }}
            options={['Spring 2026', 'Fall 2025', 'Spring 2025']}
            value={intake}
            onChange={setIntake}
          />
          <button className="btn btn-neu btn-sm"><i className="lni lni-download"></i> Export</button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-lbl">Total Batches</div><div className="stat-num" style={{ color: 'var(--b700)' }}>{stats.totalBatches}</div><div className="stat-sub">{campusGuid ? 'At this campus' : 'Active this intake'}</div></div>
        <div className="stat-card [--b700:var(--green)] [--b400:#34d399]"><div className="stat-lbl">Total Students</div><div className="stat-num" style={{ color: 'var(--green)' }}>{stats.totalStudents}</div><div className="stat-sub up">Across all batches</div></div>
        <div className="stat-card"><div className="stat-lbl">Avg Batch Size</div><div className="stat-num">{stats.avgBatchSize}</div><div className="stat-sub">students / batch</div></div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title"><span className="ctitle-icon"><i className="lni lni-users"></i></span> Batches{campusGuid ? ` · ${campuses.find(c => c.campusGuid === campusGuid)?.campusName ?? ''}` : ''}</div>
        </div>
        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 56 }}>Sl. No</th>
                <th>Batch</th>
                <th>Programme</th>
                <th>Semester</th>
                <th>Faculty</th>
                <th>Head Count</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? <TableLoadingState colSpan={6} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={6} hasFilters={!!campusGuid} onClearFilters={() => setCampusGuid('')} />
                  : pageItems.map((r, i) => (
                    // batchGuid alone isn't a safe key — the real endpoint's
                    // field names aren't confirmed yet (see file header) and
                    // a live response has been seen leaving it blank/
                    // duplicated across rows; the absolute row index (page-
                    // qualified, matching the Sl. No column) is always
                    // unique regardless of what the guid comes back as.
                    <tr key={`${r.batchGuid || 'row'}-${(page - 1) * PAGE_SIZE + i}`}>
                      <td className="text-g500">{r.slNo ?? (page - 1) * PAGE_SIZE + i + 1}</td>
                      <td><span className="font-bold font-mono text-blue">{r.batchCode}</span></td>
                      <td>{r.programName}</td>
                      <td>{semesterLabelFromCode(r.semCode)}</td>
                      <td>{r.facultyName || '—'}</td>
                      <td>{r.headCount}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="batches" onPageChange={setPage} />
      </div>
    </div>
  )
}
