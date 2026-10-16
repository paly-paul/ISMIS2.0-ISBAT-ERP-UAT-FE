# Student Module — APIs and Page Flows

How each page under `/student` in this app works: what it loads, what the user does, and which API each step calls. It was written by reading the code on 2026-09-28; the app was not run. For the backend side of these APIs, see [ERP_API_FLOWS.md](ERP_API_FLOWS.md) (section 6).

Paths in the tables drop the `/api/v1` prefix.

---

## Contents

1. [Where the code lives](#1-where-the-code-lives)
2. [Shared building blocks](#2-shared-building-blocks)
3. [APIs used, by page](#3-apis-used-by-page)
4. [How each page works](#4-how-each-page-works)
5. [Student APIs used outside this module](#5-student-apis-used-outside-this-module)
6. [Wrappers no screen uses](#6-wrappers-no-screen-uses)
7. [Things that looked wrong or unfinished](#7-things-that-looked-wrong-or-unfinished)

---

## 1. Where the code lives

| Layer | Folder | Role |
|---|---|---|
| Pages | [`src/app/student/`](../src/app/student/) | One folder per route. [`layout.tsx`](../src/app/student/layout.tsx) renders the Header and Sidebar. |
| Hooks | [`src/hooks/student/`](../src/hooks/student/) | React Query hooks: queries, mutations and cache invalidation |
| API wrappers | [`src/lib/api/student/`](../src/lib/api/student/) | One function per endpoint, called through [`src/lib/api/client.ts`](../src/lib/api/client.ts) |
| Shared UI | [`src/components/student/`](../src/components/student/), [`src/components/modals/student/`](../src/components/modals/student/) | Student search box, read-only student panel, and form modals |

Each page calls a hook, which calls a wrapper, which calls the gateway. When `NEXT_PUBLIC_AUTH_MOCK=true`, every wrapper returns mock data instead of calling the network.

The root-level `students/` folder is an untracked copy of API docs and isn't used by the app.

---

## 2. Shared building blocks

### Student search box ([`StudentLookup.tsx`](../src/components/student/StudentLookup.tsx))

Used by Profile, Batch Transfer, Programme Transfer, Fee Structure Transfer and Learning Mode.

- As the user types, it calls `POST /students/search/search` (through `useStudentSearchAdvanced`).
- Input that is all digits is sent as `studentRegNo`; anything else is sent as `studentName`.
- It shows up to 8 matches, and picking one passes that student (`StudentDto`) to the page.
- There is no "Load" button. Picking from the dropdown is the only way to load a student.

### Read-only student panel ([`BaselinePanel.tsx`](../src/components/student/BaselinePanel.tsx))

A label/value grid that the transfer pages show once a student is loaded. It makes no API calls.

### Opening a page for a specific student (`?studentGuid=`)

Student Master and Profile link to other pages with `?studentGuid=<guid>`. The target page calls `GET /students/{guid}` (`useStudent`), converts the result with `normalizeStudentDetail`, and continues as if the student had been picked in the search box. Clicking **Clear** removes the query parameter so the page doesn't reload the same student.

### Menu and permissions

- The sidebar is built from `GET /users/me/menu`.
- `usePagePermissions()` reads the current page's `edit` / `delete` rights from the same data, and pages use them to show or hide buttons.

---

## 3. APIs used, by page

| Page (route) | APIs |
|---|---|
| **Student Master** `/student/student-master` | `GET /students/filter` (table), `GET /students?searchTerm=` (search dropdown), `GET /academic/program-master`, `GET /academic/semesters/dropdownforprogram`, `GET /academic/batches` (column filter options) |
| ↳ Refugee modal | `GET /students/refugee/{guid}`, `GET /users/countries`, `POST /students/refugee/{guid}` (multipart), `DELETE /students/refugee/{guid}` |
| **Student Profile** `/student/profile` | `GET /students/{guid}` · ID card: `GET /students/id-cards/{guid}`, `POST /students/id-cards`, `PUT /students/id-cards/{cardIssueId}`, `GET /students/id-cards/{guid}/qr-image` · Sponsor: `GET /studentsponsorassignment/{guid}/sponsor-details`, `POST /studentsponsorassignment/{guid}/sponsor-assignment`, `GET /students/sponsor-categories` · Discount: `GET /students/{guid}/discount`, `POST /students/{guid}/discount`, `PUT /students/{guid}/discount`, `POST /students/{guid}/discount/cancel?includeCurrentSemester=`, `GET /finance/discounts` · Refugee: same as the modal above |
| **Batch Transfer** `/student/batch-transfer` | `GET /students/{guid}/batch-transfer/detail`, `.../eligible-batches`, `.../history`, `POST /students/{guid}/batch-transfer` |
| **Programme Transfer** `/student/prog-transfer` | `GET /students/{guid}/program-transfer/detail`, `.../history`, `GET /academic/program-master`, `GET /academic/semesters/dropdownforprogram`, `GET /students/program-transfer/batches`, `GET /students/program-transfer/fee-structures`, `POST /students/{guid}/program-transfer` |
| **Fee Structure Transfer** `/student/fee-structure-transfer` | `GET /students/{guid}/fee-transfer/student-context`, `.../history`, `GET /students/program-transfer/fee-structures`, `POST /students/{guid}/fee-transfer` |
| **Dropout Rejoin** `/student/intake-transfer` | `GET /students/dropout-rejoin`, `GET /students/dropout-rejoin/{guid}/candidate`, `GET /academic/batchtimes`, `GET /students/dropout-rejoin/{guid}/batches?semesterGuid&batchTimeGuid`, `POST /students/dropout-rejoin/{guid}/rejoin` |
| **Learning Mode** `/student/learning-mode` | `GET /students/learning-mode/options`, `GET /students/learning-mode/{guid}`, `PUT /students/learning-mode/{guid}`, `GET /students/learning-mode/report`, `GET /academic/campus/dropdown`, `GET /academic/intakes` |
| **Specialization** `/student/specialization` | `GET /academic/intakes`, `GET /students/specialization/batches?intakeGuid=`, `GET .../batches/{batchGuid}/context`, `GET .../batches/{batchGuid}/students`, `POST /students/specialization/assign` |
| **Passout Confirmation** `/student/passout-confirmation` | `GET /students/passout-confirmation/candidates`, `GET /students/passout-confirmation/{guid}`, `POST /students/passout-confirmation/{guid}/confirm` |
| **Terminate Student** `/student/terminate-student` | `GET /admissions/application-filling/payment-console/search`, `GET /admissions/application-filling/payment-console/student-profile/{applicationGuid}`, `GET /students/{guid}`, `GET /students/termination-reasons/dropdown`, `POST /students/{guid}/terminate` |
| **Termination Reasons** `/student/termination-reasons` | `GET /students/termination-reasons`, `POST /students/termination-reasons`, `PUT /students/termination-reasons/{guid}`, `DELETE /students/termination-reasons/{guid}` |
| **Announcements** `/student/announcement-management` | `GET /students/announcements`, `GET /students/announcements/{guid}`, `POST` and `PUT` (both multipart), `DELETE /students/announcements/{guid}`, `GET /academic/program-master/dropdown` |
| **Events** `/student/event-management` | `GET /students/events`, `GET /students/events/{guid}`, `POST /students/events`, `PUT /students/events/{guid}`, `DELETE /students/events/{guid}` |
| **Communications** `/student/communications` | None (mock data only) |
| **Services** `/student/services` | None (mock data only) |
| `/student` | Redirects to `/student/student-master` |
| `/student/statement` | Redirects to `/finance/student-statements` |

---

## 4. How each page works

### 4.1 Student Master — [`student-master/page.tsx`](../src/app/student/student-master/page.tsx)

The entry point for the module.

1. **Table:** `GET /students/filter`, 10 rows per page. Columns: Reg No, Name, Programme, Semester, Batch, Academic Intake (`academicIntake`).
   - **Intake filter:** the Academic Intake column's funnel (options from `GET /academic/intakes`) and the intake dropdown before the search box (server-side search + scroll) share one filter, sent as `academicIntake=<intake code>`.
2. **Column filters:** Programme, Semester and Batch. Their options come from the academic endpoints. Semester stays disabled until a programme is picked, and changing the programme clears the semester.
3. **Multi-select filters:** the API accepts only one GUID per filter. When one value (or none) is picked per column, the page uses normal server paging. When several are ticked, `useStudentsFilterMulti` sends one request for every programme × semester × batch combination (page size 1,000 each), merges the results and pages them in the browser.
4. **Search box:** filters the table and also shows a quick-pick dropdown from `GET /students?searchTerm=`, which loads more on scroll. The dropdown is hidden while column filters are active.
5. **Row menu:**
   - **View** opens `/student/profile?studentGuid=…`.
   - **Learning Mode** opens `/student/learning-mode?studentGuid=…` (needs edit permission).
   - **Refugee Status** opens [`StudentRefugeeModal`](../src/components/modals/student/StudentRefugeeModal.tsx) (needs edit permission). The modal loads `GET /students/refugee/{guid}`.
     - If the student is already a refugee, it shows the details with a **Remove** button (`DELETE`).
     - Otherwise it asks for country (from `GET /users/countries`), a refugee ID (up to 20 characters) and a required document, then sends a multipart `POST`.

### 4.2 Student Profile — [`profile/page.tsx`](../src/app/student/profile/page.tsx)

1. **Load a student** from the search box or from `?studentGuid=`. Two calls run straight away:
   - `GET /students/{guid}` for the details
   - `GET /students/id-cards/{guid}` for the ID card (a 404 means no card yet, which isn't treated as an error)
2. **Header:** name, programme, reg no, batch and semester. The action menu (edit permission) opens Batch Transfer, Programme Transfer, Learning Mode or Dropout Rejoin with `?studentGuid=`.
3. **Sponsor, Discount and Refugee are only loaded when clicked**:
   - **Sponsor:** until clicked it shows the `sponsor` field from the student details. Clicking loads the sponsor details and the category list; ✓ saves with `POST .../sponsor-assignment`. A 401 shows as "Restricted".
   - **Discount:** until clicked it shows a summary from the student details. Clicking opens a modal that loads `GET /students/{guid}/discount` and the Finance list `GET /finance/discounts`.
     - No active discount: choose a discount, type (Amount/Percentage), value and remarks → **Assign** (`POST`). `effectiveFromSemesterGuid` is the student's current semester.
     - Active discount: **Update Terms** (`PUT`), **Cancel (from next semester)**, or **Cancel Immediately** (needs delete permission). Both cancels call `POST .../discount/cancel?includeCurrentSemester=`.
   - **Refugee:** "Check status" loads the record, then offers **Grant** (the same form as the modal, in a page modal) or **Remove**.
4. **Profile Info tab:** read-only personal, academic and contact fields. There is no save.
5. **ID Card tab:**
   - **Issue Card** calls `POST /students/id-cards`, and sends `isRenewal: true` if a card already exists.
   - **Renew** calls `POST` with `isRenewal: true`.
   - **Save Dates** calls `PUT /students/id-cards/{cardIssueId}`.
   - The QR image comes from `/students/id-cards/{guid}/qr-image` (hidden in mock mode).
   - **Print** prints only the card preview.
6. **Communication & Access tab:** mock only. The dispatch buttons add entries to a local audit list and show a toast.

### 4.3 Batch Transfer — [`batch-transfer/page.tsx`](../src/app/student/batch-transfer/page.tsx)

1. Load a student from the search box or `?studentGuid=`.
2. Three calls run:
   - **detail** fills the read-only panel (programme, campus, semester, current batch, intake, fee structure)
   - **eligible-batches** fills the Target Batch dropdown, defaulting to the first one
   - **history** fills the Transfer History table
3. If eligible-batches fails (for example "Could not resolve program and semester…"), the error is shown instead of an empty dropdown.
4. Pick a target batch and add remarks → **Execute** (needs edit permission) → confirm → `POST /students/{guid}/batch-transfer` with `{ newBatchGuid, remarks }`.
5. On success a toast shows and remarks are cleared. History refreshes through the hook's cache invalidation.

The Reason list and Discount field on the form are not sent to the API.

### 4.4 Programme Transfer — [`prog-transfer/page.tsx`](../src/app/student/prog-transfer/page.tsx)

1. Load a student. **Detail** fills the "Current Programme" panel (campus, intake, fee, admission type, discount), and **history** loads.
2. Pick the target fields in order:
   1. **Programme** from `GET /academic/program-master`
   2. **Semester** from `GET /academic/semesters/dropdownforprogram?programGuid=`
   3. **Batch** from `GET /students/program-transfer/batches?programGuid&semesterGuid`
   4. **Fee structure** from `GET /students/program-transfer/fee-structures?programGuid=`

   Changing the programme clears semester, batch and fee. Changing the semester clears the batch.
3. The discount is display-only.
4. **Execute** → confirm → `POST /students/{guid}/program-transfer` with `{ newProgramGuid, newSemesterGuid, newBatchGuid, newFeeGuid, remarks }`. The toast shows `programTransferCode`, and the page clears.

### 4.5 Fee Structure Transfer — [`fee-structure-transfer/page.tsx`](../src/app/student/fee-structure-transfer/page.tsx)

1. Load a student. **student-context** returns the details plus `programGuid` and `currentFeeGuid`, and **history** loads.
2. The fee dropdown reuses `GET /students/program-transfer/fee-structures?programGuid=` and leaves out the current fee.
3. The "apply to previous semesters" checkbox maps to `changeAllSemesters` (off by default).
4. **Remarks are required** by the page.
5. **Submit** (needs edit permission) → `POST /students/{guid}/fee-transfer` with `{ newFeeGuid, changeAllSemesters, remarks }` → a success popup shows and the form resets.
6. History is paged in the browser, 10 rows per page.

This page doesn't read `?studentGuid=`, so it always starts from the search box.

### 4.6 Dropout Rejoin — [`intake-transfer/page.tsx`](../src/app/student/intake-transfer/page.tsx)

1. **List:** `GET /students/dropout-rejoin`, paged in the browser (10 per page). Each row has a **Fees Cleared / Fees Pending** badge from `canRejoin`.
2. **Rejoin** on a row (or opening with `?studentGuid=`) loads `GET .../{guid}/candidate`. Its allowed semesters and fee heads fill the dropdowns, pre-set to the current semester and the first fee head.
3. Pick a **batch time** (from `GET /academic/batchtimes`). Semester plus batch time loads `GET .../{guid}/batches`. Pick a batch.
4. **Confirm** → `POST .../{guid}/rejoin` with `{ newSemesterGuid, newBatchGuid, newFeeGuid }` → toast, then back to the list.

The "Deferment / Period Shift" mode is commented out.

### 4.7 Learning Mode — [`learning-mode/page.tsx`](../src/app/student/learning-mode/page.tsx)

The page has two independent parts.

**Edit one student**
1. Load via the search box or `?studentGuid=`.
2. `GET /students/learning-mode/{guid}` shows the programme and semester and pre-selects the current mode. The options come from `GET /students/learning-mode/options`.
3. **Apply** (needs edit permission) → `PUT /students/learning-mode/{guid}` with `{ learningMode }`.

**Roster report**
1. Pick a campus (required; from `GET /academic/campus/dropdown`). Mode, intake (from `GET /academic/intakes`) and a search term are optional.
2. `GET /students/learning-mode/report`, 25 rows per page. Changing any filter goes back to page 1.

### 4.8 Specialization — [`specialization/page.tsx`](../src/app/student/specialization/page.tsx)

1. Pick an **intake** → `GET /students/specialization/batches?intakeGuid=`.
2. Pick a **batch**. Two calls run:
   - `.../context` returns the programme, semester and valid streams
   - `.../students` returns the students with their current stream

   Changing the intake clears the batch, stream and ticks. Changing the batch clears the stream and ticks.
3. Pick a **stream** and tick students (the list is paged in the browser).
4. **Assign** (needs edit permission) → `POST /students/specialization/assign` with `{ batchGuid, streamGuid, studentGuids }`.

### 4.9 Passout Confirmation — [`passout-confirmation/page.tsx`](../src/app/student/passout-confirmation/page.tsx)

1. **Candidates:** `GET /students/passout-confirmation/candidates` with paging, a search box that waits 0.4 s after typing (Enter searches immediately), and a programme group filter (PCSE/PCIM).
2. **Review** on a row (or `?studentGuid=`) → `GET /students/passout-confirmation/{guid}` → details and a remarks box.
3. **Confirm Passout** (needs edit permission) → confirmation dialog → `POST .../{guid}/confirm` with `{ remarks }` → success view.

### 4.10 Terminate Student — [`terminate-student/page.tsx`](../src/app/student/terminate-student/page.tsx)

1. **Search** uses the Finance payment-console search, not the student search: `GET /admissions/application-filling/payment-console/search`. It waits 0.4 s after typing, needs at least 2 characters, and loads more on scroll.
2. **Pick a result** → `GET .../payment-console/student-profile/{applicationGuid}` (the student GUID from the search result is passed along when there is one), plus `GET /students/{guid}` for the student details.
3. **Reason:** `GET /students/termination-reasons/dropdown`. If it's empty, the page tells the user to add reasons in Termination Reasons first. Remarks are optional.
4. **Terminate** → confirmation dialog → `POST /students/{guid}/terminate` with `{ terminationReasonGuid, remarks }` → success popup.

### 4.11 Termination Reasons — [`termination-reasons/page.tsx`](../src/app/student/termination-reasons/page.tsx)

A standard master screen:
- **List:** `GET /students/termination-reasons`, paged on the server, with a search that waits 0.4 s after typing.
- **Add / Edit** modal with one field (`reasonName`) → `POST` or `PUT`.
- **Delete** with confirmation → `DELETE`.

### 4.12 Announcements — [`announcement-management/page.tsx`](../src/app/student/announcement-management/page.tsx) and [`AnnouncementFormModal.tsx`](../src/components/modals/student/AnnouncementFormModal.tsx)

1. **List:** `GET /students/announcements`, loaded once. Search and filtering happen in the browser. The audience column shows "All Programmes" when `isGlobal`. The attachment icon opens the file with `openDocumentForViewing`.
2. **Add:** a modal with subject, programme (from `GET /academic/program-master/dropdown`; blank means all programmes), date, rich-text body and an optional attachment → `POST` (multipart).
3. **Edit:** the modal loads `GET /students/announcements/{guid}`. The subject can't be changed. It can replace the attachment → `PUT` (multipart).
4. **Delete** with confirmation → `DELETE`. This permanently removes the announcement and its attachment.

### 4.13 Events — [`event-management/page.tsx`](../src/app/student/event-management/page.tsx) and [`EventFormModal.tsx`](../src/components/modals/student/EventFormModal.tsx)

1. **List:** `GET /students/events`, loaded once, with search in the browser.
2. **Add:** a modal with subject, date and body → `POST`. The date is converted between `YYYY-MM-DD` and the API format with `eventDateToYmd` / `ymdToEventDate`.
3. **Edit:** the modal loads `GET /students/events/{guid}` → `PUT` with all three fields.
4. **Delete** with confirmation → `DELETE` (a soft delete on the server).

### 4.14 Communications and Services — mock only

- **Communications** ([`communications/page.tsx`](../src/app/student/communications/page.tsx)): channel, recipient filters, templates and message. **Send** only shows a toast.
- **Services** ([`services/page.tsx`](../src/app/student/services/page.tsx)): a ticket list with a reply modal built from hard-coded rows. **Send response** only shows a toast.

---

## 5. Student APIs used outside this module

| Wrapper / hook | Used by |
|---|---|
| Sponsor category CRUD (`useSponsorCategories`, `useCreateSponsorCategory`, …) | `/config/student-category-master` |
| Service category CRUD (`useServiceCategories`, …) | `/config/service-category-master` |
| Student statement: search, statement, fee summary, PDF URL | `/finance/student-statements` |
| `getHallTicketSearch` | `/assessment/hall-ticket` |
| `useStudentSearchAdvancedInfinite` | `/finance/payment-console` |

---

## 6. Wrappers no screen uses

These are written but not called from any page:

- `GET /students/refugee` and `GET /students/refugee/eligible` (`useRefugeeStudents`, `useEligibleRefugeeStudents`). There is no refugee list page.
- `GET /students/discounts/{guid}/active-assignment-count` (`useActiveAssignmentCount`).
- Student-portal announcements: `GET /portal/students/{guid}/announcements` and `POST .../mark-read`.
- `useStudents` (the plain paged list) and `useStudentsByGuids`.

These documented endpoints have no wrapper at all: **student resume** (`/students/resume/*`), **ID-card search and QR scan**, **sponsor category by GUID**, and the other student-portal endpoints.

---

## 7. Things that looked wrong or unfinished

- **Profile placeholders:** the header's Campus, Fee Structure and Learning Mode values are hard-coded (`"Campus"`, `"Local"`, `"Campus"`). The email and phone are made up from the student number, and the parent contact values are fixed sample data.
- **Sponsor path:** Profile uses `/studentsponsorassignment/...`, but the newer docs describe `/students/sponsor-assignment/...`. Confirm which one the backend serves.
- **Student Master multi-select:** each extra ticked value multiplies the number of requests (3 programmes × 3 batches = 9 requests of up to 1,000 rows).
- **Route name:** `intake-transfer` is really Dropout Rejoin, and it still has an unused mock `TARGET_INTAKES` list.
- **Fee Structure Transfer** requires remarks although the API treats them as optional, and it ignores `?studentGuid=`, unlike the other transfer pages.
- **Terminate Student** finds students through the Admissions payment-console search, while every other page uses the student search.
- **Batch Transfer** shows Reason and Discount fields that are never sent to the API.
