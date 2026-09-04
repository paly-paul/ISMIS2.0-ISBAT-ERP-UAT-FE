'use client'
import { ModalProps } from '../types'
import { useProgramLevel } from '@/hooks/academic/useProgramLevels'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { AuthError } from '@/lib/api/client'
import { FailurePopup } from '../shared/FailurePopup'

interface ViewProgrammeLevelModalProps extends ModalProps {
  programLevelGuid: string | null
  // Both optional: the page wires onEdit to swap this modal for the Edit
  // one, and gates the button on the caller's own permissions.edit check
  // (canEdit) rather than this modal deciding permissions itself.
  onEdit?: () => void
  canEdit?: boolean
}

// A single label/value pair within the grid below, same bare-field style as ViewIntakeModal.
// `wide` spans to the grid's last column line so a lone trailing field (Currency here) fills
// its row instead of leaving a dangling empty cell, at whatever column count the breakpoint lands on.
function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>{label}</div>
      {/* Monospace renders visually larger than the app's usual sans body
          text at the same px size — dial it down a notch so the Code field
          doesn't read as oversized next to the other plain-text fields. */}
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: mono ? '13px' : '14px', color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

export function ViewProgrammeLevelModal({ isOpen, onClose, programLevelGuid, onEdit, canEdit }: ViewProgrammeLevelModalProps) {
  const { data: programLevel, isLoading, isError, error } = useProgramLevel(programLevelGuid, isOpen)

  const { data: currencies = [] } = useFinanceCurrencies()

  if (!isOpen) return null

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Programme Level"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load programme level details.') : 'Failed to load programme level details.'}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !programLevel) {
    return (
      <div className="modal-overlay open" id="view-alevel-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Programme Level</div>
            <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading programme level details…</span>
          </div>
        </div>
      </div>
    )
  }

  const currencyName = currencies.find(c => c.currencyGuid === programLevel.currencyGuid)?.currencyCode || '—'

  return (
    <div className="modal-overlay open" id="view-alevel-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Programme Level — <span className="font-mono">{programLevel.levelCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Level Code" value={programLevel.levelCode} mono />
            <Field label="Level Name" value={programLevel.levelName} />
            <Field label="Year Count" value={programLevel.yearCount} />
            <Field label="Minimum Credit Load" value={programLevel.minCreditLoad} />
            <Field label="Application Fee" value={programLevel.appFee} />
            <Field label="Late Fee" value={programLevel.lateFee} />
            <Field label="Currency" value={currencyName} wide />
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--g200)' }}>
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={onEdit}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
