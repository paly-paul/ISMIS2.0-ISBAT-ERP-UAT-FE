# Table Column Filters — Inventory

Generated 2026-09-01 by reading every page that uses `FilterTh` (`src/components/FilterTh.tsx`) — the
Excel-style column-header filter (funnel icon → checkbox dropdown of distinct values) used across the
app's table pages — plus its dropdown-form sibling `MultiSelect` (`src/components/MultiSelect.tsx`),
which reuses the same checkbox-list markup but isn't a table-header filter itself.

---

## 1. How the component works

`FilterTh` renders a `<th>` with a funnel icon. Clicking it opens a portaled dropdown with:
a search box, a "Select All" checkbox, one checkbox per option, and Reset/Cancel/OK buttons.

```tsx
<FilterTh
  label="Status"                          // column header text
  opts={string[]}                         // every selectable value, see §2 below
  isOpen={openFilterCol === 'status'}
  activeFilter={filters['status'] ?? []}  // currently-applied values
  onToggle={...}  onSelect={...}  onClear={...}  onClose={...}
/>
```

- **`opts`** is always a plain `string[]` — there is no typed/enum variant. Every column's filter
  operates on whatever string representation that column already renders in its table cell (see
  "Value Format" in the tables below).
- **Filtering itself is multi-select equality**, not range/contains — a row matches a column's active
  filter if its (string) value for that field is included in the selected `opts`. There's no
  date-range, numeric-range, or free-text-contains column filter anywhere in this component; the
  closest thing to "contains" search is a separate, page-level search box many of these pages also
  have above the table (unrelated to `FilterTh`).
- **`MultiSelect`** is a standalone form control (trigger button + same checkbox dropdown), not a
  table filter — it's the "checkbox-driven sibling of SearchSelect" for ordinary multi-pick form
  fields. Included here only because it shares the same value-format convention (`{value, label}` or
  bare `string[]`, multi-select, no ranges).

### Where each column's `opts` list comes from — three patterns seen across the survey

| Pattern | What it means | How common |
|---|---|---|
| **Hardcoded literal** — `['Active', 'Inactive']` | A fixed list baked into the page, independent of what's actually loaded/visible | The overwhelming majority of columns surveyed |
| **Dynamic from loaded rows** — `[...new Set(rows.map(r => r.field))]` | Computed from whatever's currently in memory — but see the caveat below | A handful of columns on real-data pages |
| **Dynamic from a separate lookup list** — `.map()` over a master-data hook's own results (e.g. `campusDropdown`, `departments`, `programLevels`) | Options come from a full master-data catalogue, not from the table's own rows at all | A few columns on config/academic master pages |

**Caveat on "dynamic from loaded rows":** on every real-data page in this survey, the underlying
fetch loads the *entire* list in one request (no server-side pagination — `usePages`/`useX(page,
pageSize)` patterns are notably absent here; instead these hooks fetch once with a large fixed page
size, or fetch everything and paginate with a client-side `usePagination` helper). So "dynamic from
loaded rows" in practice still means "from the full dataset," not "from just the visible page" — the
filter options are never stale/incomplete because of pagination. The actual **row-narrowing** (once a
filter is applied) also always happens client-side, in a `filteredRows`-style `.filter()` over that
already-fully-loaded array — none of these pages send the selected filter values back to the server as
a query parameter.

---

## 2. Wired vs. cosmetic — the split that matters most

Across all ~40 pages surveyed, `FilterTh` columns fall into one of three states. This is the single
most important finding: **on a large majority of pages, the filter dropdown is present and looks
functional but does nothing** — selecting a value updates local React state that nothing ever reads
to narrow the table.

| State | Meaning | Pages |
|---|---|---|
| **✅ Real & wired** | Backed by a real API-fetched list; selecting a filter value actually narrows `filteredRows`/`baseRows` client-side | Campus Master, Country Master, Designation Master, Faculty Master, Skill Master, Repetition Tag, Programme Group, Intake Master, Employee Master, Programme Approval, Programme Master |
| **⚠️ Wired but non-functional** | `filters` state exists and `FilterTh` reads it for display, but there is no `.filter()` call anywhere that actually narrows the rendered rows — the UI is decorative | Mark CW, Assessment Schedule, UE Schedule, Weight Config, Rpt Pending QP, Rpt Faculty, Resit Calendar, Reevaluation, Recheck, QP Vetting, Mark UE, Moderation, Hall Ticket, CW Submissions, CW Qbank, CW Overview, CBT Overview, CBT Monitor, ODL Applications, Timetable, Acad Dashboard, RoomMgmtModal, Allocation, Class Test, Coursework, Qual Equating, University Exam |
| **🚫 Imported but unused** | `FilterTh` is imported (sometimes with a helper like `fth()` defined) but every call site is inside commented-out/pre-integration reference JSX — nothing renders in the live page | Department Master, Programme Level, Course Units |

The ⚠️ group is uniformly explained by the same root cause: the page's table rows are hand-written
static JSX (a UI-first mock with a `setTimeout`-simulated `loading` state, or literally hardcoded
`<tr>`s with a `Pagination` component fed hardcoded `totalPages`/`totalCount` numbers), so there is no
row array in memory for a filter to narrow in the first place.

---

## 3. Full inventory, by module

### Config module

| Page | Column | Options Source | Value Format | Row Data API | Filter Options API | Notes |
|---|---|---|---|---|---|---|
| `/config/campus-master` | Campus Name | `.map()` over `useCampusDropdown()` — `campusDropdown.map(c => c.campusName)` | free-text label (campus name) | `GET /api/v1/academic/campus` (paginated, loaded in full) | `GET /api/v1/academic/campus/dropdown` — a separate, unpaginated dropdown-shaped endpoint | ✅ Real. Options come from a separate lookup hook, not `rows` itself. |
| `/config/campus-master` | Location | Hardcoded `['Kampala', 'Mbarara', 'Gulu']` | free-text label (city name) | `GET /api/v1/academic/campus` | none — hardcoded | ✅ Real filtering; hardcoded options list. |
| `/config/country-master` | Nationality | Hardcoded `['Ugandan', 'Kenyan', 'Tanzanian', 'Rwandan', 'South Sudanese', 'Congolese', 'British', 'Indian']` | free-text label | `GET /api/v1/users/countries` | none — hardcoded | ✅ Real. A commented-out duplicate `<thead>` (pre-integration reference) also calls `FilterTh` — only the live one counts. |
| `/config/department-master` | Faculty, Status | — | — | `GET /api/v1/users/departments` (rows still load normally) | — | 🚫 Both `FilterTh` calls live only inside commented-out "kept for reference" JSX — the page's own data is real, only the filter UI is dead. |
| `/config/designation-master` | Department | `.map()` over `useDepartments()` — `departments.map(d => d.deptName)` | free-text label (resolved via `departmentNameByIntDept[r.intDept]`, same name space as options) | `GET /api/v1/users/designations` | `GET /api/v1/users/departments` — fetched a second time, purely to resolve/list department names | ✅ Real. An earlier commented-out hardcoded version is dead/superseded code. |
| `/config/faculty-master` | Dean | Dynamic: `Array.from(new Set(rows.map(deanDisplayName)))`, deduped across all loaded rows | free-text label (full name, resolved via `useEmployees()` with a `r.deanName` fallback) | `GET /api/v1/academic/faculties` | `GET /api/v1/users/employees` — resolves each faculty row's dean name, which the options list is built from | ✅ Real. Options reflect the whole dataset, not just the visible page. |

### Academic module

| Page | Column | Options Source | Value Format | Row Data API | Filter Options API | Notes |
|---|---|---|---|---|---|---|
| `/academic/skill-master` | Approval Status | Hardcoded `['Approved', 'Pending', 'Rejected']` | status label (colored badge via `approvalBadge()`) | `GET /api/v1/users/skills` (also used for the page's own `?search=` box) | none — hardcoded | ✅ Real. A 4th status ("Details Requested") appears in legacy mock comments but isn't in the live `opts`. |
| `/academic/repetition-tag` | Programme Level | Hardcoded `["Bachelor's Degree", 'Diploma', "Master's Degree", 'Postgraduate Diploma', 'Certificate', 'PhD / Doctorate']` | badge/pill label | `GET /api/v1/academic/course-unit-repetitions` | none — hardcoded | ✅ Real. |
| `/academic/programme-level` | No Internal Assessment | — | — | `GET /api/v1/academic/program-levels` (rows still load normally) | — | 🚫 Only call site is commented out ("Not part of the confirmed GET response — kept for reference"). |
| `/academic/programme-group` | Programme Level | `.map()` over `useProgramLevels()` — `programLevels.map(l => l.levelName)` | free-text label | `GET /api/v1/academic/program-groups` | `GET /api/v1/academic/program-levels` | ✅ Real. |
| `/academic/intake-master` | Fin. Year | Dynamic: `Array.from(new Set(intakes.map(i => formatFinancialYear(i.financialYear))))` from the full `intakes` list | formatted string, e.g. `"2025–26"` | `GET /api/v1/academic/intakes` | same call — derived from `intakes` | ✅ Real. |
| `/academic/intake-master` | Academic | Hardcoded `['Current', '—']` | status label (`statusBadge(r.currentIntake)`) | `GET /api/v1/academic/intakes` | none — hardcoded | ✅ Real. |
| `/academic/intake-master` | Admission | Hardcoded `['Current', '—']` | status label (`statusBadge(r.currentAdmissionIntake)`) | `GET /api/v1/academic/intakes` | none — hardcoded | ✅ Real. |
| `/academic/course-units` | — | — | — | — | — | 🚫 `FilterTh` import is commented out entirely; the page uses separate `SearchSelect` dropdowns instead (Semester/Type ones aren't wired to any filtering either). |
| `/academic/programme-approval` | Group | Dynamic: `Array.from(new Set(rows.map(r => r.group)))` (`r.group` = `programGroupName \|\| '—'`) | free-text label, or "—" | `GET /api/v1/academic/program-master/not-approved` (fixed `pageSize=1000`, effectively load-all) | same call — derived from `rows` | ✅ Real. Filters + client `page` state both operate on that loaded set. |
| `/academic/programme-approval` | Programme Level | Dynamic: `Array.from(new Set(rows.map(r => r.level)))` | composite label, e.g. `"Bachelor's · 3yr / 6sem"` | `GET /api/v1/academic/program-master/not-approved` | same call — derived from `rows` | ✅ Real. A separate bare-name `levelDropdownOpts` powers an unrelated `SearchSelect`. |
| `/academic/programme-master` | Group | Dynamic: `Array.from(new Set(rows.map(r => r.group)))` (matched `programGroups` lookup `.groupCode`) | short code label, e.g. `"BCA"` | `GET /api/v1/academic/program-master?search=` (blank search = full list) | same call — derived from `rows`, cross-referenced against `GET /api/v1/academic/program-groups` for the code | ✅ Real. |
| `/academic/programme-master` | Programme Level | Dynamic: `Array.from(new Set(rows.map(r => r.level)))` | composite label, e.g. `"Master's · 2yr / 4sem"` | `GET /api/v1/academic/program-master?search=` | same call — derived from `rows` | ✅ Real. |
| `/academic/programme-master` | Admission Status | Hardcoded `['Active', 'Inactive']` | status label (`p.pgmStatus ? 'Active' : 'Inactive'`) | `GET /api/v1/academic/program-master?search=` | none — hardcoded | ✅ Real. |
| `/academic/odl-applications` | Programme | Hardcoded `['MBA ODL', 'BSc. IT ODL', 'Diploma Bus. ODL']` | free-text label | none — static mock rows | none — hardcoded | ⚠️ Mock rows, cosmetic filter. |
| `/academic/odl-applications` | Payment | Hardcoded `['Paid (DPO)', 'Paid', 'Not Paid']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/odl-applications` | Status | Hardcoded `['Pending Recon.', 'Awaiting Payment', 'Reconciled']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/timetable` (List View) | Day | Hardcoded `['Monday', …, 'Friday']` | free-text label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. Only applies to the hidden List View table — Week View is a separate grid with no `FilterTh`. |
| `/academic/timetable` (List View) | Type | Hardcoded `['Theory', 'Practical']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/timetable` (List View) | Room | Hardcoded `['LR-01', 'LR-02', 'Lab-A', 'Lab-B']` | alphanumeric code | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/timetable` (List View) | Faculty | Hardcoded `['Dr. Ssekibuule Ronald', 'Ms. Namutebi Joyce', 'Prof. Mukasa Charles']` | free-text label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/acad-dashboard` | Programme | Hardcoded 4-item programme list | free-text label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic; a separate plain `<select>` with a different option set also exists on the page. |
| `/academic/acad-dashboard` | Semester | Hardcoded `['Semester 1', 'Semester 2', 'Semester 3']` | pill label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/acad-dashboard` | Allocation | Hardcoded `['Done', '3 Pending']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/acad-dashboard` | Timetable | Hardcoded `['Live', 'Draft', 'Pending']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/acad-dashboard` | CW Status | Hardcoded `['In Progress', 'Not Started', 'Active']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `RoomMgmtModal` (opened from `/academic/timetable`) | Type | Hardcoded `['Lecture', 'Specialist', 'Computer Lab']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `RoomMgmtModal` | Status | Hardcoded `['Free', 'Mon 8–10']` | badge label (sometimes a time-range string) | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/allocation` | Programme | Hardcoded `['BSc. IT', 'BBA', 'MBA']` | short code | none — static mock rows | none — hardcoded | ⚠️ Cosmetic; separate plain `<select>`s also exist. |
| `/academic/allocation` | Semester | Hardcoded `['Sem 1', 'Sem 3']` | free-text label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/allocation` | Batch | Hardcoded 3-item batch-code list | alphanumeric code | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/allocation` | Status | Hardcoded `['Allocated', 'Missing']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/class-test` | Batch | Hardcoded `['BSC-IT-S1-D', 'MBA-S1-E']` | alphanumeric code | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/class-test` | Status | Hardcoded `['Completed', 'Upcoming', 'Not Scheduled']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/coursework` | Batch | Hardcoded `['BSC-IT-S1-D', 'MBA-S1-E']` | alphanumeric code | none — static mock rows | none — hardcoded | ⚠️ Cosmetic; omits a 3rd batch code (`BBA-S3-D`) that a separate plain `<select>` does list. |
| `/academic/coursework` | Faculty | Hardcoded 3-name list | free-text label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/coursework` | Status | Hardcoded `['Closed', 'Open', 'Not Scheduled']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/qual-equating` | Country of Qualification | Hardcoded `['DR Congo', 'Kenya', 'Rwanda']` | free-text label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/qual-equating` | Qualification Level | Hardcoded 3-item list | free-text label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/qual-equating` | Status | Hardcoded `['Completed', 'Pending', 'In Review']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/qual-equating` | Outcome | Hardcoded `['Equated — 2 Principal Passes', '—']` | free-text/badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/university-exam` | Programme | Hardcoded `['BSc. IT', 'BBA']` | short code | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/university-exam` | Vetting Status | Hardcoded `['Under Vetting', 'Approved', 'Not Uploaded']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |
| `/academic/university-exam` | Exam Status | Hardcoded `['Pending', 'Blocked']` | badge label | none — static mock rows | none — hardcoded | ⚠️ Cosmetic. |

### Employee module

| Page | Column | Options Source | Value Format | Row Data API | Filter Options API | Notes |
|---|---|---|---|---|---|---|
| `/employee/employee-master` | Sex | Hardcoded `['Male', 'Female']` | derived label (`r.sex === 1 ? 'Male' : 'Female'`) | `GET /api/v1/users/employees` | none — hardcoded | ✅ Real. |
| `/employee/employee-master` | Status | Hardcoded `['Approved', 'Pending']` | badge label (`r.isApproved ? 'Approved' : 'Pending'`) | `GET /api/v1/users/employees` | none — hardcoded | ✅ Real. |

### Assessment module — all ⚠️ cosmetic (static mock rows, no API call of any kind on any of these table pages)

Every row below has **Row Data API: none — static mock rows** and **Filter Options API: none —
hardcoded**, so those two columns are omitted here rather than repeated 19 times.

| Page | Column | Options Source | Value Format |
|---|---|---|---|
| `/assessment/mark-cw` | SUBMISSION | Hardcoded `['Submitted', 'Blocked']` | status badge |
| `/assessment/schedule` | Type | Hardcoded `['CW', 'CBT']` | badge label |
| `/assessment/ue-schedule` | QP Status | Hardcoded `['QP Pending', 'QP Verified', 'Under Vetting']` | badge label |
| `/assessment/weight-config` | MODEL | Hardcoded `['Standard', 'Engineering']` | free-text label |
| `/assessment/rpt-pending-qp` | STATUS | Hardcoded `['Overdue', 'Due Soon', 'Pending']` | badge label |
| `/assessment/rpt-faculty` | COMPLIANCE | Hardcoded `['Action Needed', 'Reevals Pending', 'Evaluating', 'On Track']` | badge label (note: a "Partial" value appears in row data but isn't in `opts`) |
| `/assessment/resit-calendar` | STATUS | Hardcoded `['Cleared', 'Awaiting Fee']` | badge label |
| `/assessment/reeval` | STATUS | Hardcoded `['Pending Faculty', 'Overdue']` | badge label |
| `/assessment/recheck` (Flagged Cases) | STATUS | Hardcoded `['Awaiting Auditor']` | pill label |
| `/assessment/recheck` (Audit Log) | STATUS | Hardcoded `['Resolved', 'Open']` | badge label |
| `/assessment/qp-vetting` (faculty tab) | STATUS | Hardcoded `['Verified', 'Pending Upload']` | badge label |
| `/assessment/mark-ue` | RESULT | Hardcoded `['PASS', 'FAIL (UE)']` | badge label |
| `/assessment/moderation` | RESULT | Hardcoded `['PASS', 'FAIL (UE)']` | badge label |
| `/assessment/hall-ticket` | Clearance | Hardcoded `['Ready', 'Fee Pending', 'CW/CBT Pending']` | badge label |
| `/assessment/cw-submissions` | Fee Status | Hardcoded `['Cleared', 'Blocked']` | badge label |
| `/assessment/cw-qbank` | STATUS | Hardcoded `['Overdue', 'Pending']` | badge label |
| `/assessment/cw-overview` | Status | Hardcoded `['Blocked', 'Complete', 'Evaluating']` | badge label |
| `/assessment/cbt-overview` | Status | Hardcoded `['Complete', 'In Progress', 'Not Scheduled']` | badge label |
| `/assessment/cbt-monitor` | Status | Hardcoded `['Active', 'Submitted', 'Blocked']` | badge label |

---

## 4. Takeaways

- **Value format is always a plain string**, always matched by exact equality against whatever the
  cell already displays (a badge's text, a resolved name, a formatted date string, a code). There is
  no numeric/date-range filter type anywhere in `FilterTh`.
- **Every real (✅) filter is client-side**: the full dataset is fetched once (via a hook with a large
  fixed page size, or no pagination params at all) and both the filter options and the row-narrowing
  happen in-memory afterward, with a client-side `usePagination` slicing the result for display. None
  of these pages send filter selections to the server as query params.
- **The ⚠️ group is by far the largest** (all of Assessment, most of Academic beyond its master-data
  pages) — these are UI-first design mockups where the table rows themselves are hardcoded, so there's
  nothing for the filter to narrow yet. Wiring any of them to a real filter would need (a) a real data
  hook to replace the hardcoded rows, then (b) the same `filteredRows`-over-loaded-list pattern the ✅
  pages already use.
- Three pages (Department Master, Programme Level, Course Units) have leftover `FilterTh`
  imports/helpers from before their real API integration that are now fully dead code — safe to
  remove if cleaning up unused imports.
- **Row Data API** vs. **Filter Options API** are often two different calls: most ✅ pages fetch their
  own rows from one endpoint, then derive filter options straight from those same rows in-memory
  (`Row Data API` = `Filter Options API`). A few instead call a *second*, separate lookup endpoint just
  to populate the options list — Campus Master's Campus Name filter (`/campus/dropdown`, distinct from
  the paginated `/campus` the table itself uses), Designation Master's Department filter and Faculty
  Master's Dean filter (`/users/departments`/`/users/employees`, neither of which is the page's own
  primary resource) are the clearest examples of that pattern.
- Every endpoint listed is a real, already-integrated `GET`. None of the ⚠️/🚫 pages call an API at
  all for their table data — "no API" there means exactly that, not an unconfirmed/undocumented one.
