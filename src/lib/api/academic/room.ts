import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a teaching room, as returned by the API. location/capacity are
// both nullable per get-room-by-guid.md.
export interface Room {
  roomGuid: string
  roomCode: string
  location: string | null
  capacity: number | null
}

export interface RoomListResult {
  items: Room[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockRooms: Room[] = [
  { roomGuid: '1', roomCode: 'RM-FCT-001', location: 'Main Campus — Kampala, Block A', capacity: 40 },
  { roomGuid: '2', roomCode: 'RM-FCT-002', location: 'Main Campus — Kampala, Block A', capacity: 30 },
  { roomGuid: '3', roomCode: 'RM-FBM-001', location: 'Main Campus — Kampala, Block B', capacity: 80 },
  { roomGuid: '4', roomCode: 'RM-KCC-001', location: 'Kampala City Campus, Floor 2', capacity: 25 },
  { roomGuid: '5', roomCode: 'RM-MUK-001', location: 'Mukono Campus, Main Hall', capacity: 120 },
  { roomGuid: '6', roomCode: 'RM-FCT-003', location: 'Main Campus — Kampala, Block C', capacity: 35 },
  { roomGuid: '7', roomCode: 'RM-FEN-001', location: 'Main Campus — Kampala, Block D', capacity: 50 },
]

// GET /api/v1/academic/rooms — paged with optional `search` support. The
// page itself now owns page/pageSize so it can request a single window from
// the server instead of fetching and slicing the entire room catalog.
export function getRooms(search = '', pageNumber = 1, pageSize = 1000): Promise<RoomListResult> {
  const q = search.trim()
  if (MOCK_AUTH) {
    const filtered = q
      ? mockRooms.filter(r => r.roomCode.toLowerCase().includes(q.toLowerCase()) || (r.location ?? '').toLowerCase().includes(q.toLowerCase()))
      : mockRooms
    const start = (pageNumber - 1) * pageSize
    return Promise.resolve({
      items: filtered.slice(start, start + pageSize),
      totalCount: filtered.length,
      pageNumber,
      pageSize,
    })
  }

  const params = new URLSearchParams({
    page: String(pageNumber),
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  })
  if (q) params.set('search', q)

  return apiGet<RoomListResult | Room[] | null>(`/api/v1/academic/rooms?${params.toString()}`)
    .then(data => {
      const items = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { items?: Room[] }).items)
          ? (data as { items: Room[] }).items
          : []

      const envelope = data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Partial<RoomListResult>)
        : null

      // Room Management pagination bug (QA, 2026-10): the endpoint currently
      // ignores page/pageSize and returns every room, so page 1 showed them
      // all and every other page showed the same rows. If we got back more
      // rows than asked for, it didn't page — take the requested window
      // ourselves. A correctly paged response (≤ pageSize rows) passes
      // through untouched, so this stops mattering once the backend pages.
      const unpaged = items.length > pageSize
      const totalCount = unpaged
        ? Math.max(items.length, typeof envelope?.totalCount === 'number' ? envelope.totalCount : 0)
        : typeof envelope?.totalCount === 'number' ? envelope.totalCount : items.length
      const start = (pageNumber - 1) * pageSize

      return {
        items: unpaged ? items.slice(start, start + pageSize) : items,
        totalCount,
        pageNumber,
        pageSize,
      }
    })
}

export function getRoomById(guid: string): Promise<Room> {
  if (MOCK_AUTH) {
    const existing = mockRooms.find(r => r.roomGuid === guid)
    if (!existing) return Promise.reject(new Error('Room not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Room>(`/api/v1/academic/rooms/${guid}`)
}

// Same shape used for both create and update per post-room.md — there is no
// separate update DTO.
export interface RoomInput {
  roomCode: string
  location: string | null
  capacity: number | null
}

let mockRoomSeq = mockRooms.length + 1

export function createRoom(input: RoomInput): Promise<Room> {
  if (MOCK_AUTH) {
    if (mockRooms.some(r => r.roomCode === input.roomCode)) return Promise.reject(new Error('Room already exists.'))
    const room: Room = { roomGuid: String(mockRoomSeq++), roomCode: input.roomCode, location: input.location, capacity: input.capacity }
    mockRooms.push(room)
    return Promise.resolve(room)
  }
  return apiPost<Room>('/api/v1/academic/rooms', input)
}

// PUT /rooms/{guid} returns bare `true`, not the updated RoomDto — callers
// that need the saved state re-fetch via getRoomById (see put-room.md).
export function updateRoom(guid: string, input: RoomInput): Promise<boolean> {
  if (MOCK_AUTH) {
    const existing = mockRooms.find(r => r.roomGuid === guid)
    if (!existing) return Promise.reject(new Error('Room not found'))
    if (mockRooms.some(r => r.roomCode === input.roomCode && r.roomGuid !== guid)) return Promise.reject(new Error('Room already exists.'))
    Object.assign(existing, input)
    return Promise.resolve(true)
  }
  return apiPut<boolean>(`/api/v1/academic/rooms/${guid}`, input)
}

export function deleteRoom(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockRooms.findIndex(r => r.roomGuid === guid)
    if (index === -1) return Promise.reject(new Error('Room not found'))
    mockRooms.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/rooms/${guid}`)
}
