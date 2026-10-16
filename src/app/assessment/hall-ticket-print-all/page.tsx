'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useHallTicketScopeStudents, HallTicketTerm } from '@/hooks/assessment/useHallTicket'
import { downloadBulkHallTicketPdf } from '@/lib/api/assessment/hallTicketIssue'
import { downloadBlob } from '@/lib/downloadBlob'

// Hall Ticket Print All (pages/assessment/hall-ticket-print-all-page.md) —
// successor to legacy frmRptUEHallTicketPrintAll. Intake + term only, no
// program/semester: one combined PDF of every ISSUED student in the intake.
//  1. Intake (defaults to the current one) + Term.
//  2. Preview: GET /bulk?status=Issued (no program/semester) → the count of
//     pages the PDF will have; warns when nobody's been issued yet.
//  3. Print All: GET /bulk/pdf with intakeGuid + term only. Records the
//     prints server-side; QR codes are generated into the PDF, so there's no
//     separate "save QR codes" step like the legacy page had.
// A whole intake can take a long time and produce a very large file.

const TERM_OPTIONS = [{ value: '1', label: 'Term 1' }, { value: '2', label: 'Term 2' }]

export default function HallTicketPrintAllPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 5000) }

  const { data: intakes = [] } = useIntakesDropdown()
  const [intakeGuid, setIntakeGuid] = useState('')
  useEffect(() => {
    if (intakeGuid || intakes.length === 0) return
    setIntakeGuid((intakes.find(i => i.currentIntake) ?? intakes[0]).intakeGuid)
  }, [intakes, intakeGuid])
  const intakeLabel = (() => {
    const i = intakes.find(x => x.intakeGuid === intakeGuid)
    return i ? (i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode)) : ''
  })()
  const [term, setTerm] = useState<HallTicketTerm>(1)

  const { data: issued = [], isFetching: previewLoading, isError: previewError } = useHallTicketScopeStudents(
    intakeGuid ? { intakeGuid, term } : null,
    'Issued',
  )
  const programCount = new Set(issued.map(r => r.programName)).size

  const [printing, setPrinting] = useState(false)
  async function handlePrintAll() {
    if (!intakeGuid || issued.length === 0) return
    setPrinting(true)
    try {
      const { blob, filename } = await downloadBulkHallTicketPdf({ intakeGuid, term })
      downloadBlob(blob, filename)
      showToast(`Downloaded ${issued.length} Term ${term} hall tickets for ${intakeLabel}.`, 'ok')
    } catch (e) {
      // e.g. "No issued hall tickets found for the given scope." or
      // "No student profiles could be resolved for this batch."
      showToast(e instanceof Error && e.message ? e.message : 'Could not generate the hall tickets.', 'error')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Hall Ticket Print All</div><div className="pg-sub">Print every issued hall ticket in an intake as one PDF</div></div>
          <Link className="btn btn-neu" href="/assessment/hall-print"><i className="lni lni-user"></i> Print One Student</Link>
        </div>

        <div className="card" style={{ maxWidth: 720 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="fg">
              <label className="lbl">Academic Intake <span className="req">*</span></label>
              <SearchSelect
                placeholder="— Select Intake —"
                options={intakes.map(i => ({ value: i.intakeGuid, label: i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode) }))}
                value={intakeGuid}
                onChange={setIntakeGuid}
                disabled={printing}
              />
            </div>
            <div className="fg">
              <label className="lbl">Term <span className="req">*</span></label>
              <SearchSelect options={TERM_OPTIONS} value={String(term)} onChange={v => setTerm(v === '2' ? 2 : 1)} disabled={printing} />
            </div>
          </div>

          {!intakeGuid ? null : previewLoading ? (
            <div className="text-g400" style={{ fontSize: 12.5, marginBottom: 12 }}>Counting issued hall tickets…</div>
          ) : previewError ? (
            <div className="text-clr-red" style={{ fontSize: 12.5, marginBottom: 12 }}><i className="lni lni-warning"></i> Couldn&apos;t count issued hall tickets. You can still try Print All.</div>
          ) : issued.length === 0 ? (
            <div className="info-box mb-3" style={{ borderColor: 'var(--amber-bd)', background: 'var(--amber-bg)' }}>
              <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0 }}></i>
              <div style={{ fontSize: 12.5 }}>No Term {term} hall tickets have been issued in this intake yet. Issue them on <Link href="/assessment/hall-ticket" style={{ color: 'var(--b700)', fontWeight: 600 }}>Hall Ticket Issuance</Link> first.</div>
            </div>
          ) : (
            <div className="info-box mb-3">
              <i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i>
              <div style={{ fontSize: 12.5 }}>
                <strong>{issued.length.toLocaleString()}</strong> issued student{issued.length === 1 ? '' : 's'} across {programCount} programme{programCount === 1 ? '' : 's'} — one page each.
                Students without an issued ticket are not included.
                {issued.length > 300 && ' A file this large can take several minutes to generate — keep this page open.'}
              </div>
            </div>
          )}

          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handlePrintAll} disabled={printing || !intakeGuid || previewLoading || (!previewError && issued.length === 0)}>
              <i className="lni lni-printer"></i> {printing ? 'Generating PDF…' : 'Print All'}
            </button>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
