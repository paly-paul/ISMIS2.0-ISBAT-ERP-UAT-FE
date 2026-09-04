'use client'
import { useState } from 'react'
import { TableSearch } from '@/components/TableSearch'
import { useStudentSearchAdvanced } from '@/hooks/student/useStudentSearch'
import { StudentDto } from '@/lib/api/student/student'

interface StudentLookupProps {
  onLoad: (student: StudentDto) => void
  onClear: () => void
  loaded: boolean
  placeholder?: string
  hint?: string
}

// Shared "Student Lookup" widget used by Profile, Batch Transfer, Programme
// Transfer, Learning Mode, and Intake Transfer — ported from the
// isbat_student_module.html mockup's .lookup-shell, but backed by the real
// student list (useStudents) instead of a hardcoded sample. Typing searches
// live (same real ?searchTerm= endpoint as Student Master's own search box)
// and shows the matches in an actual dropdown (TableSearch, same widget
// Permission Master/Enquiry List etc. use) — picking a row loads that exact
// student directly.
//
// There used to also be a "Load Student" button that loaded matches[0] (the
// top search result) regardless of which row you'd actually picked from the
// dropdown — clicking it after selecting a different row silently swapped in
// whatever currently ranks first for the typed term, which read as "random"
// data getting loaded. Removed rather than fixed in place, same call as
// Statement's search bar: the dropdown selection is the only load path now.
export function StudentLookup({ onLoad, onClear, loaded, placeholder, hint }: StudentLookupProps) {
  const [term, setTerm] = useState('')
  const trimmed = term.trim()
  const { data, isLoading } = useStudentSearchAdvanced({
    studentRegNo: /^\d+$/.test(trimmed) ? trimmed : null,
    studentName: !/^\d+$/.test(trimmed) && trimmed ? trimmed : null,
    pageNumber: 1,
    pageSize: 8,
  }, true)
  const matches = data?.items ?? []

  function handleSelect(id: string) {
    const found = matches.find(m => m.studentGuid === id)
    if (found) onLoad(found)
  }

  function handleClear() {
    setTerm('')
    onClear()
  }

  return (
    <div className="lookup-shell">
      <div className="lookup-label"><i className="lni lni-search-alt"></i> Student Lookup</div>
      <div className="lookup-row">
        <TableSearch
          className="flex-1"
          value={term}
          onChange={setTerm}
          placeholder={placeholder ?? 'Student ID, name, or registration number…'}
          loading={isLoading}
          emptyLabel="No students found"
          results={matches.map(m => ({ id: m.studentGuid, primary: m.studentName ?? '—', secondary: `${m.studentNum ?? '—'} · ${m.studentRegNo ?? '—'}` }))}
          onSelect={r => handleSelect(r.id)}
        />
        {loaded && <button className="btn btn-neu" onClick={handleClear}><i className="lni lni-close"></i> Clear</button>}
      </div>
      {hint && !trimmed && <div className="lookup-hint"><i className="lni lni-information" style={{ color: 'var(--b700)' }}></i> {hint}</div>}
    </div>
  )
}
