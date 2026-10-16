'use client'
import { useEffect, useRef, useState } from 'react'
import { useRejectedApplicationsSearch } from '@/hooks/academic/useRefundSearch'
import { RefundLedgerPicker, initialsFor } from './shared'
import { mockSearchRejected } from './mockData'

// Category 1 — applications rejected by the registrar
// (get-rejected-applications.md). One candidate selected at a time.
//
// Search-and-select dropdown (2026-09-15, per request) — replaces the old
// always-visible results table + Pagination below the search box with the
// same live-typing typeahead the rest of this app's student-search boxes
// use (Terminate Student, NCHE & Guild Payment, the pre-tabs Payment
// Refund page): opens on focus, narrows as you type, closes on pick. Real
// server-side search still debounced (was firing on every keystroke before,
// with no debounce at all) — same 400ms convention used elsewhere.

const PAGE_SIZE = 1000

interface RejectedTabProps {
  showToast: (msg: string, type?: string) => void
  permissionsCreate: boolean
  onRefunded: (rows: [string, string][]) => void
  useMock?: boolean
}

export function RejectedTab({ showToast, permissionsCreate, onRefunded, useMock = false }: RejectedTabProps) {
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<{ applicationGuid: string; studentGuid: string | null; name: string; appRefNo: string; email: string | null; phone: string | null } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!searchFocused) return
    function handle(e: MouseEvent) {
      if (!searchBoxRef.current?.contains(e.target as Node)) setSearchFocused(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [searchFocused])

  const searchTermLen = committedSearch.length
  const searchEnabled = searchFocused && (searchTermLen === 0 || searchTermLen >= 2)
  const { data, isLoading: isLoadingReal, isError } = useRejectedApplicationsSearch({ search: committedSearch, page: 1, pageSize: PAGE_SIZE }, !useMock && searchEnabled)
  const mockItems = useMock ? mockSearchRejected(committedSearch) : []
  const items = useMock ? mockItems : (data?.items ?? [])
  const isLoading = useMock ? false : isLoadingReal

  function selectCandidate(a: { applicationGuid: string; studentGuid: string | null; applicantName: string; appRefNo: string; email: string | null; phone: string | null }) {
    setSelected({ applicationGuid: a.applicationGuid, studentGuid: a.studentGuid, name: a.applicantName, appRefNo: a.appRefNo, email: a.email, phone: a.phone })
    setSearch(a.applicantName)
    setCommittedSearch('')
    setSearchFocused(false)
  }

  function handleClear() {
    setSelected(null)
    setSearch('')
    setCommittedSearch('')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card">
        <div className="card-hdr">
          <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Search Rejected Applications</div>
        </div>
        <div className="fg" style={{ marginBottom: 0, position: 'relative' }} ref={searchBoxRef}>
          <div className="lbl">Applicant Name, AppRefNo, Email, or Phone</div>
          <div className="flex gap-2 flex-wrap">
            <div className="inp-wrap" style={{ flex: 1, minWidth: 180 }}>
              <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
              <input
                className="ctrl"
                type="text"
                placeholder="e.g. APP20241/145 or Ashfa Maryam"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={e => { if (e.key === 'Enter') setCommittedSearch(search.trim()) }}
              />
            </div>
            {selected && (
              <button className="btn btn-neu" onClick={handleClear}><i className="lni lni-close"></i> Clear</button>
            )}
          </div>

          {searchFocused && (
            <div
              className="mt-1"
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
                boxShadow: 'var(--neu-out)', maxHeight: 280, overflowY: 'auto',
              }}
            >
              {isLoading ? (
                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Searching…</div>
              ) : isError ? (
                <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
              ) : items.length === 0 ? (
                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No rejected applications found.</div>
              ) : (
                items.map(a => (
                  <div
                    key={a.applicationGuid}
                    className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                    onMouseDown={() => selectCandidate(a)}
                  >
                    <div className="font-bold">{a.applicantName}</div>
                    <div className="text-g500" style={{ fontSize: 11 }}>{a.appRefNo}{a.email ? ` · ${a.email}` : ''}{a.phone ? ` · ${a.phone}` : ''}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <>
          {/* Full-width hero card, promoted out of a 2-column split
              (2026-09-15) — same move as Payment Console's Semester Payment
              tab. */}
          <div className="card p-0 overflow-hidden">
            <div className="pc-hero">
              <div className="pc-hero-top">
                <div className="pc-hero-avatar">{initialsFor(selected.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="pc-hero-name truncate">{selected.name}</div>
                  <div className="pc-hero-sub truncate">Rejected by Registrar</div>
                  <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {selected.appRefNo}</span>
                </div>
              </div>
              <div className="pc-hero-facts">
                <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Email</span><span className="pc-hero-fact-val" title={selected.email ?? '—'}>{selected.email ?? '—'}</span></div>
                <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Phone</span><span className="pc-hero-fact-val" title={selected.phone ?? '—'}>{selected.phone ?? '—'}</span></div>
              </div>
            </div>
          </div>

          <RefundLedgerPicker
            key={selected.applicationGuid}
            applicationGuid={selected.applicationGuid}
            studentGuid={selected.studentGuid}
            showToast={showToast}
            permissionsCreate={permissionsCreate}
            onRefunded={onRefunded}
            useMock={useMock}
          />
        </>
      )}
    </div>
  )
}
