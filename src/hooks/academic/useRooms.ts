import { useEffect } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRoom, deleteRoom, getRoomById, getRooms, Room, RoomInput, RoomListResult, updateRoom } from '@/lib/api/academic/room'

const ROOMS_KEY = ['rooms']

// Original unpaged room list used by the modal/other consumers that expect a
// flat Room[] payload.
export function useRooms(enabled = true) {
  return useQuery<Room[]>({
    queryKey: [...ROOMS_KEY, 'flat'],
    queryFn: () => getRooms('', 1, 1000).then(data => data.items),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Paged room list for the Room Management table itself. keepPreviousData
// keeps the current page (and its totalCount) on screen while the next page
// loads, instead of dropping to "no data" for a moment on every page change.
// `search` narrows the table server-side (?search=, room code/location) and
// is part of the key, so each term's pages cache separately.
export function useRoomsPaged(enabled = true, pageNumber = 1, pageSize = 10, search = '') {
  const queryClient = useQueryClient()
  const query = useQuery<RoomListResult>({
    queryKey: [...ROOMS_KEY, 'paged', search, pageNumber, pageSize],
    queryFn: () => getRooms(search, pageNumber, pageSize),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })

  // Warm the neighbouring pages in the background once this one has landed,
  // so Next/Previous show cached rows instantly instead of waiting on a
  // round trip. prefetchQuery is a no-op for pages already cached.
  const totalCount = query.data?.totalCount
  const isRealData = !!query.data && !query.isPlaceholderData
  useEffect(() => {
    if (!enabled || !isRealData || totalCount == null) return
    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize))
    for (const p of [pageNumber + 1, pageNumber - 1]) {
      if (p < 1 || p > lastPage) continue
      queryClient.prefetchQuery({
        queryKey: [...ROOMS_KEY, 'paged', search, p, pageSize],
        queryFn: () => getRooms(search, p, pageSize),
        staleTime: Infinity,
      })
    }
  }, [enabled, isRealData, totalCount, pageNumber, pageSize, search, queryClient])

  return query
}

// Server-side search for Room Management's search box — hits the same list
// endpoint with the real, confirmed ?search= param (get-rooms.md) instead of
// filtering the already-fetched full list client-side. Kept as its own
// hook/query key so the main table can stay paged independently.
export function useRoomSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...ROOMS_KEY, 'search', q, 1, 8],
    queryFn: () => getRooms(q, 1, 8),
    enabled: q.length > 0,
    select: (data: RoomListResult) => data.items,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateRoom() {
  return useMutation({
    mutationFn: (input: RoomInput) => createRoom(input),
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
