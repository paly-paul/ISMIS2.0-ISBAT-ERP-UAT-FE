import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { getAuditSources, getConsolidatedAuditLogs, getScopedAuditLogs, ConsolidatedAuditParams, ScopedAuditParams } from '@/lib/api/audit/audit'

export const AUDIT_SOURCES_KEY = ['audit-sources']
export const AUDIT_LOGS_KEY = ['audit-logs']

export function useAuditSources() {
  return useQuery({
    queryKey: AUDIT_SOURCES_KEY,
    queryFn: getAuditSources,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

interface UseAuditLogsProps {
  userGuid?: string
  from?: string
  to?: string
  entityType?: string
  auditPath?: string
}

export function useAuditLogs(filters: UseAuditLogsProps, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...AUDIT_LOGS_KEY, filters],
    queryFn: ({ pageParam }) => {
      // If userGuid is provided, or if NO auditPath is provided (meaning we need to search across all), 
      // use the consolidated endpoint.
      if (filters.userGuid || !filters.auditPath) {
        if (!filters.userGuid || !filters.from || !filters.to) {
          throw new Error('userGuid, from, and to are required for consolidated audit logs')
        }
        const params: ConsolidatedAuditParams = {
          userGuid: filters.userGuid,
          from: filters.from,
          to: filters.to,
          entityType: filters.entityType,
          pageSize: 20,
        }
        if (pageParam) params.cursor = pageParam as string
        return getConsolidatedAuditLogs(params)
      } 
      
      // Otherwise, use the scoped endpoint
      const params: ScopedAuditParams = {
        entityType: filters.entityType,
        from: filters.from,
        to: filters.to,
        pageSize: 20,
      }
      if (pageParam) params.cursor = pageParam as string
      return getScopedAuditLogs(filters.auditPath, params)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : null,
    enabled,
  })
}
