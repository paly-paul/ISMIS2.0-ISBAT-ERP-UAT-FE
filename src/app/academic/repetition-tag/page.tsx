'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { RepTagFormModal } from '@/components/modals/academic/RepTagFormModal'
import { ViewRepTagModal } from '@/components/modals/academic/ViewRepTagModal'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useRepetitionTagsPaged, useCreateRepetitionTag, useUpdateRepetitionTag, useDeleteRepetitionTag, RepetitionTag } from '@/hooks/academic/useRepetitionTags'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { AuthError } from '@/lib/api/client'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as Intake Master /
// Skill Master / Batch Management's search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingRepTagGuid, setEditingRepTagGuid] = useState<string | null>(null)
  const [viewingRepTagGuid, setViewingRepTagGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RepetitionTag | null>(null)

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingRepTagGuid(guid)
    openModal('edit-rep-tag-modal')
  }

  function openViewModal(guid: string) {
    setViewingRepTagGuid(guid)
    openModal('view-rep-tag-modal')
    setSearch('')
  }

  function confirmDeleteRepetitionTag() {
    if (!deleteTarget) return
    deleteRepetitionTag.mutate(deleteTarget.courseUnitRepetitionGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Repetition tag deleted successfully') },
      onError: (error: Error) => {
        // delete-course-unit-repetition.md: tag_in_use while any course unit
        // still points at this tag — say how to free it up.
        if (error instanceof AuthError && error.code === 'tag_in_use') {
          setDeleteTarget(null)
          showToast(`"${deleteTarget.tagCode}" is still used by one or more course units. Change or clear their repetition tag in Course Units, then delete it.`, 'error')
          return
        }
        showToast(error.message || 'Failed to delete repetition tag', 'error')
      },
    })
  }

  useEffect(() => {
    function closeFilter(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('th')) setOpenFilter(null)
    }
    document.addEventListener('click', closeFilter)
    return () => document.removeEventListener('click', closeFilter)
  }, [])

  // Previous hardcoded rows (pre GET /api/v1/academic/course-unit-repetitions
  // integration) — kept here for reference until the backend fields are
  // fully confirmed.
  // const rows = [
  //   { code: 'RT-CU-001', description: 'Standard repeat for failed course units',       level: "Bachelor's Degree"    },
  //   { code: 'RT-CU-002', description: 'Supplementary exam carry-forward repeat',        level: 'Diploma'              },
  //   { code: 'RT-CU-003', description: 'Medical or special consideration repeat',        level: "Master's Degree"      },
  //   { code: 'RT-CU-004', description: 'Retake after academic probation',                level: "Bachelor's Degree"    },
  //   { code: 'RT-CU-005', description: 'Credit exemption repeat for lateral entrants',   level: 'Postgraduate Diploma' },
  // ]

  // Real server-side pagination (2026-09-09) — only PAGE_SIZE rows are ever
  // requested for the page on screen (see useRepetitionTagsPaged), not the
  // whole table in one 1000-row shot. Trade-off: the Programme Level column
  // filter below can now only narrow the rows already on the current page,
  // same "server search, client filter stays page-scoped" trade-off
  // enquiry-list's own Channel/Intake filters made.
  const [page, setPage] = useState(1)
  const searchTrimmed = search.trim()
  // Only actually queried once the term clears MIN_SEARCH_CHARS, same gate
  // TableSearch's own dropdown uses, so a 1-character keystroke doesn't fire
  // a request.
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  const { data, isLoading, isFetching } = useRepetitionTagsPaged(page, PAGE_SIZE, activeSearch)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && isFetching

  const createRepetitionTag = useCreateRepetitionTag()
  const updateRepetitionTag = useUpdateRepetitionTag()
  const deleteRepetitionTag = useDeleteRepetitionTag()

  // Search already happened server-side (see useRepetitionTagsPaged above) —
  // this only applies the column filter on top of the current page's rows.
  const filteredRows = rows.filter(r =>
    Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as unknown as Record<string, unknown>)[k])))
  )
  const pageItems = filteredRows

  // Live preview shown in the search dropdown as the user types — rows are
  // already server-filtered by activeSearch, so this just previews up to 8
  // of what's already loaded (same convention as enquiry-list's own
  // searchMatches). Empty below MIN_SEARCH_CHARS, matching TableSearch's own
  // minChars gate on when the dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? filteredRows.slice(0, 8) : []

  function fth(label: string, col: string, opts: string[]) {
    return (
      <FilterTh
        label={label}
        opts={opts}
        isOpen={openFilter === col}
        activeFilter={filters[col] ?? []}
        onToggle={(e) => { e.stopPropagation(); setOpenFilter(p => p === col ? null : col) }}
        onSelect={(vals) => { setFilters(f => ({ ...f, [col]: vals })); setOpenFilter(null) }}
        onClear={() => { setFilters(f => ({ ...f, [col]: [] })); setOpenFilter(null) }}
        onClose={() => setOpenFilter(null)}
      />
    )
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Course Units Repetition Tag</div>
            <div className="pg-sub">Define repetition tags for course units · Linked to programme levels</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-rep-tag-modal')}>
              <i className="lni lni-plus"></i> Add Repetition Tag
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">
              <span className="ctitle-icon"><i className="lni lni-reload"></i></span>
              Repetition Tags
            </div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or description…"
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              results={searchMatches.map(r => ({ id: r.courseUnitRepetitionGuid, primary: r.tagCode, secondary: r.tagName }))}
              loading={searchPending}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Repetition Tag Code</th>
                  <th>Description</th>
                  {fth('Programme Level', 'levelName', ["Bachelor's Degree", 'Diploma', "Master's Degree", 'Postgraduate Diploma', 'Certificate', 'PhD / Doctorate'])}
                </tr>
              </thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search || Object.values(filters).some(v => v.length > 0)} onClearFilters={() => { setSearch(''); setFilters({}); setPage(1) }} />
                    : null}
                {!(isLoading || searchPending) && pageItems.map((r) => (
                  <tr key={r.courseUnitRepetitionGuid}>
                    <td>
                      {(permissions.edit || permissions.delete) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.courseUnitRepetitionGuid)}>
                            <i className="lni lni-eye"></i> View
                          </button>
                          {permissions.edit && (
                            <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.courseUnitRepetitionGuid)}>
                              <i className="lni lni-pencil"></i> Edit
                            </button>
                          )}
                          {permissions.delete && (
                            <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                              <i className="lni lni-trash-can"></i> Delete
                            </button>
                          )}
                        </ActionMenu>
                      )}
                    </td>
                    <td className="font-mono font-bold text-b700">{r.tagCode}</td>
                    <td>{r.tagName}</td>
                    <td><span className="badge badge-blue">{r.levelName}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="repetition tags" onPageChange={setPage} />
        </div>
      </div>
      <RepTagFormModal
        mode="new"
        isOpen={openModals.has('new-rep-tag-modal')}
        onClose={() => closeModal('new-rep-tag-modal')}
        showToast={showToast}
        courseUnitRepetitionGuid={null}
        createRepetitionTag={createRepetitionTag}
        updateRepetitionTag={updateRepetitionTag}
      />
      <RepTagFormModal
        mode="edit"
        isOpen={openModals.has('edit-rep-tag-modal')}
        onClose={() => closeModal('edit-rep-tag-modal')}
        showToast={showToast}
        courseUnitRepetitionGuid={editingRepTagGuid}
        createRepetitionTag={createRepetitionTag}
        updateRepetitionTag={updateRepetitionTag}
      />
      <ViewRepTagModal canEdit={permissions.edit} onEdit={() => { closeModal('view-rep-tag-modal'); openEditModal(viewingRepTagGuid || '') }}
        isOpen={openModals.has('view-rep-tag-modal')}
        onClose={() => closeModal('view-rep-tag-modal')}
        showToast={showToast}
        courseUnitRepetitionGuid={viewingRepTagGuid}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.tagCode}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this repetition tag. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteRepetitionTag.isPending} onClick={confirmDeleteRepetitionTag}>
                <i className="lni lni-trash-can"></i> {deleteRepetitionTag.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
