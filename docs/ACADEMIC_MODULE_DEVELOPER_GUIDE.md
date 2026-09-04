# ISBAT University ERP — Academic Module: Developer Guide

> **Branch:** `feature/erp-academic-modernization`
> **Stack:** Next.js 14 App Router · React 18 · Custom CSS Design System (no Tailwind)
> **Last Updated:** 2026-05-26

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Map](#2-file-map)
3. [State & Props System](#3-state--props-system)
4. [Sidebar Navigation Map](#4-sidebar-navigation-map)
5. [Page-by-Page Breakdown](#5-page-by-page-breakdown)
   - [Module 1 — Setup Hierarchy](#module-1--setup-hierarchy)
   - [Module 2 — Batch & Fee Setup](#module-2--batch--fee-setup)
   - [Module 3 — Allocation & Session](#module-3--allocation--session)
   - [Module 4 — Timetable](#module-4--timetable)
   - [Module 5 — Assessments](#module-5--assessments)
   - [ODL Track](#odl-track)
   - [Cross-Module Pages](#cross-module-pages)
6. [User Flow Diagrams](#6-user-flow-diagrams)
7. [Modal Inventory](#7-modal-inventory)
8. [Business Rules Reference](#8-business-rules-reference)
9. [Known Incomplete Wiring](#9-known-incomplete-wiring)

---

## 1. Architecture Overview

The entire Academic Module is a **single-page application (SPA) nested inside Next.js**. There is no client-side routing — navigation is a `useState<string>` called `currentPage` in the root `page.tsx`. Every sidebar click updates that string; the `renderPage()` switch renders the matching component.

```
User clicks sidebar item
        ↓
nav('page-id') called in page.tsx
        ↓
setCurrentPage('page-id')
        ↓
renderPage() switch returns matching component
        ↓
window.scrollTo(0, 0)
```

All shared state (which page is visible, which modals are open, toast messages, tab states) lives in `page.tsx` and flows **down** to page components via props. Page components never hold their own navigation or modal state — they only call the functions passed to them.

---

## 2. File Map

```
src/app/academic/
├── page.tsx                    ← Shell: all state, sidebar, header, toast, modal container
└── components/
    ├── pages-part1.tsx         ← Dashboard, Intake Master, Course Units, Skill Management
    ├── pages-part2.tsx         ← Session Movement, Allocation, Timetable, Coursework, Class Test
    ├── pages-part3.tsx         ← University Exam, Results, Grievance, ODL Applications,
    │                              ODel Student Preview, ODL Reconciliation, Qual Equating
    ├── pages-part4.tsx         ← Faculty Master, Lecturer Master, Programme Level,
    │                              Programme Group, Programme Master
    ├── pages-part5.tsx         ← Batch Management, Fee Structure, Access Gate,
    │                              Student Lookup, Fee Clearance
    └── modals.tsx              ← ModalsContainer: all 30+ modal dialogs in one file
```

### Why split into 5 parts?

Each file is kept under ~700 lines to avoid the 32,000 output-token limit that would be hit if the entire page set were in one file. The split is by logical module grouping, not arbitrary.

---

## 3. State & Props System

### State in `page.tsx`

| State variable | Type | Purpose |
|---|---|---|
| `currentPage` | `string` | Controls which page component renders |
| `openModals` | `Set<string>` | All currently open modal IDs |
| `collapsedSections` | `Set<string>` | Collapsed sidebar section IDs |
| `toast` | `{ msg, type } \| null` | Current toast notification (auto-clears after 3.5s) |
| `showPreview` | `boolean` | ODL Applications — controls candidate-form preview panel |
| `odpTab` | `string` | ODel Student Preview — active tab: `personal \| qualifications \| family \| documents \| payment` |
| `showFcResult` | `boolean` | Fee Clearance — shows/hides the clearance result panel |

### PageProps interface (identical in every component file)

```ts
interface PageProps {
  nav: (id: string) => void;           // Navigate to a page
  openModal: (id: string) => void;     // Open a modal by ID
  closeModal: (id: string) => void;    // Close a modal by ID
  showToast: (msg: string, type?: string) => void;  // Show toast notification
  openModals: Set<string>;             // Read which modals are open
}
```

Pages with extra state receive additional props:

| Page | Extra props |
|---|---|
| `OdlApplicationsPage` | `showPreview`, `setShowPreview` |
| `OdelStudentPreviewPage` | `odpTab`, `setOdpTab` |
| `FeeClearancePage` | `showFcResult`, `setShowFcResult` |

### Toast types

```ts
showToast('message')            // neutral (no colour)
showToast('message', 'success') // green
showToast('message', 'warn')    // amber
showToast('message', 'info')    // blue
```

---

## 4. Sidebar Navigation Map

The sidebar has two layers:

- **Icon rail (66px)** — always visible; shows module icons. Finance, Attendance, Analytics, Admin are locked ("Coming Soon").
- **Panel (228px)** — slides in for the active module (Academic). Contains collapsible groups.

```
Sidebar Group            Sidebar Item             → currentPage ID
─────────────────────────────────────────────────────────────────
Overview                 Dashboard                → acad-dashboard
Academic Core            Intake Master            → intake-master
                         Faculty Master           → faculty-master
                         Lecturer Master          → lecturer-master
                         Skill Management         → skill-master
                         Batch Management         → batch-management
                         Session Movement 🔴1    → session-movement
Course Unit Master       Course Units             → course-units
Programme Master         Programme Level          → a-level-master
                         Programme Group          → programme-group
                         Programme Master         → programme-master
                         Fee Structure            → fee-structure
Timetable                Timetable                → timetable
ODL Applications         ODL Applications 🔵7    → odl-applications
                         Payment Reconciliation 🔴4 → odl-reconciliation
Cross-Module             Student Lookup           → student-lookup
```

> Badges on items (e.g. `🔴1`) show alert counts and are currently hardcoded.

### Pages accessible only via code (not sidebar)

These pages are navigated to programmatically from other pages using `nav()`:

| Page ID | Navigated from |
|---|---|
| `allocation` | Dashboard (batch table "Fix →"), Skill Master ("Proceed to Allocation") |
| `timetable` | Dashboard (batch table "View →" / "Schedule →"), Coursework |
| `coursework` | Dashboard (batch table "View →") |
| `odl-reconciliation` | ODL Applications ("Reconciliation Desk →", row "Reconcile →") |
| `odel-student-preview` | Not wired in sidebar — accessible via `nav('odel-student-preview')` |
| `qual-equating` | Not wired in sidebar — accessible via `nav('qual-equating')` |
| `grievance` | Not wired in sidebar — accessible via `nav('grievance')` |
| `university-exam` | Not wired in sidebar — accessible via `nav('university-exam')` |
| `results` | Not wired in sidebar — accessible via `nav('results')` |
| `class-test` | Not wired in sidebar — accessible via `nav('class-test')` |
| `fee-clearance` | Not wired in sidebar — accessible via `nav('fee-clearance')` |
| `access-gate` | Not wired in sidebar — accessible via `nav('access-gate')` |

> **Action required:** 10 pages are not linked in the sidebar. Decide whether to add them, or keep them as drill-through destinations only.

---

## 5. Page-by-Page Breakdown

---

### Module 1 — Setup Hierarchy

> These pages configure the foundational data that all other modules depend on. They must be completed **in order** before any intake can be run.

---

#### `acad-dashboard` — Academic Dashboard
**File:** `pages-part1.tsx` · `DashboardPage`

**What it shows:**
- Two **pipeline visualisations**: "Setup Hierarchy" (7-step: Programme Level → Programme → Curriculum → Batches → Fee Structure → Skills+Allocation → Session Movement) and "Current Semester Cycle" (7-step: Session Movement → Allocation → Timetable → CW/CBT → Uni.Exam → Results → Grievance). Each step shows done/active/pending.
- **4 stat cards**: Active Students (1,284), Allocation Pending (3), Timetables Active (14), ODL Pending Recon (4).
- **Active Intakes card**: Current Academic Intake (Spring 2026 – teaching in progress) and Current Admission Intake (Fall 2026 – admissions open). Includes a business rule info box: only one of each can be active at a time.
- **Recent Activity timeline**: Live feed of system events (session movement completion, allocation gaps, ODL payments, timetable drafts, course unit updates).
- **Active Batches table**: All batches for the current intake showing programme, semester, student count, allocation status, timetable status, and CW status. Each row has a contextual action button.

**Buttons and where they go:**

| Button | Action |
|---|---|
| "Intake Settings" | `nav('intake-master')` |
| "Run Session Movement" | `nav('session-movement')` |
| Active Intakes card "Manage →" | `nav('intake-master')` |
| Batch row "View →" (timetable set) | `nav('timetable')` |
| Batch row "Fix →" (allocation pending) | `nav('allocation')` |
| Batch row "View →" (CW active) | `nav('coursework')` |
| Batch row "Schedule →" (timetable pending) | `nav('timetable')` |

---

#### `intake-master` — Intake Master
**File:** `pages-part1.tsx` · `IntakeMasterPage`

**What it shows:**
- **Warning banner**: Only one Current Academic Intake and one Current Admission Intake can be active at a time. Dates are manually set.
- **Two gradient hero cards** (blue = current academic, green = current admission) showing the active intake dates at a glance.
- **All Intakes table**: Full history of all intake records with columns: Code, Description, Financial Year, Semester Start, Term1 End, Term2 End, Grievance End, Re-entry Date, Academic flag, Admission flag, Action.
- Row states: `selected-row` (current), normal (future/closed).

**Buttons and modals:**

| Button | Action |
|---|---|
| "New Intake" | `openModal('new-intake-modal')` |
| Row "Edit" (active rows) | `openModal('intake-edit-modal')` |
| Row "View" (closed rows) | No handler (dead button) |

**Modal: `new-intake-modal`** — Form to create a new intake with code, description, all date fields, and academic/admission type toggles.

**Modal: `intake-edit-modal`** — Same form pre-populated for editing an existing intake.

---

#### `faculty-master` — Faculty Master
**File:** `pages-part4.tsx` · `FacultyMasterPage`

**What it shows:**
- Simple table of all faculties: Code, Name, Dean, Programme count, Course Unit count.
- Current data: FCT (Computing & Technology), FBM (Business & Management), FEN (Engineering).

**Buttons and modals:**

| Button | Action |
|---|---|
| "Add Faculty" | `openModal('new-faculty-modal')` |
| Row "Edit" | No handler (dead — should openModal) |

**Modal: `new-faculty-modal`** — Form: Faculty Code, Full Name, Short Name, Dean (staff lookup), Contact Info.

---

#### `lecturer-master` — Lecturer Master
**File:** `pages-part4.tsx` · `LecturerMasterPage`

**What it shows:**
- Info box linking to Skill Management (where subject expertise is captured separately).
- Table of all lecturers with: ID, Name + email, Highest Qualification + institution, Specialisation, Faculty, Designation badge, Status badge (Active / On Leave).

**Buttons and modals:**

| Button | Action |
|---|---|
| "Add Lecturer" | `openModal('new-lecturer-modal')` |
| Row "Edit" | No handler (dead — should openModal) |

**Modal: `new-lecturer-modal`** — Form: Staff ID, Title, Name, Email, Highest Qualification, Institution, Specialisation, Faculty, Designation, Employment Type.

> Note: Subject-level skills are captured in Skill Management, not here.

---

#### `a-level-master` — Programme Level
**File:** `pages-part4.tsx` · `ALevelMasterPage`

**What it shows:**
- Info box explaining that selecting a level in Programme Master auto-populates year count, semester count, and minimum credit load.
- Table of defined levels: Certificate, Diploma, Bachelor's, Bachelor of Engineering, Master's, PhD.
- Columns: Level Code, Level Name, Year Count, Semester Count, Min. Credit Load, No Internal Assessment flag, Linked Programmes count.

**Key business rule visible in UI:**
- PhD level has "No Internal Assessment" flag — no CW or CBT is generated for PhD course units.

**Buttons and modals:**

| Button | Action |
|---|---|
| "Add Level" | `openModal('new-alevel-modal')` |
| Row "Edit" | No handler (dead — should openModal) |

---

#### `programme-group` — Programme Group
**File:** `pages-part4.tsx` · `ProgrammeGroupPage`

**What it shows:**
- Info box: Groups are used for **high-level reporting** — searching "BCA" returns students across all BCA curriculum versions (2026, 2031, etc.).
- Table: Group Code, Group Name, Programme Level, Active Versions count, Inactive Versions count, Total Students.

**Buttons and modals:**

| Button | Action |
|---|---|
| "Add Programme Group" | `openModal('new-proggroup-modal')` |
| Row "Edit" | No handler (dead — should openModal) |

---

#### `programme-master` — Programme Master
**File:** `pages-part4.tsx` · `ProgrammeMasterPage`

**What it shows:**
- **Breadcrumb hierarchy bar**: Programme Level → Programme Group → **Programme Master** (current) → Course Units. Each step is a clickable button navigating to that page.
- **Warning banner**: Versioning Rule — NCHE requires 30–50% curriculum change every 5 years. Old versions must stay Inactive; new versions set Active for new admissions only.
- **Danger box**: Accreditation Alert — BBA 2021 expires in 6 months.
- **Programme Versions table**: Prog Code, Name, Group, Level, Faculty→Campus, Accreditation Date, Expiry, No IA flag, Specializations count, Admission Status (Active/Inactive).

**Buttons and modals:**

| Button | Action |
|---|---|
| "Add Programme Version" | `openModal('new-prog-modal')` |
| Hierarchy bar buttons | `nav('a-level-master')`, `nav('programme-group')`, `nav('course-units')` |
| Accreditation alert "View →" | `nav('programme-master')` (self — refreshes) |
| Row "Edit" | `openModal('new-prog-modal')` |
| Row "Curriculum" | `nav('course-units')` |
| Row "Renew" (expiring) | `openModal('new-prog-modal')` |
| Row "New Version" | `openModal('new-prog-modal')` |
| Row "Specializations" | `openModal('specialization-modal')` |

---

#### `course-units` — Course Units Master (Curriculum)
**File:** `pages-part1.tsx` · `CourseUnitsPage`

**What it shows:**
- Two info boxes: proration rules (CW 25→15, CBT 50→15, UE 100→70) and unit type/category explanation.
- **Unit Type → Assessment Component Rules** card (4-column grid):
  - **Theory**: Internal Assessment = CW + CBT; University Assessment = UE Paper
  - **Practical**: Internal Assessment = CW only (no CBT); University Assessment = Practical Exam
  - **Combined**: Theory IA = CW + CBT; Practical = no IA, separate exam only
  - **Project**: Student-led; evaluated after set timeframe
- **Course Unit Master table**: Code, Unit Name, Programme, Semester, Credits, Unit Type badge, Unit Category badge, Has CW, Has CBT, Proration formula, Syllabus status, Action.

**Unit Category values:**
- `Core` — all students in the programme
- `Specialization` — students in a specific specialisation only
- `Elective (batch-level)` — one paper selected per batch for the session (requires elective paper selection)

**Buttons and modals:**

| Button | Action |
|---|---|
| "Add Course Unit" | `openModal('cu-new-modal')` |
| Row "Edit" | `openModal('cu-edit-modal')` |
| Elective row "Select Paper →" | `openModal('elective-select-modal')` |
| Missing syllabus row "Upload Syllabus" | `openModal('cu-edit-modal')` |

---

### Module 2 — Batch & Fee Setup

---

#### `batch-management` — Batch Management
**File:** `pages-part5.tsx` · `BatchManagementPage`

**What it shows:**
- Info box: Batch Code is system-generated as `Course Code + Session/Year + Batch Type + Sub-Batch` e.g. `BSc-VFX-S26-DA`.
- Warning: large cohorts (100+ students) must be split into sub-batches (DA, DB) of ~50.
- **4 stat cards**: Active Batches (18), Pending Sub-batch (3), Total Students (1,284), Batch In-Charges (18).
- **Active Batches table**: Batch Code, Programme Version, Semester, Type (Day/Evening/Weekend/Distance), Sub-Batch label, Student count, Batch In-Charge, Timetable status, Edit button.
- **Batch Code Generator** card: Interactive form (Course Code + Session/Year + Batch Type + Sub-batch) that previews the auto-generated code in real time.

**Key rules visible in UI:**
- Specialization is per-student, not per-batch.
- Batch In-Charges can view batch reports but have no direct relation to programme courses.
- Admissions happen every semester (twice a year); a new batch must be created each intake.

**Buttons and modals:**

| Button | Action |
|---|---|
| "Create Batch" | `openModal('new-batch-modal')` |
| Row "Edit" | `openModal('new-batch-modal')` |
| Flagged row "Split → Sub-batches" | `openModal('new-batch-modal')` |

---

#### `fee-structure` — Programme Fee Structure
**File:** `pages-part5.tsx` · `FeeStructurePage`

**What it shows:**
- Programme/Student Type/Currency selector row at the top (three read-only fields + Settings button).
- **Quick Summary chips**: Semesters, Fee Items, Avg/Semester, Programme Total.
- Two info boxes: auto-settlement by priority; sponsored students bypass payment checks.
- **Per-semester fee cards** (Semester 1, 2, 3 shown): Each card has a header with semester label, item count, total amount, and "Add Fee Item" button. Body lists fee items as rows: Priority badge (P1–P5), Fee Name + description, Amount, Edit + Delete buttons.
- **Add New Semester** button at the bottom.

**Settlement priority (hardcoded display):**
1. Admission Fee (P1) — one-time
2. Semester Entry Fee (P2) — required before registration
3. Tuition Fee (P3) — 50% needed for assessment, 100% for progression
4. Lab Fee / Industrial Training Fee (P4)
5. Library & Resources Fee (P5)

**Buttons and modals:**

| Button | Action |
|---|---|
| "Clone Last Year" | `showToast(...)` (no actual clone — dead) |
| "New Fee Structure" | `openModal('new-fee-structure-modal')` |
| "Settings" | `openModal('new-fee-structure-modal')` |
| Semester "Add Fee Item" | `openModal('new-fee-item-modal')` |
| Fee row "Edit" pencil | `openModal('new-fee-item-modal')` |
| Fee row "Delete" trash | No handler (dead) |
| "Add New Semester" | `showToast(...)` (informational only) |

---

### Module 3 — Allocation & Session

---

#### `skill-master` — Skill Management
**File:** `pages-part1.tsx` · `SkillMasterPage`

**What it shows:**
- Warning: Faculty must populate skills here **before** allocation can be performed. Faculty-only access.
- Two info boxes: skill-to-allocation dependency; typical faculty load is 5–6 subjects; project subjects only need weekly check-ins.
- **4 stat cards**: Total Faculty (28), Skills Populated (24), Skills Incomplete (4), Total Skills Logged (142).
- **Faculty Skill Register table**: Faculty Name, Faculty code, Skills/Subject Areas (rendered as pill tags), Subjects Eligible count, Current Load badge, Project Check-ins count, Status badge (Complete/Partial/Incomplete), Action.

**Buttons and modals:**

| Button | Action |
|---|---|
| "→ Proceed to Allocation" | `nav('allocation')` |
| "Add Skill" | `openModal('add-skill-modal')` |
| Row "View" (complete) | `openModal('skill-edit-modal')` |
| Row "Add Skills →" (incomplete) | `openModal('skill-edit-modal')` |
| Row "Update Skills →" (partial) | `openModal('skill-edit-modal')` |

---

#### `allocation` — Course Unit Allocation
**File:** `pages-part2.tsx` · `AllocationPage`

**What it shows:**
- Warning with link to Skill Management ("4 faculty members currently have incomplete skill profiles").
- Info box: support staff enter data from Dean's pre-approved Excel file; no system restriction on subject count.
- **4 stat cards**: Total Course Units (84), Allocated (81, 96%), Unallocated (3), Faculty Members (28).
- **Current Allocations table**: Course Code, Unit Name, Programme, Semester, Batch, Allocated To (lecturer name or "— Unallocated —"), Status badge (Allocated/Missing), Action.
- Unallocated rows are highlighted in `flagged` class.

**Buttons:**

| Button | Action |
|---|---|
| "Manual Entry" | `openModal('manual-alloc-modal')` |
| "Import from Excel" | `openModal('alloc-import-modal')` |
| "Skill Management Master" inline button | `nav('skill-master')` |
| Allocated row "Edit" | `showToast('Editing [code]', 'info')` |
| Unallocated row "Assign →" | `showToast('Assigning [code]', 'info')` |

---

#### `session-movement` — Session Movement
**File:** `pages-part2.tsx` · `SessionMovementPage`

**What it shows:**
- **Execution Rules** warning box: must run 3–4 weeks before session start; batch-by-batch only; original batch code stays fixed; blocked if student count = 0; **irreversible**.
- **Tables Initialised** info box: describes `T_session_management`, `Tia Table`, and Exam Schedule Tables that are created during movement.
- **Progression Eligibility Rules table** (read-only, system-enforced):
  - Initial Registration: Admission Fee + Registration Fee fully paid → Registered
  - Sem 1 → Sem 2: Current sem fee fully cleared + Next sem Entry Fee cleared → Registered; else Dropout or Yet to Register
  - Sem 2 → Sem 3+: Above fees + must clear minimum 50% of all previous semester subjects → Registered; else Dropout / Yet to Register / Yet to Clear
  - Sponsored students bypass all fee checks
- **Outcome legend**: Registered (green), Dropout (red), Yet to Register (amber), Yet to Clear (cyan).
- **4 stat cards** showing live counts of each outcome status.
- **Movement Configuration card**: From Intake selector, To Intake selector, Programme Filter, "Preview Movement Results" button.
- **Preview Results panel** (hidden until preview runs): full student-by-student table showing each student's fee status, subject clearance %, sponsored flag, and movement outcome. Plus outcome summary grid. Plus danger box (irreversible warning) and action buttons.

**Buttons:**

| Button | Action |
|---|---|
| "← Back" | `nav('acad-dashboard')` |
| "Preview Movement Results" | `showToast('Running preview...', 'info')` |
| "Download Preview CSV" | `showToast('Preview report downloaded.', 'success')` |
| "Cancel" | Hides preview panel + `showToast(...)` |
| "Confirm & Execute Session Movement →" | `openModal('confirm-movement-modal')` |

**Modal: `confirm-movement-modal`** — Final confirmation dialog before irreversible batch promotion. Shows batch count and affected student count.

> **Important:** The preview results panel uses `style={{ display: 'none' }}` and is revealed by direct DOM manipulation (`document.getElementById`). This is vanilla JS in a React component and will not survive a re-render. This needs to be converted to a `useState<boolean>` for the preview visibility.

---

### Module 4 — Timetable

---

#### `timetable` — Timetable Management
**File:** `pages-part2.tsx` · `TimetablePage`

**What it shows:**
- **Dual Clash Prevention danger box**: Faculty clash (teacher already allocated elsewhere) + Room clash (room already occupied) are both hard-blocked on every slot entry. No override permitted.
- **Publish Rules info box**: published schedule immediately visible on Student Portal and Lecturer view. Subjects with Repetition Tags allow combining multiple batches into a single slot.
- **Batch/Intake/Room Filter/View toggle selector card**.
- **Conflict Warning banner** (hidden by default, shows when conflict detected).
- **Weekly Schedule grid card** with drag-and-drop visual container (`#tt-grid-container`) and legend for slot types (Theory, Practical, Tutorial, CBT/Lab, Combined Batch, Conflict).
- **List View card** (hidden by default, toggled by View button).

**Buttons:**

| Button | Action |
|---|---|
| "Manage Rooms" | `openModal('room-mgmt-modal')` |
| "Import Excel" | `openModal('tt-import-modal')` |
| "Publish — Students & Faculty" | `showToast('Publishing timetable...', 'success')` |
| Batch/Room filter selectors | `showToast('Rendering...', 'info')` |
| "Week" view toggle | `showToast('Week view', 'info')` |
| "List" view toggle | `showToast('List view', 'info')` |
| "Add Slot" | `openModal('add-slot-modal')` |

> **Note:** The grid (`#tt-grid-container`) and list (`#tt-list-body`) are populated by DOM ID — there is no React state driving the grid render. This will need to be refactored using `useState` with a timetable data structure when backend integration starts.

---

### Module 5 — Assessments

---

#### `coursework` — Coursework Management
**File:** `pages-part2.tsx` · `CourseworkPage`

**What it shows:**
- Info box: CW marked out of 25 → prorated to 15. Students need 50% fee clearance to **submit** (not to view).
- Warning: View access permitted without clearance; clearance only blocks submission.
- **Assessment pipeline**: Term 1 CW → Term 1 CBT → Term 2 CW → Term 2 CBT → Uni. Exam.
- **Active Coursework table**: Course Unit, Batch, Faculty, Open Date, Due Date, Out Of, Submitted count (of enrolled), Fee-cleared count, Status badge (Closed/Open/Not Scheduled), Action.

**Buttons:**

| Button | Action |
|---|---|
| "Schedule Coursework" | `openModal('new-cw-modal')` |
| Active row "View Marks" | No handler (dead) |
| Active row "Manage" | No handler (dead) |
| Unscheduled row "Schedule →" | `openModal('new-cw-modal')` |

---

#### `class-test` — Class Test (CBT)
**File:** `pages-part2.tsx` · `ClassTestPage`

**What it shows:**
- Info box: CBT marked out of 50 → prorated to 15. 60-minute server-side timer; cannot be extended or paused.
- Warning: 50% fee clearance required for submission (on original pre-discount fee).
- **Scheduled Class Tests table**: Course Unit, Batch, Date, Time, Duration, Out Of, Attempted, Fee-cleared count, Status badge, Action.

**Buttons:**

| Button | Action |
|---|---|
| "Schedule Class Test" | `openModal('new-cbt-modal')` |
| Completed row "View Marks" | No handler (dead) |
| Upcoming row "Manage" | No handler (dead) |
| Unscheduled row "Schedule →" | `openModal('new-cbt-modal')` |

---

#### `university-exam` — University Examination
**File:** `pages-part3.tsx` · `UniversityExamPage`

**What it shows:**
- Info box: QPs must be uploaded by faculty → manually vetted by QP Vetting Committee (checked against approved syllabus) → printed for offline exam. Marked out of 100 → prorated to 70.
- **QP Vetting Pipeline**: QP Uploaded → Vetting → QP Approved → Exam Day → Mark Entry.
- **Question Papers table**: Course Unit, Programme, Exam Date, Uploaded By, Upload Date, Vetting Status, Exam Status, Action.

**Buttons:**

| Button | Action |
|---|---|
| "Upload Question Paper" | `openModal('new-qp-modal')` |
| Row "Vet QP →" | No handler (dead) |
| Row "View QP" | No handler (dead) |
| Flagged row "Upload QP" | `openModal('new-qp-modal')` |

---

#### `results` — Results
**File:** `pages-part3.tsx` · `ResultsPage`

**What it shows:**
- Placeholder page. Results and Mark Entry are owned by the **Assessment Module (Service 4)**.
- Displays an "undefined-box" with explanation and "Pending KT Session" badge.
- Note: Result publication triggers the next Session Movement cycle.

**No buttons or modals.**

---

#### `grievance` — Grievance Management
**File:** `pages-part3.tsx` · `GrievancePage`

**What it shows:**
- Warning: Grievance window end date is defined in Intake Master (currently "10 Jun 2026").
- Placeholder "undefined-box": Grievance workflow has not yet been covered in a KT session.
- Known facts shown: students submit before Grievance End Date; appeals processed post-result publication.

**No buttons or modals.** Module not yet defined.

---

### ODL Track

---

#### `odl-applications` — ODL Applications
**File:** `pages-part3.tsx` · `OdlApplicationsPage`

**What it shows:**
- Info box: ODL applications start at `ERP.../online.ASP`; payment not required to start; no fee exemptions.
- Warning: Applications stay in Temporary ODL Table until accounts reconciles payment; only then moves to regular application.
- **ODL Pipeline**: Online Apply → Reference No. Sent → Payment (DPO) → Reconciliation → Regular App. → Admission.
- **4 stat cards**: Total ODL Applications (31), Awaiting Payment (9), Paid – Pending Recon (4), Reconciled → Moved (18).
- **ODL Applicants table**: ODL Ref No., Applicant Name, Email, Programme, Applied Date, Payment status, DPO Token, Status, Action.
- **Candidate-Facing ODL Application Form** preview (cyan dashed border card): Shows the public form for context — Name, Email, Phone, Programme of Interest, Highest Qualification, Photo upload, Payment method toggle (Online DPO / Manual at Office).

**Buttons:**

| Button | Action |
|---|---|
| "Reconciliation Desk →" | `nav('odl-reconciliation')` |
| Paid row "Reconcile →" | `nav('odl-reconciliation')` |
| Unpaid row "View App →" | No handler (dead) |
| Reconciled row "View →" | No handler (dead) |
| Candidate form "Save & Get Reference No." | `showToast(...)` |
| Candidate form "Proceed to Payment →" | `showToast(...)` |

---

#### `odel-student-preview` — ODel Student Preview
**File:** `pages-part3.tsx` · `OdelStudentPreviewPage`

**What it shows:**
A 5-tab form showing exactly what the candidate sees on the public portal. Tab state is driven by `odpTab` prop from `page.tsx`.

| Tab | Content |
|---|---|
| **Personal Info** | Profile photo upload, First/Last Name, DOB, Gender, Nationality, National ID, Phone, Email, Country of Residence, Residential Address. "Next: Qualifications →" button |
| **Qualifications** | Highest Qualification, Institution, Year, Grade, Subjects/Specialisation. Optional: Current Employer, Years of Experience. Prev/Next navigation |
| **Family Details** | Father/Guardian Name, Occupation, Phone. Mother Name, Occupation, Phone. Emergency Contact. Prev/Next navigation |
| **Documents** | File upload zones: Passport Photo (required), National ID/Passport (required), Academic Certificate (required), Academic Transcript (optional), Other Documents (multiple). Prev/Next navigation |
| **Application Payment** | Full candidate application form + Fee Type selector + Amount display + Payment method toggle (DPO Online / Manual at Office) + Save & Get Reference + Proceed to Payment |

**Tab navigation is wired via `setOdpTab()`** — every tab's Prev/Next button calls `setOdpTab('tab-name')`.

---

#### `odl-reconciliation` — ODL Payment Reconciliation
**File:** `pages-part3.tsx` · `OdlReconciliationPage`

**What it shows:**
- Warning: Reconciliation is a **manual accounts process**. System does NOT auto-move applicants after DPO payment. Once reconciled, a "Payment is reconciled" email is sent and status changes from Lead → Candidate.
- **Pending Reconciliation list** (2 items shown): Each item shows applicant name, ODL Ref No, status badge, email, programme, DPO Token, paid date, amount. Three action buttons per item.

**Buttons:**

| Button | Action |
|---|---|
| "← ODL Applications" | `nav('odl-applications')` |
| "Verify Token" | `showToast('Viewing DPO transaction...', 'success')` |
| "Reject" | `showToast('Reconciliation rejected...', 'warn')` |
| "Confirm Reconciled" | `showToast('[Name] moved to regular application.', 'success')` |

---

#### `qual-equating` — Qualification Equating
**File:** `pages-part3.tsx` · `QualEquatingPage`

**What it shows:**
- Info box: Foreign qualifications must be equated with **NCHE** or **UVTOP** before admission. O-Level: min 5 passes, pass grade ≤ 8. A-Level: assessed on Principal and Subsidiary Passes.
- **Equating Requests table**: Applicant Name, Country, Qualification Level, Referred To (NCHE/UVTOP badge), Submitted Date, Status, Outcome, Action.
- **Undefined-box**: Detailed workflow (document submission to NCHE/UVTOP, tracking, outcome recording) not yet covered in KT session.

**Buttons:**

| Button | Action |
|---|---|
| "New Equating Request" | `openModal('new-equating-modal')` |
| Completed row "View →" | No handler (dead) |
| Pending row "Follow Up" | No handler (dead) |
| In-review row "View →" | No handler (dead) |

---

### Cross-Module Pages

---

#### `student-lookup` — Student Lookup
**File:** `pages-part5.tsx` · `StudentLookupPage`

**What it shows:**
- Info box: Cross-module shared page; full profile management lives in Student Microservice (Service 10).
- **Search card**: Name/Student No./Email input, Programme filter, Academic Year filter.
- **Registered Students table**: Student No., Name + email, Programme, Year/Sem, Intake, Academic Year, Fee Status badge (Cleared/Partial/Outstanding), Status badge (Active/Access Blocked), View + Edit buttons.

**Buttons:**

| Button | Action |
|---|---|
| "View" | No handler (dead — should open student profile) |
| "Edit" | No handler (dead — should open edit modal or navigate) |

---

#### `access-gate` — Academic Access Gate
**File:** `pages-part5.tsx` · `AccessGatePage`

**What it shows:**
- Danger box: Non-payment of current semester fee = absolute block on class attendance AND LMS. Separate from the 50% assessment submission threshold. Sponsorship bypasses all checks.
- **Three-tier access level grid** (visual):
  - 🔴 Fee Not Paid → BLOCKED: Class Attendance, LMS Access, Assessment Submission, Progression
  - 🟡 ≥50% Fee Paid → PARTIAL: Attendance allowed, LMS read-only, Question viewing; Submission blocked
  - 🟢 Sponsored Student → FULL ACCESS: All gates bypassed
- **Finance Auto-Settlement Priority Reference card** (read-only, owned by Finance/S3): Shows P1 Admission Fee → P2 Registration/Entry Fee → P3 Tuition Fee. Describes lump-sum auto-conversion and priority settlement.

**No action buttons** — this is a read-only reference/documentation page.

---

#### `fee-clearance` — Fee Clearance Check
**File:** `pages-part5.tsx` · `FeeClearancePage`

**What it shows:**
- Badge: "Shared — Read Only in Academic Module".
- Info box: Clearance is owned by Finance Module (Service 3). Minimum 50% calculated on original tuition fee (before discounts).
- **Clearance Status Lookup card**: Student Number input + "Check Clearance" button.
- **Result panel** (visible when `showFcResult === true`): 3 cards showing Clearance %, CW Submission status, CBT Submission status.
- **Undefined-box**: Finance Module Integration note — fee management, payment processing, clearance calculation all live in Finance Service.

**Buttons:**

| Button | Action |
|---|---|
| "Check Clearance" | `setShowFcResult(true)` |

---

## 6. User Flow Diagrams

### New Intake Setup Flow

```
1. Programme Level (a-level-master)    ← define NQF levels, year count
         ↓
2. Programme Group (programme-group)   ← group programmes by generic name
         ↓
3. Programme Master (programme-master) ← create versioned programme, set accreditation
         ↓
4. Course Units (course-units)         ← attach curriculum, set unit types, upload syllabus
         ↓
5. Batch Management (batch-management) ← create batches per intake, sub-batch if needed
         ↓
6. Fee Structure (fee-structure)       ← define fee items per semester per programme
         ↓
7. Skill Management (skill-master)     ← faculty log subject expertise
         ↓
8. Allocation (allocation)             ← assign faculty to course units per batch
         ↓ (3–4 weeks before session start)
9. Session Movement (session-movement) ← preview → confirm → promote students
```

### Each Semester Cycle Flow

```
Session Movement (session-movement)
         ↓
Allocation (allocation)
         ↓
Timetable (timetable)               ← set up per batch, publish to student/faculty portal
         ↓
 Term 1: Coursework (coursework)    ← schedule CW, faculty upload questions
          +  Class Test (class-test)
         ↓
 Term 2: Coursework (coursework)
          +  Class Test (class-test)
         ↓
University Exam (university-exam)   ← QP upload → vetting → offline exam → mark entry
         ↓
Results (results)                   ← owned by Assessment Module (Service 4)
         ↓
Grievance (grievance)               ← post-result appeals window (from Intake Master dates)
         ↓
 next Session Movement
```

### ODL Application Flow

```
Candidate at ERP.../online.ASP (public, no login)
         ↓
Fill ODL form → receive Reference No. by email
         ↓
Pay via DPO gateway (optional — can apply without payment)
         ↓
Admin sees in ODL Applications (odl-applications) table
         ↓
Accounts reconciles payment at ODL Reconciliation (odl-reconciliation)
         ↓
Status: Lead → Candidate. Email sent to applicant.
         ↓
Application moves to regular application form (Admissions)
```

### Fee Clearance → Assessment Submission Flow

```
Student pays fees (Finance Module S3)
         ↓
Fee clearance % calculated on ORIGINAL tuition fee (before discounts)
         ↓
Academic module queries clearance via API (read-only)
         ↓
< 50% paid  → access to view CW/CBT questions allowed; submission BLOCKED
≥ 50% paid  → CW and CBT submission ALLOWED
100% paid   → assessment submission + semester progression allowed
Sponsored   → all checks bypassed
```

---

## 7. Modal Inventory

All modals live in `modals.tsx` and are rendered via `ModalsContainer`. Each renders conditionally when its ID is in the `openModals` Set. Clicking the backdrop closes the modal; clicking inside stops propagation.

| Modal ID | Triggered By | Purpose |
|---|---|---|
| `new-intake-modal` | Intake Master "New Intake" | Create new academic/admission intake with all date fields |
| `intake-edit-modal` | Intake Master row "Edit" | Edit existing intake dates and type flags |
| `cu-new-modal` | Course Units "Add Course Unit" | Create new course unit with type, category, credits, proration |
| `cu-edit-modal` | Course Units row "Edit", "Upload Syllabus" | Edit course unit; upload syllabus outline |
| `elective-select-modal` | Course Units elective row "Select Paper →" | Choose which elective paper a batch will study |
| `add-skill-modal` | Skill Management "Add Skill" | Add new skill/subject area to the master |
| `skill-edit-modal` | Skill Management row "View/Add Skills/Update Skills" | View or edit a faculty member's skill list |
| `confirm-movement-modal` | Session Movement "Confirm & Execute" | Final confirmation before irreversible session movement |
| `manual-alloc-modal` | Allocation "Manual Entry" | Manually assign a lecturer to a course unit |
| `alloc-import-modal` | Allocation "Import from Excel" | Upload HOD Excel allocation sheet |
| `room-mgmt-modal` | Timetable "Manage Rooms" | CRUD for room master (name, capacity, type) |
| `tt-import-modal` | Timetable "Import Excel" | Import timetable from Excel template |
| `add-slot-modal` | Timetable "Add Slot" | Add a timetable slot (day, time, room, faculty, course unit) |
| `new-cw-modal` | Coursework "Schedule Coursework", unscheduled row "Schedule →" | Schedule a coursework assessment |
| `new-cbt-modal` | Class Test "Schedule Class Test", unscheduled row "Schedule →" | Schedule a CBT |
| `new-qp-modal` | University Exam "Upload Question Paper", flagged row | Upload question paper PDF for vetting |
| `new-faculty-modal` | Faculty Master "Add Faculty" | Create new faculty record |
| `new-lecturer-modal` | Lecturer Master "Add Lecturer" | Create new lecturer profile |
| `new-alevel-modal` | Programme Level "Add Level" | Create new programme level (NQF) |
| `new-proggroup-modal` | Programme Group "Add Programme Group" | Create new programme group |
| `new-prog-modal` | Programme Master "Add Version", "Edit", "Renew", "New Version" | Create or edit a programme version |
| `specialization-modal` | Programme Master row "Specializations" | Manage specialisation tracks for a programme |
| `new-batch-modal` | Batch Management "Create Batch", row "Edit", "Split" | Create or edit a batch; handle sub-batching |
| `new-fee-structure-modal` | Fee Structure "New Fee Structure", "Settings" | Create or configure a fee structure for a programme |
| `new-fee-item-modal` | Fee Structure semester "Add Fee Item", row "Edit" | Create or edit a fee line item |
| `new-equating-modal` | Qual Equating "New Equating Request" | Create a qualification equating request |

---

## 8. Business Rules Reference

These rules are **hardcoded in the frontend as display-only reference**. Backend must enforce them independently.

### Session Movement Progression Rules

| Stage | Fee Requirement | Subject Requirement | Sponsored | Outcome |
|---|---|---|---|---|
| Initial Registration (Sem 1 entry) | Admission Fee + Registration Fee fully paid | Not checked | Fee check bypassed | Registered |
| Sem 1 → Sem 2 | Current sem fee fully cleared + Next sem Entry Fee cleared | Not checked | Fee check bypassed | Registered / Dropout / Yet to Register |
| Sem 2 → Sem 3+ | Current sem fee fully cleared + Next sem Entry Fee cleared | Min 50% of all previous semester subjects passed | Fee check bypassed | Registered / Dropout / Yet to Register / Yet to Clear |

### Fee Clearance Access Tiers

| Clearance Level | Class Attendance | LMS View | Assessment Viewing | Assessment Submission | Progression |
|---|---|---|---|---|---|
| 0% (not paid) | ❌ | ❌ | ❌ | ❌ | ❌ |
| ≥50% (partial) | ✅ | ✅ read-only | ✅ | ❌ | ❌ |
| 100% (cleared) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sponsored | ✅ | ✅ | ✅ | ✅ | ✅ |

> 50% threshold is calculated on **original tuition fee before discounts**.

### Assessment Proration

| Assessment Type | Raw Mark | Prorated To | Notes |
|---|---|---|---|
| Coursework (CW) | 25 | 15 | Term-based, 2 per semester |
| Class-Based Test (CBT) | 50 | 15 | 60-minute server-side timer |
| University Exam (UE) | 100 | 70 | Offline, post-vetting |

### Unit Type → Assessment Components

| Unit Type | CW | CBT | UE Paper | Practical Exam |
|---|---|---|---|---|
| Theory | ✅ | ✅ | ✅ | ❌ |
| Practical | ✅ | ❌ | ❌ | ✅ |
| Combined | ✅ (theory) | ✅ (theory only) | ✅ | ✅ (no practical IA) |
| Project | ❌ | ❌ | ❌ | ❌ (evaluated after timeframe) |

### Programme Versioning

- NCHE requires **30–50% curriculum change every 5 years** for reaccreditation.
- Old versions stay **Inactive** (existing students continue on old curriculum).
- New versions set **Active** for new admissions only.
- Each programme version has an accreditation expiry date — alerts surface 6 months before expiry.

---

## 9. Known Incomplete Wiring

These are items visible in the UI but not yet wired to any action. They need to be addressed before the UI is production-ready.

### Dead buttons (no onClick)

| Location | Button | What it should do |
|---|---|---|
| Intake Master, All Intakes row (closed) | "View" | Open read-only intake detail modal |
| Faculty Master, table rows | "Edit" (all 3) | `openModal('edit-faculty-modal')` |
| Lecturer Master, table rows | "Edit" (all 5) | `openModal('edit-lecturer-modal')` |
| Programme Level, table rows | "Edit" | `openModal('edit-alevel-modal')` |
| Programme Group, table rows | "Edit" | `openModal('edit-proggroup-modal')` |
| Fee Structure, fee item rows | "Delete" (trash icon) | Confirm delete fee item |
| Coursework, active rows | "View Marks", "Manage" | Navigate to mark entry or manage view |
| Class Test, rows | "View Marks", "Manage" | Navigate to mark entry or manage view |
| University Exam, rows | "Vet QP →", "View QP" | Open vetting workflow or view QP |
| Qual Equating, rows | "View →", "Follow Up" | Open equating request detail |
| Student Lookup, rows | "View", "Edit" | Open student profile page or modal |
| ODL Applications, rows | "View App →", "View →" | Open application detail |
| Dashboard, batch table | Export button | Download CSV |
| Most pages | Export buttons | Download table as CSV |

### Partially wired (toast only, no state change)

| Location | Button | Issue |
|---|---|---|
| Timetable | "Publish — Students & Faculty" | Shows toast but doesn't mark timetable as published |
| Timetable | "Week" / "List" view toggle | Shows toast but doesn't switch the visible view (needs `useState`) |
| Session Movement | "Preview Movement Results" | Shows toast but doesn't reveal the preview panel (panel uses `display:none` DOM hack) |
| Batch Management | Batch Code Generator | Preview updates via DOM ID, not React state |

### Pages not in sidebar

The following pages exist in the component files and in the `renderPage()` switch, but have no sidebar entry and no clear navigation path from any other page:

- `odel-student-preview` — ODel Student Preview
- `qual-equating` — Qualification Equating
- `grievance` — Grievance Management
- `university-exam` — University Examination
- `results` — Results
- `class-test` — Class Test (CBT)
- `fee-clearance` — Fee Clearance Check
- `access-gate` — Academic Access Gate
- `allocation` — Course Unit Allocation *(reachable from Dashboard and Skill Management, but not directly in sidebar)*

Consider adding a second sidebar section (e.g. "Semester Operations") for the assessment and exam pages, or linking them from the Dashboard pipeline steps.

---

*End of Developer Guide*
