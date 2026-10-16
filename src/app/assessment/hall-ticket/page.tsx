'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { Toast } from '@/components/Toast'
import { TableLoadingState } from '@/components/TableLoadingState'
import { BaselinePanel } from '@/components/student/BaselinePanel'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useProgramDropdown } from '@/hooks/academic/useProgramMaster'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import {
  useHallTicketSearch,
  useHallTicketEligibility,
  useHallTicketScopeStudents,
  useIssueHallTicket,
  useBulkIssueHallTickets,
  BulkIssueResponseDto,
  HallTicketIssueStatus,
  HallTicketTerm,
} from '@/hooks/assessment/useHallTicket'
import type { HallTicketSearchResultDto } from '@/lib/api/student/hallTicketSearch'

// Hall Ticket Eligibility & Issue (pages/assessment/hall-ticket-eligibility-
// and-issue-page.md) — successor to legacy frmTrnUEHallTicketIssue. This
// page only ISSUES; printing lives on /assessment/hall-print (one student)
// and /assessment/hall-ticket-print-all (whole intake).
//  1. Intake + term — sent with every call.
//  2. Search → GET /students/hall-ticket-search (registered students of the intake).
//  3. Select a row → GET /eligibility, one call for every clearance.
//  4. Issue → POST /, shown only when canIssue (the server re-checks).
//  5/6. Bulk issue + issue status → POST /bulk and GET /bulk in one modal,
//     scoped to the intake or one program/semester.

const PAGE_SIZE = 10
const TERM_OPTIONS = [{ value: '1', label: 'Term 1' }, { value: '2', label: 'Term 2' }]
const STATUS_OPTIONS = [
  { value: '', label: 'All students' },
  { value: 'NotIssued', label: 'Not issued' },
  { value: 'Issued', label: 'Issued' },
]

export default function HallTicketIssuancePage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ---- Scope ---------------------------------------------------------------
  // Hall tickets are only issued for the current academic intake — the field
  // is locked to it, not a choice.
  const { data: intakes = [], isLoading: intakesLoading } = useIntakesDropdown()
  const currentIntake = intakes.find(i => i.currentIntake)
  const intakeGuid = currentIntake?.intakeGuid ?? ''
  const intakeLabel = currentIntake ? (currentIntake.description ? `${currentIntake.description} (${currentIntake.intakeCode})` : String(currentIntake.intakeCode)) : ''
  const [term, setTerm] = useState<HallTicketTerm>(1)

  // ---- Search --------------------------------------------------------------
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { if (searchInput.trim() !== search) { setSearch(searchInput.trim()); setPage(1) } }, 400)
    return () => clearTimeout(t)
  }, [searchInput, search])
  const { data: students = [], isFetching: searching, isError: searchError } = useHallTicketSearch(search, intakeGuid || null)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE))
  const pageRows = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ---- Selected student ----------------------------------------------------
  // Kept across term changes — eligibility is keyed by term, so the
  // clearance card re-checks the same student.
  const [selected, setSelected] = useState<HallTicketSearchResultDto | null>(null)
  const { data: elig, isFetching: checking, isError: eligError, error: eligErr } = useHallTicketEligibility(selected?.studentGuid ?? null, intakeGuid || null, term)
  const issue = useIssueHallTicket()

  function handleIssue() {
    if (!selected || !elig?.canIssue) return
    issue.mutate({ studentGuid: selected.studentGuid, intakeGuid, term }, {
      // "Already issued" is a success too — the server refreshed the
      // existing ticket's issue date rather than creating a new one.
      onSuccess: ({ alreadyIssued }) => {
        const who = selected.studentName ?? 'the student'
        showToast(alreadyIssued ? `${who} already had a Term ${term} hall ticket — its issue date has been updated to today.` : `Hall ticket issued to ${who}.`, 'ok')
        // Per the page doc: clear the selection and the search box.
        setSelected(null); setSearchInput(''); setSearch('')
      },
      // A 400 here means a clearance changed since the check, or Finance
      // couldn't be reached on the server's re-check.
      onError: (e: Error) => showToast(e.message || 'Could not issue the hall ticket.', 'error'),
    })
  }

  const [bulkOpen, setBulkOpen] = useState(false)

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Hall Ticket Issuance</div><div className="pg-sub">Check a student&apos;s exam clearances and issue their University Exam hall ticket</div></div>
          <button className="btn btn-neu" onClick={() => setBulkOpen(true)} disabled={!intakeGuid}><i className="lni lni-ticket"></i> Bulk Issue &amp; Status</button>
        </div>

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="fg">
              <label className="lbl">Academic Intake</label>
              {/* readOnly, not disabled — the field has a real value, and the
                  grey .ctrl:disabled style reads as "unavailable". The lock
                  icon says it's fixed. */}
              <div className="inp-wrap">
                <i className="lni lni-lock-alt inp-icon"></i>
                <input
                  className="ctrl"
                  value={intakesLoading ? 'Loading…' : intakeLabel || 'No current intake set'}
                  readOnly
                  tabIndex={-1}
                  style={{ cursor: 'default', fontWeight: 600 }}
                  title="Hall tickets are issued for the current academic intake only"
                />
              </div>
              {!intakesLoading && !currentIntake && (
                <p className="text-clr-red" style={{ fontSize: 11.5, marginTop: 4 }}>No intake is marked as the current academic intake. Set one in Intake Master to issue hall tickets.</p>
              )}
            </div>
            <div className="fg">
              <label className="lbl">Term <span className="req">*</span></label>
              <SearchSelect options={TERM_OPTIONS} value={String(term)} onChange={v => setTerm(v === '2' ? 2 : 1)} />
            </div>
            <div className="fg">
              <label className="lbl">Search Student</label>
              <div className="inp-wrap">
                <i className="lni lni-search-alt inp-icon"></i>
                <input className="ctrl" placeholder="Student No., Reg No. or name…" value={searchInput} onChange={e => setSearchInput(e.target.value)} disabled={!intakeGuid} />
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <>
            <BaselinePanel
              label="Selected Student"
              items={[
                { label: 'Student', value: elig?.studentName ?? selected.studentName ?? '—' },
                { label: 'Reg No.', value: selected.studentRegNo ?? '—', accent: true },
                { label: 'Programme', value: selected.programName || '—' },
                { label: 'Semester', value: selected.semCode || '—' },
                { label: 'Batch', value: selected.batchCode || '—' },
              ]}
            />
            <div className="card">
              <div className="card-hdr">
                <div className="card-title"><i className="lni lni-checkmark-circle"></i> Clearance — Term {term}</div>
                <button className="btn btn-neu btn-sm" onClick={() => setSelected(null)}><i className="lni lni-close"></i> Clear</button>
              </div>
              {checking ? (
                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Checking clearances…</div>
              ) : eligError || !elig ? (
                // A Finance status (fee / Guild / NCHE) or the course unit
                // lookup couldn't load — the API fails with a 400 naming it
                // rather than reporting "not cleared", so show it as an
                // error, never as a red clearance line.
                <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}>
                  <i className="lni lni-warning"></i> {eligErr instanceof Error && eligErr.message ? eligErr.message : 'Couldn’t check eligibility. Please try again.'}
                </div>
              ) : elig.alreadyIssued ? (
                <div className="info-box">
                  <i className="lni lni-checkmark-circle" style={{ color: 'var(--green)', fontSize: 15, flexShrink: 0 }}></i>
                  <div style={{ fontSize: 12.5 }}>
                    Hall ticket already issued for Term {term}.{' '}
                    <Link href="/assessment/hall-print" style={{ color: 'var(--b700)', fontWeight: 600 }}>Print it on Hall Ticket Print →</Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                    <ClearanceLine
                      label="Fee clearance"
                      ok={elig.feeOk}
                      note={elig.isFeeExcepted ? 'No fee clearance needed' : elig.isExempted ? 'Exemption student' : `Needs ${term === 1 ? '50%' : '100%'} of fees paid`}
                    />
                    <ClearanceLine label="Coursework" ok={elig.cwOk} note="First coursework submitted on every unit with coursework" />
                    <ClearanceLine label="Class test" ok={elig.ctOk} note="First class test submitted on every unit with a mid-semester test" />
                    {/* Term 2 only — both are null for Term 1. */}
                    {elig.guildOk !== null && <ClearanceLine label="Guild fee" ok={elig.guildOk} note="Current-semester Guild fee paid" />}
                    {elig.ncheOk !== null && <ClearanceLine label="NCHE" ok={elig.ncheOk} note="NCHE status for the semester is Paid" />}
                  </div>
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                    {elig.canIssue ? (
                      <button className="btn btn-primary" onClick={handleIssue} disabled={issue.isPending}>
                        <i className="lni lni-ticket"></i> {issue.isPending ? 'Issuing…' : 'Issue Hall Ticket'}
                      </button>
                    ) : (
                      <span className="badge badge-red"><i className="lni lni-ban"></i> Not eligible — clear the failing items above first</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><i className="lni lni-users"></i> Students</div>
            {students.length > 0 && <span className="badge badge-blue">{students.length} found</span>}
          </div>
          <ScrollTable>
            <table>
              <thead><tr><th>Reg No.</th><th>Name</th><th>Programme</th><th>Semester</th><th>Batch</th></tr></thead>
              <tbody>
                {!search ? (
                  <tr><td colSpan={5} className="text-g400 text-center" style={{ padding: 24 }}>Search for a student by number or name to check their clearances.</td></tr>
                ) : searching && students.length === 0 ? (
                  <TableLoadingState colSpan={5} />
                ) : searchError ? (
                  <tr><td colSpan={5} className="text-clr-red text-center" style={{ padding: 24 }}><i className="lni lni-warning"></i> Couldn&apos;t search students. Please try again.</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={5} className="text-g400 text-center" style={{ padding: 24 }}>No registered student of this intake matches &quot;{search}&quot;.</td></tr>
                ) : pageRows.map(s => (
                  <tr key={s.studentGuid} onClick={() => setSelected(s)} style={{ cursor: 'pointer', background: selected?.studentGuid === s.studentGuid ? 'var(--b50)' : undefined }}>
                    <td className="font-mono">{s.studentRegNo ?? '—'}</td>
                    <td className="font-semibold">{s.studentName ?? '—'}</td>
                    <td>{s.programName || '—'}</td>
                    <td>{s.semCode || '—'}</td>
                    <td>{s.batchCode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          {students.length > PAGE_SIZE && <Pagination page={page} totalPages={totalPages} totalCount={students.length} itemLabel="students" onPageChange={setPage} />}
        </div>
      </div>

      <BulkIssueModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        intakeGuid={intakeGuid}
        intakeLabel={intakeLabel}
        term={term}
        showToast={showToast}
      />
      <Toast toast={toast} />
    </>
  )
}

function ClearanceLine({ label, ok, note }: { label: string; ok: boolean; note: string }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: '8px 10px', borderRadius: 'var(--rsm)', border: `1px solid var(--${ok ? 'green' : 'red'}-bd)`, background: `var(--${ok ? 'green' : 'red'}-bg)` }}>
      <i className={`lni ${ok ? 'lni-checkmark-circle' : 'lni-cross-circle'}`} style={{ color: `var(--${ok ? 'green' : 'red'})`, fontSize: 18, flexShrink: 0 }}></i>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{label} — {ok ? 'Cleared' : 'Not cleared'}</div>
        <div className="text-g500" style={{ fontSize: 11 }}>{note}</div>
      </div>
    </div>
  )
}

// Bulk issue (POST /bulk) + issue status list (GET /bulk), per steps 5–6:
// filter Not issued, bulk issue, and the list reloads to show who's left.
// Program + semester narrow the scope; leaving program empty = whole intake.
function BulkIssueModal({ isOpen, onClose, intakeGuid, intakeLabel, term, showToast }: {
  isOpen: boolean
  onClose: () => void
  intakeGuid: string
  intakeLabel: string
  term: HallTicketTerm
  showToast: (msg: string, type?: string) => void
}) {
  const [programGuid, setProgramGuid] = useState('')
  const [semesterGuid, setSemesterGuid] = useState('')
  const [status, setStatus] = useState<HallTicketIssueStatus | ''>('NotIssued')
  const [summary, setSummary] = useState<BulkIssueResponseDto | null>(null)
  const [page, setPage] = useState(1)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  useEffect(() => { if (isOpen) { setSummary(null); setPage(1); setShowConfirmModal(false) } }, [isOpen])

  const { data: programs = [] } = useProgramDropdown(undefined, isOpen)
  const { data: semesters = [] } = useSemestersForProgram(programGuid || null, isOpen)
  // The API needs program and semester together — a program alone isn't a scope.
  const scopeIncomplete = !!programGuid && !semesterGuid
  const scope = { intakeGuid, term, programGuid: programGuid || null, semesterGuid: semesterGuid || null }
  const { data: rows = [], isFetching, isError } = useHallTicketScopeStudents(scope, status || null, isOpen && !scopeIncomplete)
  const bulk = useBulkIssueHallTickets()
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  if (!isOpen) return null

  const scopeLabel = programGuid
    ? `${programs.find(p => p.programGuid === programGuid)?.programName ?? 'programme'}${semesterGuid ? ` · ${semesters.find(s => s.semesterGuid === semesterGuid)?.semName ?? ''}` : ''}`
    : `the whole of ${intakeLabel || 'this intake'}`

  function handleBulkIssue() {
    if (scopeIncomplete || !intakeGuid) return
    setShowConfirmModal(true)
  }

  function confirmBulkIssue() {
    setShowConfirmModal(false)
    setSummary(null)
    bulk.mutate(scope, {
      onSuccess: res => { setSummary(res); setPage(1) },
      onError: (e: Error) => showToast(e.message || 'Bulk issue failed.', 'error'),
    })
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-xl" style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr"><div className="modal-title"><i className="lni lni-ticket"></i> Bulk Issue &amp; Status — Term {term}</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="fg">
              <label className="lbl">Programme</label>
              <SearchSelect
                placeholder="All programmes"
                options={[{ value: '', label: 'All programmes (whole intake)' }, ...programs.map(p => ({ value: p.programGuid, label: p.programName }))]}
                value={programGuid}
                onChange={v => { setProgramGuid(v); setSemesterGuid(''); setPage(1) }}
              />
            </div>
            <div className="fg">
              <label className="lbl">Semester {programGuid && <span className="req">*</span>}</label>
              <SearchSelect
                placeholder={programGuid ? '— Select Semester —' : 'Pick a programme first'}
                options={semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))}
                value={semesterGuid}
                onChange={v => { setSemesterGuid(v); setPage(1) }}
                disabled={!programGuid}
              />
            </div>
            <div className="fg">
              <label className="lbl">Show</label>
              <SearchSelect options={STATUS_OPTIONS} value={status} onChange={v => { setStatus(v as HallTicketIssueStatus | ''); setPage(1) }} />
            </div>
          </div>

          {summary && (
            <div className="info-box mb-3">
              <i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i>
              <div style={{ fontSize: 12.5 }}>
                <strong>{summary.totalConsidered}</strong> considered — <strong style={{ color: 'var(--green)' }}>{summary.issued}</strong> issued,{' '}
                <strong>{summary.alreadyIssued}</strong> already issued, <strong style={{ color: 'var(--amber)' }}>{summary.ineligible}</strong> ineligible,{' '}
                <strong style={{ color: 'var(--red)' }}>{summary.failed}</strong> failed.
                {summary.alreadyIssued > 0 && ' Students who already had a ticket were skipped (their issue date is unchanged).'}
                {summary.ineligible > 0 && ' Ineligible means a clearance came back not cleared — select the student on the main page to see which one.'}
                {summary.failed > 0 && ' Failed means the check couldn’t be completed — for example a fee status could not be loaded from Finance — not that the student is ineligible. Select one on the main page to see the error, and retry once it’s fixed.'}
              </div>
            </div>
          )}

          {scopeIncomplete ? (
            <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Pick a semester to scope to this programme.</div>
          ) : (
            <>
              <ScrollTable>
                <table>
                  <thead><tr><th>Reg No.</th><th>Name</th><th>Status</th><th>Programme</th><th>Sem</th><th>Batch</th></tr></thead>
                  <tbody>
                    {isFetching && rows.length === 0 ? (
                      <TableLoadingState colSpan={6} />
                    ) : isError ? (
                      <tr><td colSpan={6} className="text-clr-red text-center" style={{ padding: 24 }}><i className="lni lni-warning"></i> Couldn&apos;t load students. Please try again.</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={6} className="text-g400 text-center" style={{ padding: 24 }}>No students {status === 'Issued' ? 'with an issued ticket' : status === 'NotIssued' ? 'left without a ticket' : ''} in this scope.</td></tr>
                    ) : rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(r => (
                      <tr key={r.studentGuid}>
                        <td className="font-mono">{r.studentRegNo ?? '—'}</td>
                        <td>{r.studentName ?? '—'}</td>
                        <td><span className={`badge ${r.status === 'Issued' ? 'badge-green' : 'badge-amber'}`}>{r.status === 'Issued' ? 'Issued' : 'Not issued'}</span></td>
                        <td>{r.programName || '—'}</td>
                        <td>{r.semCode || '—'}</td>
                        <td>{r.batchCode || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
              {rows.length > PAGE_SIZE && <Pagination page={page} totalPages={totalPages} totalCount={rows.length} itemLabel="students" onPageChange={setPage} />}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose} disabled={bulk.isPending}>Close</button>
          <button className="btn btn-primary" onClick={handleBulkIssue} disabled={bulk.isPending || scopeIncomplete || !intakeGuid}>
            <i className="lni lni-ticket"></i> {bulk.isPending ? 'Issuing…' : 'Bulk Issue'}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div
          className="perm-delete-overlay"
          style={{ position: 'fixed', zIndex: 600 }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div
              className="perm-delete-icon"
              style={{
                background: 'var(--b50)',
                border: '1.5px solid var(--b200)',
                color: 'var(--b700)',
              }}
            >
              <i className="lni lni-ticket" />
            </div>
            <div className="perm-delete-title">Confirm Bulk Issuance</div>
            <div className="perm-delete-sub">
              Issue Term {term} hall tickets to every eligible student in {scopeLabel}? Students who already have one are skipped. This may take a while.
            </div>
            <div className="perm-delete-actions">
              <button
                type="button"
                className="btn btn-neu"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmBulkIssue}
              >
                <i className="lni lni-ticket"></i> Issue Hall Tickets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
