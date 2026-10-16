'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FeeStructureModal } from '@/components/modals/academic/FeeStructureModal'
import { ViewFeeStructureModal } from '@/components/modals/academic/ViewFeeStructureModal'
import { Toast } from '@/components/Toast'
import { TableSearch } from '@/components/TableSearch'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useProgramFeeStructuresPaged, ProgramFeeStructureHeader } from '@/hooks/academic/useProgramFeeStructure'
import { useProgramMastersByGuids } from '@/hooks/academic/useProgramMaster'
import { useProgramApprovals } from '@/hooks/academic/useProgramApproval'
import { useIntakesByGuids } from '@/hooks/academic/useIntakes'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// academic master pages' search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  // Passed straight into FeeStructureModal as editData — the modal now
  // fetches its own real fee lines by feeHdGuid (GET fee-lines/:feeHdGuid),
  // this row supplies the header fields (feeCode, calcType, lef/cef/ace,
  // intakeGuid, etc.) that endpoint doesn't return.
  const [editRecord, setEditRecord] = useState<ProgramFeeStructureHeader | null>(null)
  const [viewRecord, setViewRecord] = useState<ProgramFeeStructureHeader | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const searchTrimmed = search.trim()
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  // Real server-side pagination (2026-09-10) — only PAGE_SIZE rows are ever
  // requested for the page on screen (see useProgramFeeStructuresPaged),
  // not the whole table in one 1000-row shot, same conversion Programme
  // Master's own table already went through.
  const { data, isLoading, isFetching } = useProgramFeeStructuresPaged(page, PAGE_SIZE, activeSearch)
  const records = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && isFetching

  // Programme column — resolves only the guids actually on the current page
  // (2026-09-10) instead of useProgramMasters()' full unconditional list
  // fetched just to look up a handful of programGuids at a time, same
  // batched-by-guid convention as the Intake column below.
  const programGuidsOnPage = records.map(r => r.programGuid)
  const { byGuid: programsByGuid, isLoading: programsByGuidLoading } = useProgramMastersByGuids(programGuidsOnPage)
  // GET /api/v1/academic/program-master only lists approved programmes — a
  // fee structure can already be attached to one still pending approval
  // (see programme-approval/page.tsx), which programmeFor() below silently
  // showed as "—" for. Only fall back to the (still full-list, no by-guid
  // endpoint exists to batch it) not-approved list once the batched lookup
  // above has actually finished and a row is still unresolved, instead of
  // always fetching all pending not-approved rows on every load — including
  // while that batch is simply still in flight, which would otherwise fire
  // this fallback on every fresh page load regardless of whether it's ever
  // actually needed.
  const needsNotApprovedFallback = !programsByGuidLoading && records.some(r => !programsByGuid.has(r.programGuid))
  const { data: notApprovedData } = useProgramApprovals(1, PAGE_SIZE, '', needsNotApprovedFallback)
  const notApprovedPrograms = notApprovedData?.items ?? []

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openViewModal(r: ProgramFeeStructureHeader) {
    setViewRecord(r)
    openModal('view-fee-structure-modal')
    setSearch('')
  }

  function programmeFor(programGuid: string) {
    return programsByGuid.get(programGuid)
      ?? notApprovedPrograms.find(p => p.programGuid === programGuid)
  }

  // No delete endpoint is confirmed for this resource yet (only
  // hd/save-complete has been seen) — flagged rather than faked, same
  // convention as AdjustLedgerModal/the Finance "New Deposit" stub. Removing
  // the row from local state here would look like a real delete but
  // silently reappear on the next refetch, which is worse than doing
  // nothing.
  function deleteRecord() {
    showToast("Delete isn't wired to a real endpoint yet.", 'error')
  }

  // Live preview shown in the search dropdown as the user types — reads the
  // current server-scoped page of records, capped to a handful. Empty below
  // MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on when the
  // dropdown is even allowed to open. Same "reflects the current page only"
  // trade-off Programme Master's own search preview accepted.
  const searchMatches = useMemo(
    () => searchTrimmed.length >= MIN_SEARCH_CHARS
      ? records.filter(r => `${r.feeCode} ${r.feeDesc}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
      : [],
    [records, searchTrimmed],
  )

  // Re-filter client-side on top of whatever the server sent back, so
  // results stay correct even if the backend doesn't actually honor
  // ?search= (see the note on getProgramFeeStructures).
  const pageItems = useMemo(
    () => records.filter(r => searchTrimmed.length < MIN_SEARCH_CHARS || `${r.feeCode} ${r.feeDesc}`.toLowerCase().includes(searchTrimmed.toLowerCase())),
    [records, searchTrimmed],
  )

  // Intake column — resolves only the guids actually on the current page
  // (2026-09-10) instead of useIntakes()' full 1000-row snapshot fetched
  // just to look up a handful of intakeGuids at a time, same batched-by-guid
  // convention as Programme Master's own table (see useIntakesByGuids).
  const intakesByGuid = useIntakesByGuids(pageItems.map(r => r.intakeGuid).filter((g): g is string => !!g))
  function intakeCodeFor(intakeGuid: string | null) {
    if (!intakeGuid) return '—'
    const intake = intakesByGuid.get(intakeGuid)
    return intake ? String(intake.intakeCode) : '—'
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Programme Fee Structure</div>
            <div className="pg-sub">Define and manage fee structures per programme · Set fee items, priorities and base currency</div>
          </div>
          <div className="flex gap-2">
            {/* Commented out per request — never wired to a real endpoint,
                only fired a fake success toast. Kept here in case cloning
                gets a real backend implementation later.
            <button className="btn btn-neu" onClick={() => showToast('Fee structure duplicated for next intake.', 'success')}>
              <i className="lni lni-files"></i> Clone Last Year
            </button>
            */}
            {permissions.add && (
              <button className="btn btn-primary" onClick={() => openModal('new-fee-structure-modal')}>
                <i className="lni lni-plus"></i> New Fee Structure
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end mb-3">
          <TableSearch
            className="w-56"
            placeholder="Search by fee code or description…"
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            results={searchMatches.map(r => ({ id: r.feeHdGuid, primary: r.feeCode, secondary: r.feeDesc }))}
            loading={searchPending}
            minChars={MIN_SEARCH_CHARS}
            onSelect={(r) => {
              const rec = records.find(x => x.feeHdGuid === r.id)
              if (rec) openViewModal(rec)
            }}
          />
        </div>

        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Fee Code</th>
                <th>Description</th>
                <th>Programme</th>
                <th>Intake</th>
                <th>Local / Foreign</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(isLoading || searchPending)
                ? <TableLoadingState colSpan={999} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => { setSearch(''); setPage(1) }} />
                  : null}
              {!(isLoading || searchPending) && pageItems.map(r => {
                const programme = programmeFor(r.programGuid)
                return (
                  <tr key={r.feeHdGuid}>
                    <td>
                      <ActionMenu>
                        <button
                          className="btn btn-neu btn-sm"
                          onClick={() => openViewModal(r)}
                        ><i className="lni lni-eye"></i> View</button>
                        {permissions.edit && (
                          <button
                            className="btn btn-neu btn-sm"
                            onClick={() => { setEditRecord(r); openModal('edit-fee-structure-modal') }}
                          ><i className="lni lni-pencil"></i> Edit</button>
                        )}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={deleteRecord}><i className="lni lni-trash-can"></i> Delete</button>}
                      </ActionMenu>
                    </td>
                    <td><span className="font-mono text-[var(--b700)] font-semibold">{r.feeCode}</span></td>
                    <td>{r.feeDesc}</td>
                    <td>{programme ? `${programme.programName} (${programme.programCode})` : '—'}</td>
                    <td>{intakeCodeFor(r.intakeGuid)}</td>
                    <td><span className={`badge ${r.localOrForeign ? 'badge-blue' : 'badge-grey'}`}>{r.localOrForeign ? 'Foreign' : 'Local'}</span></td>
                    <td><span className={`badge ${r.status ? 'badge-green' : 'badge-grey'}`}>{r.status ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="fee structures" onPageChange={setPage} />
      </div>

      {openModals.has('new-fee-structure-modal') && (
        <FeeStructureModal isOpen onClose={() => closeModal('new-fee-structure-modal')} showToast={showToast} nav={nav} />
      )}
      {openModals.has('edit-fee-structure-modal') && (
        <FeeStructureModal isOpen onClose={() => closeModal('edit-fee-structure-modal')} showToast={showToast} nav={nav} mode="edit" editData={editRecord ?? undefined} />
      )}
      {openModals.has('view-fee-structure-modal') && (
        <ViewFeeStructureModal 
          isOpen
          onClose={() => closeModal('view-fee-structure-modal')} 
          showToast={showToast} 
          feeStructure={viewRecord ?? undefined} 
          onEdit={(r) => {
            closeModal('view-fee-structure-modal')
            setEditRecord(r)
            openModal('edit-fee-structure-modal')
          }}
        />
      )}
      <Toast toast={toast} />
    </>
  )
}
