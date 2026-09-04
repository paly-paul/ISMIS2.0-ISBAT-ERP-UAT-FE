import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDiscount, deleteDiscount, Discount, DiscountInput, getDiscountById, getDiscounts, updateDiscount } from '@/lib/api/finance/discount'

const DISCOUNTS_KEY = ['discounts']

export function useDiscounts() {
  return useQuery({
    queryKey: DISCOUNTS_KEY,
    queryFn: () => getDiscounts(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DiscountInput) => createDiscount(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOUNTS_KEY }),
  })
}

// Fetches a single discount for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the discounts table.
export function useDiscount(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...DISCOUNTS_KEY, guid],
    queryFn: () => getDiscountById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: DiscountInput }) => updateDiscount(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: DISCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: [...DISCOUNTS_KEY, guid] })
    },
  })
}

export function useDeleteDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteDiscount(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOUNTS_KEY }),
  })
}

export type { Discount, DiscountInput }
