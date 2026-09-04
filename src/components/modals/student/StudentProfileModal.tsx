'use client'
import { ModalProps } from '../types'
import { useStudent } from '@/hooks/student/useStudents'
import { useCountries } from '@/hooks/config/useCountries'

interface Props extends ModalProps {
  studentGuid: string | null
}

// Field mapping confirmed against a real GET /api/v1/students/:guid
// response (2026-08-31) — a flatter shape than StudentDetailDto's original
// fields (regNo not studentRegNo, batch not batchCode, programme not
// programName, plus faculty/campus/email/phone/nationality*/gender/sponsor/
// learningMode, none of which existed on the DTO before). That response
// carried none of the old iStatus/regStatusName/discount fields, so the old
// "Registration & Academic Status" section (raw status codes + discount
// breakdown) had nothing left to show and is replaced with a Contact &
// Personal section reflecting what the endpoint actually returns. The old
// fields are kept on the type (see student.ts) for Profile/Programme
// Transfer, which still read them — this modal just doesn't rely on them.
export function StudentProfileModal({ isOpen, onClose, studentGuid }: Props) {
  const { data: student, isLoading, isError } = useStudent(studentGuid, isOpen)
  // Country Master's own catalogue (config/country-master) — nationality/
  // nationalityCode have both come back null on real responses that still
  // carried a country guid, on live data confirmed live 2026-09-01: neither
  // that guid nor students/students/get-student-by-guid.md's own documented
  // applicationSummary.countryGuid matched any row here, so this app has no
  // catalogue that actually resolves that guid — see the comment on
  // `nationality` below for what that means for the fallback chain.
  const { data: countries } = useCountries()

  if (!isOpen || !studentGuid) return null

  const name = student?.studentName || '—'
  const regNo = student?.regNo ?? student?.studentRegNo ?? '—'
  const programme = student?.programme ?? student?.programName ?? '—'
  const semester = student?.semester ?? student?.semesterName ?? '—'
  const batch = student?.batch ?? student?.batchCode ?? '—'
  // Two different live shapes have carried a country guid under two
  // different field names (nationalityGuid directly on the DTO, or nested
  // under applicationSummary.countryGuid per the newer doc) — both are
  // tried against Country Master's catalogue. Confirmed live (2026-09-01)
  // that at least nationalityGuid's value doesn't match any Country Master
  // row even though that catalogue is fetched successfully elsewhere in the
  // app (Country Master's own page, admission enquiry forms) — so this is
  // very likely not a fetch bug, but either a different/legacy ID space, or
  // a genuinely orphaned guid on this student's record.
  // Note: The user requested to fallback to '—' instead of exposing the raw GUID.
  const nationalityGuidCandidate = student?.nationalityGuid ?? student?.applicationSummary?.countryGuid ?? null
  const nationality = student?.nationality
    ?? student?.nationalityCode
    ?? countries?.find(c => c.countryGuid === nationalityGuidCandidate)?.nationality
    ?? '—'

  return (
    <div className="modal-overlay open">
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title flex items-center gap-2">
            <i className="lni lni-user"></i> Student Profile{student ? <>: <span className="text-b600">{student.studentName}</span></> : null}
          </div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll">
          {isLoading && <div className="text-center text-sm text-g500 py-10">Loading student…</div>}
          {isError && <div className="text-center text-sm text-red-600 py-10">Could not load this student.</div>}

          {student && (
            <>
              <div className="card mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center rounded-full font-bold text-white shrink-0" style={{ width: 64, height: 64, background: 'var(--b500)', fontSize: 22 }}>
                    {(name?.trim()[0] ?? '—').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg text-g900">{name}</div>
                    <div className="text-sm text-g500">{programme} &middot; {semester}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-blue font-mono">{regNo}</span>
                    {student.gender && <span className="badge badge-grey">{student.gender}</span>}
                  </div>
                </div>
              </div>

              <div className="sec-divider">Student Information</div>
              <div className="g3 mb-4">
                <div className="fg"><label className="lbl">Registration No.</label><input className="ctrl font-mono" readOnly value={regNo} /></div>
                <div className="fg"><label className="lbl">Programme</label><input className="ctrl" readOnly value={programme} /></div>
                <div className="fg"><label className="lbl">Semester</label><input className="ctrl" readOnly value={semester} /></div>
                <div className="fg"><label className="lbl">Batch</label><input className="ctrl" readOnly value={batch} /></div>
                <div className="fg"><label className="lbl">Faculty</label><input className="ctrl" readOnly value={student.faculty || '—'} /></div>
                <div className="fg"><label className="lbl">Campus</label><input className="ctrl" readOnly value={student.campus || '—'} /></div>
              </div>

              <div className="sec-divider">Contact &amp; Personal</div>
              <div className="g3">
                <div className="fg"><label className="lbl">Email</label><input className="ctrl" readOnly value={student.email || '—'} /></div>
                <div className="fg"><label className="lbl">Phone</label><input className="ctrl" readOnly value={student.phone || '—'} /></div>
                <div className="fg"><label className="lbl">Nationality</label><input className="ctrl" readOnly value={nationality} /></div>
                <div className="fg"><label className="lbl">Gender</label><input className="ctrl" readOnly value={student.gender || '—'} /></div>
                <div className="fg"><label className="lbl">Sponsor</label><input className="ctrl" readOnly value={student.sponsor || '—'} /></div>
                <div className="fg"><label className="lbl">Learning Mode</label><input className="ctrl" readOnly value={student.learningMode || '—'} /></div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
