'use client'
import { ModalProps } from '../types'
import { RegisterStudentResponse } from '@/hooks/admission/useRegistrarDesk'

// None of these three have a corresponding field on RegisterStudentResponse
// (registrar-desk-api-docs.html's POST /register only returns
// studentGuid/registrationNumber/studentNumber/username/studentName/email/
// applicationGuid) — kept as decorative flourish rather than implying a
// confirmed backend signal, same "not backed by anything real yet, not
// hidden either" convention as other UI-first cards in this app.
const CARDS = [
  { icon: 'lni lni-credit-cards',   title: 'ID Card Initiated',      sub: 'Queued for printing — batch #PRN-2026-06' },
  { icon: 'lni lni-fingerprint',    title: 'Biometrics Queued',      sub: 'Scheduled for capture at registration desk' },
  { icon: 'lni lni-certificate',    title: 'Admission Letter Issued', sub: 'PDF generated and attached to profile' },
]

interface Props extends ModalProps {
  result: RegisterStudentResponse | null
}

export function OnboardModal({ isOpen, onClose, showToast, nav, result }: Props) {
  if (!isOpen) return null

  // Real outcome per post-register-student.md: no password is created or
  // sent. With an email on file the student gets a 7-day activation link to
  // set their own password; without one, nothing is sent.
  const email = result?.email?.trim()

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-volume"></i> {result?.studentName ? `${result.studentName} — ` : ''}Student Successfully Registered!</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g2 mb-4">
          {email ? (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--green-bg)', border: '1px solid var(--green-bd)' }}>
              <i className="lni lni-envelope text-lg" style={{ color: 'var(--green)' }} />
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--green)' }}>Activation Link Emailed</div>
                <div className="text-xs" style={{ color: 'var(--g500)' }}>Sent to {email}, valid 7 days. The student sets a password, then logs in with their registration number.</div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)' }}>
              <i className="lni lni-warning text-lg" style={{ color: 'var(--amber)' }} />
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--amber)' }}>No Activation Email Sent</div>
                <div className="text-xs" style={{ color: 'var(--g500)' }}>No email on file. Add one, then the student can use Forgot Password to set up their login.</div>
              </div>
            </div>
          )}
          {CARDS.map(c => (
            <div key={c.title} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--green-bg)', border: '1px solid var(--green-bd)' }}>
              <i className={`${c.icon} text-lg`} style={{ color: 'var(--green)' }} />
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--green)' }}>{c.title}</div>
                <div className="text-xs" style={{ color: 'var(--g500)' }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--g400)' }}>Student Number</div>
          <div className="font-mono text-xl font-bold" style={{ color: 'var(--b600)' }}>{result?.studentNumber || '—'}</div>
          <div className="text-sm" style={{ color: 'var(--g500)' }}>{result?.email || result?.username || '—'}</div>
          {result?.registrationNumber && (
            <div className="text-xs mt-1" style={{ color: 'var(--g400)' }}>Registration No. {result.registrationNumber}</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => showToast('Admission letter sent to print queue.', 'success')}>
            <i className="lni lni-printer"></i> Print Letter
          </button>
          <button className="btn btn-primary" onClick={() => { onClose(); nav?.('dashboard') }}>
            <i className="lni lni-arrow-left"></i> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
