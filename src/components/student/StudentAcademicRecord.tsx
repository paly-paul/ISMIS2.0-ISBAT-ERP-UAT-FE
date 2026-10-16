'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { useCreditAccumulation, useProgramUnits } from '@/hooks/student/useAcademicRecord'
import type { UnitPassStatus } from '@/lib/api/student/academicRecord'

// Staff-side view of a student's academic record, laid out like the student
// portal's "My Academic Record": credits summary on top (credit-accumulation),
// then one collapsible row per semester with its units (program-units). The
// two calls load and fail independently, so one failing doesn't blank the
// other — see lib/api/student/academicRecord.ts.

const UNIT_BADGE: Record<UnitPassStatus, { cls: string; label: string }> = {
  Pass: { cls: 'badge-green', label: 'Pass' },
  Fail: { cls: 'badge-red', label: 'Fail' },
  RL: { cls: 'badge-amber', label: 'Result Late' },
  Pending: { cls: 'badge-grey', label: 'Pending' },
}

function formatMarks(scored: number | null, max: number | null) {
  if (scored == null) return '—'
  return max != null ? `${scored} / ${max}` : `${scored}`
}

// SVG progress ring — r=26 gives a circumference of ~163.4.
function CreditsRing({ percent }: { percent: number }) {
  const c = 2 * Math.PI * 26
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r="26" stroke="var(--g200)" strokeWidth="6" fill="none" />
        <circle cx="32" cy="32" r="26" stroke="var(--b500)" strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * percent) / 100} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--g900)' }}>{percent}%</span>
        <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.05em' }}>EARNED</span>
      </div>
    </div>
  )
}

export function StudentAcademicRecord({ studentGuid }: { studentGuid: string }) {
  const { data: credits, isLoading: creditsLoading, isError: creditsError, error: creditsErrorObj } = useCreditAccumulation(studentGuid)
  const { data: record, isLoading: unitsLoading, isError: unitsError, error: unitsErrorObj } = useProgramUnits(studentGuid)
  // null = untouched, so the server's autoExpandSemesterIndex decides.
  const [openSemesters, setOpenSemesters] = useState<Set<string> | null>(null)

  const defaultOpen = record?.semesters[record.autoExpandSemesterIndex]?.semesterGuid
  const open = openSemesters ?? new Set(defaultOpen ? [defaultOpen] : [])
  function toggle(guid: string) {
    const next = new Set(open)
    if (next.has(guid)) next.delete(guid); else next.add(guid)
    setOpenSemesters(next)
  }

  const percent = Math.max(0, Math.min(100, credits?.creditPercentage ?? 0))

  return (
    <div>
      {/* Credits summary */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {creditsLoading ? (
          <div className="text-g400" style={{ fontSize: 12.5 }}>Loading credit summary…</div>
        ) : creditsError || !credits ? (
          <div style={{ fontSize: 12.5, color: 'var(--g500)' }}>
            <i className="lni lni-warning" style={{ color: 'var(--amber)' }}></i> Couldn&apos;t load the credit summary{creditsErrorObj instanceof Error && creditsErrorObj.message ? ` — ${creditsErrorObj.message}` : ''}.
          </div>
        ) : (
          <>
            <CreditsRing percent={percent} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--g900)' }}>{credits.earnedCredit} / {credits.totalCredit} Credits Earned</div>
              {record?.programGroupName && <div style={{ fontSize: 12.5, color: 'var(--g500)', marginTop: 2 }}>{record.programGroupName}</div>}
            </div>
          </>
        )}
      </div>

      {/* Semesters */}
      {unitsLoading ? (
        <div className="empty"><div className="empty-title">Loading academic record…</div></div>
      ) : unitsError || !record ? (
        <div className="empty">
          <div className="empty-icon"><i className="lni lni-warning"></i></div>
          <div className="empty-title">Couldn&apos;t load the academic record</div>
          {unitsErrorObj instanceof Error && unitsErrorObj.message && <div className="empty-sub">{unitsErrorObj.message}</div>}
        </div>
      ) : record.semesters.length === 0 ? (
        <div className="empty"><div className="empty-title">No curriculum units on record</div></div>
      ) : record.semesters.map(sem => {
        const isOpen = open.has(sem.semesterGuid)
        return (
          <div key={sem.semesterGuid} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
            <div
              onClick={() => toggle(sem.semesterGuid)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
            >
              <i className={`lni lni-chevron-${isOpen ? 'down' : 'right'}`} style={{ fontSize: 11, color: 'var(--g400)' }}></i>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--b500)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="lni lni-book"></i>
              </span>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--g900)', flex: 1 }}>{sem.semesterName}</span>
              {sem.isCurrentSemester && <span className="badge badge-blue">Current</span>}
              <span style={{ fontSize: 11.5, color: 'var(--g400)', whiteSpace: 'nowrap' }}>{sem.units.length} units · {sem.totalSemesterCredit} credits</span>
            </div>
            {isOpen && (
              sem.units.length === 0 ? (
                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No units in this semester.</div>
              ) : (
                <ScrollTable>
                  <table>
                    <thead><tr><th>Code</th><th style={{ textAlign: 'left' }}>Unit Name</th><th>Credits</th><th>IA Marks</th><th>UE Marks</th><th>Status</th></tr></thead>
                    <tbody>
                      {sem.units.map(u => {
                        const badge = UNIT_BADGE[u.passStatus] ?? { cls: 'badge-grey', label: u.passStatus }
                        return (
                          <tr key={u.courseUnitGuid}>
                            <td className="font-mono">{u.unitCode}</td>
                            <td style={{ textAlign: 'left', fontWeight: 600 }}>{u.unitName}</td>
                            <td>{u.credit}</td>
                            <td>{formatMarks(u.iaMarksScored, u.iaMaxMarks)}</td>
                            <td>{formatMarks(u.ueMarksScored, u.ueMaxMarks)}</td>
                            <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </ScrollTable>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
