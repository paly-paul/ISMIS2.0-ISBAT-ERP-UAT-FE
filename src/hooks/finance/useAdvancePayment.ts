import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAdjustment,
  getAdjustmentLedgerBreakdown,
  getAdjustmentsByAdvance,
  getAdvanceBalance,
  getAdvanceDeposits,
  CreateAdjustmentInput,
} from '@/lib/api/finance/advancePayment'

const ADVANCE_DEPOSITS_KEY = ['advance-deposits']
const ADVANCE_BALANCE_KEY = ['advance-balance']
const ADJUSTMENTS_BY_ADVANCE_KEY = ['adjustments-by-advance']
const ADJUSTMENT_LEDGERS_KEY = ['adjustment-ledger-breakdown']

// This application's own drawable deposits — the picker.
export function useAdvanceDeposits(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ADVANCE_DEPOSITS_KEY, applicationGuid],
    queryFn: () => getAdvanceDeposits(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

// Informational per-currency undrawn total — shown alongside the picker.
export function useAdvanceBalance(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ADVANCE_BALANCE_KEY, applicationGuid],
    queryFn: () => getAdvanceBalance(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

// This deposit's own adjustment history.
export function useAdjustmentsByAdvance(paymentAdvanceGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ADJUSTMENTS_BY_ADVANCE_KEY, paymentAdvanceGuid],
    queryFn: () => getAdjustmentsByAdvance(paymentAdvanceGuid as string),
    enabled: enabled && !!paymentAdvanceGuid,
  })
}

// The ledger breakdown behind one adjustment row — fetched on demand
// (e.g. when a history row is expanded/clicked), not eagerly for every row.
export function useAdjustmentLedgerBreakdown(adjustmentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ADJUSTMENT_LEDGERS_KEY, adjustmentGuid],
    queryFn: () => getAdjustmentLedgerBreakdown(adjustmentGuid as string),
    enabled: enabled && !!adjustmentGuid,
  })
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentAdvanceGuid, input, applicationGuid }: { paymentAdvanceGuid: string; input: CreateAdjustmentInput; applicationGuid: string }) =>
      createAdjustment(paymentAdvanceGuid, input),
    onSuccess: (_result, { paymentAdvanceGuid, applicationGuid }) => {
      // The funding deposit's balance moved (or was fully drawn and, if
      // there was a leftover, a new deposit was created) — the picker and
      // balance strip are both stale. So is this deposit's own adjustment
      // history, and — since this settles real tuition ledgers, exactly
      // like a Payment Console payment would — the application's
      // outstanding-ledgers/payment-history.
      queryClient.invalidateQueries({ queryKey: [...ADVANCE_DEPOSITS_KEY, applicationGuid] })
      queryClient.invalidateQueries({ queryKey: [...ADVANCE_BALANCE_KEY, applicationGuid] })
      queryClient.invalidateQueries({ queryKey: [...ADJUSTMENTS_BY_ADVANCE_KEY, paymentAdvanceGuid] })
      queryClient.invalidateQueries({ queryKey: ['payment-console', 'outstanding-ledgers', applicationGuid] })
      queryClient.invalidateQueries({ queryKey: ['payment-console', 'payment-history', applicationGuid] })
      // A newly-created leftover deposit (newAdvanceMessage) or the
      // cross-student advances list both live under this separate key
      // family — same invalidation useCreateAdvanceDeposit already does.
      queryClient.invalidateQueries({ queryKey: ['payments', 'advances'] })
    },
  })
}

export type {
  AdjustmentLedgerDto,
  AdjustmentResultDto,
  AdjustmentSummaryDto,
  AdvanceBalanceDto,
  AdvanceDepositSummary,
  CreateAdjustmentInput,
} from '@/lib/api/finance/advancePayment'
