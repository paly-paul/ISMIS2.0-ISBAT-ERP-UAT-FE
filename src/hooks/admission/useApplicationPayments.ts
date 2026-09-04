import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApplicationPaymentInput,
  createApplicationPayment,
  getApplicationPaymentBanks,
  getApplicationPaymentBatches,
  getApplicationPaymentExemptionTypes,
  getApplicationPaymentFees,
  getApplicationPaymentTypes,
  getUnconvertedEnquiries,
} from '@/lib/api/admission/applicationPayment'

const APPLICATION_PAYMENTS_KEY = ['application-payments']

export function useApplicationPaymentBanks() {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'banks'],
    queryFn: () => getApplicationPaymentBanks(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Scoped to a program/semester/batch time — only enabled once all three are
// picked, same convention as useSemestersForProgram.
export function useApplicationPaymentBatches(programGuid: string, semesterGuid: string, batchTimeGuid: string, enabled: boolean) {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'batches', programGuid, semesterGuid, batchTimeGuid],
    queryFn: () => getApplicationPaymentBatches(programGuid, semesterGuid, batchTimeGuid),
    enabled: enabled && !!programGuid && !!semesterGuid && !!batchTimeGuid,
  })
}

export function useApplicationPaymentExemptionTypes() {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'exemption-types'],
    queryFn: () => getApplicationPaymentExemptionTypes(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Scoped to a program — only enabled once one is picked.
export function useApplicationPaymentFees(programGuid: string, enabled: boolean) {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'fees', programGuid],
    queryFn: () => getApplicationPaymentFees(programGuid),
    enabled: enabled && !!programGuid,
  })
}

// Per Application_Payment_Change_Requests_Final_Updated.md #1/#2 — only
// enabled once an Intake has actually been picked, same "gate the dependent
// dropdown" convention as useApplicationPaymentFees/useSemestersForProgram.
export function useUnconvertedEnquiries(intakeGuid: string, page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'unconverted-enquiries', intakeGuid, page, pageSize],
    queryFn: () => getUnconvertedEnquiries(intakeGuid, page, pageSize),
    enabled: enabled && !!intakeGuid,
  })
}

export function useApplicationPaymentTypes() {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'payment-types'],
    queryFn: () => getApplicationPaymentTypes(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateApplicationPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplicationPaymentInput) => createApplicationPayment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICATION_PAYMENTS_KEY }),
  })
}

export type {
  ApplicationPaymentInput,
  BankAccountInfoDto,
  BatchInfoDto,
  ExemptionTypeDto,
  ProgramFeeHeadInfoDto,
  PaymentTypeDto,
  CreateApplicationPaymentResponse,
} from '@/lib/api/admission/applicationPayment'
