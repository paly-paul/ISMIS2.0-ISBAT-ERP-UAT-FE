'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { TableSearch } from '@/components/TableSearch'
import { ActionMenu } from '@/components/ActionMenu'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { usePagination } from '@/hooks/usePagination'
import { ExamRuleFormModal } from './_components/ExamRuleFormModal'
import { ExamRuleViewModal } from './_components/ExamRuleViewModal'
import { useExamRules, useDeleteExamRule } from '@/hooks/assessment/useExamRules'
import { ExamRuleDto } from '@/lib/api/assessment/examRule'

const FETCH_SIZE = 12000
const DISPLAY_PAGE_SIZE = 10

export default function ExamRulesPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGuid, setEditingGuid] = useState<string | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ guid: string; name: string } | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading: loading } = useExamRules(1, FETCH_SIZE, search)
  const deleteMut = useDeleteExamRule()

  const rows = data?.items ?? []

  // Client-side pagination over the fetched batch
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(rows, DISPLAY_PAGE_SIZE)

  // Dynamically calculate max sections across current page items to generate columns (minimum 3: A, B, C)
  const maxSectionsCount = Math.max(3, ...pageItems.map(r => r.sections?.length || 0))

  function showToast(msg: string, type = '') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleAddNew() {
    setEditingGuid(null)
    setIsModalOpen(true)
  }

  function handleEdit(guid: string) {
    setEditingGuid(guid)
    setIsModalOpen(true)
  }

  function handleView(guid: string) {
    setViewingGuid(guid)
    setIsViewModalOpen(true)
  }

  function handleEditFromView() {
    setIsViewModalOpen(false)
    setEditingGuid(viewingGuid)
    setIsModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.guid)
      showToast('Exam Rule deleted successfully', 'success')
      setDeleteTarget(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error')
      setDeleteTarget(null)
    }
  }

  function countSections(r: ExamRuleDto) {
    if (r.sections?.length) return r.sections.length
    let count = 0
    const hasData = (sec: any) => sec && sec.maxQuestions > 0
    if (hasData((r as any).sectionA)) count++
    if (hasData((r as any).sectionB)) count++
    if (hasData((r as any).sectionC)) count++
    return count
  }

  return (
    <div id="page-exam-rules">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Exam Rules Master</h1>
          <p className="text-sm text-g500 mt-0.5">Manage reusable exam paper blueprints and section configurations</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button className="btn btn-ghost flex-1 sm:flex-none justify-center" onClick={() => router.push('/assessment/dashboard')}><i className="lni lni-arrow-left" /> Back</button>
          <button className="btn btn-primary flex-1 sm:flex-none justify-center whitespace-nowrap" onClick={handleAddNew}><i className="lni lni-plus" /> Add Exam Rule</button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-g800">Exam Rules</h2>
            <p className="text-xs text-g400 mt-0.5">{totalCount.toLocaleString()} total active rules</p>
          </div>
          <TableSearch
            className="w-full sm:w-64"
            placeholder="Search by code or name…"
            value={search}
            onChange={setSearch}
            results={[]}
          />
        </div>

        <ScrollTable>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Code</th>
                <th>Name</th>
                {Array.from({ length: maxSectionsCount }).flatMap((_, i) => {
                  const secChar = String.fromCharCode(65 + i)
                  // Add a light left border for visual separation of sections
                  const borderClass = "border-l border-slate-200"
                  return [
                    <th key={`sec-${secChar}-max`} className={`text-right ${borderClass}`} style={{ whiteSpace: 'normal', minWidth: 100 }}>Sec. {secChar}<br/>Max Qns</th>,
                    <th key={`sec-${secChar}-mark`} className="text-right" style={{ whiteSpace: 'normal', minWidth: 100 }}>Sec. {secChar}<br/>Marks/Qn</th>,
                    <th key={`sec-${secChar}-type`} style={{ whiteSpace: 'normal', minWidth: 100 }}>Sec. {secChar}<br/>Type</th>
                  ]
                })}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <TableLoadingState colSpan={3 + (maxSectionsCount * 3)} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={3 + (maxSectionsCount * 3)} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                  : null}
              {pageItems.map(r => {
                const getTypeLabel = (t: number | null | undefined) => {
                  if (t === 1) return 'MCQ'
                  if (t === 2) return 'DQ'
                  return ''
                }

                return (
                  <tr key={r.examRuleGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => handleView(r.examRuleGuid)}>
                          <i className="lni lni-eye" /> View
                        </button>
                        <button className="btn btn-neu btn-sm" onClick={() => handleEdit(r.examRuleGuid)}>
                          <i className="lni lni-pencil" /> Edit
                        </button>
                        <button className="btn btn-neu btn-sm text-clr-red" onClick={() => setDeleteTarget({ guid: r.examRuleGuid, name: r.ruleName || '' })}>
                          <i className="lni lni-trash-can" /> Delete
                        </button>
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-sm">{r.ruleCode}</td>
                    <td className="font-medium">{r.ruleName}</td>
                    {Array.from({ length: maxSectionsCount }).flatMap((_, i) => {
                      const sec = r.sections?.[i] || (i === 0 ? (r as any).sectionA : i === 1 ? (r as any).sectionB : i === 2 ? (r as any).sectionC : undefined)
                      const secChar = String.fromCharCode(65 + i)
                      const borderClass = "border-l border-slate-200"
                      return [
                        <td key={`val-${secChar}-max`} className={`text-right ${borderClass}`}>{sec?.attemptQuestions || 0}</td>,
                        <td key={`val-${secChar}-mark`} className="text-right">{sec?.mark || 0}</td>,
                        <td key={`val-${secChar}-type`}>{getTypeLabel(sec?.type)}</td>
                      ]
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollTable>

        {totalCount > 0 && (
          <div className="flex items-center justify-between mt-3" style={{ fontSize: 12.5, color: 'var(--g500)' }}>
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn btn-neu btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <i className="lni lni-chevron-left" /> Previous
              </button>
              <button className="btn btn-neu btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Next <i className="lni lni-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ExamRuleFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        showToast={showToast}
        editingGuid={editingGuid}
      />

      <ExamRuleViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onEdit={handleEditFromView}
        viewingGuid={viewingGuid}
      />

      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.name}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this exam rule. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteMut.isPending} onClick={confirmDelete}>
                <i className="lni lni-trash-can"></i> {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
