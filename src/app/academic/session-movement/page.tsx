'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { ConfirmMovementModal, MovementTarget } from '@/components/modals/academic/ConfirmMovementModal'
import { BulkSessionMovementModal } from '@/components/modals/academic/BulkSessionMovementModal'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { AdmissionIntakeReminderModal } from '@/components/modals/academic/AdmissionIntakeReminderModal'
import { useCurrentAcademicIntake, useCurrentAdmissionIntake, useSearchIntakesInfinite } from '@/hooks/academic/useIntakes'
import { useSearchCampusesInfinite } from '@/hooks/config/useCampuses'
import { flattenUniquePages } from '@/lib/pagination'
import {
  useSessions,
  useExecuteSessionMove,
  useMoveAllSessions,
  useBulkMovementStatus,
  getMovementStatus,
  MovementResult,
  SessionListItemDto,
  BulkMovementStatusDto,
} from '@/hooks/academic/useSessionManagement'
import { AuthError } from '@/lib/api/client'

// Redesigned per the legacy ISMS "Session Management" screen (2026-09-05),
// then wired to the real session-management/*.md endpoints (repo root,
// 2026-09-05): a session/campus filter bar above a paged Admission Intake /
// Programme / Semester grid, one row per session due for movement, each
// paired with a Session Movement status/action in its trailing column.
//
// `intakeGuid` (the Academic Session picked above) is the required scope for
// the list endpoint — Term stays an inert "-Select-" placeholder per the
// list doc's own note ("Reserved filter param — not yet active").
//
// Row states:
//   - sessionMoved: true            → "Session Movement Completed" (terminal)
//   - sessionMoved: false           → "Move Session" button
// Clicking "Move Session" first calls the movement-status pre-flight check
// (get-session-movement-status.md) — a row that LOOKS actionable from the
// list alone can still turn out to be a final semester, have no linked
// students, or belong to an intake whose results aren't published. Only
// `MovementAllowed` opens the confirm dialog; every other result is cached
// locally per sessionGuid so the row settles into that terminal pill instead
// of re-checking on every click.
const RESULT_LABELS: Record<Exclude<MovementResult, 'MovementAllowed'>, string> = {
  AlreadyMoved: 'Session Movement Completed',
  NotPossible: 'Not Possible',
  FinalSemester: 'Final Semester',
  NoStudents: 'No Students',
  ResultsNotPublished: 'Results Not Published',
}

const PAGE_SIZE = 10

// The API can send a blank programName/programCode (and some names carry a
// leading tab), so trim and drop the empty half rather than render "()".
function programmeLabel(row: SessionListItemDto) {
  const name = row.programName?.trim() ?? ''
  const code = row.programCode?.trim() ?? ''
  if (name && code) return `${name} (${code})`
  return name || code || '—'
}

function toTarget(row: SessionListItemDto): MovementTarget {
  return { intake: row.intakeText, programme: programmeLabel(row), semester: row.semesterCode }
}

export default function SessionMovementPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [intakeGuid, setIntakeGuid] = useState('')
  const [campusGuid, setCampusGuid] = useState('')
  const [page, setPage] = useState(1)
  const [intakeSearch, setIntakeSearch] = useState('')
  const [campusSearch, setCampusSearch] = useState('')
  const [committedIntakeSearch, setCommittedIntakeSearch] = useState('')
  const [committedCampusSearch, setCommittedCampusSearch] = useState('')
  const [intakePickerOpen, setIntakePickerOpen] = useState(false)
  const [campusPickerOpen, setCampusPickerOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCommittedIntakeSearch(intakeSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [intakeSearch])

  useEffect(() => {
    const timer = setTimeout(() => setCommittedCampusSearch(campusSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [campusSearch])

  const intakeQuery = useSearchIntakesInfinite(committedIntakeSearch, 20, intakePickerOpen || !intakeGuid)
  const campusQuery = useSearchCampusesInfinite(committedCampusSearch, 20, campusPickerOpen)
  const { data: currentIntake } = useCurrentAcademicIntake()
  const { data: currentAdmissionIntake } = useCurrentAdmissionIntake()
  // Reminder shown once on entering the page: advance the admission intake
  // before moving sessions.
  const [reminderOpen, setReminderOpen] = useState(true)
  const intakes = useMemo(() => {
    const items = flattenUniquePages(intakeQuery.data?.pages ?? [], i => i.intakeGuid)
    if (currentIntake && !items.some(i => i.intakeGuid === currentIntake.intakeGuid)) items.unshift(currentIntake)
    return items
  }, [currentIntake, intakeQuery.data])
  const campuses = useMemo(() => flattenUniquePages(campusQuery.data?.pages ?? [], c => c.campusGuid), [campusQuery.data])

  // Default to whichever intake is flagged current, once intakes load — same
  // "don't make the user hunt for today's session" convenience Intake
  // Master's own hero cards use (useCurrentAcademicIntake), just resolved
  // inline here since this page only needs the guid, not the full record.
  useEffect(() => {
    if (intakeGuid) return
    if (currentIntake) {
      setIntakeGuid(currentIntake.intakeGuid)
    } else if (intakes.length > 0) {
      setIntakeGuid(intakes[0].intakeGuid)
    }
  }, [currentIntake, intakeGuid, intakes])

  useEffect(() => setPage(1), [intakeGuid, campusGuid])

  const { data: sessionList, isLoading, isError } = useSessions(
    { intakeGuid, campusGuid: campusGuid || undefined, pageNumber: page, pageSize: PAGE_SIZE },
    !!intakeGuid,
  )
  const rows = sessionList?.items ?? []
  const totalPages = sessionList?.totalPages ?? 1

  const selectedIntakeLabel = intakes.find(i => i.intakeGuid === intakeGuid)
    ? `${intakes.find(i => i.intakeGuid === intakeGuid)!.description} (${intakes.find(i => i.intakeGuid === intakeGuid)!.intakeCode})`
    : ''

  // Per-row pre-flight results that turned out NOT to be MovementAllowed —
  // cached so a "Final Semester"/"No Students"/etc. row settles into that
  // pill instead of re-hitting movement-status on every render or click.
  // Cleared whenever the underlying list refetches with different rows
  // (new intake/campus/page), since a stale guid→result mapping from a
  // previous page would otherwise leak into a completely different set of
  // rows sharing no relationship to it.
  const [blockedResults, setBlockedResults] = useState<Record<string, Exclude<MovementResult, 'MovementAllowed'>>>({})
  useEffect(() => setBlockedResults({}), [intakeGuid, campusGuid, page])
  const [checkingGuid, setCheckingGuid] = useState<string | null>(null)

  const [confirmTarget, setConfirmTarget] = useState<MovementTarget | null>(null)
  const [confirmSessionGuid, setConfirmSessionGuid] = useState<string | null>(null)
  const executeMove = useExecuteSessionMove()

  async function handleMoveClick(row: SessionListItemDto) {
    setCheckingGuid(row.sessionGuid)
    try {
      const status = await getMovementStatus(row.sessionGuid)
      if (status.result === 'MovementAllowed') {
        setConfirmSessionGuid(row.sessionGuid)
        setConfirmTarget(toTarget(row))
      } else {
        // Captured into a local first — TS's control-flow narrowing of a
        // property access (status.result) doesn't persist once read inside
        // the nested setBlockedResults closure below, only a plain
        // variable's does.
        const result = status.result
        setBlockedResults(prev => ({ ...prev, [row.sessionGuid]: result }))
        showToast(status.description, result === 'AlreadyMoved' ? 'success' : 'warn')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not check movement status. Please try again.', 'error')
    } finally {
      setCheckingGuid(null)
    }
  }

  function closeConfirm() {
    setConfirmSessionGuid(null)
    setConfirmTarget(null)
  }

  function executeSingleMove() {
    if (!confirmSessionGuid) return
    const row = rows.find(r => r.sessionGuid === confirmSessionGuid)
    executeMove.mutate(confirmSessionGuid, {
      onSuccess: () => {
        showToast(row ? `Session movement completed — ${row.programName}, Semester ${row.semesterCode}.` : 'Session movement completed.', 'success')
        closeConfirm()
      },
      onError: (err: Error) => showToast(err instanceof AuthError ? err.message : (err.message || 'Failed to execute session movement.'), 'error'),
    })
  }

  // Bulk Session Movement — intake-scoped (move-all takes no per-row target
  // list; the server decides eligibility itself), confirm → running →
  // results, all in one modal (BulkSessionMovementModal).
  const [bulkPhase, setBulkPhase] = useState<'confirm' | 'result' | null>(null)
  const [bulkMovementGuid, setBulkMovementGuid] = useState<string | null>(null)
  const moveAll = useMoveAllSessions()
  const { data: bulkStatus, isLoading: isBulkStatusLoading } = useBulkMovementStatus(bulkMovementGuid, bulkPhase === 'result')
  const isBulkRunning = moveAll.isPending || (bulkPhase === 'result' && (isBulkStatusLoading || bulkStatus?.status === 'InProgress'))

  function openBulkConfirm() {
    if (!intakeGuid) { showToast('Select an Academic Session first.', 'warn'); return }
    setBulkMovementGuid(null)
    setBulkPhase('confirm')
  }

  function executeBulkMove() {
    moveAll.mutate(intakeGuid, {
      onSuccess: res => {
        setBulkMovementGuid(res.bulkMovementGuid)
        setBulkPhase('result')
      },
      onError: (err: Error) => {
        showToast(err instanceof AuthError ? err.message : (err.message || 'Failed to start bulk session movement.'), 'error')
        setBulkPhase(null)
      },
    })
  }

  function closeBulk() {
    setBulkPhase(null)
    setBulkMovementGuid(null)
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Session Movement</div>
            <div className="pg-sub">Move eligible students to the next semester, one session at a time or in bulk for the whole intake</div>
          </div>        </div>

        <div className="card mb-[18px]">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> Session Management</div>
          </div>
          <div className="g2">
            <div className="fg">
              <div className="lbl">Academic Session <span className="req">*</span></div>
              <SearchSelect
                options={intakes.map(i => ({ value: i.intakeGuid, label: `${i.description} (${i.intakeCode})` }))}
                value={intakeGuid}
                onSearch={setIntakeSearch}
                onOpenChange={setIntakePickerOpen}
                isLoading={intakeQuery.isLoading}
                hasNextPage={intakeQuery.hasNextPage}
                isFetchingNextPage={intakeQuery.isFetchingNextPage}
                onLoadMore={() => intakeQuery.fetchNextPage()}
                onChange={setIntakeGuid}
              />
            </div>
            <div className="fg">
              <div className="lbl">Campus</div>
              <SearchSelect
                placeholder="All Campuses"
                options={campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))}
                value={campusGuid}
                onSearch={setCampusSearch}
                onOpenChange={setCampusPickerOpen}
                isLoading={campusQuery.isLoading}
                hasNextPage={campusQuery.hasNextPage}
                isFetchingNextPage={campusQuery.isFetchingNextPage}
                onLoadMore={() => campusQuery.fetchNextPage()}
                onChange={setCampusGuid}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-reload"></i></span> Session Movement</div>
            {/* Bulk action — intake-scoped, no per-row selection: the server
                decides which sessions are eligible when the run executes. */}
            <button className="btn btn-primary btn-sm" disabled={!intakeGuid} onClick={openBulkConfirm}>
              <i className="lni lni-reload"></i> Bulk Session Movement
            </button>
          </div>

          {!intakeGuid ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Select an Academic Session to load sessions.</div>
          ) : (
            <>
              <ScrollTable>
                <table>
                  <thead><tr><th style={{ textAlign: 'left' }}>Admission Intake</th><th>Programme</th><th>Semester</th><th>Session Movement</th></tr></thead>
                  <tbody>
                    {isLoading
                      ? <TableLoadingState colSpan={999} title="Loading sessions…" subtitle="Fetching the latest sessions, just a moment." />
                      : isError
                        ? <EmptyState colSpan={999} title="Couldn't load sessions" subtitle="Something went wrong fetching this list. Please try again." />
                        : rows.length === 0
                          ? <EmptyState colSpan={999} title="No sessions found" subtitle="No sessions match this intake/campus." />
                          : null}
                    {!isLoading && !isError && rows.map(r => {
                      const blocked = blockedResults[r.sessionGuid]
                      const isChecking = checkingGuid === r.sessionGuid
                      return (
                        <tr key={r.sessionGuid}>
                          <td className="font-bold" style={{ textAlign: 'left' }}>{r.intakeText}</td>
                          <td>
                            {r.programName?.trim() || (r.programCode?.trim() ? null : <span className="text-g400">—</span>)}
                            {r.programCode?.trim() && <> <span className="text-g400">({r.programCode.trim()})</span></>}
                          </td>
                          <td className="font-bold">{r.semesterCode}</td>
                          <td>
                            {r.sessionMoved || blocked === 'AlreadyMoved' ? (
                              <span className="badge badge-blue" style={{ width: '100%', justifyContent: 'center', padding: '8px 10px', display: 'flex' }}>
                                <i className="lni lni-checkmark"></i>&nbsp;Session Movement Completed
                              </span>
                            ) : blocked ? (
                              <span
                                className={`badge ${blocked === 'ResultsNotPublished' ? 'badge-amber' : 'badge-grey'}`}
                                style={{ width: '100%', justifyContent: 'center', padding: '8px 10px', display: 'flex' }}
                              >
                                {RESULT_LABELS[blocked]}
                              </span>
                            ) : (
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ width: '100%', justifyContent: 'center', borderRadius: 999 }}
                                disabled={isChecking}
                                onClick={() => handleMoveClick(r)}
                              >
                                <i className="lni lni-reload"></i> {isChecking ? 'Checking…' : 'Move Session'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollTable>
              <Pagination page={page} totalPages={totalPages} totalCount={sessionList?.totalCount ?? 0} itemLabel="sessions" onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <ConfirmMovementModal
        isOpen={!!confirmTarget}
        onClose={closeConfirm}
        showToast={showToast}
        target={confirmTarget}
        onConfirm={executeSingleMove}
        isSubmitting={executeMove.isPending}
      />
      <BulkSessionMovementModal
        isOpen={bulkPhase !== null}
        onClose={closeBulk}
        showToast={showToast}
        intakeLabel={selectedIntakeLabel}
        phase={bulkPhase ?? 'confirm'}
        isRunning={isBulkRunning}
        result={(bulkStatus as BulkMovementStatusDto) ?? null}
        onConfirm={executeBulkMove}
      />
      <AdmissionIntakeReminderModal
        isOpen={reminderOpen}
        onClose={() => setReminderOpen(false)}
        showToast={showToast}
        nav={id => router.push('/academic/' + id)}
        academicIntake={currentIntake}
        admissionIntake={currentAdmissionIntake}
        sameIntake={!!currentIntake && !!currentAdmissionIntake && currentIntake.intakeGuid === currentAdmissionIntake.intakeGuid}
      />
      <Toast toast={toast} />
    </>
  )
}
