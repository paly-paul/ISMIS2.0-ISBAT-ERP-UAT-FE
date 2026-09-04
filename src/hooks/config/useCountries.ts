import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Country, CountryInput, createCountry, deleteCountry, getCountries, updateCountry } from '@/lib/api/academic/country'

const COUNTRIES_KEY = ['countries']

// Load enough rows to cover the full country list in one request.
const COUNTRIES_PAGE_SIZE = 1000

export function useCountries() {
  return useQuery({
    queryKey: COUNTRIES_KEY,
    queryFn: () => getCountries(1, COUNTRIES_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateCountry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CountryInput) => createCountry(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COUNTRIES_KEY }),
  })
}

export function useUpdateCountry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CountryInput }) => updateCountry(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COUNTRIES_KEY }),
  })
}

export function useDeleteCountry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCountry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COUNTRIES_KEY }),
  })
}

export type { Country, CountryInput }
