import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  SaveResitConfigRequest,
  createResitConfig,
  deleteResitConfig,
  getResitConfigById,
  getResitConfigs,
  updateResitConfig
} from '@/lib/api/assessment/resitConfig'

const RESIT_CONFIGS_KEY = ['resit-configs']

export function useResitConfigs(page: number, pageSize: number, academicIntakeGuid?: string) {
  return useQuery({
    queryKey: [...RESIT_CONFIGS_KEY, page, pageSize, academicIntakeGuid],
    queryFn: () => getResitConfigs(page, pageSize, academicIntakeGuid),
  })
}

export function useResitConfig(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...RESIT_CONFIGS_KEY, guid],
    queryFn: () => getResitConfigById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateResitConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveResitConfigRequest) => createResitConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESIT_CONFIGS_KEY })
    },
  })
}

export function useUpdateResitConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: SaveResitConfigRequest }) => updateResitConfig(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: RESIT_CONFIGS_KEY })
      queryClient.invalidateQueries({ queryKey: [...RESIT_CONFIGS_KEY, guid] })
    },
  })
}

export function useDeleteResitConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteResitConfig(guid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESIT_CONFIGS_KEY })
    },
  })
}
