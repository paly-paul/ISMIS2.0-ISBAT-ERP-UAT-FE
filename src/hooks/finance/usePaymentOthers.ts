import { useQuery } from '@tanstack/react-query'
import { getPaymentOthers, PaymentOtherListParams } from '@/lib/api/finance/paymentOthers'

// Exported (not just used internally) so useCreatePaymentOther in
// usePaymentConsole.ts can invalidate this list too — a newly-added Other
// payment there needs this query to refetch, even though it's a separate
// key family from that file's own ['payment-console', …] keys.
export const PAYMENT_OTHERS_KEY = ['payment-others']

export function usePaymentOthersList(params: PaymentOtherListParams, enabled: boolean) {
  return useQuery({
    queryKey: [...PAYMENT_OTHERS_KEY, 'list', params],
    queryFn: () => getPaymentOthers(params),
    enabled,
  })
}

export type { PaymentOtherDto, PaymentOtherListResponse, PaymentOtherListParams } from '@/lib/api/finance/paymentOthers'
