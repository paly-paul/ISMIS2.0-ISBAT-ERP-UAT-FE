import React, { useState, useEffect } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import {
  useProjectProposals,
  useProjectProposal,
  useUploadProjectProposalDocument
} from '@/hooks/assessment/useProjectProposals'
import { ProjectProposalRow, getProjectProposalSynopsis } from '@/lib/api/assessment/projectProposals'

interface ProjectProposalUploadModalProps {
  isOpen: boolean
  onClose: () => void
  proposalGuid?: string | null
  initialRow?: ProjectProposalRow | null
  onSuccess?: () => void
}

export function ProjectProposalUploadModal({
  isOpen,
  onClose,
  proposalGuid: propGuid,
  initialRow,
  onSuccess
}: ProjectProposalUploadModalProps) {
  const [selectedGuid, setSelectedGuid] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { data: allProposals, isLoading: isLoadingProposals } = useProjectProposals()
  const activeGuid = propGuid || selectedGuid
  const { data: proposalDetail, isLoading: isLoadingDetail } = useProjectProposal(activeGuid || null)
  const uploadMut = useUploadProjectProposalDocument()

  // Find active proposal row for quick summary info
  const activeProposal = initialRow || allProposals?.find(p => p.proposalGuid === activeGuid) || null

  useEffect(() => {
    if (isOpen) {
      setSelectedGuid(propGuid || '')
      setSelectedFile(null)
      setIsDragOver(false)
      setErrorMsg('')
    }
  }, [isOpen, propGuid])

  if (!isOpen) return null

  const handleFileChange = (file: File | null) => {
    setErrorMsg('')
    if (!file) {
      setSelectedFile(null)
      return
    }

    const validExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!validExtensions.includes(ext)) {
      setErrorMsg(`Invalid file type (${ext}). Supported formats: ${validExtensions.join(', ')}`)
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 10MB limit.')
      return
    }

    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleDownloadExisting = async () => {
    if (!activeGuid) return
    try {
      const data = await getProjectProposalSynopsis(activeGuid)
      if (data && data.url) {
        window.open(data.url, '_blank')
      } else {
        setErrorMsg('Document file link could not be retrieved.')
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to download document.')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!activeGuid) {
      setErrorMsg('Please select a project proposal.')
      return
    }

    if (!selectedFile) {
      setErrorMsg('Please choose a document file to upload.')
      return
    }

    uploadMut.mutate(
      { guid: activeGuid, file: selectedFile },
      {
        onSuccess: () => {
          if (onSuccess) onSuccess()
          onClose()
        },
        onError: (err: any) => {
          setErrorMsg(err?.message || 'Failed to upload project document. Please try again.')
        }
      }
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const proposalOptions = (allProposals || []).map(p => ({
    value: p.proposalGuid,
    label: `${p.studentNum ? `${p.studentNum} - ` : ''}${p.studentName || 'Student'} (${p.projectName || 'Untitled Project'})`
  }))

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className="lni lni-cloud-upload"></i> Upload Project Document
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <i className="lni lni-close"></i>
          </button>
        </div>

        <div>
          {errorMsg && (
            <div className="p-3 mb-4 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="lni lni-warning text-base"></i>
                <span>{errorMsg}</span>
              </div>
              <button type="button" onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700">
                <i className="lni lni-close text-xs"></i>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '6px' }}>
            {/* If opened generally without proposal preselected */}
            {!propGuid ? (
              <div className="fg mb-0">
                <div className="lbl">
                  Select Project Proposal <span className="req">*</span>
                </div>
                <SearchSelect
                  placeholder="Select Project Proposal..."
                  options={proposalOptions}
                  value={selectedGuid}
                  onChange={val => {
                    setSelectedGuid(val)
                    setErrorMsg('')
                  }}
                  disabled={isLoadingProposals || uploadMut.isPending}
                />
              </div>
            ) : null}

            {/* Target Proposal Summary Card */}
            {activeProposal && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Target Proposal Details
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Student:</span>{' '}
                    <strong className="text-slate-800">
                      {activeProposal.studentName || 'N/A'} {activeProposal.studentNum ? `(${activeProposal.studentNum})` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Course Unit:</span>{' '}
                    <strong className="text-slate-800">
                      {activeProposal.unitCode ? `${activeProposal.unitCode} - ` : ''}{activeProposal.unitName || 'N/A'}
                    </strong>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-500">Project:</span>{' '}
                    <span className="font-semibold text-indigo-700">{activeProposal.projectName}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Current Synopsis / Document If Available */}
            {proposalDetail?.synopsisFileName && (
              <div className="flex items-center justify-between p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-blue-900">
                  <i className="lni lni-files text-base text-blue-600"></i>
                  <div>
                    <div className="font-semibold">{proposalDetail.synopsisFileName}</div>
                    <span className="text-blue-600 text-[11px]">Currently attached document</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExisting}
                  className="btn btn-white btn-sm text-blue-700 hover:text-blue-900 text-xs py-1 px-2.5"
                  title="Download Current File"
                >
                  <i className="lni lni-download mr-1"></i> View / Download
                </button>
              </div>
            )}

            {/* Drag and Drop Upload Area */}
            <div className="fg mb-0">
              <div className="lbl">
                Choose Document File <span className="req">*</span>
              </div>
              <div
                onDragOver={e => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
                onClick={() => document.getElementById('project-doc-file-input')?.click()}
              >
                <input
                  id="project-doc-file-input"
                  type="file"
                  className="hidden"
                  accept=".doc,.docx,.pdf,.ppt,.pptx"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0])
                    }
                  }}
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                    <i className="lni lni-cloud-upload"></i>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    Click to browse or drag & drop file here
                  </div>
                  <div className="text-xs text-slate-500">
                    Supports <strong>PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx)</strong> · Max 10MB
                  </div>
                </div>
              </div>
            </div>

            {/* Selected File Details */}
            {selectedFile && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-base shrink-0">
                    <i className="lni lni-empty-file"></i>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-950 text-sm truncate max-w-[280px]">
                      {selectedFile.name}
                    </div>
                    <div className="text-emerald-700 text-[11px] font-mono">
                      {formatFileSize(selectedFile.size)} · Ready to upload
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-rose-500 hover:text-rose-700 p-1.5 rounded hover:bg-rose-50"
                  title="Remove selected file"
                >
                  <i className="lni lni-trash-can text-base"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-neu"
            onClick={onClose}
            disabled={uploadMut.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploadMut.isPending || !activeGuid || !selectedFile}
            onClick={handleSubmit}
          >
            {uploadMut.isPending ? (
              <>
                <i className="lni lni-spinner-solid animate-spin mr-1"></i> Uploading Document...
              </>
            ) : (
              <>
                <i className="lni lni-cloud-upload mr-1"></i> Upload Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
