'use client'

import { useState, useEffect } from 'react'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Toast } from '@/components/Toast'
import { 
  useGraduateTranscriptCollectionSearch, 
  useRecordGraduateTranscriptCollection 
} from '@/hooks/assessment/useGraduateTranscript'
import { GraduateTranscriptCollectionRow } from '@/lib/api/assessment/graduateTranscript'

export default function GraduateTranscriptCollectionPage() {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [toastMessage, setToastMessage] = useState<{ msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' } | null>(null)
  
  const [recordingRow, setRecordingRow] = useState<GraduateTranscriptCollectionRow | null>(null)
  
  const { data: searchResults, isLoading: isSearching, isFetching } = useGraduateTranscriptCollectionSearch(appliedSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim())
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  const showToast = (msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' = 'success') => {
    setToastMessage({ msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  return (
    <div className="page active">
      <Toast toast={toastMessage} />
      
      {recordingRow && (
        <RecordCollectionModal 
          row={recordingRow} 
          onClose={() => setRecordingRow(null)}
          onSuccess={() => {
            setRecordingRow(null)
            showToast('Collection recorded successfully', 'success')
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title flex items-center gap-2">
            <span>Transcript Collection</span>
            <span className="badge badge-purple text-[11px] font-semibold">Assessment Ops</span>
          </h1>
          <p className="pg-sub">Record physical collection of printed graduate transcripts.</p>
        </div>
      </div>

      <div className="card mb-5">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="w-full sm:w-96">
            <TableSearch
              placeholder="Search Student Number or Name..."
              value={searchInput}
              onChange={setSearchInput}
              results={[]}
              minChars={999}
            />
          </div>
        </div>

        <ScrollTable>
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-12"></th>
                <th>Student No</th>
                <th>Student Name</th>
                <th>Programme</th>
                <th>Collection Status</th>
              </tr>
            </thead>
            <tbody>
              {!appliedSearch ? (
                <EmptyState colSpan={5} title="Search for a student to view transcripts available for collection." />
              ) : isSearching ? (
                <TableLoadingState colSpan={5} title="Searching transcripts..." />
              ) : !searchResults || searchResults.length === 0 ? (
                <EmptyState colSpan={5} title="No printed transcripts found matching this search." />
              ) : (
                searchResults.map((row) => (
                  <tr key={row.transcriptGuid}>
                    <td className="text-center">
                      <ActionMenu>
                        {!row.collectionDate && (
                          <button
                            className="btn btn-sm btn-outline-primary w-full text-left"
                            onClick={() => setRecordingRow(row)}
                          >
                            <i className="lni lni-check-box text-primary"></i> Record Collection
                          </button>
                        )}
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-slate-700">{row.studentNumber || '-'}</td>
                    <td className="font-medium text-slate-800">{row.studentName || '-'}</td>
                    <td className="text-sm text-slate-500 max-w-xs truncate" title={row.programName || ''}>{row.programName || '-'}</td>
                    <td>
                      {row.collectionDate ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="badge badge-green self-start">Collected on {new Date(row.collectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span className="text-xs text-slate-500 mt-1">
                            By: <span className="font-semibold text-slate-700">{row.collectedByName}</span>
                            {row.phone && ` (${row.phone})`}
                          </span>
                        </div>
                      ) : (
                        <span className="badge badge-amber">Pending Collection</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>
    </div>
  )
}

function RecordCollectionModal({ 
  row, 
  onClose, 
  onSuccess,
  onError
}: { 
  row: GraduateTranscriptCollectionRow
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [collectionMode, setCollectionMode] = useState('SELF')
  const [proxyName, setProxyName] = useState('')
  const [phone, setPhone] = useState('')
  
  const recordMut = useRecordGraduateTranscriptCollection()

  const isSelf = collectionMode === 'SELF'
  const isSubmitDisabled = recordMut.isPending || (!isSelf && (!proxyName.trim() || !phone.trim()))

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitDisabled) return

    recordMut.mutate({
      transcriptGuid: row.transcriptGuid,
      collectedByName: isSelf ? 'SELF' : proxyName.trim(),
      phone: isSelf ? null : phone.trim()
    }, {
      onSuccess: () => onSuccess(),
      // AuthError's message already holds the server's errors[0].
      onError: (err: any) => onError(err?.message || 'Failed to record collection.')
    })
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-check-box"></i> Record Transcript Collection</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        
        <div className="g2 p-4">
          <div className="fg span2">
            <div className="bg-slate-50 rounded p-3 border border-slate-100">
              <div className="text-sm">
                <span className="text-slate-500">Student:</span> <span className="font-semibold text-slate-800">{row.studentName} ({row.studentNumber})</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-slate-500">Programme:</span> <span className="font-medium text-slate-700">{row.programName}</span>
              </div>
            </div>
          </div>

          <div className="fg span2">
            <div className="lbl">Collection Mode <span className="req">*</span></div>
            <SearchSelect
              placeholder="Select Mode"
              value={collectionMode}
              onChange={setCollectionMode}
              options={[
                { value: 'SELF', label: 'Self Collection' },
                { value: 'PROXY', label: 'Proxy Collection' }
              ]}
            />
          </div>

          {!isSelf && (
            <>
              <div className="fg span2">
                <div className="lbl">Proxy Name <span className="req">*</span></div>
                <input
                  type="text"
                  className="ctrl"
                  value={proxyName}
                  onChange={e => setProxyName(e.target.value)}
                  placeholder="Full name of proxy"
                  autoFocus
                />
              </div>

              <div className="fg span2">
                <div className="lbl">Proxy Phone Number <span className="req">*</span></div>
                <input
                  type="text"
                  className="ctrl"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Contact number"
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-neu" onClick={onClose} disabled={recordMut.isPending}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={isSubmitDisabled} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {recordMut.isPending ? 'Confirming...' : 'Confirm Collection'}
          </button>
        </div>
      </div>
    </div>
  )
}
