import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProjectReviewUnits,
  getProjectReviewStudents,
  getProjectReviews,
  getProjectReviewByGuid,
  createProjectReview,
  updateProjectReview,
  deleteProjectReview
} from '@/lib/api/assessment/projectReviews'

export function useProjectReviewUnits() {
  return useQuery({
    queryKey: ['assessment', 'project-reviews', 'units'],
    queryFn: getProjectReviewUnits
  })
}

export function useProjectReviewStudents(unitGuid: string) {
  return useQuery({
    queryKey: ['assessment', 'project-reviews', 'students', unitGuid],
    queryFn: () => getProjectReviewStudents(unitGuid),
    enabled: !!unitGuid
  })
}

export function useProjectReviews(proposalGuid: string | null) {
  return useQuery({
    queryKey: ['assessment', 'project-reviews', 'history', proposalGuid],
    queryFn: () => getProjectReviews(proposalGuid!),
    enabled: !!proposalGuid
  })
}

export function useProjectReviewByGuid(reviewGuid: string | null) {
  return useQuery({
    queryKey: ['assessment', 'project-reviews', reviewGuid],
    queryFn: () => getProjectReviewByGuid(reviewGuid!),
    enabled: !!reviewGuid
  })
}

export function useCreateProjectReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ proposalGuid, req }: { proposalGuid: string, req: any }) => createProjectReview(proposalGuid, req),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-reviews', 'history', variables.proposalGuid] })
    }
  })
}

export function useUpdateProjectReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewGuid, req }: { reviewGuid: string, req: any }) => updateProjectReview(reviewGuid, req),
    onSuccess: (data, variables) => {
      // Invalidate the specific review and the proposal's history
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-reviews', variables.reviewGuid] })
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-reviews', 'history'] })
    }
  })
}

export function useDeleteProjectReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProjectReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment', 'project-reviews', 'history'] })
    }
  })
}
