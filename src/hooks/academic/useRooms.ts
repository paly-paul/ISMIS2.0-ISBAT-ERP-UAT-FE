import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRoom, deleteRoom, getRoomById, getRooms, Room, RoomInput, updateRoom } from '@/lib/api/academic/room'

const ROOMS_KEY = ['rooms']

export function useRooms() {
  return useQuery({
    queryKey: ROOMS_KEY,
    queryFn: () => getRooms(),
    // The endpoint is unpaged and returns the full list every time — only
    // refetch once a create/update/delete mutation invalidates this key.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-side search for Room Management's search box — hits the same list
// endpoint with the real, confirmed ?search= param (get-rooms.md) instead of
// filtering the already-fetched full list client-side. Kept as its own
// hook/query key so useRooms() above stays the plain unfiltered, cached list
// — only enabled while the search box actually has a query in it.
export function useRoomSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...ROOMS_KEY, 'search', q],
    queryFn: () => getRooms(q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RoomInput) => createRoom(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOMS_KEY }),
  })
}

// Fetches a single room for the Edit/View modals. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the room table.
export function useRoom(roomGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ROOMS_KEY, roomGuid],
    queryFn: () => getRoomById(roomGuid as string),
    enabled: enabled && !!roomGuid,
  })
}

export function useUpdateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: RoomInput }) => updateRoom(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: ROOMS_KEY })
      queryClient.invalidateQueries({ queryKey: [...ROOMS_KEY, guid] })
    },
  })
}

export function useDeleteRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteRoom(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOMS_KEY }),
  })
}

export type { Room, RoomInput }
