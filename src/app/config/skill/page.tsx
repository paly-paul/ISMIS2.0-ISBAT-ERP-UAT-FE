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
import { usePagination } from '@/hooks/usePagination'
import { SkillFormModal } from '@/components/modals/config/SkillFormModal'
import { ViewSkillModal } from '@/components/modals/config/ViewSkillModal'
import { useSkillMasters, useCreateSkillMaster, useUpdateSkillMaster, useDeleteSkillMaster, SkillMaster } from '@/hooks/config/useSkillMaster'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

// TEMPORARY BOOTSTRAP OVERRIDE: after a DB reset there is no permission
// group yet, so /me/menu correctly comes back with add:false/edit:false for
// this page - nobody has been granted the right to create one yet. Force
// both on here, same convention as src/app/config/permission-master/page.tsx
// and the "TEMPORARY" overrides in src/lib/api/users/menu.ts. Remove once
// real permission groups exist and normal /me/menu-driven gating can take
// back over.
const BOOTSTRAP_FORCE_PERMISSIONS = true

export default function Page() {
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

  const { data, isLoading } = useSkillMasters()
  const rows = data?.items ?? []
  const createSkill = useCreateSkillMaster()
  const updateSkill = useUpdateSkillMaster()
  const deleteSkill = useDeleteSkillMaster()

  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => r.skillName.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || r.skillName.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

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
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.skillGuid, primary: r.skillName }))}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(res) => { const row = rows.find(x => x.skillGuid === res.id); if (row) openViewModal(row) }}
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
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {pageItems.map((r) => (
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
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="skills" onPageChange={setPage} />
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
