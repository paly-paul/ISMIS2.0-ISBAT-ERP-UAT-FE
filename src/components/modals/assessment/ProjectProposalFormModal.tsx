import React, { useState, useEffect } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import {
  useProjectProposalUnits,
  useProjectProposalEligibleStudents,
  useCreateProjectProposal,
  useUpdateProjectProposal,
  useProjectProposal
} from '@/hooks/assessment/useProjectProposals'

interface ProjectProposalFormModalProps {
  isOpen: boolean
  onClose: () => void
  proposalGuid?: string | null
  onSuccess?: () => void
}

export function ProjectProposalFormModal({ isOpen, onClose, proposalGuid, onSuccess }: ProjectProposalFormModalProps) {
  const [unitGuid, setUnitGuid] = useState('')
  const [studentGuid, setStudentGuid] = useState('')
  const [projectName, setProjectName] = useState('')
  const [objective, setObjective] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [studentCount, setStudentCount] = useState<number | ''>('')
  const [members, setMembers] = useState('')
  const [proposalDate, setProposalDate] = useState('')
  const [synopsisFile, setSynopsisFile] = useState<File | null>(null)
  const [removeSynopsis, setRemoveSynopsis] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = !!proposalGuid

  const { data: units, isLoading: isLoadingUnits } = useProjectProposalUnits()
  const { data: eligibleStudents, isLoading: isLoadingStudents } = useProjectProposalEligibleStudents(unitGuid)
  const { data: existingData, isLoading: isLoadingExisting } = useProjectProposal(proposalGuid || null)

  const createMut = useCreateProjectProposal()
  const updateMut = useUpdateProjectProposal()

  useEffect(() => {
    if (isOpen && !isEdit) {
      setUnitGuid('')
      setStudentGuid('')
      setProjectName('')
      setObjective('')
      setIsGroup(false)
      setStudentCount('')
      setMembers('')
      setProposalDate(new Date().toISOString().split('T')[0])
      setSynopsisFile(null)
      setRemoveSynopsis(false)
      setErrorMsg('')
    }
  }, [isOpen, isEdit])

  useEffect(() => {
    if (isEdit && existingData) {
      setUnitGuid(existingData.unitGuid || '')
      setStudentGuid(existingData.studentGuid || '')
      setProjectName(existingData.projectName || '')
      setObjective(existingData.objective || '')
      setIsGroup(existingData.isGroup || false)
      setStudentCount(existingData.studentCount || '')
      setMembers(existingData.members || '')
      setProposalDate(existingData.proposalDate ? existingData.proposalDate.split('T')[0] : '')
      setSynopsisFile(null)
      setRemoveSynopsis(false)
      setErrorMsg('')
    }
  }, [isEdit, existingData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!unitGuid || !studentGuid || !projectName || !proposalDate) {
      setErrorMsg('Please fill in all required fields.')
      return
    }

    const formData = new FormData()
    formData.append('unitGuid', unitGuid)
    formData.append('studentGuid', studentGuid)
    formData.append('projectName', projectName)
    formData.append('objective', objective)
    formData.append('isGroup', String(isGroup))
    formData.append('studentCount', String(studentCount))
    formData.append('members', members)
    formData.append('proposalDate', proposalDate)
    formData.append('removeSynopsis', String(removeSynopsis))
    if (synopsisFile) {
      formData.append('synopsis', synopsisFile)
    }

    if (isEdit) {
      updateMut.mutate({ guid: proposalGuid!, req: formData }, {
        onSuccess: () => {
          if (onSuccess) onSuccess()
          onClose()
        },
        onError: (err: any) => {
          setErrorMsg(err?.message || 'Failed to update proposal.')
        }
      })
    } else {
      createMut.mutate(formData, {
        onSuccess: () => {
          if (onSuccess) onSuccess()
          onClose()
        },
        onError: (err: any) => {
          setErrorMsg(err?.message || 'Failed to create proposal.')
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
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-plus'}`}></i> {isEdit ? 'Edit Project Proposal' : 'Add Project Proposal'}
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
              <span style={{ color: 'var(--g400)' }}>Loading proposal details...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
              <div className="fg mb-0">
                <div className="lbl">Course Unit <span className="req">*</span></div>
                <SearchSelect 
                  placeholder="Select Course Unit"
                  value={unitGuid}
                  onChange={(val) => {
                    setUnitGuid(val)
                    setStudentGuid('')
                  }}
                  disabled={isEdit || isLoadingUnits}
                  options={[
                    { value: '', label: 'Select Course Unit' },
                    ...(units || []).map(u => ({
                      value: u.unitGuid,
                      label: `${u.unitCode} - ${u.unitName}`
                    }))
                  ]}
                />
              </div>
              
              <div className="fg mb-0">
                <div className="lbl">Student <span className="req">*</span></div>
                <SearchSelect 
                  placeholder="Select Student"
                  value={studentGuid}
                  onChange={setStudentGuid}
                  disabled={isEdit || !unitGuid || isLoadingStudents}
                  options={[
                    { value: '', label: 'Select Student' },
                    ...(isEdit && existingData ? [
                      { value: existingData.studentGuid, label: 'Student Selected' }
                    ] : (eligibleStudents || []).map(s => ({
                      value: s.studentGuid,
                      label: `${s.studentNum} - ${s.studentName}`
                    })))
                  ]}
                />
              </div>

              <div className="fg mb-0">
                <div className="lbl">Project Name <span className="req">*</span></div>
                <input 
                  type="text" 
                  className="ctrl"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  maxLength={200}
                  placeholder="Enter project title"
                />
              </div>
              
              <div className="fg mb-0">
                <div className="lbl">Proposal Date <span className="req">*</span></div>
                <input 
                  type="date" 
                  className="ctrl"
                  value={proposalDate}
                  onChange={e => setProposalDate(e.target.value)}
                />
              </div>

              <div className="fg mb-0">
                <div className="lbl">Objective</div>
                <textarea 
                  className="ctrl"
                  style={{ height: '80px', resize: 'none' }}
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  maxLength={500}
                  placeholder="Brief description of the project"
                ></textarea>
              </div>

              <div className="fg mb-0 mt-2 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="chkGroup" 
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  checked={isGroup}
                  onChange={e => setIsGroup(e.target.checked)}
                />
                <label htmlFor="chkGroup" className="text-sm font-semibold text-slate-700 mb-0 cursor-pointer">Is this a Group Project?</label>
              </div>

              {isGroup && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                  <div className="fg mb-0">
                    <div className="lbl">Student Count</div>
                    <input 
                      type="number" 
                      min="1" 
                      max="99"
                      className="ctrl"
                      value={studentCount}
                      onChange={e => setStudentCount(e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>
                  <div className="fg mb-0">
                    <div className="lbl">Members List</div>
                    <input 
                      type="text" 
                      className="ctrl"
                      value={members}
                      onChange={e => setMembers(e.target.value)}
                      maxLength={500}
                      placeholder="Comma separated names or IDs"
                    />
                  </div>
                </div>
              )}

              <div className="fg mb-0">
                <div className="lbl">Synopsis Document</div>
                
                {isEdit && existingData?.synopsisFileName && !removeSynopsis && (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-md mb-2">
                    <div className="flex items-center gap-2 text-emerald-700 text-sm">
                      <i className="lni lni-empty-file text-lg"></i>
                      <span className="font-medium">{existingData.synopsisFileName}</span>
                    </div>
                    <button 
                      type="button" 
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Remove Document"
                      onClick={() => setRemoveSynopsis(true)}
                    >
                      <i className="lni lni-trash-can"></i>
                    </button>
                  </div>
                )}

                <input 
                  type="file" 
                  className="ctrl text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  accept=".doc,.docx,.pdf,.ppt,.pptx"
                  style={{ padding: '6px' }}
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSynopsisFile(e.target.files[0])
                      setRemoveSynopsis(false)
                    } else {
                      setSynopsisFile(null)
                    }
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Accepted formats: .doc, .docx, .pdf, .ppt, .pptx (Max 5MB)</p>
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
              <><i className="lni lni-checkmark mr-1"></i> {isEdit ? 'Update Proposal' : 'Save Proposal'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
