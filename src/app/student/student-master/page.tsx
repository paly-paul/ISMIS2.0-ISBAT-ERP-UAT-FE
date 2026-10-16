'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams, ReadonlyURLSearchParams } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { GuidColumnFilter } from '@/components/GuidColumnFilter'
import { IntakeSearchPicker } from '@/components/IntakeSearchPicker'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { StudentRefugeeModal } from '@/components/modals/student/StudentRefugeeModal'
import { StudentLearningModeModal } from '@/components/modals/student/StudentLearningModeModal'
import { StudentSponsorModal } from '@/components/modals/student/StudentSponsorModal'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useStudentsFilter, useStudentsFilterMulti, getStudentsFilterCombinations, useStudentsInfinite } from '@/hooks/student/useStudents'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useBatches } from '@/hooks/academic/useBatches'
import { useSemesterCodeGroups } from '@/hooks/academic/useSemesters'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10

// Empty array means "not applied" — matches get-students-filter.md's own
// "omitted filters are not applied" behaviour. Only these three: that's all
// GET /api/v1/students/filter takes (plus searchTerm, handled by the
// existing search box above the table). An earlier, broader
// AdvancedFilterState (campus/sponsor/refugee/country/intake/gender) lived
// here before this — dropped along with its own dead "Filters" toggle
// button, since no confirmed endpoint ever backed those and this real one
// only covers Programme/Semester/Batch. Each field is an array — multi-
// select, same as FilterTh's own columns elsewhere — even though the
// endpoint itself only takes one guid per field; see
// getStudentsFilterCombinations/useStudentsFilterMulti in useStudents.ts
// for how multiple selections turn into real results. Semester holds
// semCodes, not guids — sent as /students/filter's semCode param. Two
// separate intake filters: intakeGuid is the joined intake (T_STUDENT.
// INTAKEGUID), set only from the header intake dropdown (no default);
// academicIntake holds intake codes (e.g. "20241") from the active history
// row, set only from the Academic Intake column's funnel and defaulting to
// the current academic intake.
// Status holds regStatus codes (e.g. "5"), sent as regStatus.
interface ColumnFilterState {
  programGuid: string[]
  semCode: string[]
  batchGuid: string[]
  intakeGuid: string[]
  academicIntake: string[]
  regStatus: string[]
}
const EMPTY_COLUMN_FILTERS: ColumnFilterState = { programGuid: [], semCode: [], batchGuid: [], intakeGuid: [], academicIntake: [], regStatus: [] }

// regStatus codes from get-students-filter.md. The filter sends the code;
// the list items carry the matching name in regStatusName, which is what
// the column's badge keys off.
const REG_STATUSES = [
  { code: '1', name: 'Registered', label: 'Registered', badge: 'badge-green' },
  { code: '2', name: 'YetToRegister', label: 'Yet to Register', badge: 'badge-amber' },
  { code: '3', name: 'DropOut', label: 'Drop Out', badge: 'badge-grey' },
  { code: '4', name: 'YetToClear', label: 'Yet to Clear', badge: 'badge-red' },
  { code: '5', name: 'Passout', label: 'Passout', badge: 'badge-blue' },
]
const REG_STATUS_OPTIONS = REG_STATUSES.map(s => ({ value: s.code, label: s.label }))
function regStatusBadge(name: string) {
  const s = REG_STATUSES.find(x => x.name.toLowerCase() === name.toLowerCase())
  return { label: s?.label ?? name.replace(/([a-z])([A-Z])/g, '$1 $2'), badge: s?.badge ?? 'badge-grey' }
}

// Page/search/column filters ↔ URL query (?page=&q=&prog=&sem=&batch=
// &joined=&intake=&status=). Parameters this page doesn't own (refugeeFor
// etc.) are ignored/dropped.
//
// Academic Intake defaults to the current academic intake. `intake` is
// therefore always written explicitly (`intake=all` once cleared), so a URL
// with no `intake` at all — a fresh visit, or clicking Student Master in the
// sidebar — means "apply the default", not "all intakes".
const ALL_INTAKES = 'all'

function listStateFromUrl(params: URLSearchParams | ReadonlyURLSearchParams, defaultIntakeCode: string | null) {
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? []
  const intakeParam = params.get('intake')
  const academicIntake = intakeParam === null
    ? (defaultIntakeCode ? [defaultIntakeCode] : [])
    : intakeParam === ALL_INTAKES ? [] : list('intake')
  return {
    page: Math.max(1, Number(params.get('page')) || 1),
    search: params.get('q') ?? '',
    colFilters: { programGuid: list('prog'), semCode: list('sem'), batchGuid: list('batch'), intakeGuid: list('joined'), academicIntake, regStatus: list('status') } as ColumnFilterState,
    // No intake in the URL and the current intake isn't known yet.
    awaitingDefault: intakeParam === null && !defaultIntakeCode,
  }
}

function listStateToQuery(page: number, search: string, colFilters: ColumnFilterState) {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (search.trim()) params.set('q', search)
  if (colFilters.programGuid.length) params.set('prog', colFilters.programGuid.join(','))
  if (colFilters.semCode.length) params.set('sem', colFilters.semCode.join(','))
  if (colFilters.batchGuid.length) params.set('batch', colFilters.batchGuid.join(','))
  if (colFilters.intakeGuid.length) params.set('joined', colFilters.intakeGuid.join(','))
  params.set('intake', colFilters.academicIntake.length ? colFilters.academicIntake.join(',') : ALL_INTAKES)
  if (colFilters.regStatus.length) params.set('status', colFilters.regStatus.join(','))
  return params.toString()
}

function StudentMasterContent() {
  // Row actions gated by this page's own custom keys from /me/menu
  // ({ get, view, learningmode, refugee, sponsor }). Each falls back to the
  // generic flag (`?? permissions.get` / `?? permissions.edit`) — same
  // convention as Employee Master's `assign ?? edit` — so mock mode and the
  // fail-open default (both only carry add/edit/delete/get) still show every
  // action, while a real response missing a key hides that action.
  const pagePermissions = usePagePermissions()
  const permissions = {
    view: pagePermissions.view ?? pagePermissions.get ?? false,
    learningMode: pagePermissions.learningmode ?? pagePermissions.edit ?? false,
    refugee: pagePermissions.refugee ?? pagePermissions.edit ?? false,
    sponsor: pagePermissions.sponsor ?? pagePermissions.edit ?? false,
  }
  const hasAnyAction = permissions.view || permissions.learningMode || permissions.refugee || permissions.sponsor
  const router = useRouter()
  const searchParams = useSearchParams()
  // Student Profile's read-only Refugee Status / Sponsor fields link here as
  // ?refugeeFor=<guid> or ?sponsorFor=<guid> (plus &studentName=<name>) —
  // the matching modal opens pre-loaded for that student, and the params
  // are cleared below so a refresh doesn't reopen it.
  const refugeeForParam = searchParams.get('refugeeFor')
  const sponsorForParam = searchParams.get('sponsorFor')
  const [openModals, setOpenModals] = useState<Set<string>>(() => new Set(
    refugeeForParam ? ['refugee-status-modal'] : sponsorForParam ? ['sponsor-modal'] : []
  ))
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [selectedStudentGuid, setSelectedStudentGuid] = useState<string | null>(refugeeForParam ?? sponsorForParam)
  const [selectedStudentName, setSelectedStudentName] = useState<string | undefined>(() => searchParams.get('studentName') ?? undefined)
  // Page, search and column filters live in the URL (?page=&q=&prog=&sem=
  // &batch=) so opening a student's profile and coming back — browser Back
  // or Profile's own "Back to Student Master" — lands on the same page and
  // filters instead of resetting to page 1.
  // Academic Intake options + default (see listStateFromUrl), from
  // GET /academic/intakes/dropdown — the item with currentIntake: true is
  // preselected (get-intakes-dropdown.md). Cached indefinitely by the hook,
  // so on a revisit it's usually already known.
  const { data: intakes = [], isFetched: currentIntakeFetched } = useIntakesDropdown()
  const currentAcademicIntake = intakes.find(i => i.currentIntake)
  const defaultIntakeCode = currentAcademicIntake ? String(currentAcademicIntake.intakeCode) : null
  const [search, setSearch] = useState(() => listStateFromUrl(searchParams, defaultIntakeCode).search)
  const [page, setPage] = useState(() => listStateFromUrl(searchParams, defaultIntakeCode).page)
  const [colFilters, setColFilters] = useState<ColumnFilterState>(() => listStateFromUrl(searchParams, defaultIntakeCode).colFilters)
  // True while the URL asks for the default intake but it hasn't loaded —
  // the list waits rather than briefly showing every intake.
  const [awaitingDefault, setAwaitingDefault] = useState(() => listStateFromUrl(searchParams, defaultIntakeCode).awaitingDefault)
  useEffect(() => {
    if (!awaitingDefault || !currentIntakeFetched) return
    // No current intake configured (or the lookup failed) → fall back to all.
    if (defaultIntakeCode) setColFilters(prev => ({ ...prev, academicIntake: [defaultIntakeCode] }))
    setAwaitingDefault(false)
  }, [awaitingDefault, currentIntakeFetched, defaultIntakeCode])
  // State → URL. window.history.replaceState (not router.replace) so the URL
  // updates synchronously — Next.js keeps useSearchParams in step with it,
  // and the URL → state effect below never sees a stale, half-applied write
  // (e.g. mid-typing in the search box). Also drops refugeeFor/sponsorFor/
  // studentName once read above, so a refresh doesn't reopen their modal.
  // Skipped while awaitingDefault, so the bare URL isn't overwritten with
  // `intake=all` before the default has been applied.
  const stateQs = listStateToQuery(page, search, colFilters)
  useEffect(() => {
    if (awaitingDefault) return
    if (window.location.search.replace(/^\?/, '') === stateQs) return
    window.history.replaceState(null, '', stateQs ? `/student/student-master?${stateQs}` : '/student/student-master')
  }, [stateQs, awaitingDefault])
  // URL → state, for navigations from outside this page's own controls —
  // e.g. clicking Student Master in the sidebar while already here swaps
  // the URL to the bare route without remounting the page, which must reset
  // the table to page 1 / default filters rather than leave it where it was.
  const urlQs = searchParams.toString()
  useEffect(() => {
    const fromUrl = listStateFromUrl(searchParams, defaultIntakeCode)
    if (fromUrl.awaitingDefault) setAwaitingDefault(true)
    else if (listStateToQuery(fromUrl.page, fromUrl.search, fromUrl.colFilters) === stateQs) return
    setPage(fromUrl.page); setSearch(fromUrl.search); setColFilters(fromUrl.colFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQs])
  // Which column's filter popover is open, if any — GuidColumnFilter's own
  // funnel icon toggles this, same "one open at a time, tracked by key"
  // convention academic/intake-master's own FilterTh usage already uses.
  const [openColFilter, setOpenColFilter] = useState<string | null>(null)

  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  // Navigates to the full Student Profile page instead of the old read-only
  // modal (StudentProfileModal, now unused) — same page Student Profile's
  // own sidebar link opens, just pre-loaded via ?studentGuid= instead of a
  // StudentLookup search.
  function handleView(studentGuid: string) { router.push('/student/profile?studentGuid=' + studentGuid + '&from=student-master') }
  function handleLearningMode(studentGuid: string, studentName: string) { setSelectedStudentGuid(studentGuid); setSelectedStudentName(studentName); openModal('learning-mode-modal') }
  function handleRefugee(studentGuid: string, studentName: string) { setSelectedStudentGuid(studentGuid); setSelectedStudentName(studentName); openModal('refugee-status-modal') }
  function handleSponsor(studentGuid: string, studentName: string) { setSelectedStudentGuid(studentGuid); setSelectedStudentName(studentName); openModal('sponsor-modal') }
  function updateSearch(value?: string) { setSearch(value ?? ''); setPage(1) }
  // Closes whichever column popover is open — every call site here is a
  // committed choice (OK or Reset inside GuidColumnFilter), same as
  // FilterTh's own onSelect/onClear handlers closing the filter themselves.
  function updateColFilters(patch: Partial<ColumnFilterState>) { setColFilters(prev => ({ ...prev, ...patch })); setPage(1); setOpenColFilter(null) }
  function clearColFilters() { setColFilters(EMPTY_COLUMN_FILTERS); setPage(1); setOpenColFilter(null) }

  const { data: programs = [] } = useProgramMasters()
  const { data: allBatchesData } = useBatches(1, 1000)
  const batches = allBatchesData?.items ?? []
  // Semester options come from GET /academic/semesters/filter/by-semcode —
  // one option per semCode ("Year One - Semester One", …), usable without a
  // Programme picked. A picked code goes to /students/filter as semCode, so
  // one request covers every programme's semester with that code.
  const { groups: semCodeGroups } = useSemesterCodeGroups()

  // Academic Intake column funnel options (by intake code), and the label
  // lookup for the header joined-intake dropdown's trigger (by intakeGuid —
  // the dropdown itself pages intakes server-side via IntakeSearchPicker).
  // The two filters are independent: colFilters.intakeGuid (header, no
  // default) vs colFilters.academicIntake (column funnel, defaults to the
  // current intake). `intakes` is the dropdown list loaded above
  // (GET /academic/intakes/dropdown — every intake, newest first).
  // description may be null — label as "description (intakeCode)".
  const intakeLabel = (i: { intakeCode: string | number; description?: string | null }) => i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode)
  const intakeOptions = intakes.map(i => ({ value: String(i.intakeCode), label: intakeLabel(i) }))
  const joinedIntakeGuid = colFilters.intakeGuid[0]
  const joinedIntake = joinedIntakeGuid ? intakes.find(i => i.intakeGuid === joinedIntakeGuid) : undefined
  const [joinedIntakeLabel, setJoinedIntakeLabel] = useState<string | null>(null)
  const selectedIntakeLabel = !joinedIntakeGuid
    ? null
    : joinedIntake ? intakeLabel(joinedIntake) : joinedIntakeLabel ?? joinedIntakeGuid

  const hasColFilters = colFilters.programGuid.length > 0 || colFilters.semCode.length > 0 || colFilters.batchGuid.length > 0 || colFilters.intakeGuid.length > 0 || colFilters.academicIntake.length > 0 || colFilters.regStatus.length > 0

  // get-students-filter.md's programGuid/semCode/batchGuid each take
  // exactly one value — a multi-select column here (checking 2+ boxes) has
  // no single request that can express it. combos is every (programGuid ×
  // semCode × batchGuid) combination actually selected; it collapses
  // to exactly one entry — real server pagination via useStudentsFilter
  // below — whenever each dimension has at most one value picked (the
  // common case, including "no filters at all"). More than one combination
  // switches to useStudentsFilterMulti, which fetches only each
  // combination's first page × PAGE_SIZE rows and merges them into one
  // name-sorted list (see that hook's comment in useStudents.ts).
  const normalizedSearch = (search || '').trim()
  const combos = getStudentsFilterCombinations(colFilters, normalizedSearch || undefined)
  const isMultiCombo = combos.length > 1

  const singleQuery = useStudentsFilter(page, PAGE_SIZE, combos[0], !isMultiCombo && !awaitingDefault)
  const multi = useStudentsFilterMulti(combos, page, PAGE_SIZE, isMultiCombo && !awaitingDefault)

  const items = isMultiCombo ? multi.items : (singleQuery.data?.items ?? [])
  const totalCount = isMultiCombo ? multi.totalCount : (singleQuery.data?.totalCount ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const isLoading = awaitingDefault || (isMultiCombo ? multi.isLoading : singleQuery.isLoading)

  // Dedicated, infinite-scroll query for the search dropdown — its matches
  // aren't filtered by the guid columns above, so it's suppressed the
  // moment any column filter is active rather than showing unfiltered
  // "quick jump" results alongside a filtered table.
  const searchDropdownQuery = useStudentsInfinite(normalizedSearch, 15)
  const searchMatches = normalizedSearch && !hasColFilters
    ? searchDropdownQuery.data?.pages.flatMap(p => p.items) ?? []
    : []

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Student Master</div><div className="pg-sub">Master list of enrolled students · Programme, semester &amp; batch</div></div>
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-graduation"></i></span> Students</div>
            <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <IntakeSearchPicker
                className="w-56"
                placeholder="All joined intakes"
                selectedLabel={selectedIntakeLabel}
                onSelect={i => { setJoinedIntakeLabel(intakeLabel(i)); updateColFilters({ intakeGuid: [i.intakeGuid] }) }}
                onClear={() => updateColFilters({ intakeGuid: [] })}
              />
              <TableSearch
                className="w-56"
                placeholder="Search by Student No., Reg No. or name…"
                value={search}
                onChange={updateSearch}
                loading={searchDropdownQuery.isLoading}
                onLoadMore={() => searchDropdownQuery.fetchNextPage()}
                hasMore={!!searchDropdownQuery.hasNextPage}
                loadingMore={searchDropdownQuery.isFetchingNextPage}
                results={searchMatches.map(r => ({
                  id: r.studentGuid,
                  primary: r.studentName || r.studentRegNo || r.studentNum || '',
                  secondary: [r.studentRegNo, r.studentNum].filter(Boolean).join(' · '),
                }))}
                onSelect={r => updateSearch(r.primary)}
              />
            </div>
          </div>

          <ScrollTable filters={{ ...colFilters }} onResetFilters={clearColFilters}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Reg No.</th>
                  <th>Name</th>
                  {/* Column filters — multi-select, same interaction as
                      FilterTh's own columns elsewhere (Select All, staged
                      pending choice, Reset/Cancel/OK), backed by GET
                      /api/v1/students/filter (get-students-filter.md)
                      instead of a client-side Array.filter() — see
                      GuidColumnFilter's own header comment and
                      useStudentsFilterMulti in useStudents.ts for how a
                      multi-value pick here turns into real results. */}
                  <GuidColumnFilter
                    label="Programme"
                    options={programs.map(p => ({ value: p.programGuid, label: p.programName }))}
                    isOpen={openColFilter === 'programGuid'}
                    activeFilter={colFilters.programGuid}
                    onToggle={e => { e.stopPropagation(); setOpenColFilter(v => v === 'programGuid' ? null : 'programGuid') }}
                    onSelect={vals => updateColFilters({ programGuid: vals })}
                    onClear={() => updateColFilters({ programGuid: [] })}
                    onClose={() => setOpenColFilter(null)}
                  />
                  <GuidColumnFilter
                    label="Semester"
                    options={semCodeGroups.map(g => ({ value: g.semCode, label: g.semName }))}
                    isOpen={openColFilter === 'semCode'}
                    activeFilter={colFilters.semCode}
                    onToggle={e => { e.stopPropagation(); setOpenColFilter(v => v === 'semCode' ? null : 'semCode') }}
                    onSelect={vals => updateColFilters({ semCode: vals })}
                    onClear={() => updateColFilters({ semCode: [] })}
                    onClose={() => setOpenColFilter(null)}
                  />
                  <GuidColumnFilter
                    label="Batch"
                    options={batches.map(b => ({ value: b.batchGuid, label: b.batchCode }))}
                    isOpen={openColFilter === 'batchGuid'}
                    activeFilter={colFilters.batchGuid}
                    onToggle={e => { e.stopPropagation(); setOpenColFilter(v => v === 'batchGuid' ? null : 'batchGuid') }}
                    onSelect={vals => updateColFilters({ batchGuid: vals })}
                    onClear={() => updateColFilters({ batchGuid: [] })}
                    onClose={() => setOpenColFilter(null)}
                  />
                  <GuidColumnFilter
                    label="Academic Intake"
                    options={intakeOptions}
                    isOpen={openColFilter === 'academicIntake'}
                    activeFilter={colFilters.academicIntake}
                    onToggle={e => { e.stopPropagation(); setOpenColFilter(v => v === 'academicIntake' ? null : 'academicIntake') }}
                    onSelect={vals => updateColFilters({ academicIntake: vals })}
                    onClear={() => updateColFilters({ academicIntake: [] })}
                    onClose={() => setOpenColFilter(null)}
                  />
                  <GuidColumnFilter
                    label="Status"
                    options={REG_STATUS_OPTIONS}
                    isOpen={openColFilter === 'regStatus'}
                    activeFilter={colFilters.regStatus}
                    onToggle={e => { e.stopPropagation(); setOpenColFilter(v => v === 'regStatus' ? null : 'regStatus') }}
                    onSelect={vals => updateColFilters({ regStatus: vals })}
                    onClear={() => updateColFilters({ regStatus: [] })}
                    onClose={() => setOpenColFilter(null)}
                  />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={8} />
                  : items.length === 0
                    ? <EmptyState colSpan={8} hasFilters={!!normalizedSearch || hasColFilters} onClearFilters={() => { setSearch(''); clearColFilters() }} />
                    : null}
                {/* Rows only once everything's in — a multi-combo fetch
                    (e.g. a Semester pick fanning out per programme) would
                    otherwise show partial, still-reshuffling results under
                    the loader. */}
                {!isLoading && items.map(r => (
                  <tr key={r.studentGuid}>
                    <td>
                      {hasAnyAction && <ActionMenu>
                        {permissions.view && <button className="btn btn-neu btn-sm" onClick={() => handleView(r.studentGuid)}><i className="lni lni-eye"></i> View</button>}
                        {permissions.learningMode && <button className="btn btn-neu btn-sm" onClick={() => handleLearningMode(r.studentGuid, r.studentName)}><i className="lni lni-book"></i> Learning Mode</button>}
                        {permissions.refugee && <button className="btn btn-neu btn-sm" onClick={() => handleRefugee(r.studentGuid, r.studentName)}><i className="lni lni-shield"></i> Refugee Status</button>}
                        {permissions.sponsor && <button className="btn btn-neu btn-sm" onClick={() => handleSponsor(r.studentGuid, r.studentName)}><i className="lni lni-handshake"></i> Sponsor</button>}
                      </ActionMenu>}
                    </td>
                    <td className="font-mono">{r.studentRegNo}</td>
                    <td><strong>{r.studentName}</strong></td>
                    <td>{r.programName || '—'}</td>
                    <td>{r.semesterName || '—'}</td>
                    <td>{r.batchCode || '—'}</td>
                    <td className="font-mono">{r.academicIntake || '—'}</td>
                    <td>{r.regStatusName ? <span className={`badge ${regStatusBadge(r.regStatusName).badge}`}>{regStatusBadge(r.regStatusName).label}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="students" onPageChange={setPage} />
        </div>
      </div>
      {/* Gated here too, not just on the row buttons — the Refugee/Sponsor
          modals can also open from Student Profile's ?refugeeFor=/?sponsorFor=
          deep links. */}
      <StudentLearningModeModal isOpen={openModals.has('learning-mode-modal') && permissions.learningMode} onClose={() => closeModal('learning-mode-modal')} showToast={showToast} studentGuid={selectedStudentGuid} studentName={selectedStudentName} />
      <StudentRefugeeModal isOpen={openModals.has('refugee-status-modal') && permissions.refugee} onClose={() => closeModal('refugee-status-modal')} showToast={showToast} studentGuid={selectedStudentGuid} studentName={selectedStudentName} />
      <StudentSponsorModal isOpen={openModals.has('sponsor-modal') && permissions.sponsor} onClose={() => closeModal('sponsor-modal')} showToast={showToast} studentGuid={selectedStudentGuid} studentName={selectedStudentName} />
      <Toast toast={toast} />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <StudentMasterContent />
    </Suspense>
  )
}
