'use client'
import { ModalProps } from '../types'
import { useProgramCourseUnits } from '@/hooks/academic/useProgramCourseUnits'

// Backs Programme Master's Home Page "Curriculum" three-dot action (see
// Program_Master_Change_Requests_Final.md) — replaces the old behaviour of
// just navigating to the generic /academic/course-units page, which showed
// every course unit in the system rather than this specific programme's own
// curriculum. Reuses the same GET /api/v1/academic/program-course-units/
// {programGuid} hook already wired for ProgrammeModal's Edit prefill (see
// programCourseUnits.ts) — a flat list of (courseUnit, semester) pairs,
// grouped here by semesterGuid for display.
interface CurriculumModalProps extends ModalProps {
  programGuid: string | null
  programName?: string
}

export function CurriculumModal({ isOpen, onClose, programGuid, programName }: CurriculumModalProps) {
  const { data: rows = [], isLoading } = useProgramCourseUnits(programGuid, isOpen && !!programGuid)

  if (!isOpen) return null

  const semesters: { semesterGuid: string; semName: string; units: typeof rows }[] = []
  rows.forEach(r => {
    let sem = semesters.find(s => s.semesterGuid === r.semesterGuid)
    if (!sem) { sem = { semesterGuid: r.semesterGuid, semName: r.semName, units: [] }; semesters.push(sem) }
    sem.units.push(r)
  })

  return (
    <div className="modal-overlay open" id="curriculum-modal">
      <div className="modal modal-md modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-book"></i> Curriculum{programName ? ` — ${programName}` : ''}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll">
          {isLoading && (
            <div className="text-g400 italic" style={{ fontSize: 12.5, padding: '18px 0' }}>
              <i className="lni lni-reload"></i> Loading curriculum…
            </div>
          )}

          {!isLoading && semesters.length === 0 && (
            <div className="text-g400 italic" style={{ fontSize: 12.5, padding: '18px 0' }}>
              No course units assigned to this programme yet.
            </div>
          )}

          {!isLoading && semesters.length > 0 && (
            <div className="flex flex-col gap-2">
              {semesters.map(sem => (
                <div key={sem.semesterGuid} style={{ border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--b50)', borderBottom: '1px solid var(--b100)' }}>
                    <span className="badge badge-blue">{sem.units.length} unit{sem.units.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--b700)' }}>{sem.semName}</span>
                  </div>
                  <div style={{ padding: '6px 14px' }}>
                    {sem.units.map(u => (
                      <div key={u.courseUnitGuid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--g100)' }}>
                        <span className="font-mono font-bold text-b700" style={{ fontSize: 12, minWidth: 60 }}>{u.courseUnitCode}</span>
                        <span style={{ fontSize: 13, color: 'var(--g700)' }}>{u.courseUnitName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
