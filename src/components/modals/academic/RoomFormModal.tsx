'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { RoomInput } from '@/lib/api/academic/room'
import { useRoom } from '@/hooks/academic/useRooms'
import { AuthError } from '@/lib/api/client'

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
    if (!roomCode.trim()) e.roomCode = 'Room Code is required'
    // 10-char cap per post-room.md's CreateRoomCommandValidator.
    else if (roomCode.trim().length > 10) e.roomCode = 'Room Code must not exceed 10 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Only roomCode uniqueness is an actionable field error (409 conflict);
  // anything else shows the failure popup.
  function handleSaveError(error: Error) {
    const code = error instanceof AuthError ? error.code : undefined
    if (code === 'conflict') {
      setErrors(prev => ({ ...prev, roomCode: error.message || 'A room with this code already exists.' }))
      return
    }
    setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} room. Please try again.`)
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
            <input
              className="ctrl font-mono uppercase"
              placeholder={isEdit ? undefined : 'e.g. RM-FCT-004'}
              maxLength={10}
              value={roomCode}
              onChange={e => { setRoomCode(e.target.value); clearError('roomCode') }}
              style={errors.roomCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.roomCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.roomCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Capacity</div>
            <input className="ctrl" type="number" placeholder={isEdit ? undefined : 'e.g. 40'} min={0} value={capacity} onChange={e => setCapacity(e.target.value)} />
          </div>
          <div className="fg span2">
            <div className="lbl">Location</div>
            <input className="ctrl" placeholder={isEdit ? undefined : 'e.g. Main Campus — Kampala, Block A'} value={location} onChange={e => setLocation(e.target.value)} />
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
