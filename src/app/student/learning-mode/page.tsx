'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { StudentLookup } from '@/components/student/StudentLookup'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import { StudentDto, normalizeStudentDetail } from '@/lib/api/student/student'
import { useStudent } from '@/hooks/student/useStudents'
import { useCampusDropdown } from '@/hooks/config/useCampuses'
import { useIntakes } from '@/hooks/academic/useIntakes'
import {
  useLearningModeOptions,
  useStudentLearningModeDetail,
  useUpdateStudentLearningMode,
  useLearningModeReport,
  LearningModeReportFilters,
} from '@/hooks/student/useLearningMode'

// Ported from isbat_student_module.html's Learning Mode page, then rewired
// to the real students/learning-mode/*.md endpoints (2026-08-31) — both the
// per-student edit view and the campus-wide roster report live on this one
// page, per every endpoint's own "Used by pages" entry. Only 3 real modes
// exist (Campus/Blended/Online) — the old mock's binary Campus/ODL toggle,
// Campus Location/Online Region/Effective From/Reason/Remarks fields, and
// Impact Preview/Mode History sections all had no backing field anywhere in
// this API and are dropped rather than faked.
// The doc's own default is 25 — narrowed to 10 to match this app's usual
// table-page-size convention (see e.g. academic/intake-master's own
// PAGE_SIZE) rather than the API's raw default.
const REPORT_PAGE_SIZE = 10

// useSearchParams() requires a Suspense boundary above it (Next.js App
// Router) — see the wrapping default export at the bottom of this file,
// same split Student Profile uses for the same reason.
function LearningModeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Student Profile's action menu links here as
  // /student/learning-mode?studentGuid=<guid> instead of requiring a second
  // StudentLookup search for the student already open there — same
  // deep-link convention Student Master's own "View" action uses to reach
  // Profile itself.
  const studentGuidParam = searchParams.get('studentGuid')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [student, setStudent] = useState<StudentDto | null>(null)
  const effectiveStudentGuid = student?.studentGuid ?? studentGuidParam
  const { data: guidLoadedStudent } = useStudent(effectiveStudentGuid ?? null, !!effectiveStudentGuid)
  // Once the deep-linked guid's detail resolves, seed `student` from it —
  // same effect Profile itself uses for its own ?studentGuid= param.
  useEffect(() => {
    if (!student && studentGuidParam && guidLoadedStudent) setStudent(normalizeStudentDetail(guidLoadedStudent, effectiveStudentGuid))
  }, [student, studentGuidParam, guidLoadedStudent, effectiveStudentGuid])

  const { data: detail, isLoading: isDetailLoading } = useStudentLearningModeDetail(student?.studentGuid ?? null)
  const { data: options = [] } = useLearningModeOptions()
  const updateLearningMode = useUpdateStudentLearningMode()

  const [selectedMode, setSelectedMode] = useState('')

  // Once the detail loads for a newly-picked student, seed the picker with
  // their current mode (falls back to nothing selected if they've never had
  // one set — learningMode comes back null in that case).
  useEffect(() => {
    setSelectedMode(detail?.learningMode != null ? String(detail.learningMode) : '')
  }, [detail?.studentGuid, detail?.learningMode])

  function handleLoad(s: StudentDto) { setStudent(s) }
  function handleClear() {
    setStudent(null); setSelectedMode('')
    // Drop ?studentGuid= so the effect above doesn't immediately reload the
    // same student right back in — same reasoning as Profile's own clear.
    if (studentGuidParam) router.replace('/student/learning-mode')
  }

  function handleApply() {
    if (!student) return
    const modeNum = Number(selectedMode)
    if (!selectedMode || !modeNum) { showToast('Please select a learning mode.', 'warn'); return }
    updateLearningMode.mutate(
      { studentGuid: student.studentGuid, learningMode: modeNum },
      {
        onSuccess: result => showToast(`Learning mode updated to ${result.learningModeLabel}.`, 'ok'),
        onError: (error: Error) => showToast(error.message || 'Failed to update learning mode.', 'error'),
      },
    )
  }

  // Report section — campus-wide roster, independent of whichever student
  // the edit section above has loaded.
  const { data: campuses = [] } = useCampusDropdown()
  const { data: intakes = [] } = useIntakes()
  const [reportCampusGuid, setReportCampusGuid] = useState('')
  const [reportMode, setReportMode] = useState('')
  const [reportIntakeGuid, setReportIntakeGuid] = useState('')
  const [reportSearch, setReportSearch] = useState('')
  const [reportPage, setReportPage] = useState(1)

  const reportFilters: LearningModeReportFilters | null = reportCampusGuid
    ? { campusGuid: reportCampusGuid, learningMode: reportMode ? Number(reportMode) : null, intakeGuid: reportIntakeGuid || null, search: reportSearch.trim() || null }
    : null
  const { data: reportData, isLoading: isReportLoading } = useLearningModeReport(reportFilters, reportPage, REPORT_PAGE_SIZE)
  const reportItems = reportData?.items ?? []
  const reportTotal = reportData?.totalCount ?? 0
  const reportTotalPages = Math.max(1, Math.ceil(reportTotal / REPORT_PAGE_SIZE))

  useEffect(() => { setReportPage(1) }, [reportCampusGuid, reportMode, reportIntakeGuid, reportSearch])

  return (
    <>
      <div className="page active">
        <div className="pg-hdr"><div><div className="pg-title">Learning Mode</div><div className="pg-sub">Update a student's learning mode, or review the campus-wide roster</div></div></div>

        <StudentLookup onLoad={handleLoad} onClear={handleClear} loaded={!!student} />

        {!student ? (
          <div className="empty">
            <div className="empty-icon"><i className="lni lni-display"></i></div>
            <div className="empty-title">No Student Loaded</div>
            <div className="empty-sub">Search for a student to view and update their learning mode.</div>
          </div>
        ) : isDetailLoading ? (
          <div className="text-g400 text-center" style={{ padding: 24 }}>Loading learning mode…</div>
        ) : (
          <>
            <BaselinePanel
              label="Current Enrollment (Read-Only)"
              items={[
                { label: 'Student', value: detail?.studentName ?? student.studentName },
                { label: 'Programme', value: detail?.programName ?? (detail as any)?.programme ?? student.programName ?? (student as any).programme ?? '—' },
                { label: 'Semester', value: detail?.semesterName ?? (detail as any)?.semester ?? student.semesterName ?? (student as any).semester ?? '—' },
                { label: 'Current Mode', value: detail?.learningModeLabel ?? (detail as any)?.learningMode ?? (student as any).learningMode ?? 'Not set' },
              ]}
            />
            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-display"></i> Update Learning Mode</div></div>
              <div className="fg"><label className="lbl">Learning Mode <span className="req">*</span></label>
                <SearchSelect
                  placeholder="— Select mode —"
                  options={options.map(o => ({ value: String(o.value), label: o.label }))}
                  value={selectedMode}
                  onChange={setSelectedMode}
                />
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-neu" onClick={handleClear}>Cancel</button>
                <button className="btn btn-primary" disabled={updateLearningMode.isPending} onClick={handleApply}>
                  <i className="lni lni-checkmark"></i> {updateLearningMode.isPending ? 'Saving…' : 'Apply Mode Change'}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="card">
          <div className="card-hdr"><div className="card-title"><i className="lni lni-bar-chart"></i> Learning Mode Report</div></div>
          <div className="g3 mb-3">
            <div className="fg">
              <label className="lbl">Campus <span className="req">*</span></label>
              <SearchSelect
                placeholder="— Select campus —"
                options={campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))}
                value={reportCampusGuid}
                onChange={setReportCampusGuid}
              />
            </div>
            <div className="fg">
              <label className="lbl">Learning Mode</label>
              <SearchSelect
                placeholder="— All modes —"
                options={options.map(o => ({ value: String(o.value), label: o.label }))}
                value={reportMode}
                onChange={setReportMode}
              />
            </div>
            <div className="fg">
              <label className="lbl">Intake</label>
              <SearchSelect
                placeholder="— All intakes —"
                options={intakes.map(i => ({ value: i.intakeGuid, label: i.description }))}
                value={reportIntakeGuid}
                onChange={setReportIntakeGuid}
              />
            </div>
          </div>
          <div className="fg mb-3">
            <label className="lbl">Search</label>
            <input className="ctrl" type="text" maxLength={50} placeholder="Student number, reg. no, or name…" value={reportSearch} onChange={e => setReportSearch(e.target.value)} />
          </div>

          {!reportCampusGuid ? (
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
                    {isReportLoading
                      ? <TableLoadingState colSpan={6} />
                      : reportItems.length === 0
                        ? <EmptyState colSpan={6} hasFilters={!!(reportMode || reportIntakeGuid || reportSearch)} onClearFilters={() => { setReportMode(''); setReportIntakeGuid(''); setReportSearch('') }} />
                        : reportItems.map(r => (
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
              <Pagination page={reportPage} totalPages={reportTotalPages} totalCount={reportTotal} itemLabel="students" onPageChange={setReportPage} />
            </>
          )}
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <LearningModeContent />
    </Suspense>
  )
}
