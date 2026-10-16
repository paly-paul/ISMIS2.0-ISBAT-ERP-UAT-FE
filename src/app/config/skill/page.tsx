'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { SkillFormModal } from '@/components/modals/config/SkillFormModal'
import { ViewSkillModal } from '@/components/modals/config/ViewSkillModal'
import { useSkillMastersPaged, useCreateSkillMaster, useUpdateSkillMaster, useDeleteSkillMaster, SkillMaster } from '@/hooks/config/useSkillMaster'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

// TEMPORARY BOOTSTRAP OVERRIDE: after a DB reset there is no permission
// group yet, so /me/menu correctly comes back with add:false/edit:false for
// this page - nobody has been granted the right to create one yet. Force
// both true until the permission-catalog seed runs against the real DB.
const BOOTSTRAP_FORCE_PERMISSIONS = true

export default function SkillPage() {
  const router = useRouter()
  const realPermissions = usePagePermissions()
  const permissions = BOOTSTRAP_FORCE_PERMISSIONS
    ? { ...realPermissions, add: true, edit: true }
    : realPermissions
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]           = useState<{ msg: string; type: string } | null>(null)
  const [editingSkill, setEditingSkill] = useState<SkillMaster | null>(null)
  const [viewingSkill, setViewingSkill] = useState<SkillMaster | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SkillMaster | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const searchTrimmed = search.trim()
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  const { data, isLoading, isFetching } = useSkillMastersPaged(page, PAGE_SIZE, activeSearch)
  const pageItems = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && isFetching
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? pageItems.slice(0, 8) : []
  const displayItems = pageItems

  const createSkill = useCreateSkillMaster()
  const updateSkill = useUpdateSkillMaster()
  const deleteSkill = useDeleteSkillMaster()

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(skill: SkillMaster) {
    setEditingSkill(skill)
    openModal('edit-skill-modal')
  }

  function openViewModal(skill: SkillMaster) {
    setViewingSkill(skill)
    openModal('view-skill-modal')
    setSearch('')
  }

  function confirmDeleteSkill() {
    if (!deleteTarget) return
    deleteSkill.mutate(deleteTarget.skillGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Skill deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete skill', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Skill Master</div>
            <div className="pg-sub">Define skills and subject areas for lecturer profiles</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-skill-modal')}>
              <i className="lni lni-plus"></i> Add Skill
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bulb"></i></span> Skills</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={v => { setSearch(v); setPage(1) }}
                results={searchMatches.map(r => ({ id: r.skillGuid, primary: r.skillName }))}
                loading={searchPending}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(res) => { const row = pageItems.find(x => x.skillGuid === res.id); if (row) openViewModal(row) }}
              />
            </div>
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Skill Name</th>
                </tr>
              </thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : displayItems.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                    : null}
                {displayItems.map((r) => (
                  <tr key={r.skillGuid}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r)}>
                            <i className="lni lni-eye"></i> View
                          </button>
                          {permissions.edit && (
                            <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r)}>
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
                    <td><strong>{r.skillName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={safePage} totalPages={totalPages} totalCount={totalCount} itemLabel="skills" onPageChange={pageNum => { setPage(pageNum) }} />
        </div>
      </div>
      <SkillFormModal
        mode="new"
        isOpen={openModals.has('new-skill-modal')}
        onClose={() => closeModal('new-skill-modal')}
        showToast={showToast}
        skill={null}
        createSkill={createSkill}
        updateSkill={updateSkill}
      />
      <SkillFormModal
        mode="edit"
        isOpen={openModals.has('edit-skill-modal')}
        onClose={() => closeModal('edit-skill-modal')}
        showToast={showToast}
        skill={editingSkill}
        createSkill={createSkill}
        updateSkill={updateSkill}
      />
      <ViewSkillModal
        isOpen={openModals.has('view-skill-modal')}
        onClose={() => closeModal('view-skill-modal')}
        showToast={showToast}
        skill={viewingSkill}
        onEdit={() => {
          closeModal('view-skill-modal')
          openEditModal(viewingSkill!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.skillName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this skill. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteSkill.isPending} onClick={confirmDeleteSkill}>
                <i className="lni lni-trash-can"></i> {deleteSkill.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
