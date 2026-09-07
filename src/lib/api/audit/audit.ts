import { apiGet } from '../client'

export interface AuditSource {
  code: string
  name: string
  auditPath: string
  pages: string[]
}

export interface AuditLogItem {
  module: string
  userName: string | null
  action: string
  entityType: string
  summary: string
  changes: string | null
  ipAddress: string
  timestamp: string
  cursor: string
}

export interface AuditLogResponse {
  items: AuditLogItem[]
  hasMore: boolean
  nextCursor: string | null
}

export interface ConsolidatedAuditParams {
  userGuid: string
  from: string
  to: string
  entityType?: string
  cursor?: string
  pageSize?: number
}

export interface ScopedAuditParams {
  entityType?: string
  from?: string
  to?: string
  cursor?: string
  pageSize?: number
}

export function getAuditSources(): Promise<AuditSource[]> {
  return apiGet<AuditSource[]>('/api/v1/users/admin/audit/sources')
}

export function getConsolidatedAuditLogs(params: ConsolidatedAuditParams): Promise<AuditLogResponse> {
  const q = new URLSearchParams()
  q.set('userGuid', params.userGuid)
  q.set('from', params.from)
  q.set('to', params.to)
  if (params.entityType) q.set('entityType', params.entityType)
  if (params.cursor) q.set('cursor', params.cursor)
  if (params.pageSize) q.set('pageSize', params.pageSize.toString())

  return apiGet<AuditLogResponse>(`/api/v1/users/admin/audit/all?${q.toString()}`)
}

export function getScopedAuditLogs(auditPath: string, params: ScopedAuditParams): Promise<AuditLogResponse> {
  const q = new URLSearchParams()
  if (params.entityType) q.set('entityType', params.entityType)
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.cursor) q.set('cursor', params.cursor)
  if (params.pageSize) q.set('pageSize', params.pageSize.toString())

  const queryString = q.toString()
  const url = queryString ? `${auditPath}?${queryString}` : auditPath
  
  return apiGet<AuditLogResponse>(url)
}
