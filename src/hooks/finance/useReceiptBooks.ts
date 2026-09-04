import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createReceiptBook, CreateReceiptBookInput, deleteReceiptBook, getReceiptBooks, ReceiptBook, updateReceiptBook, UpdateReceiptBookInput } from '@/lib/api/finance/receiptBook'

const RECEIPT_BOOKS_KEY = ['receipt-books']

export function useReceiptBooks() {
  return useQuery({
    queryKey: RECEIPT_BOOKS_KEY,
    queryFn: () => getReceiptBooks(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateReceiptBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReceiptBookInput) => createReceiptBook(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECEIPT_BOOKS_KEY }),
  })
}

export function useUpdateReceiptBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: UpdateReceiptBookInput }) => updateReceiptBook(guid, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECEIPT_BOOKS_KEY }),
  })
}

export function useDeleteReceiptBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteReceiptBook(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECEIPT_BOOKS_KEY }),
  })
}

export type { ReceiptBook, CreateReceiptBookInput, UpdateReceiptBookInput }
