import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getServiceTicket,
  getServiceTicketQueue,
  getTicketStatuses,
  updateServiceTicket,
  ServiceTicketQueueParams,
  UpdateServiceTicketRequest,
} from '@/lib/api/student/serviceTickets'

export const SERVICE_TICKET_KEYS = {
  all: ['academic-service', 'students', 'service-tickets'] as const,
  queue: (params: ServiceTicketQueueParams) => [...SERVICE_TICKET_KEYS.all, 'queue', params] as const,
  detail: (ticketGuid: string) => [...SERVICE_TICKET_KEYS.all, 'detail', ticketGuid] as const,
  statuses: ['academic-service', 'students', 'enums', 'ticket-statuses'] as const,
}

export function useTicketStatuses() {
  return useQuery({
    queryKey: SERVICE_TICKET_KEYS.statuses,
    queryFn: getTicketStatuses,
    staleTime: Infinity,
  })
}

export function useServiceTicketQueue(params: ServiceTicketQueueParams) {
  return useQuery({
    queryKey: SERVICE_TICKET_KEYS.queue(params),
    queryFn: () => getServiceTicketQueue(params),
    placeholderData: keepPreviousData,
  })
}

// staleTime 0: always reload when a ticket is opened — another staff member
// may have triaged it since the queue loaded.
export function useServiceTicket(ticketGuid: string | null) {
  return useQuery({
    queryKey: SERVICE_TICKET_KEYS.detail(ticketGuid ?? ''),
    queryFn: () => getServiceTicket(ticketGuid as string),
    enabled: !!ticketGuid,
    staleTime: 0,
  })
}

// Settled, not just success: a 404 also means the queue is stale.
export function useUpdateServiceTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketGuid, payload }: { ticketGuid: string; payload: UpdateServiceTicketRequest }) => updateServiceTicket(ticketGuid, payload),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SERVICE_TICKET_KEYS.all }),
  })
}

export type { ServiceTicketListItem, ServiceTicketDetail, TicketStatusOption } from '@/lib/api/student/serviceTickets'
