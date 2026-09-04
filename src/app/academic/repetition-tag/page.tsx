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
import { usePagination } from '@/hooks/usePagination'
import { useRepetitionTags, useRepetitionTagSearch, useCreateRepetitionTag, useUpdateRepetitionTag, useDeleteRepetitionTag, RepetitionTag } from '@/hooks/academic/useRepetitionTags'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

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
      onError: (error: Error) => showToast(error.message || 'Failed to delete repetition tag', 'error'),
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

  const { data: rows = [], isLoading } = useRepetitionTags()

  // Debounced so the backend's ?search= isn't hit on every keystroke, and
  // held at '' (falling back to the unfiltered list) until MIN_SEARCH_CHARS
  // is met — same convention as Intake/Skill Master's search boxes.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: searchResults, isFetching: isSearching } = useRepetitionTagSearch(debouncedSearch)
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isSearching)
  // Re-filter client-side on top of whatever the server sent back, so
  // results stay correct even if the backend doesn't actually honor
  // ?search= (see the note on getRepetitionTags).
  const baseRows = debouncedSearch
    ? (searchResults ?? []).filter(r => `${r.tagCode} ${r.tagName}`.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : rows

  const createRepetitionTag = useCreateRepetitionTag()
  const updateRepetitionTag = useUpdateRepetitionTag()
  const deleteRepetitionTag = useDeleteRepetitionTag()

  // Text matching against code/name already happened above (baseRows is
  // search-scoped) — this only applies the column filter on top.
  const filteredRows = baseRows.filter(r =>
    Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as unknown as Record<string, unknown>)[k])))
  )

  // Live preview shown in the search dropdown as the user types — reads the
  // same server-scoped baseRows, ignoring the column filters and capped to a
  // handful of rows. Empty below MIN_SEARCH_CHARS, matching TableSearch's own
  // minChars gate on when the dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? baseRows.slice(0, 8) : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

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
              onChange={setSearch}
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
                    ? <EmptyState colSpan={999} hasFilters={!!search || Object.values(filters).some(v => v.length > 0)} onClearFilters={() => { setSearch(''); setFilters({}) }} />
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
