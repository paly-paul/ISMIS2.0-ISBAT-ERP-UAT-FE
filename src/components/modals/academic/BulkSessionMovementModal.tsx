'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'
import { BulkMovementStatusDto } from '@/hooks/academic/useSessionManagement'

interface BulkSessionMovementModalProps extends ModalProps {
  intakeLabel: string
  // 'confirm': the typed-CONFIRM gate, before POST .../move-all is sent.
  // 'result': POST already sent — shows a running state while the bulk run
  // and/or the audit-status poll are still in flight, then the moved/
  // skipped/failed breakdown once terminal.
  phase: 'confirm' | 'result'
  isRunning: boolean
  result: BulkMovementStatusDto | null
  onConfirm: () => void
}

const CONFIRM_WORD = 'CONFIRM'

// Bulk Session Movement's own confirm-then-results modal — POST
// .../move-all (per its doc) only returns a bulkMovementGuid, not the
// per-session outcome; the actual moved/skipped/failed breakdown comes back
// from a separate GET .../move-all/{guid}/status call the page polls while
// the run is still 'InProgress'. One modal covers both steps rather than a
// confirm dialog that closes into a silent toast, since a partial failure
// here needs the reason shown per session, not just a count.
export function BulkSessionMovementModal({ isOpen, onClose, showToast, intakeLabel, phase, isRunning, result, onConfirm }: BulkSessionMovementModalProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (isOpen && phase === 'confirm') setTyped('')
  }, [isOpen, phase])

  if (!isOpen) return null

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

  function handleExecute() {
    if (!confirmed) { showToast(`Type ${CONFIRM_WORD} to proceed.`, 'warn'); return }
    onConfirm()
  }

  const movedCount = result?.moved.length ?? 0
  const skippedCount = result?.skipped.length ?? 0
  const failedCount = result?.failed.length ?? 0
  const breakdown = [
    ...(result?.moved.map(e => ({ ...e, outcome: 'Moved' as const })) ?? []),
    ...(result?.skipped.map(e => ({ ...e, outcome: 'Skipped' as const })) ?? []),
    ...(result?.failed.map(e => ({ ...e, outcome: 'Failed' as const })) ?? []),
  ]

  return (
    <div className="modal-overlay open" onClick={phase === 'confirm' || !isRunning ? onClose : undefined}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-reload"></i> Bulk Session Movement — {intakeLabel}</div>
          {(phase === 'confirm' || !isRunning) && <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>}
        </div>

        {phase === 'confirm' ? (
          <>
            <div className="danger-box mb-4">
              <i className="lni lni-volume-high"></i> <span>
                This action is <strong>irreversible</strong>. Every eligible, not-yet-moved session in <strong>{intakeLabel}</strong> will be advanced to its next semester in one run. Sessions at their final semester are skipped automatically; anything with no linked students or unpublished results will fail with a reason, shown here once the run completes.
              </span>
            </div>
            <div className="fg mb-4">
              <div className="lbl">Type {CONFIRM_WORD} to proceed</div>
              <input
                className="ctrl"
                type="text"
                placeholder={`Type ${CONFIRM_WORD}`}
                value={typed}
                onChange={e => setTyped(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={onClose}>Cancel</button>
              <button className="btn btn-danger" disabled={!confirmed} onClick={handleExecute}>
                <i className="lni lni-reload"></i> Execute Bulk Movement
              </button>
            </div>
          </>
        ) : isRunning ? (
          <div className="text-center" style={{ padding: '32px 16px' }}>
            <i className="lni lni-reload" style={{ fontSize: 28, animation: 'spin 1s linear infinite' }}></i>
            <div className="font-bold text-g700 mt-3" style={{ fontSize: 13.5 }}>Running bulk session movement…</div>
            <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>This can take a moment for a large intake.</div>
          </div>
        ) : (
          <>
            <div className="g3 mb-[14px]">
              <div className="p-3 bg-[var(--green-bg)] border border-[var(--green-bd)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] text-clr-green font-bold">MOVED</div><div className="text-[var(--fs-xl)] font-extrabold text-clr-green font-sans">{movedCount}</div></div>
              <div className="p-3 bg-[var(--amber-bg)] border border-[var(--amber-bd)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] text-clr-amber font-bold">SKIPPED</div><div className="text-[var(--fs-xl)] font-extrabold text-clr-amber font-sans">{skippedCount}</div></div>
              <div className="p-3 bg-[var(--red-bg)] border border-[var(--red-bd)] rounded-[var(--rsm)] text-center"><div className="text-[var(--fs-xs)] text-clr-red font-bold">FAILED</div><div className="text-[var(--fs-xl)] font-extrabold text-clr-red font-sans">{failedCount}</div></div>
            </div>
            {breakdown.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No sessions were eligible for movement.</div>
            ) : (
              <ScrollTable className="no-sticky-col mb-[14px]">
                <table>
                  <thead><tr><th>Programme</th><th>Outcome</th><th>Reason</th></tr></thead>
                  <tbody>
                    {breakdown.map((e, i) => (
                      <tr key={`${e.sessionGuid}-${i}`}>
                        <td>{e.programName}</td>
                        <td>
                          <span className={`badge ${e.outcome === 'Moved' ? 'badge-green' : e.outcome === 'Skipped' ? 'badge-amber' : 'badge-red'}`}>{e.outcome}</span>
                        </td>
                        <td>{e.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
            <div className="modal-footer">
              <button className="btn btn-primary flex-1 justify-center" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
