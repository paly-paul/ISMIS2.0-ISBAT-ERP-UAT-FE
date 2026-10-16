import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProjectProposals,
  getProjectProposalUnits,
  getProjectProposalEligibleStudents,
  getProjectProposal,
  getProjectProposalSynopsis,
  createProjectProposal,
  updateProjectProposal,
  deleteProjectProposal,
  uploadProjectProposalDocument
} from '@/lib/api/assessment/projectProposals'

export function useProjectProposals() {
  return useQuery({
    queryKey: ['assessment', 'project-proposals'],
    queryFn: getProjectProposals
  })
}

export function useProjectProposalUnits() {
  return useQuery({
    queryKey: ['assessment', 'project-proposals', 'units'],
    queryFn: getProjectProposalUnits
  })
}

export function useProjectProposalEligibleStudents(unitGuid: string) {
  return useQuery({
    queryKey: ['assessment', 'project-proposals', 'eligible-students', unitGuid],
    queryFn: () => getProjectProposalEligibleStudents(unitGuid),
    enabled: !!unitGuid
  })
}

export function useProjectProposal(guid: string | null) {
  return useQuery({
    queryKey: ['assessment', 'project-proposals', guid],
    queryFn: () => getProjectProposal(guid!),
    enabled: !!guid
  })
}

export function useCreateProjectProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProjectProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-proposals'] })
    }
  })
}

export function useUpdateProjectProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, req }: { guid: string, req: FormData }) => updateProjectProposal(guid, req),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-proposals'] })
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-proposals', variables.guid] })
    }
  })
}

export function useDeleteProjectProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProjectProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-proposals'] })
    }
  })
}

export function useUploadProjectProposalDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, file }: { guid: string, file: File }) => uploadProjectProposalDocument(guid, file),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-proposals'] })
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-proposals', variables.guid] })
    }
  })
}

