'use client'
import { ModalProps } from '../types'
import type { CurrentSemesterUpcomingSemester } from '@/hooks/finance/usePaymentConsole'

interface UpcomingSemestersModalProps extends ModalProps {
  upcomingSemesters: CurrentSemesterUpcomingSemester[]
  totalProgramOutstanding: number
}

function fmtAmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Opened from the Programme Progress "Total Outstanding" stat card on Step
// 2/3's Outstanding Balance card — this is the only place upcomingSemesters
// (current-semester-payable's whole-programme breakdown, everything beyond
// the current semester already shown in that card's own ledger table) is
// surfaced, since nothing on the page needs it for anything functional.
//
// Each semester's own table reuses the same .recgrid grid look as that
// Outstanding Balance table (per request, 2026-09-11), just the
// .recgrid-4col variant — Ledger/Scheduled Amt/Paid/Outstanding, no
// Scheduled Bill column, since nothing here goes through that table's
// Currency Received conversion step (these ledgers aren't being paid from
// this modal). Discount/Total Payable footer rows are summed client-side
// per semester from its own ledgers, same "sum what the API gives per-row"
// pattern the main table's own ledgerTotals uses.
export function UpcomingSemestersModal({ isOpen, onClose, upcomingSemesters, totalProgramOutstanding }: UpcomingSemestersModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue" style={{ flexShrink: 0 }}>
          <div className="modal-title"><i className="lni lni-calendar"></i> Upcoming Semesters</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {/* One summary line for the whole programme — the per-semester
              tables below each carry their own Total Payable footer row
              already, this is the only place the grand total appears so it
              doesn't just repeat what's already on screen. */}
          <div className="flex items-center justify-between mb-3" style={{ fontSize: 11.5 }}>
            <span className="text-g400">Ledgers beyond the current semester, across the rest of the programme.</span>
            <span className="font-bold text-amber" style={{ fontSize: 13 }}>{fmtAmt(totalProgramOutstanding)} total</span>
          </div>

          {upcomingSemesters.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>No upcoming semester ledgers — the current semester is the last one billed.</div>
          ) : (
            upcomingSemesters.map(sem => {
              const totalDiscount = sem.ledgers.reduce((sum, l) => sum + l.discountAmount, 0)
              const totalNetPayable = sem.ledgers.reduce((sum, l) => sum + l.netPayable, 0)
              return (
                <div key={sem.semesterGuid} className="mb-4">
                  <div className="font-bold text-g700 mb-2" style={{ fontSize: 13 }}>{sem.semesterName}</div>
                  <div className="recgrid recgrid-4col">
                    <div className="recgrid-row recgrid-hdr">
                      <span>Ledger</span>
                      <span>Scheduled Amt</span>
                      <span>Paid</span>
                      <span>Outstanding</span>
                    </div>
                    {sem.ledgers.map((l, i) => {
                      const isPaid = l.outstanding === 0
                      return (
                        <div className="recgrid-row recgrid-body" key={`${l.ledgerGuid ?? 'none'}-${i}`}>
                          <span>
                            {l.ledgerName}{l.ledgerNum ? ` (${l.ledgerNum})` : ''}
                            {isPaid && <span className="text-green" style={{ fontSize: 11, fontWeight: 600, marginLeft: 6 }}>Paid</span>}
                          </span>
                          <span data-label="Scheduled Amt">
                            <span>
                              {fmtAmt(l.ledgerAmount)}
                              {l.currencyCode && <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>({l.currencyCode})</span>}
                            </span>
                          </span>
                          <span data-label="Paid" className="font-bold text-green">
                            <span>
                              {fmtAmt(l.paidAmount)}
                              {l.currencyCode && <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>({l.currencyCode})</span>}
                            </span>
                          </span>
                          <span data-label="Outstanding" className={isPaid ? 'font-bold text-green' : 'font-bold text-amber'}>{fmtAmt(l.outstanding)}</span>
                        </div>
                      )
                    })}
                    <div className="recgrid-foot recgrid-total">
                      <span>
                        Discount
                        <span className="text-g400" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>(full payment only)</span>
                      </span>
                      <span style={{ color: totalDiscount > 0 ? 'var(--green)' : 'var(--g400)' }}>
                        {totalDiscount > 0 ? `− ${fmtAmt(totalDiscount)}` : fmtAmt(totalDiscount)}
                      </span>
                    </div>
                    <div className="recgrid-foot recgrid-total">
                      <span>Total Payable</span>
                      <span style={{ color: 'var(--amber)' }}>{fmtAmt(totalNetPayable)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-neu flex-1 justify-center" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
