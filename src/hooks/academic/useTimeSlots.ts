import { useQuery } from '@tanstack/react-query'
import { getTimeSlotDropdown, TimeSlotDropdownItem } from '@/lib/api/academic/timeSlot'

const TIME_SLOTS_KEY = ['timeSlots']

// Backs Add/Edit Slot's Time Slot picker, cascaded off whichever Batch Time
// is currently selected (batchTimeGuid: null/undefined returns every time
// slot across all batch times, per get-time-slot-dropdown.md).
export function useTimeSlotDropdown(batchTimeGuid?: string | null) {
  return useQuery({
    queryKey: [...TIME_SLOTS_KEY, 'dropdown', batchTimeGuid ?? null],
    queryFn: () => getTimeSlotDropdown(batchTimeGuid),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export type { TimeSlotDropdownItem }
