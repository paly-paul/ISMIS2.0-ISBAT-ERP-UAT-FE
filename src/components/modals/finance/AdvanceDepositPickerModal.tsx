'use client'
import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { usePaymentAdvances, PaymentAdvance } from '@/hooks/finance/usePayments'
import { getStudentProfile } from '@/lib/api/finance/paymentConsole'
import { PAY_TYPE_LABELS } from '@/hooks/finance/usePaymentConsole'
import { formatDate } from '@/lib/date'

const PAGE_SIZE = 10

interface AdvanceDepositPickerModalProps extends ModalProps {
  // Fires once for the row the cashier confirmed — the caller (Other
  // Payment's Advance Payment checkbox) owns what happens with it (filling
  // otherCurrencyGuid/otherAmount, storing paymentAdvanceGuid for submit).
  onConfirm: (advance: PaymentAdvance) => void
  // Scopes the list to one student's own deposits instead of every deposit
  // in the system — get-payment-advances.md now documents studentGuid as an
  // optional filter (2026-09-01 revision). Omit to browse the full
  // unfiltered list (kept for any future admin-style caller; the Other
  // Payment tab always has a studentGuid once a student is loaded, so it
  // never hits that path in practice).
  studentGuid?: string | null
  // Shown above the table once scoped, in place of a Student column that
  // would otherwise repeat the same name on every row.
  studentDisplayName?: string
}

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function applicantName(a: { firstName: string | null; lastName: string | null } | undefined) {
  if (!a) return undefined
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || undefined
}

// Same derived-not-real status get-payment-advances.md's own advanced-
// payments/page.tsx computes — there's no "applied to X ledger" detail
// anywhere in this API, just amount vs. balance.
function depositStatus(balance: number, amount: number): { label: string; badge: string } {
  if (balance <= 0) return { label: 'Fully Drawn', badge: 'badge-green' }
  if (balance >= amount) return { label: 'Available', badge: 'badge-blue' }
  return { label: 'Partially Drawn', badge: 'badge-amber' }
}

// Picker for the Other Payment tab's Advance Payment checkbox — backs the
// "no picker for an existing advance deposit to pay from" gap
// createAdvanceDeposit's own comment (paymentConsole.ts) used to flag, now
// that get-payment-advances.md's list endpoint is confirmed wired
// (usePaymentAdvances, already backing the Advanced Payments console page).
// Scoped to the current student via studentGuid (per request, 2026-09-01,
// now that the doc confirms it as a real filter) — the per-row student-
// profile resolution below only runs for the unscoped (no guid passed)
// case, since a scoped list is every row's own student by definition and
// studentDisplayName already covers it.
export function AdvanceDepositPickerModal({ isOpen, onClose, onConfirm, studentGuid, studentDisplayName }: AdvanceDepositPickerModalProps) {
  const [page, setPage] = useState(1)
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null)
  const isScoped = !!studentGuid

  const { data, isLoading } = usePaymentAdvances(page, PAGE_SIZE, isOpen, isScoped ? studentGuid : undefined)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Only needed in the unscoped (browse-everyone) case — GetPaymentAdvances
  // carries no name/programme, only the raw guids, same reasoning
  // advanced-payments/page.tsx's own per-row resolution uses.
  const applicationGuidsOnPage = useMemo(() => isScoped ? [] : Array.from(new Set(rows.map(r => r.applicationGuid))), [rows, isScoped])
  const profileQueries = useQueries({
    queries: applicationGuidsOnPage.map(guid => ({
      queryKey: ['payment-console', 'profile', guid],
      queryFn: () => getStudentProfile(guid),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      enabled: isOpen,
    })),
  })
  const profileByApplication = useMemo(() => {
    const map = new Map<string, { firstName: string | null; lastName: string | null; appRefNo: string; studentNum: string | null }>()
    applicationGuidsOnPage.forEach((guid, i) => {
      const p = profileQueries[i]?.data
      if (p) map.set(guid, p)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationGuidsOnPage, profileQueries.map(q => q.dataUpdatedAt).join(',')])

  function studentLabel(r: PaymentAdvance) {
    const p = profileByApplication.get(r.applicationGuid)
    // No raw-guid fallback — an unresolved profile shows '—' rather than
    // the bare applicationGuid, which isn't a meaningful identifier for a
    // cashier to pick a deposit by.
    return { name: applicantName(p) ?? p?.appRefNo ?? '—', ref: p?.studentNum ?? p?.appRefNo ?? '—' }
  }

  const selected = rows.find(r => r.paymentAdvanceGuid === selectedGuid) ?? null

  function handleClose() {
    setSelectedGuid(null)
    onClose()
  }

  function handleConfirm() {
    if (!selected) return
    onConfirm(selected)
    setSelectedGuid(null)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay open" onClick={handleClose}>
      {/* maxHeight/overflow override .modal's own base 90vh-cap-plus-scroll —
          per request, this modal shouldn't scroll; it relies on the 10-row
          page size to stay short instead. */}
      <div className="modal modal-lg" style={{ maxHeight: 'none', overflow: 'visible' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-wallet"></i> Select Advance Deposit</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '14px 20px 0' }}>
          <div className="text-g500" style={{ fontSize: 12, marginBottom: 10 }}>
            {isScoped
              ? <>Showing deposits for <strong className="text-g700">{studentDisplayName ?? 'this student'}</strong>. Only deposits with an undrawn balance can be selected.</>
              : 'Pick the deposit to draw this payment from. Only deposits with an undrawn balance can be selected.'}
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  {!isScoped && <th>Student</th>}
                  <th>Deposit Code</th><th>Deposit Date</th>
                  <th>Deposited</th><th>Cur.</th><th>Method</th><th>Status</th><th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : rows.length === 0
                    ? <EmptyState colSpan={999} title="No advance deposits" subtitle={isScoped ? "This student has no advance deposits on record." : "There are no advance deposits recorded in the system yet."} />
                    : null}
                {!isLoading && rows.map(r => {
                  const s = studentLabel(r)
                  const status = depositStatus(r.balance, r.amount)
                  const selectable = r.balance > 0
                  const isSelected = r.paymentAdvanceGuid === selectedGuid
                  return (
                    <tr
                      key={r.paymentAdvanceGuid}
                      style={{ cursor: selectable ? 'pointer' : 'not-allowed', opacity: selectable ? 1 : 0.5, background: isSelected ? 'var(--b50)' : undefined }}
                      onClick={() => selectable && setSelectedGuid(r.paymentAdvanceGuid)}
                      title={selectable ? undefined : 'Fully drawn — nothing left to draw from this deposit.'}
                    >
                      <td>
                        <input
                          type="radio"
                          checked={isSelected}
                          disabled={!selectable}
                          onChange={() => selectable && setSelectedGuid(r.paymentAdvanceGuid)}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      {!isScoped && (
                        <td>
                          <strong>{s.name}</strong>
                          <div className="font-mono text-blue" style={{ fontSize: 11 }}>{s.ref}</div>
                        </td>
                      )}
                      <td className="font-mono text-blue" style={{ fontSize: 12 }}>{r.advPaymentCode}</td>
                      <td>{formatDate(r.payDate)}</td>
                      <td className="font-bold">{fmtAmount(r.amount)}</td>
                      <td><span className="badge badge-gold">{r.currency?.currencyCode ?? '—'}</span></td>
                      <td>{PAY_TYPE_LABELS[r.payType] ?? `Type ${r.payType}`}</td>
                      <td><span className={`badge ${status.badge}`}>{status.label}</span></td>
                      {/* balance is NOT in r.currency despite the doc's own
                          wording — see advanced-payments/page.tsx's own
                          comment on this same figure — shown unitless here
                          too rather than mislabeled. */}
                      <td className={`font-bold ${status.label === 'Fully Drawn' ? 'text-muted' : 'text-amber'}`}>
                        {status.label === 'Fully Drawn' ? '—' : fmtAmount(r.balance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="deposit accounts" onPageChange={setPage} />
        </div>

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selected} onClick={handleConfirm}>
            <i className="lni lni-checkmark"></i> Use This Deposit
          </button>
        </div>
      </div>
    </div>
  )
}
