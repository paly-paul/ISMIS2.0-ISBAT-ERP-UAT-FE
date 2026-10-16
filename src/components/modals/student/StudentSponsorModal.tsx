'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SearchSelect } from '@/components/SearchSelect'
import { useSponsorDetails, useSponsorCategories, useAssignSponsorCategory } from '@/hooks/student/useSponsor'
import { AuthError } from '@/lib/api/client'

interface Props extends ModalProps {
  studentGuid: string | null
  studentName?: string
}

// Sponsor-category assignment (students/sponsor-assignment/*.md), moved off the
// Student Profile page's inline editor so Student Master's row action menu
// owns it — same split as StudentRefugeeModal. Profile's Sponsor field is
// read-only and deep-links here. Shares useSponsor's cache, so a change here
// shows on Profile straight away. There's no un-assign endpoint — re-posting
// a different category is how a sponsor is changed.
export function StudentSponsorModal({ isOpen, onClose, showToast, studentGuid, studentName }: Props) {
  // An error from useSponsorDetails is a real 401
  // ("not authorized to view sponsor details for students in this campus",
  // seen live 2026-08-25), not "no assignment" (that resolves to null).
  const { data: sponsorDetail, isLoading, error } = useSponsorDetails(studentGuid, isOpen)
  const { data: categoriesPage, isLoading: isCategoriesLoading } = useSponsorCategories(isOpen)
  const categoryOptions = (categoriesPage?.items ?? []).map(c => ({ value: c.sponsorCategoryGuid, label: c.category }))
  const assignSponsorCategory = useAssignSponsorCategory()

  const [choice, setChoice] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setChoice(sponsorDetail?.sponsorCategoryGuid ?? '')
  }, [isOpen, sponsorDetail])

  if (!isOpen || !studentGuid) return null

  // Only a real access denial blocks the form. Any other failure (500,
  // validation, etc.) is ignored silently and falls back to "Unassigned" —
  // the POST is a separate endpoint and may still succeed.
  const errorCode = error instanceof AuthError ? error.code : null
  const restricted = errorCode === 'unauthorized' || errorCode === 'forbidden'
  const errorMessage = error instanceof Error ? error.message : null
  const unchanged = !!sponsorDetail && choice === sponsorDetail.sponsorCategoryGuid

  function handleSave() {
    if (!studentGuid) return
    if (!choice) { showToast('Please select a sponsor category.', 'warn'); return }
    assignSponsorCategory.mutate(
      { studentGuid, sponsorCategoryGuid: choice },
      {
        onSuccess: () => { showToast(sponsorDetail ? 'Sponsor category updated' : 'Sponsor category assigned', 'ok'); onClose() },
        onError: (err: Error) => showToast(err.message || 'Could not update sponsor category', 'err'),
      }
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr"><div className="modal-title"><i className="lni lni-handshake"></i> Sponsor Assignment</div><button className="modal-close" onClick={onClose}>✕</button></div>
        <div>
          {studentName && <div className="fg"><label className="lbl">Student</label><input className="ctrl" readOnly value={studentName} /></div>}

          {isLoading ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading sponsor details…</div>
          ) : restricted ? (
            <div className="info-box"><i className="lni lni-lock-alt" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12.5 }}>{errorMessage || 'You are not authorized to view or change sponsor details for students in this campus.'}</div></div>
          ) : (
            <>
              <div className="fg"><label className="lbl">Current Sponsor</label><input className="ctrl" readOnly value={sponsorDetail?.category ?? 'Unassigned'} /></div>
              <div className="fg">
                <label className="lbl">{sponsorDetail ? 'Change To' : 'Sponsor Category'} <span className="req">*</span></label>
                <SearchSelect
                  placeholder={isCategoriesLoading ? 'Loading categories…' : '-- Select Sponsor Category --'}
                  options={categoryOptions}
                  value={choice}
                  onChange={setChoice}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Close</button>
          {!isLoading && !restricted && (
            <button className="btn btn-primary" onClick={handleSave} disabled={assignSponsorCategory.isPending || unchanged}>
              <i className="lni lni-checkmark"></i> {assignSponsorCategory.isPending ? 'Saving…' : sponsorDetail ? 'Update Sponsor' : 'Assign Sponsor'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
