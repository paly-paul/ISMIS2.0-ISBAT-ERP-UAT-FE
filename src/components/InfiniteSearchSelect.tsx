'use client'
import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { SearchSelect } from '@/components/SearchSelect'
import { PaginatedItems, flattenUniquePages, getNextPageParam } from '@/lib/pagination'

type Option = { value: string; label: string }

interface Props<T> {
  // Distinguishes this list in the query cache (e.g. ['campuses', 'picker']).
  // Include any scoping values (a parent GUID) so a change refetches.
  queryKey: unknown[]
  // One page of the server-side list, filtered by the typed search.
  fetchPage: (page: number, pageSize: number, search: string) => Promise<PaginatedItems<T>>
  toOption: (item: T) => Option
  value: string
  onChange: (value: string) => void
  // Label of the "no filter" option (value ''). Omit for no such option.
  allLabel?: string
  placeholder?: string
  disabled?: boolean
  pageSize?: number
  // Label for a value set from outside (e.g. a default) before the dropdown
  // has loaded the page that contains it.
  selectedOption?: Option | null
}

// SearchSelect backed by a paginated list endpoint: loads the first page when
// the dropdown opens, fetches the next page as the list is scrolled to the
// bottom, and re-queries the server as the user types (debounced 300 ms) —
// same useInfiniteQuery pattern as the campus/intake pickers on Session
// Movement, packaged so each dropdown doesn't repeat the wiring.
export function InfiniteSearchSelect<T>({ queryKey, fetchPage, toOption, value, onChange, allLabel, placeholder, disabled, pageSize = 20, selectedOption }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // The picked option's label, kept so it still shows once the loaded pages
  // no longer contain it (e.g. after a new search).
  const [picked, setPicked] = useState<Option | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const query = useInfiniteQuery({
    queryKey: [...queryKey, 'infinite-select', search, pageSize],
    queryFn: ({ pageParam }) => fetchPage(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled: open && !disabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const options = useMemo(() => {
    const loaded = flattenUniquePages(query.data?.pages ?? [], item => toOption(item).value).map(toOption)
    const list: Option[] = allLabel !== undefined ? [{ value: '', label: allLabel }] : []
    const current = picked?.value === value ? picked : selectedOption?.value === value ? selectedOption : null
    if (value && current && !loaded.some(o => o.value === value)) list.push(current)
    return [...list, ...loaded]
    // toOption is expected to be a pure mapping; the loaded pages drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, allLabel, value, picked, selectedOption])

  function handleChange(v: string) {
    setPicked(options.find(o => o.value === v) ?? null)
    onChange(v)
  }

  return (
    <SearchSelect
      options={options}
      value={value}
      onChange={handleChange}
      onSearch={setSearchInput}
      onOpenChange={o => { setOpen(o); if (!o) setSearchInput('') }}
      placeholder={placeholder}
      disabled={disabled}
      isLoading={query.isLoading}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => query.fetchNextPage()}
    />
  )
}
