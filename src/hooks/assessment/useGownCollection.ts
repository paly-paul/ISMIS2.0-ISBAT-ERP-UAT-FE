import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { searchGownCollection, recordGownCollection } from '@/lib/api/assessment/gownCollection'

export const GOWN_COLLECTION_QUERY_KEY = 'gownCollectionSearch'

export function useGownCollectionSearch(searchTerm: string) {
  return useQuery({
    queryKey: [GOWN_COLLECTION_QUERY_KEY, searchTerm],
    queryFn: () => searchGownCollection(searchTerm),
    enabled: !!searchTerm && searchTerm.length > 2,
    staleTime: 1000 * 60 * 5, // 5 mins
  })
}

export function useRecordGownCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (studentGuid: string) => recordGownCollection(studentGuid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GOWN_COLLECTION_QUERY_KEY] })
    }
  })
}
