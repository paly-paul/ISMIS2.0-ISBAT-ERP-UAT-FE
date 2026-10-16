'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { RoomInput } from '@/lib/api/academic/room'
import { useRoom } from '@/hooks/academic/useRooms'
import { AuthError } from '@/lib/api/client'
import { scrollToFirstError } from '@/lib/scrollToFirstError'

// post-room.md / put-room.md (same CreateRoomRequest): only roomCode is
// validated server-side (required, ≤ 10, unique → 409). Location and capacity
// have NO API rule — an over-long location fails at the database and 0 /
// negative capacities are accepted — so the limits below are the form's own.
const ROOM_CODE_MAX = 10
const LOCATION_MAX = 100
const CAPACITY_MAX = 9999

// Add and Edit share this form — differ in prefill and which mutation runs.
interface RoomFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  roomGuid: string | null
  createRoom: {
    mutate: (input: RoomInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateRoom: {
    mutate: (variables: { guid: string; input: RoomInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function RoomFormModal({ isOpen, onClose, showToast, mode, roomGuid, createRoom, updateRoom }: RoomFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: room, isLoading, isError, error } = useRoom(roomGuid, isOpen && isEdit)

  const [saved, setSaved]       = useState(false)
  const [failure, setFailure]   = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState('')
  const [errors, setErrors]     = useState<Record<string, string>>({})

  // Prefill on edit once the room loads (react-query resets `room` to undefined per guid); blank on fresh create.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && room) {
      setRoomCode(room.roomCode)
      setLocation(room.location ?? '')
      setCapacity(room.capacity != null ? String(room.capacity) : '')
      setErrors({})
    } else if (!isEdit) {
      setRoomCode(''); setLocation(''); setCapacity(''); setErrors({})
    }
  }, [isOpen, isEdit, room])

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setRoomCode(''); setLocation(''); setCapacity(''); setErrors({})
    onClose()
  }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    const code = roomCode.trim()
    // Messages match CreateRoomCommandValidator's.
    if (!code) e.roomCode = 'Room code is required.'
    else if (code.length > ROOM_CODE_MAX) e.roomCode = `Room code must not exceed ${ROOM_CODE_MAX} characters.`
    if (capacity.trim()) {
      const n = Number(capacity)
      if (!Number.isInteger(n) || n < 1) e.capacity = 'Capacity must be at least 1.'
      else if (n > CAPACITY_MAX) e.capacity = `Capacity can't exceed ${CAPACITY_MAX.toLocaleString()}.`
    }
    if (location.trim().length > LOCATION_MAX) e.location = `Location must not exceed ${LOCATION_MAX} characters.`
    setErrors(e)
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  // Room-code problems from the server (409 duplicate, or a validation_error
  // about the code) go under the field; anything else shows the popup.
  function handleSaveError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    const msg = error.message || ''
    if (code === 'conflict' || (code === 'validation_error' && /room code/i.test(msg))) {
      const e = { roomCode: code === 'conflict' ? 'A room with this code already exists.' : msg }
      setErrors(prev => ({ ...prev, ...e }))
      scrollToFirstError(e)
      return
    }
    setFailure(msg || `Failed to ${isEdit ? 'update' : 'add'} room. Please try again.`)
  }

  function handleSubmit() {
    if (!validate()) return
    // PUT is a full replacement — omitting location/capacity clears them
    // (see put-room.md), so both are always sent even when blank.
    const input: RoomInput = { roomCode: roomCode.trim(), location: location.trim() || null, capacity: capacity.trim() ? Number(capacity) : null }

    if (isEdit && roomGuid) {
      updateRoom.mutate(
        { guid: roomGuid, input },
        { onSuccess: () => { setSaved(true); showToast('Room updated successfully') }, onError: handleSaveError },
      )
    } else {
      createRoom.mutate(
        input,
        { onSuccess: () => { setSaved(true); showToast('Room added successfully') }, onError: handleSaveError },
      )
    }
  }

  const isPending = isEdit ? updateRoom.isPending : createRoom.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Room Updated!' : 'Room Added!'}
            subtitle={isEdit ? 'The room details have been saved successfully.' : 'The new room has been added successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title={isEdit ? "Couldn't Update Room" : "Couldn't Add Room"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Room"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load room details.') : 'Failed to load room details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !room)) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Room</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading room details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-home'}`}></i> {isEdit ? <>Edit Room — <span className="font-mono">{room!.roomCode}</span></> : 'Add Room'}
          </div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g2">
          <div className="fg">
            <div className="lbl">Room Code <span className="req">*</span></div>
            {/* Displayed uppercase, so store it uppercase too — otherwise
                "rm-a1" looked like "RM-A1" here but saved (and showed in the
                table) in lowercase. No spaces: a room code is a single token,
                and the API stores it untrimmed. */}
            <input
              className="ctrl font-mono uppercase"
              placeholder={isEdit ? undefined : 'e.g. RM-FCT-004'}
              maxLength={ROOM_CODE_MAX}
              value={roomCode}
              onChange={e => { setRoomCode(e.target.value.toUpperCase().replace(/\s+/g, '')); clearError('roomCode') }}
              style={errors.roomCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.roomCode && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.roomCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Capacity</div>
            {/* Text + numeric keypad, digits only — type="number" let "e",
                decimals and negatives through, and the API accepts 0 / negative. */}
            <input
              className="ctrl"
              inputMode="numeric"
              placeholder={isEdit ? undefined : 'e.g. 40'}
              maxLength={String(CAPACITY_MAX).length}
              value={capacity}
              onChange={e => { setCapacity(e.target.value.replace(/\D/g, '')); clearError('capacity') }}
              style={errors.capacity ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.capacity && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.capacity}</p>}
          </div>
          <div className="fg span2">
            <div className="lbl">Location</div>
            <input
              className="ctrl"
              placeholder={isEdit ? undefined : 'e.g. Main Campus — Kampala, Block A'}
              maxLength={LOCATION_MAX}
              value={location}
              onChange={e => { setLocation(e.target.value); clearError('location') }}
              style={errors.location ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.location && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.location}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Update Room' : 'Save Room')}
          </button>
        </div>
      </div>
    </div>
  )
}
