'use client'
import { useEffect, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useCampusDropdown } from '@/hooks/config/useCampuses'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useLearningModeOptions, useLearningModeReport, LearningModeReportFilters } from '@/hooks/student/useLearningMode'

// Campus-wide learning-mode roster (GET /students/learning-mode/report).
// Split out of the Learning Mode page into its own report page, 2026-09-29 —
// that page now only handles the per-student mode change.
// The doc's own default is 25 — narrowed to 10 to match this app's usual
// table-page-size convention (see e.g. academic/intake-master's own
// PAGE_SIZE) rather than the API's raw default.
const PAGE_SIZE = 10

export default function Page() {
  const { data: options = [] } = useLearningModeOptions()
  const { data: campuses = [] } = useCampusDropdown()
  const { data: intakes = [] } = useIntakes()
  const [campusGuid, setCampusGuid] = useState('')
  const [mode, setMode] = useState('')
  const [intakeGuid, setIntakeGuid] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filters: LearningModeReportFilters | null = campusGuid
    ? { campusGuid, learningMode: mode ? Number(mode) : null, intakeGuid: intakeGuid || null, search: search.trim() || null }
    : null
  const { data, isLoading } = useLearningModeReport(filters, page, PAGE_SIZE)
  const items = data?.items ?? []
  const total = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => { setPage(1) }, [campusGuid, mode, intakeGuid, search])

  return (
    <div className="page active">
      <div className="pg-hdr"><div><div className="pg-title">Learning Mode Report</div><div className="pg-sub">Campus-wide roster of students by learning mode</div></div></div>

      <div className="card">
        <div className="g3 mb-3">
          <div className="fg">
            <label className="lbl">Campus <span className="req">*</span></label>
            <SearchSelect
              placeholder="— Select campus —"
              options={campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))}
              value={campusGuid}
              onChange={setCampusGuid}
            />
          </div>
          <div className="fg">
            <label className="lbl">Learning Mode</label>
            <SearchSelect
              placeholder="— All modes —"
              options={options.map(o => ({ value: String(o.value), label: o.label }))}
              value={mode}
              onChange={setMode}
            />
          </div>
          <div className="fg">
            <label className="lbl">Intake</label>
            <SearchSelect
              placeholder="— All intakes —"
              options={intakes.map(i => ({ value: i.intakeGuid, label: i.description }))}
              value={intakeGuid}
              onChange={setIntakeGuid}
            />
          </div>
        </div>
        <div className="fg mb-3">
          <label className="lbl">Search</label>
          <input className="ctrl" type="text" maxLength={50} placeholder="Student number, reg. no, or name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {!campusGuid ? (
          <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Select a campus to load the roster.</div>
        ) : (
          <>
            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th>Student No.</th>
                    <th>Name</th>
                    <th>Programme</th>
                    <th>Semester</th>
                    <th>Batch</th>
                    <th>Learning Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? <TableLoadingState colSpan={6} />
                    : items.length === 0
                      ? <EmptyState colSpan={6} hasFilters={!!(mode || intakeGuid || search)} onClearFilters={() => { setMode(''); setIntakeGuid(''); setSearch('') }} />
                      : items.map(r => (
                        <tr key={r.studentGuid}>
                          <td className="font-mono">{r.studentNum ?? '—'}</td>
                          <td><strong>{r.studentName ?? '—'}</strong></td>
                          <td>{r.programName ?? '—'}</td>
                          <td>{r.semesterName ?? '—'}</td>
                          <td>{r.batchCode ?? '—'}</td>
                          <td><span className="pill pill-blue">{r.learningModeLabel}</span></td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </ScrollTable>
            <Pagination page={page} totalPages={totalPages} totalCount={total} itemLabel="students" onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
