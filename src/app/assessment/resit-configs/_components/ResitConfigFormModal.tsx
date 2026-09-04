import { useState, useEffect } from 'react'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import { useCreateResitConfig, useResitConfig, useUpdateResitConfig } from '@/hooks/assessment/useResitConfigs'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { SearchSelect } from '@/components/SearchSelect'

interface ResitConfigFormModalProps {
  isOpen: boolean
  onClose: () => void
  showToast: (msg: string, type?: string) => void
  editingGuid: string | null
}

export function ResitConfigFormModal({ isOpen, onClose, showToast, editingGuid }: ResitConfigFormModalProps) {
  const isEdit = !!editingGuid
  const { data: existingData, isLoading } = useResitConfig(editingGuid, isOpen && isEdit)
  const createMut = useCreateResitConfig()
  const updateMut = useUpdateResitConfig()
  
  const { data: intakes } = useIntakes()

  const [refCode, setRefCode] = useState('')
  const [academicIntakeGuid, setAcademicIntakeGuid] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(false)
  
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (isEdit && existingData) {
        setRefCode(existingData.refCode || '')
        setAcademicIntakeGuid(existingData.academicIntakeGuid || '')
        setStartDate(existingData.startDate ? existingData.startDate.split('T')[0] : '')
        setEndDate(existingData.endDate ? existingData.endDate.split('T')[0] : '')
        setIsActive(!!existingData.isActive)
      } else if (!isEdit) {
        setRefCode('')
        setAcademicIntakeGuid('')
        setStartDate('')
        setEndDate('')
        setIsActive(false)
      }
      setErrorMsg('')
    }
  }, [isOpen, isEdit, existingData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    
    const rTrim = refCode.trim()

    if (!rTrim) return setErrorMsg('Reference Code is required.')
    if (rTrim.length > 20) return setErrorMsg('Reference Code cannot exceed 20 characters.')
    if (!academicIntakeGuid) return setErrorMsg('Academic Intake is required.')
    if (!startDate) return setErrorMsg('Start Date is required.')
    if (!endDate) return setErrorMsg('End Date is required.')
    
    if (new Date(endDate) < new Date(startDate)) {
      return setErrorMsg('End Date must be after or equal to Start Date.')
    }
    
    try {
      const payload = {
        refCode: rTrim,
        academicIntakeGuid,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        isActive
      }

      if (isEdit) {
        await updateMut.mutateAsync({ guid: editingGuid as string, input: payload })
      } else {
        await createMut.mutateAsync(payload)
      }
      setShowSuccess(true)
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed')
    }
  }

  function handleSuccessClose() {
    setShowSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  if (showSuccess) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup 
            title={isEdit ? 'Resit Config Updated' : 'Resit Config Created'}
            subtitle={isEdit ? 'The resit configuration has been updated successfully.' : 'New resit configuration has been created successfully.'}
            onClose={handleSuccessClose}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-md flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue shrink-0">
          <div className="modal-title">{isEdit ? 'Edit Resit Config' : 'New Resit Config'}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="modal-body p-5 flex flex-col flex-1 gap-4 bg-slate-50">
            {isLoading && isEdit ? (
              <div className="p-6 text-center text-g500">Loading details...</div>
            ) : (
              <>
                <div className="fg mb-0">
                  <label className="lbl">Reference Code <span className="text-clr-red">*</span></label>
                  <input 
                    type="text"
                    className="ctrl" 
                    placeholder="e.g. Resit Spring 2026" 
                    value={refCode}
                    onChange={e => setRefCode(e.target.value)}
                    maxLength={20}
                    required
                  />
                  <div className="text-xs text-g400 mt-1">Max 20 characters. Must be unique.</div>
                </div>

                <div className="fg mb-0">
                  <label className="lbl">Academic Intake <span className="text-clr-red">*</span></label>
                  <SearchSelect 
                    options={intakes?.map(i => ({ value: i.intakeGuid, label: i.description })) || []}
                    value={academicIntakeGuid}
                    onChange={val => setAcademicIntakeGuid(val)}
                    placeholder="Select an intake"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="fg mb-0">
                    <label className="lbl">Start Date <span className="text-clr-red">*</span></label>
                    <input 
                      type="date"
                      className="ctrl" 
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="fg mb-0">
                    <label className="lbl">End Date <span className="text-clr-red">*</span></label>
                    <input 
                      type="date"
                      className="ctrl" 
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      min={startDate}
                      required
                    />
                  </div>
                </div>

                <div className="fg mb-0">
                  <label className="flex items-center gap-2 cursor-pointer mt-2 p-3 border border-slate-200 rounded bg-white">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-primary"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-g800">Set as Active Window</span>
                      <span className="text-xs text-g500">Activating this will automatically deactivate any currently active resit window.</span>
                    </div>
                  </label>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 text-clr-red rounded border border-red-100 text-sm">
                    {errorMsg}
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="modal-footer shrink-0">
            <span className="flex-1"></span>
            <button type="button" className="btn btn-neu" onClick={onClose} disabled={createMut.isPending || updateMut.isPending}>Cancel</button>
            <button type="submit" className="btn btn-primary ml-2" disabled={createMut.isPending || updateMut.isPending || (isLoading && isEdit)}>
              {createMut.isPending || updateMut.isPending ? 'Saving...' : (isEdit ? 'Update Config' : 'Create Config')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
