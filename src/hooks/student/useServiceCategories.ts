import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createServiceCategory,
  deleteServiceCategory,
  getServiceCategories,
  ServiceCategoryRequest,
  updateServiceCategory,
} from '@/lib/api/student/serviceCategories'

const SERVICE_CATEGORIES_KEY = ['service-categories']

export function useServiceCategories() {
  return useQuery({
    queryKey: SERVICE_CATEGORIES_KEY,
    queryFn: () => getServiceCategories(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateServiceCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ServiceCategoryRequest) => createServiceCategory(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SERVICE_CATEGORIES_KEY }),
  })
}

export function useUpdateServiceCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, payload }: { guid: string; payload: ServiceCategoryRequest }) => updateServiceCategory(guid, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SERVICE_CATEGORIES_KEY }),
  })
}

export function useDeleteServiceCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteServiceCategory(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SERVICE_CATEGORIES_KEY }),
  })
}

export type { ServiceCategoryDto, ServiceCategoryRequest, PagedResult } from '@/lib/api/student/serviceCategories'
