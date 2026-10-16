'use client'

import { useState, useEffect } from 'react'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Toast } from '@/components/Toast'
import { useGownCollectionSearch, useRecordGownCollection } from '@/hooks/assessment/useGownCollection'
import type { GownCollectionRow } from '@/lib/api/assessment/gownCollection'

export default function GownCollectionPage() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [recordingRow, setRecordingRow] = useState<GownCollectionRow | null>(null)
  
  const [toastMessage, setToastMessage] = useState<{ msg: string, type: 'success' | 'error' | 'warn' | 'info' | 'danger' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ msg, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: searchResults, isFetching: isSearching, error: searchError } = useGownCollectionSearch(debouncedSearch)

  return (
    <div className="pg-cnt">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Gown Collection</div>
          <div className="pg-sub">Record physical collection of academic gowns for confirmed graduates.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr flex justify-between items-center">
          <div className="card-title">
            <span className="ctitle-icon"><i className="lni lni-graduation"></i></span> Students
          </div>
          <TableSearch 
            value={searchInput} 
            onChange={setSearchInput} 
            placeholder="Search by student no or name..." 
            className="w-80"
          />
        </div>

        <ScrollTable>
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-12"></th>
                <th>Student No</th>
                <th>Student Name</th>
                <th>Programme</th>
                <th>Batch</th>
                <th>Collection Status</th>
              </tr>
            </thead>
            <tbody>
              {!debouncedSearch || debouncedSearch.length < 3 ? (
                <EmptyState colSpan={6} title="Search for a student to view gown collection status." />
              ) : isSearching ? (
                <TableLoadingState colSpan={6} title="Searching confirmed graduates..." />
              ) : searchError ? (
                <EmptyState colSpan={6} title={(searchError as Error).message || 'Failed to search confirmed graduates.'} />
              ) : !searchResults || searchResults.length === 0 ? (
                <EmptyState colSpan={6} title="No confirmed graduates found matching this search." />
              ) : (
                searchResults.map((row) => (
                  <tr key={row.studentGuid}>
                    <td className="text-center">
                      <ActionMenu>
                        {!row.isGownCollected && (
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
                    <td className="text-sm text-slate-600">{row.batchCode || '-'}</td>
                    <td>
                      {row.isGownCollected ? (
                        <span className="badge badge-green">Gown Collected</span>
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

      {recordingRow && (
        <RecordCollectionModal
          row={recordingRow}
          onClose={() => setRecordingRow(null)}
          onSuccess={() => {
            setRecordingRow(null)
            showToast('Gown collection recorded successfully.')
          }}
          onError={(msg) => {
            showToast(msg, 'error')
          }}
        />
      )}

      <Toast toast={toastMessage} />
    </div>
  )
}

function RecordCollectionModal({ 
  row, 
  onClose, 
  onSuccess,
  onError
}: { 
  row: GownCollectionRow
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const recordMut = useRecordGownCollection()

  const handleSubmit = () => {
    if (recordMut.isPending) return

    recordMut.mutate(row.studentGuid, {
      onSuccess: () => onSuccess(),
      // AuthError's message already holds the server's errors[0].
      onError: (err: any) => onError(err?.message || 'Failed to record collection.')
    })
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-check-box"></i> Confirm Gown Collection</div>
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
          <div className="fg span2 mt-2">
            <p className="text-sm text-slate-700">Are you sure you want to mark the gown as collected for this student? This action cannot be undone.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-neu" onClick={onClose} disabled={recordMut.isPending}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={recordMut.isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {recordMut.isPending ? 'Confirming...' : 'Confirm Collection'}
          </button>
        </div>
      </div>
    </div>
  )
}
