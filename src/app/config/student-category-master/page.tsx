'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { useSponsorCategories, useCreateSponsorCategory, useUpdateSponsorCategory, useDeleteSponsorCategory, isMandatoryFeeCheck } from '@/hooks/student/useSponsor'
import { SponsorCategoryDto } from '@/lib/api/student/sponsor'

// Split out of the old combined "Category Masters" page (student/masters/)
// per request — this half owns Student Category Master only. Wired to the
// real students/sponsor-categories CRUD API (see students/sponsor-categories/
// *.md) — it's the same resource used to assign a student's sponsor on the
// Profile page. The real record is just { category: string (max 10 chars),
// mandatoryFeeCheck } — there's no free-text "Fee Impact" note field on the
// backend, so that column/input was replaced with the real mandatoryFeeCheck
// flag. Read via isMandatoryFeeCheck() rather than plain truthiness: a live
// GET response (2026-08-25) returns this as the string "Yes"/"No", not the
// 0/1 byte the docs describe — `!!"No"` is true in JS, which silently showed
// every row as "Yes" before that helper.
export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const { data: sponsorCategoriesPage, isLoading: sponsorCatsLoading } = useSponsorCategories()
  const sponsorCats = sponsorCategoriesPage?.items ?? []
  const createSponsorCategory = useCreateSponsorCategory()
  const updateSponsorCategory = useUpdateSponsorCategory()
  const deleteSponsorCategory = useDeleteSponsorCategory()

  const [studentCatModal, setStudentCatModal] = useState<{ mode: 'add' | 'edit'; row?: SponsorCategoryDto } | null>(null)
  const [studentCatName, setStudentCatName] = useState('')
  const [studentCatMandatory, setStudentCatMandatory] = useState(false)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openAddStudentCat() { setStudentCatModal({ mode: 'add' }); setStudentCatName(''); setStudentCatMandatory(false) }
  function openEditStudentCat(row: SponsorCategoryDto) {
    setStudentCatModal({ mode: 'edit', row })
    setStudentCatName(row.category)
    setStudentCatMandatory(isMandatoryFeeCheck(row.mandatoryFeeCheck))
  }

  function saveStudentCategory() {
    if (!studentCatModal) return
    const payload = { category: studentCatName.trim().slice(0, 10), mandatoryFeeCheck: studentCatMandatory ? 1 : 0 }
    if (!payload.category) { showToast('Category name is required', 'err'); return }
    const onDone = { onSuccess: () => { showToast(studentCatModal.mode === 'add' ? 'Category added' : 'Category updated', 'ok'); setStudentCatModal(null) }, onError: () => showToast('Could not save category', 'err') }
    if (studentCatModal.mode === 'add') createSponsorCategory.mutate(payload, onDone)
    else updateSponsorCategory.mutate({ guid: studentCatModal.row!.sponsorCategoryGuid, payload }, onDone)
  }

  function removeStudentCategory(guid: string) {
    deleteSponsorCategory.mutate(guid, {
      onSuccess: () => showToast('Category removed', 'ok'),
      onError: () => showToast('Could not remove category — it may still be assigned to students', 'err'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr"><div><div className="pg-title">Student Category Master</div><div className="pg-sub">Sponsor/student category configuration</div></div></div>
        <div className="card">
          <div className="card-hdr"><div className="card-title"><i className="lni lni-users"></i> Student Category Master</div><button className="btn btn-primary btn-sm" onClick={openAddStudentCat}><i className="lni lni-plus"></i> Add</button></div>
          <ScrollTable>
            <table>
              {/* "Fee Impact" was a free-text note with no backing field — the real
                  resource only has mandatoryFeeCheck, shown as a Yes/No column below. */}
              <thead><tr><th>Category</th><th>Mandatory Fee Check</th><th style={{ width: 90 }}></th></tr></thead>
              <tbody>
                {sponsorCatsLoading ? (
                  <tr><td colSpan={3} className="text-muted">Loading…</td></tr>
                ) : sponsorCats.length === 0 ? (
                  <tr><td colSpan={3} className="text-muted">No categories yet</td></tr>
                ) : sponsorCats.map(c => (
                  <tr key={c.sponsorCategoryGuid}>
                    <td><strong>{c.category}</strong></td>
                    <td className="text-muted">{isMandatoryFeeCheck(c.mandatoryFeeCheck) ? 'Yes' : 'No'}</td>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openEditStudentCat(c)}><i className="lni lni-pencil-alt"></i> Edit</button>
                        <button className="btn btn-neu btn-sm" style={{ color: 'var(--red)' }} onClick={() => removeStudentCategory(c.sponsorCategoryGuid)}><i className="lni lni-trash-can"></i> Delete</button>
                      </ActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </div>

      {studentCatModal && (
        <div className="modal-overlay open" onClick={() => setStudentCatModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title">{studentCatModal.mode === 'add' ? 'Add' : 'Edit'} Student Category</div><button className="modal-close" onClick={() => setStudentCatModal(null)}>✕</button></div>
            <div>
              <div className="fg">
                <label className="lbl">Name <span className="req">*</span></label>
                <input className="ctrl" placeholder="e.g. HEC" maxLength={10} value={studentCatName} onChange={e => setStudentCatName(e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--g500)', marginTop: 4 }}>Max 10 characters — a short code, not a descriptive name.</div>
              </div>
              <div className="fg">
                <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={studentCatMandatory} onChange={e => setStudentCatMandatory(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span>Mandatory Fee Check</span>
                </label>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-neu" onClick={() => setStudentCatModal(null)}>Cancel</button><button className="btn btn-primary" onClick={saveStudentCategory}>Save</button></div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  )
}
