'use client'
import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useCampusDropdown } from '@/hooks/config/useCampuses'
import { useBatchSummary } from '@/hooks/academic/useBatchSummary'
import { InfiniteSearchSelect } from '@/components/InfiniteSearchSelect'
import { getIntakesPaged } from '@/lib/api/academic/intake'

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
  const [campusGuid, setCampusGuid] = useState('')
  const [page, setPage] = useState(1)
  const { data: campuses = [] } = useCampusDropdown()
  // The endpoint returns every batch for the campus in one go (no server
  // paging — see useBatchSummary), so page it here. Before, the table showed
  // the whole list on page 1 and the same list again on every other page.
  // Intake filter is server-side (?intakeGuid=, ACD-015). Empty = the current
  // admission intake, the endpoint's default — not every intake.
  const [intakeGuid, setIntakeGuid] = useState('')
  // isPlaceholderData: the rows on screen are the previous filter's, kept
  // while the new one loads — dimmed with a pill so it's clear they're stale.
  const { data, isLoading, isPlaceholderData: isRefetching } = useBatchSummary(campusGuid || null, intakeGuid || null)

  const allRows = useMemo(() => data?.items ?? [], [data])
  const totalCount = allRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const rows = allRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  // Stat tiles cover every batch for the campus, not just the visible page.
  const stats = useMemo(() => statsFromRows(allRows), [allRows])

  // Land back on page 1 whenever the campus filter changes — the previous
  // page offset almost never lands on a valid page of the newly-filtered set.
  useEffect(() => { setPage(1) }, [campusGuid, intakeGuid])

  // Keep the page state clamped if the list shrinks (e.g. a stricter campus
  // filter) — only against loaded data, so a pending fetch can't bounce
  // the page back to 1.
  useEffect(() => {
    if (data && page !== safePage) setPage(safePage)
  }, [data, page, safePage])

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
          {/* Sent as ?intakeGuid=. With none picked the endpoint lists the
              current admission intake, hence the label. */}
          <div style={{ width: 220 }}>
            <InfiniteSearchSelect
              queryKey={['intakes', 'batch-summary']}
              fetchPage={getIntakesPaged}
              toOption={i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` })}
              allLabel="Current Intake"
              value={intakeGuid}
              onChange={setIntakeGuid}
            />
          </div>
          <button className="btn btn-neu btn-sm"><i className="lni lni-download"></i> Export</button>
        </div>
      </div>

      <div className="stats-row" style={{ opacity: isRefetching ? 0.45 : 1, transition: 'opacity .15s ease' }}>
        <div className="stat-card"><div className="stat-lbl">Total Batches</div><div className="stat-num" style={{ color: 'var(--b700)' }}>{stats.totalBatches}</div><div className="stat-sub">{[campusGuid ? 'At this campus' : 'All campuses', intakeGuid ? 'In this intake' : 'Current intake'].join(' · ')}</div></div>
        <div className="stat-card [--b700:var(--green)] [--b400:#34d399]"><div className="stat-lbl">Total Students</div><div className="stat-num" style={{ color: 'var(--green)' }}>{stats.totalStudents}</div><div className="stat-sub up">Across all batches</div></div>
        <div className="stat-card"><div className="stat-lbl">Avg Batch Size</div><div className="stat-num">{stats.avgBatchSize}</div><div className="stat-sub">students / batch</div></div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title"><span className="ctitle-icon"><i className="lni lni-users"></i></span> Batches{campusGuid ? ` · ${campuses.find(c => c.campusGuid === campusGuid)?.campusName ?? ''}` : ''}</div>
        </div>
        <div className={`tbl-refetch-wrap${isRefetching ? ' is-refetching' : ''}`} aria-busy={isRefetching}>
        {isRefetching && (
          <div className="tbl-refetch-pill" role="status">
            <i className="lni lni-reload" /> Loading batches…
          </div>
        )}
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
                : rows.length === 0
                  ? <EmptyState colSpan={6} hasFilters={!!campusGuid || !!intakeGuid} onClearFilters={() => { setCampusGuid(''); setIntakeGuid('') }} />
                  : rows.map((r, i) => (
                    // batchGuid alone isn't a safe key — the real endpoint's
                    // field names aren't confirmed yet (see file header) and
                    // a live response has been seen leaving it blank/
                    // duplicated across rows; the absolute row index (page-
                    // qualified, matching the Sl. No column) is always
                    // unique regardless of what the guid comes back as.
                    <tr key={`${r.batchGuid || 'row'}-${(safePage - 1) * PAGE_SIZE + i}`}>
                      <td className="text-g500">{r.slNo ?? (safePage - 1) * PAGE_SIZE + i + 1}</td>
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
        </div>
        <Pagination page={safePage} totalPages={totalPages} totalCount={totalCount} itemLabel="batches" onPageChange={setPage} />
      </div>
    </div>
  )
}
