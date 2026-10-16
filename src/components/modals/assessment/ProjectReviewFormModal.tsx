import React, { useState, useEffect } from 'react'
import {
  useCreateProjectReview,
  useUpdateProjectReview,
  useProjectReviewByGuid
} from '@/hooks/assessment/useProjectReviews'

interface ProjectReviewFormModalProps {
  isOpen: boolean
  onClose: () => void
  proposalGuid: string | null
  reviewGuid?: string | null
  onSuccess?: () => void
}

export function ProjectReviewFormModal({ isOpen, onClose, proposalGuid, reviewGuid, onSuccess }: ProjectReviewFormModalProps) {
  const [reviewDate, setReviewDate] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [currentStatus, setCurrentStatus] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = !!reviewGuid

  const { data: existingData, isLoading: isLoadingExisting } = useProjectReviewByGuid(reviewGuid || null)
  
  const createMut = useCreateProjectReview()
  const updateMut = useUpdateProjectReview()

  useEffect(() => {
    if (isOpen && !isEdit) {
      setReviewDate(new Date().toISOString().split('T')[0])
      setRecommendations('')
      setCurrentStatus('')
      setErrorMsg('')
    }
  }, [isOpen, isEdit])

  useEffect(() => {
    if (isEdit && existingData) {
      setReviewDate(existingData.reviewDate ? existingData.reviewDate.split('T')[0] : '')
      setRecommendations(existingData.recommendations || '')
      setCurrentStatus(existingData.currentStatus || '')
      setErrorMsg('')
    }
  }, [isEdit, existingData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!reviewDate) {
      setErrorMsg('Please select a review date.')
      return
    }
    if (!proposalGuid) {
      setErrorMsg('Proposal is missing.')
      return
    }

    const reqData = {
      reviewDate,
      recommendations,
      currentStatus
    }

    if (isEdit) {
      updateMut.mutate({ reviewGuid: reviewGuid!, req: reqData }, {
        onSuccess: () => {
          if (onSuccess) onSuccess()
          onClose()
        },
        onError: (err: any) => {
          setErrorMsg(err?.message || 'Failed to update review.')
        }
      })
    } else {
      createMut.mutate({ proposalGuid, req: reqData }, {
        onSuccess: () => {
          if (onSuccess) onSuccess()
          onClose()
        },
        onError: (err: any) => {
          setErrorMsg(err?.message || 'Failed to create review.')
        }
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-plus'}`}></i> {isEdit ? 'Edit Project Review' : 'Add Project Review'}
          </div>
          <button className="modal-close" type="button" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div>
          {errorMsg && (
            <div className="p-3 mb-4 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-sm">
              <i className="lni lni-close mr-2"></i>{errorMsg}
            </div>
          )}
          
          {isEdit && isLoadingExisting ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
              <span style={{ color: 'var(--g400)' }}>Loading review details...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
              <div className="fg mb-0">
                <div className="lbl">Review Date <span className="req">*</span></div>
                <input 
                  type="date" 
                  className="ctrl"
                  value={reviewDate}
                  onChange={e => setReviewDate(e.target.value)}
                />
              </div>

              <div className="fg mb-0">
                <div className="lbl">Current Status</div>
                <input 
                  type="text"
                  className="ctrl"
                  value={currentStatus}
                  onChange={e => setCurrentStatus(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Literature review in progress"
                />
              </div>

              <div className="fg mb-0">
                <div className="lbl">Recommendations</div>
                <textarea 
                  className="ctrl"
                  style={{ height: '80px', resize: 'none' }}
                  value={recommendations}
                  onChange={e => setRecommendations(e.target.value)}
                  maxLength={500}
                  placeholder="Supervisor's recommendations"
                ></textarea>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-neu" onClick={onClose} disabled={createMut.isPending || updateMut.isPending}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending || (isEdit && isLoadingExisting)} onClick={handleSubmit}>
            {createMut.isPending || updateMut.isPending ? (
              <><i className="lni lni-spinner-solid animate-spin mr-1"></i> Saving...</>
            ) : (
              <><i className="lni lni-checkmark mr-1"></i> {isEdit ? 'Update Review' : 'Save Review'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
