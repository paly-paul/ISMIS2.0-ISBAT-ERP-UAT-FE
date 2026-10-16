import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProjectProposal, getProjectProposalSynopsis, ProjectProposalRow } from '@/lib/api/assessment/projectProposals'
import { useUploadProjectProposalDocument } from '@/hooks/assessment/useProjectProposals'

interface ProjectProposalViewModalProps {
  isOpen: boolean
  onClose: () => void
  proposalGuid: string | null
  row?: ProjectProposalRow | null
  onToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void
}

export function ProjectProposalViewModal({ isOpen, onClose, proposalGuid, row, onToast }: ProjectProposalViewModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data: proposal, isLoading } = useQuery({
    queryKey: ['assessment', 'project-proposals', proposalGuid],
    queryFn: () => getProjectProposal(proposalGuid!),
    enabled: !!proposalGuid && isOpen
  })

  const uploadMut = useUploadProjectProposalDocument()

  if (!isOpen) return null

  const handleDownloadSynopsis = async () => {
    if (!proposalGuid) return
    try {
      const data = await getProjectProposalSynopsis(proposalGuid)
      if (data && data.url) {
        window.open(data.url, '_blank')
        onToast(`Synopsis download started for ${row?.studentName || proposal?.studentGuid || 'student'}`)
      } else {
        onToast('No synopsis file found for this proposal.', 'warn')
      }
    } catch (err: any) {
      onToast(err?.message || 'Failed to download synopsis.', 'error')
    }
  }

  const handleUpload = () => {
    if (!proposalGuid || !selectedFile) {
      onToast('Please select a document file to upload.', 'warn')
      return
    }

    uploadMut.mutate(
      { guid: proposalGuid, file: selectedFile },
      {
        onSuccess: () => {
          setSelectedFile(null)
          onToast('Document uploaded successfully!', 'success')
        },
        onError: (err: any) => {
          onToast(err?.message || 'Failed to upload document.', 'error')
        }
      }
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-flex max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className="lni lni-eye"></i> Project Proposal Details
          </div>
          <button onClick={onClose} className="modal-close">
            <i className="lni lni-close"></i>
          </button>
        </div>

        <div className="modal-body p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="spinner"></div>
            </div>
          ) : !proposal ? (
            <div className="text-center text-gray-500 py-10">Proposal not found.</div>
          ) : (
            <div className="space-y-6">
              
              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 font-medium uppercase mb-1">Student / Group</div>
                  <div className="font-semibold text-slate-800 text-base">{row?.studentName || proposal.studentGuid || 'N/A'}</div>
                  <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                    {row?.studentNum && <span className="font-mono text-xs">{row.studentNum}</span>}
                    {proposal.isGroup ? (
                      <span className="badge badge-indigo">Group of {proposal.studentCount}</span>
                    ) : (
                      <span className="badge badge-slate">Solo Project</span>
                    )}
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 font-medium uppercase mb-1">Course Unit</div>
                  <div className="font-semibold text-slate-800 text-base">{row?.unitName || proposal.unitGuid || 'N/A'}</div>
                  {row?.unitCode && <div className="text-xs text-slate-500 font-mono mt-1">{row.unitCode}</div>}
                </div>
              </div>

              {/* Project Details */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 border-b pb-2">Project Information</h4>
                <div className="grid grid-cols-1 gap-4 mt-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Project Name</div>
                    <div className="text-slate-800 font-medium">{proposal.projectName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Objective</div>
                    <div className="text-slate-700 text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-100 min-h-[60px]">
                      {proposal.objective || 'No objective provided.'}
                    </div>
                  </div>
                  {proposal.isGroup && proposal.members && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Group Members</div>
                      <div className="text-slate-700 text-sm bg-slate-50 p-3 rounded border border-slate-100">
                        {proposal.members}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents & Upload */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 border-b pb-2">Documents</h4>
                
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-3">
                  {/* Synopsis File */}
                  <div className="p-3 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                        <i className="lni lni-files text-lg"></i>
                      </div>
                      <div>
                        <div className="font-medium text-slate-800 text-sm">{proposal.synopsisFileName || 'Synopsis Document'}</div>
                        <div className="text-xs text-slate-500">Initial Project Synopsis</div>
                      </div>
                    </div>
                    <div>
                      <button onClick={handleDownloadSynopsis} className="btn btn-white btn-sm" title="Download">
                        <i className="lni lni-download"></i> Download
                      </button>
                    </div>
                  </div>

                  {/* Upload Additional File */}
                  <div className="p-4 bg-slate-50 flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Upload Additional Document</label>
                      <input
                        type="file"
                        className="form-control text-sm"
                        accept=".doc,.docx,.pdf,.ppt,.pptx"
                        onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            setSelectedFile(e.target.files[0])
                          } else {
                            setSelectedFile(null)
                          }
                        }}
                      />
                    </div>
                    <div className="pt-5">
                      <button
                        onClick={handleUpload}
                        className="btn btn-primary btn-sm"
                        disabled={uploadMut.isPending || !selectedFile}
                      >
                        {uploadMut.isPending ? (
                          <>
                            <i className="lni lni-spinner-solid animate-spin mr-1"></i> Uploading...
                          </>
                        ) : (
                          <>
                            <i className="lni lni-cloud-upload mr-1"></i> Upload
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  <i className="lni lni-information"></i> Upload final reports, presentations, or supporting materials here.
                </p>
              </div>

            </div>
          )}
        </div>

        <div className="modal-ftr">
          <span className="flex-1"></span>
          <button onClick={onClose} className="btn btn-neu">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
