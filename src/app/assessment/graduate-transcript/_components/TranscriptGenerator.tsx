'use client'

import { useEffect, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Toast } from '@/components/Toast'
import {
  useDownloadGraduateTranscriptPdf,
  useGenerateGraduateTranscripts,
  useGraduateTranscriptCollectionSearch,
  useGraduateTranscriptPending,
} from '@/hooks/assessment/useGraduateTranscript'
import { saveBlob } from '@/lib/xlsx'

// Shared by Graduate Transcript (graduate-transcript-page.md) and HEC
// Graduate Transcript (hec-graduate-transcript-page.md): same pending grid and
// batched, idempotent generate; only the intake / program group lists differ.
// The page passes those lists in.

export interface Option { value: string; label: string }

const MONTHS: Option[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  .map((label, i) => ({ value: String(i + 1), label }))
const YEARS: Option[] = Array.from({ length: 10 }, (_, i) => {
  const y = String(new Date().getFullYear() - 2 + i)
  return { value: y, label: y }
})

interface Props {
  title: string
  subtitle: string
  intakeOptions: Option[]
  intakesLoading: boolean
  programOptions: Option[]
  programsLoading: boolean
  programLabel?: string
  // Pre-select this intake (general page: the current one; HEC page: none).
  defaultIntakeGuid?: string
  notice?: React.ReactNode
}

export function TranscriptGenerator({ title, subtitle, intakeOptions, intakesLoading, programOptions, programsLoading, programLabel = 'Programme', defaultIntakeGuid, notice }: Props) {
  const [intakeGuid, setIntakeGuid] = useState('')
  const [programGuid, setProgramGuid] = useState('')
  const [examMonth, setExamMonth] = useState('')
  const [examYear, setExamYear] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4500) }

  const effectiveIntake = intakeGuid || defaultIntakeGuid || ''
  const pendingQuery = useGraduateTranscriptPending(effectiveIntake || null, programGuid || null)
  const pending = pendingQuery.data ?? []
  const generateMut = useGenerateGraduateTranscripts()

  const allSelected = pending.length > 0 && pending.every(s => selected.has(s.studentGuid))
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(pending.map(s => s.studentGuid))) }
  function toggleOne(guid: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(guid)) next.delete(guid); else next.add(guid); return next })
  }

  function handleGenerate() {
    if (!effectiveIntake || selected.size === 0) return
    if (!examMonth || !examYear) { showToast('Select the exam month and year to generate certificates.', 'error'); return }
    generateMut.mutate({
      academicIntakeGuid: effectiveIntake,
      examMonth: Number(examMonth),
      examYear: Number(examYear),
      studentGuids: Array.from(selected),
    }, {
      // Summary toast, not a per-student result list. The pending grid reloads
      // (the hook invalidates it), so generated students drop out.
      onSuccess: res => {
        showToast(`${res.requested} requested · ${res.created} certificate${res.created === 1 ? '' : 's'} generated · ${res.refreshed} refreshed.`)
        setSelected(new Set())
      },
      onError: (err: unknown) => showToast((err as { message?: string } | null)?.message || 'Failed to generate certificates. Please try again.', 'error'),
    })
  }

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">{title}</div>
          <div className="pg-sub">{subtitle}</div>
        </div>
        <div className="pg-actions">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!effectiveIntake || selected.size === 0 || generateMut.isPending}>
            {generateMut.isPending ? <i className="lni lni-spinner-solid animate-spin"></i> : <i className="lni lni-certificate"></i>} Generate selected ({selected.size})
          </button>
        </div>
      </div>

      {notice}

      <div className="card mb-5">
        <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="fg mb-0">
            <label className="lbl">Academic Intake <span className="text-red-500">*</span></label>
            <SearchSelect
              placeholder={intakesLoading ? 'Loading…' : 'Select intake'}
              value={effectiveIntake}
              onChange={v => { setIntakeGuid(v); setSelected(new Set()) }}
              disabled={intakesLoading}
              options={intakeOptions}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">{programLabel}</label>
            <SearchSelect
              placeholder="All"
              value={programGuid}
              onChange={v => { setProgramGuid(v); setSelected(new Set()) }}
              disabled={programsLoading}
              options={[{ value: '', label: 'All' }, ...programOptions]}
            />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Exam Month <span className="text-red-500">*</span></label>
            <SearchSelect placeholder="Select month" value={examMonth} onChange={setExamMonth} options={MONTHS} />
          </div>
          <div className="fg mb-0">
            <label className="lbl">Exam Year <span className="text-red-500">*</span></label>
            <SearchSelect placeholder="Select year" value={examYear} onChange={setExamYear} options={YEARS} />
          </div>
        </div>

        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th className="w-12 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!pending.length} aria-label="Select all" />
                </th>
                <th>Student No</th>
                <th>Student Name</th>
                <th>Programme</th>
              </tr>
            </thead>
            <tbody>
              {!effectiveIntake ? (
                <EmptyState colSpan={4} title="Select an academic intake to view students pending a certificate." />
              ) : pendingQuery.isLoading ? (
                <TableLoadingState colSpan={4} title="Loading pending students..." />
              ) : pendingQuery.isError ? (
                <tr><td colSpan={4} className="text-center py-8 text-sm">
                  <span style={{ color: 'var(--red)' }}>{(pendingQuery.error as { message?: string } | null)?.message || 'Could not load pending students.'}</span>{' '}
                  <button className="btn btn-neu btn-sm ml-2" onClick={() => pendingQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
                </td></tr>
              ) : pending.length === 0 ? (
                <EmptyState colSpan={4} title="No students are pending a certificate for this selection." />
              ) : (
                pending.map(s => (
                  <tr key={s.studentGuid} className={selected.has(s.studentGuid) ? 'bg-indigo-50/30' : ''}>
                    <td className="text-center">
                      <input type="checkbox" checked={selected.has(s.studentGuid)} onChange={() => toggleOne(s.studentGuid)} aria-label={`Select ${s.studentName ?? s.studentNumber}`} />
                    </td>
                    <td className="font-mono text-slate-700">{s.studentNumber ?? '—'}</td>
                    <td className="font-medium text-slate-800">{s.studentName ?? '—'}</td>
                    <td className="text-sm text-slate-500">{s.programName ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <GeneratedCertificates showToast={showToast} />

      <Toast toast={toast} />
    </div>
  )
}

// Generated students leave the pending grid and generate returns only counts,
// so certificates are found through the transcript search (the only call that
// returns a transcriptGuid) and downloaded from there.
function GeneratedCertificates({ showToast }: { showToast: (msg: string, type?: string) => void }) {
  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTerm(input.trim()), 400)
    return () => clearTimeout(t)
  }, [input])
  const searchQuery = useGraduateTranscriptCollectionSearch(term)
  const results = searchQuery.data ?? []
  const pdfMut = useDownloadGraduateTranscriptPdf()
  const [downloading, setDownloading] = useState<string | null>(null)

  function download(transcriptGuid: string, name: string | null) {
    setDownloading(transcriptGuid)
    pdfMut.mutate(transcriptGuid, {
      onSuccess: ({ blob, filename }) => saveBlob(blob, filename ?? `Graduate_Transcript_${name ?? transcriptGuid}.pdf`),
      onError: err => showToast((err as { message?: string } | null)?.message || 'Could not download the certificate.', 'error'),
      onSettled: () => setDownloading(null),
    })
  }

  return (
    <div className="card">
      <div className="card-hdr flex items-center justify-between flex-wrap gap-2">
        <div className="card-title"><span className="ctitle-icon"><i className="lni lni-download"></i></span> Generated certificates</div>
        <div className="inp-wrap w-80">
          <i className="lni lni-search-alt inp-icon"></i>
          <input className="ctrl" placeholder="Student number or name (3+ characters)" maxLength={100} value={input} onChange={e => setInput(e.target.value)} />
        </div>
      </div>
      <ScrollTable>
        <table>
          <thead>
            <tr>
              <th style={{ width: 150 }}></th>
              <th>Student No</th>
              <th>Student Name</th>
              <th>Programme</th>
            </tr>
          </thead>
          <tbody>
            {term.length < 3 ? (
              <EmptyState colSpan={4} title="Search a student to download a generated certificate." />
            ) : searchQuery.isLoading ? (
              <TableLoadingState colSpan={4} title="Searching…" />
            ) : searchQuery.isError ? (
              <tr><td colSpan={4} className="text-center py-6 text-sm" style={{ color: 'var(--red)' }}>
                {(searchQuery.error as { message?: string } | null)?.message || 'Could not search certificates.'}
              </td></tr>
            ) : results.length === 0 ? (
              <EmptyState colSpan={4} title="No generated certificate matches this search." />
            ) : (
              results.map(r => (
                <tr key={r.transcriptGuid}>
                  <td>
                    <button className="btn btn-neu btn-sm" onClick={() => download(r.transcriptGuid, r.studentNumber)} disabled={downloading === r.transcriptGuid}>
                      {downloading === r.transcriptGuid ? <i className="lni lni-spinner-solid animate-spin"></i> : <i className="lni lni-download"></i>} Certificate PDF
                    </button>
                  </td>
                  <td className="font-mono text-slate-700">{r.studentNumber ?? '—'}</td>
                  <td className="font-medium text-slate-800">{r.studentName ?? '—'}</td>
                  <td className="text-sm text-slate-500">{r.programName ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  )
}
