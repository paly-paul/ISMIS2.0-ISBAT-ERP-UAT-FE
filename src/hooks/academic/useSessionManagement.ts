import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  getSessions,
  executeSessionMove,
  moveAllSessions,
  getBulkMovementStatus,
  SessionListParams,
  BulkMovementStatusDto,
} from '@/lib/api/academic/sessionManagement'

const SESSION_MGMT_KEY = ['session-management']

// Real server-side pagination, params (intake/campus/page) as part of the
// query key so each combination is cached independently — same convention
// as useCourseUnits.ts/useEnquiries.ts. keepPreviousData avoids a loading
// flash when paging or switching intake/campus, leaving the previous page's
// rows on screen while the next request is in flight; staleTime/gcTime:
// Infinity stops a re-fetch on every click, serving each already-seen
// combination from cache until a mutation (move/move-all) invalidates it.
export function useSessions(params: SessionListParams, enabled: boolean) {
  return useQuery({
    queryKey: [...SESSION_MGMT_KEY, 'list', params],
    queryFn: () => getSessions(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// getMovementStatus itself isn't wrapped in a query hook — it's a one-off
// pre-flight check fired imperatively right before opening the confirm
// dialog (per the doc's own framing), not something to keep cached/
// refetched in the background the way a list query is. Call
// getMovementStatus() from lib/api directly inside that click handler.

export function useExecuteSessionMove() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionGuid: string) => executeSessionMove(sessionGuid),
    // The moved session (and the newly-created next-semester one) change
    // this list's sessionMoved flags — refetch every cached list page
    // regardless of the exact intake/campus/page params used to fetch it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...SESSION_MGMT_KEY, 'list'] }),
  })
}

export function useMoveAllSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (intakeGuid: string) => moveAllSessions(intakeGuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...SESSION_MGMT_KEY, 'list'] }),
  })
}

// Polls the bulk run's audit status while still InProgress — a fallback for
// the SignalR completion event the doc mentions (not wired here; this app
// has no SignalR client), and the only way to get a result at all now that
// move-all's own changelog says it dropped RabbitMQ/SignalR in favour of a
// synchronous response — by the time that POST resolves the run is usually
// already Completed, but polling briefly covers it if not.
export function useBulkMovementStatus(bulkMovementGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...SESSION_MGMT_KEY, 'bulk-status', bulkMovementGuid],
    queryFn: () => getBulkMovementStatus(bulkMovementGuid as string),
    enabled: enabled && !!bulkMovementGuid,
    refetchInterval: (query) => {
      const data = query.state.data as BulkMovementStatusDto | undefined
      return data?.status === 'InProgress' ? 1500 : false
    },
  })
}

export type {
  SchedulingStatus,
  SessionListItemDto,
  SessionListResponse,
  SessionListParams,
  MovementResult,
  MovementStatusDto,
  MoveSessionResult,
  MoveAllResult,
  BulkMovementRunStatus,
  BulkAuditEntry,
  BulkMovementStatusDto,
} from '@/lib/api/academic/sessionManagement'
export { getMovementStatus } from '@/lib/api/academic/sessionManagement'
