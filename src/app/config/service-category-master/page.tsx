'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { useServiceCategories, useCreateServiceCategory, useUpdateServiceCategory, useDeleteServiceCategory } from '@/hooks/student/useServiceCategories'
import { ServiceCategoryDto } from '@/lib/api/student/serviceCategories'

// Split out of the old combined "Category Masters" page (student/masters/)
// per request — this half owns Service Category Master only (the ticketing
// workflow's categories). Wired to the real students/service-categories CRUD
// API (see students/service-categories/*.md). The real record is just
// { serviceCategoryGuid, categoryName } — there's no "Routes To" free-text
// note field on the backend, so that mock-only column/input was dropped
// rather than faked.
export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const { data: serviceCatsPage, isLoading: serviceCatsLoading } = useServiceCategories()
  const serviceCats = serviceCatsPage?.items ?? []
  const createServiceCategory = useCreateServiceCategory()
  const updateServiceCategory = useUpdateServiceCategory()
  const deleteServiceCategory = useDeleteServiceCategory()

  const [serviceCatModal, setServiceCatModal] = useState<{ mode: 'add' | 'edit'; row?: ServiceCategoryDto } | null>(null)
  const [serviceName, setServiceName] = useState('')

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openAddService() { setServiceCatModal({ mode: 'add' }); setServiceName('') }
  function openEditService(row: ServiceCategoryDto) { setServiceCatModal({ mode: 'edit', row }); setServiceName(row.categoryName ?? '') }

  function saveServiceCategory() {
    if (!serviceCatModal) return
    const categoryName = serviceName.trim().slice(0, 100)
    if (!categoryName) { showToast('Category name is required', 'err'); return }
    const onDone = {
      onSuccess: () => { showToast(serviceCatModal.mode === 'add' ? 'Category added' : 'Category updated', 'ok'); setServiceCatModal(null) },
      onError: () => showToast('Could not save category — name may already be in use', 'err'),
    }
    if (serviceCatModal.mode === 'add') createServiceCategory.mutate({ categoryName }, onDone)
    else updateServiceCategory.mutate({ guid: serviceCatModal.row!.serviceCategoryGuid, payload: { categoryName } }, onDone)
  }

  function removeServiceCategory(guid: string) {
    deleteServiceCategory.mutate(guid, {
      onSuccess: () => showToast('Category removed', 'ok'),
      onError: () => showToast('Could not remove category', 'err'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr"><div><div className="pg-title">Service Category Master</div><div className="pg-sub">Student Services ticketing category configuration</div></div></div>
        <div className="card">
          <div className="card-hdr"><div className="card-title"><i className="lni lni-ticket"></i> Service Category Master</div><button className="btn btn-primary btn-sm" onClick={openAddService}><i className="lni lni-plus"></i> Add</button></div>
          <ScrollTable>
            <table>
              <thead><tr><th>Category</th><th style={{ width: 90 }}></th></tr></thead>
              <tbody>
                {serviceCatsLoading ? (
                  <tr><td colSpan={2} className="text-muted">Loading…</td></tr>
                ) : serviceCats.length === 0 ? (
                  <tr><td colSpan={2} className="text-muted">No categories yet</td></tr>
                ) : serviceCats.map(c => (
                  <tr key={c.serviceCategoryGuid}>
                    <td><strong>{c.categoryName}</strong></td>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openEditService(c)}><i className="lni lni-pencil-alt"></i> Edit</button>
                        <button className="btn btn-neu btn-sm" style={{ color: 'var(--red)' }} onClick={() => removeServiceCategory(c.serviceCategoryGuid)}><i className="lni lni-trash-can"></i> Delete</button>
                      </ActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </div>

      {serviceCatModal && (
        <div className="modal-overlay open" onClick={() => setServiceCatModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title">{serviceCatModal.mode === 'add' ? 'Add' : 'Edit'} Category</div><button className="modal-close" onClick={() => setServiceCatModal(null)}>✕</button></div>
            <div>
              <div className="fg"><label className="lbl">Name <span className="req">*</span></label><input className="ctrl" placeholder="Category name" maxLength={100} value={serviceName} onChange={e => setServiceName(e.target.value)} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-neu" onClick={() => setServiceCatModal(null)}>Cancel</button><button className="btn btn-primary" onClick={saveServiceCategory}>Save</button></div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  )
}
