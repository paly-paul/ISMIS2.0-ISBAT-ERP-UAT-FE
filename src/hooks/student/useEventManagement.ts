import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EventInput, EventItem, createEvent, deleteEvent, getEventById, getEvents, updateEvent } from '@/lib/api/student/eventManagement'

const EVENTS_KEY = ['student-events']

// The endpoint returns the full unpaginated list (see get-events.md) — no
// page/search params to forward, unlike most other list hooks in this app.
// Search/pagination are handled client-side by the page itself.
export function useEvents() {
  return useQuery({
    queryKey: EVENTS_KEY,
    queryFn: () => getEvents(),
  })
}

export function useEvent(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...EVENTS_KEY, guid],
    queryFn: () => getEventById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: EventInput }) => updateEvent(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY })
      queryClient.invalidateQueries({ queryKey: [...EVENTS_KEY, guid] })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteEvent(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  })
}

export type { EventItem, EventInput }
