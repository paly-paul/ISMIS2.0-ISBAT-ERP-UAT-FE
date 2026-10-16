'use client'
import { ModalProps } from '../types'

interface IntakeSummary {
  description: string
  intakeCode: string | number
}

interface AdmissionIntakeReminderModalProps extends ModalProps {
  academicIntake: IntakeSummary | null | undefined
  admissionIntake: IntakeSummary | null | undefined
  // True when both "current" flags point at the same intake — i.e. the
  // admission intake hasn't been moved forward yet.
  sameIntake: boolean
}

function label(i: IntakeSummary | null | undefined) {
  return i ? `${i.description} (${i.intakeCode})` : '—'
}

// Shown on entering Session Movement: moving sessions forward assumes the
// admission intake has already been advanced to the next intake, so remind
// the user to do that first in Intake Master.
export function AdmissionIntakeReminderModal({ isOpen, onClose, nav, academicIntake, admissionIntake, sameIntake }: AdmissionIntakeReminderModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay open">
      <div className="modal modal-sm" id="admission-intake-reminder-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-information"></i> Before You Move Sessions</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.6, color: 'var(--g700)' }}>
            Please change the <strong>Admission Intake</strong> to the next intake before running session movement.
            For example, if the current Academic and Admission Intake are both <strong>2026 Spring</strong>, set the
            Admission Intake to <strong>2026 Fall</strong> first.
          </p>

          <div
            className="bg-[var(--b50)] border border-[var(--b200)] rounded-md"
            style={{ padding: '10px 14px', fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 16, rowGap: 6 }}
          >
            <span className="text-muted">Academic Intake</span><strong>{label(academicIntake)}</strong>
            <span className="text-muted">Admission Intake</span><strong>{label(admissionIntake)}</strong>
          </div>

          {sameIntake && (
            <div className="warn-box" style={{ margin: 0 }}>
              <i className="lni lni-warning"></i> <span>The Admission Intake is still the same as the Academic Intake. Update it in Intake Master before moving sessions.</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {nav && (
            <button className="btn btn-neu" onClick={() => nav('intake-master')}>
              <i className="lni lni-calendar"></i> Go to Intake Master
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
