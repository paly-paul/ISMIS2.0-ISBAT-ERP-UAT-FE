import { useQuery } from '@tanstack/react-query'
import { getResitApplicationCourseUnits, getResitApplications, ResitApplicationQueryParams } from '@/lib/api/assessment/resitApplications'

export function useResitAppCourseUnits() {
  return useQuery({
    queryKey: ['assessment-attendance-service', 'assessment', 'resit-application', 'list-application-units'],
    queryFn: getResitApplicationCourseUnits
  })
}

export function useResitApplications(params: ResitApplicationQueryParams) {
  return useQuery({
    queryKey: ['assessment-attendance-service', 'assessment', 'resit-application', 'list-applications', params],
    queryFn: () => getResitApplications(params)
  })
}
