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

const mockRooms: Room[] = [
  { roomGuid: '1', roomCode: 'RM-FCT-001', location: 'Main Campus — Kampala, Block A', capacity: 40 },
  { roomGuid: '2', roomCode: 'RM-FCT-002', location: 'Main Campus — Kampala, Block A', capacity: 30 },
  { roomGuid: '3', roomCode: 'RM-FBM-001', location: 'Main Campus — Kampala, Block B', capacity: 80 },
  { roomGuid: '4', roomCode: 'RM-KCC-001', location: 'Kampala City Campus, Floor 2', capacity: 25 },
  { roomGuid: '5', roomCode: 'RM-MUK-001', location: 'Mukono Campus, Main Hall', capacity: 120 },
  { roomGuid: '6', roomCode: 'RM-FCT-003', location: 'Main Campus — Kampala, Block C', capacity: 35 },
  { roomGuid: '7', roomCode: 'RM-FEN-001', location: 'Main Campus — Kampala, Block D', capacity: 50 },
]

// GET /api/v1/academic/rooms — unpaged, filtered only by `search` (partial
// match against room code/location per get-rooms.md). Omit search to get
// every room back in one call.
export function getRooms(search = ''): Promise<Room[]> {
  const q = search.trim()
  if (MOCK_AUTH) {
    if (!q) return Promise.resolve(mockRooms)
    const needle = q.toLowerCase()
    return Promise.resolve(mockRooms.filter(r => r.roomCode.toLowerCase().includes(needle) || (r.location ?? '').toLowerCase().includes(needle)))
  }
  const params = new URLSearchParams()
  if (q) params.set('search', q)
  const qs = params.toString()
  return apiGet<Room[] | null>(`/api/v1/academic/rooms${qs ? `?${qs}` : ''}`).then(data => data ?? [])
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
