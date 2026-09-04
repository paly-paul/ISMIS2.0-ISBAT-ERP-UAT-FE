# Page Actions & Permission Gating — for Backend

This documents the **real action set available on each page as implemented
in the frontend today**, read directly from each page's `page.tsx` (and,
where a button's purpose wasn't obvious from the page alone, the modal it
opens under `src/components/modals/**`) — not the generic
add/edit/delete/get menu-permission shape. It's for the backend team to
model fine-grained permissions against real UI actions (e.g. "the Enquiry
Followup Master page only has View, Convert, and Add Follow-up — that's the
whole permission surface, there's no Edit/Delete").

See `MENU_ROUTES_REFERENCE.md` (repo root) for the menu-tree/URL/icon
structure this doc complements — that doc answers "where does this page live
in the sidebar and what does its menu permission bag look like", this one
answers "what can a user actually click on this page".

**How to read the Actions column:** every page implicitly has **View** (page
access), listed first and never further annotated. Every other action is
tagged one of:
- **(gated: `permissions.x`)** — wrapped in a `usePagePermissions()` check in code today.
- **(not yet permission-gated)** — always rendered/enabled regardless of permissions; a gap, not a deliberate open action.

A page with nothing beyond View is written as "View only".

---

## Admission

### Enquiry

| Page | Route | Actions |
|---|---|---|
| Online Enquiry | `/admission/online-enquiry` | View · Submit Enquiry (gated: `add`) |
| Self-Service Kiosk | `/admission/kiosk-enquiry` | View · Submit Enquiry (gated: `add`) |
| On-Desk Enquiry | `/admission/ondesk-enquiry` | View · Submit Enquiry (gated: `add`) |
| Enquiry List | `/admission/enquiry-list` | View · New Enquiry, opens form modal (gated: `add`) · View detail (gated: `edit`) · Convert → Application Payment (not yet permission-gated) |
| Enquiry Followup Master | `/admission/enquiry-followup-master` | View · Add Follow-up (gated: `add`) · View detail (gated: `edit`) · Convert → Application Payment (not yet permission-gated) |
| Enquiry Followup | `/admission/enquiry-followup` | View · View detail (gated: `edit`) · Convert → Application Payment (not yet permission-gated) |

### Admission Flow

| Page | Route | Actions |
|---|---|---|
| Dashboard | `/admission/dashboard` | View · New Application (not yet permission-gated) |
| Application Payment | `/admission/payment` | View · Import from Enquiry / ODeL / CRM (not yet permission-gated) · Save Payment & Generate Receipt (gated: `add`) · Print Receipt, Proceed to Filing (not yet permission-gated) |
| Application Filing | `/admission/filing` | View · Save & Next (general info) (gated: `add`) · Add/Save/Delete qualification row (gated: `add` for save, `delete` for remove-after-save) · Add experience entry (not yet permission-gated) · Upload/Save Photo (gated: `add`) · Submit Application for Vetting (gated: `add`) |
| Vetting Desk | `/admission/vetting` | View · Review, opens `VettingReviewModal` (not yet permission-gated) · **In modal:** Wait, Approve & Issue Provisional Letter, Reject Application (all not yet permission-gated) |
| Registrar's Desk | `/admission/registration` | View · Register (per applicant, once payment is complete) (not yet permission-gated) |

### Records

| Page | Route | Actions |
|---|---|---|
| All Applicants | `/admission/applicants` | View · Export CSV (not yet permission-gated) · View → Registrar's Desk (not yet permission-gated) |
| Receipts | *(no page — `url: null`)* | — |
| Reports | *(no page — `url: null`)* | — |

---

## Academic

### Overview

| Page | Route | Actions |
|---|---|---|
| Dashboard | `/academic/acad-dashboard` | View · Intake Settings / Run Session Movement shortcuts, Export (not yet permission-gated) |

### Academic Core

| Page | Route | Actions |
|---|---|---|
| Intake Master | `/academic/intake-master` | View · New Intake (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Bulk Intake Edit | `/academic/bulk-intake-edit` | View · Edit multiple intake rows inline, Save changes, Reset changes (all not yet permission-gated) |
| Skill Management | `/academic/skill-master` | View · Add Skill (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) · Proceed to Allocation (not yet permission-gated) |
| Batch Management | `/academic/batch-management` | View · Create Batch (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Batch Summary | `/academic/batch-summary` | View · Export |
| Room Management | `/academic/room-management` | View · Add Room (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Session Movement | `/academic/session-movement` | View · Preview Movement Results, Download Preview CSV, Cancel, Confirm & Execute Session Movement (all not yet permission-gated) |

### Course Unit Master

| Page | Route | Actions |
|---|---|---|
| Repetition Tag | `/academic/repetition-tag` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Course Units | `/academic/course-units` | View · Add Course Unit (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) · Export (not yet permission-gated) |

### Programme Master

| Page | Route | Actions |
|---|---|---|
| Programme Level | `/academic/programme-level` | View · Add Level (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Programme Group | `/academic/programme-group` | View · Add Programme Group (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) · Export (not yet permission-gated) |
| Programme Master | `/academic/programme-master` | View · Add Programme (gated: `add`) · Edit / Renew / New Version, Curriculum, Specializations (gated: `edit`) · Delete (gated: `delete`) · Export (not yet permission-gated) |
| Programme Approval | `/academic/programme-approval` | View · Approve (gated: `edit`) · Delete (gated: `delete`) — no Add on this page (approval queue over records created elsewhere) |
| Fee Structure | `/academic/fee-structure` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) · Duplicate for next intake (not yet permission-gated) |

### Timetable

| Page | Route | Actions |
|---|---|---|
| Timetable | `/academic/timetable` | View · Manage Rooms, Import Excel, Add Slot, Edit Slot, Publish — Students & Faculty (all not yet permission-gated) |

### ODL Applications

| Page | Route | Actions |
|---|---|---|
| ODL Applications | `/academic/odl-applications` | View · Save & Get Reference No., Proceed to Payment, Reconcile →, View App →, Export (all not yet permission-gated) |
| Payment Reconciliation | `/academic/odl-reconciliation` | View · Verify Token, Reject, Confirm Reconciled (all not yet permission-gated) |

### Cross-Module

| Page | Route | Actions |
|---|---|---|
| Student Lookup | `/academic/student-lookup` | View · Edit (not yet permission-gated) |

---

## Assessment

None of Assessment's 25 pages gate any action on `permissions.xxx` today —
every action below is **not yet permission-gated**.

### Overview

| Page | Route | Actions |
|---|---|---|
| Assessment Dashboard | `/assessment/dashboard` | View · Export Summary |

### Assessment Structure

| Page | Route | Actions |
|---|---|---|
| Weight Configuration | `/assessment/weight-config` | View · Export Config |
| Assessment Schedule | `/assessment/schedule` | View · New Schedule · Edit · Delete |

### Coursework (CW)

| Page | Route | Actions |
|---|---|---|
| CW Overview | `/assessment/cw-overview` | View · Schedule CW · View Details |
| Question Bank Upload | `/assessment/cw-qbank` | View · Download Template · Import Questions |
| CW Submissions | `/assessment/cw-submissions` | View · Save (mark entry, per submission) |
| CW Rectification | `/assessment/cw-rectify` | View only |

### Class Test (CBT)

| Page | Route | Actions |
|---|---|---|
| CBT Overview | `/assessment/cbt-overview` | View · Schedule · View Details |
| CBT Schedule | `/assessment/cbt-schedule` | View · Schedule CBT |
| CBT Question Upload | `/assessment/cbt-qupload` | View · Import Questions |
| CBT Monitor | `/assessment/cbt-monitor` | View · View Details (live monitor, read-heavy) |

### University Exam (UE)

| Page | Route | Actions |
|---|---|---|
| UE Schedule | `/assessment/ue-schedule` | View · New UE Slot · Edit Slot |
| QP Upload & Vetting | `/assessment/qp-vetting` | View · Submit to Vetting Queue · View (vetting queue row) |
| Hall Ticket Issuance | `/assessment/hall-ticket` | View · Issue Ticket (per student; disabled until eligible) |
| Hall Ticket Print | `/assessment/hall-print` | View · Print All Ready Tickets · Preview & Print (per ticket) |

### Mark Entry & Results

| Page | Route | Actions |
|---|---|---|
| Mark Entry — CW | `/assessment/mark-cw` | View · Save All Marks |
| Mark Entry — CBT | `/assessment/mark-cbt` | View · View Details / View Log · Override (mark override) · Action Blocked state for locked rows |
| Mark Entry — UE | `/assessment/mark-ue` | View · Save All · View (per row) |
| Result & Moderation | `/assessment/moderation` | View · Publish Results · View (per row) |

### Resit & Disputes

| Page | Route | Actions |
|---|---|---|
| Resit Calendar | `/assessment/resit-calendar` | View · Open Resit Window · View (per window) |
| Resit Seating Allocator | `/assessment/resit-seating` | View · Publish Seating Plan |
| CW Reevaluation | `/assessment/reeval` | View · View Log · Escalate to Dean |
| CW Recheck Hub | `/assessment/recheck` | View · Assign auditor, opens confirm modal · Confirm & Dispatch Recheck |

### Reports

| Page | Route | Actions |
|---|---|---|
| Pending QP Upload | `/assessment/rpt-pending-qp` | View · Send Bulk Reminder · Export · View Profile (per faculty row) |
| Faculty Summary | `/assessment/rpt-faculty` | View · Export summary report · View Details · Send Reminder (per row) |

---

## Finance

### Payment Collection

None of these 6 pages gate any action on `permissions.xxx` today.

| Page | Route | Actions |
|---|---|---|
| Dashboard | `/finance/dashboard` | View · Exchange Rates / Collect Payment shortcuts, Collect → / View All (not yet permission-gated) |
| Payment Console | `/finance/payment-console` | View · Search student, Save Payment, Clear, Print Receipt, New Payment (not yet permission-gated) |
| Payment History | `/finance/payment-history` | View · Open Receipt (2 variants), Export CSV (currently commented out in code, not rendered) (not yet permission-gated) |
| Ledger Adjustments | `/finance/ledger-adjustments` | View · Load Ledger, Adjust (per line) (not yet permission-gated) |
| Exchange Rates | `/finance/exchange-rates` | View · Save All Rates, Save (per currency row) (not yet permission-gated) |
| Advanced Payments | `/finance/advanced-payments` | View · New Deposit (not yet permission-gated) |

### Reports & Statements

| Page | Route | Actions |
|---|---|---|
| Financial Reports | `/finance/financial-reports` | View · Export to Excel (per semester) (not yet permission-gated) |
| Student Statements | `/finance/student-statements` | View · Generate, Print, Email Statement (not yet permission-gated) |

### Finance Core

| Page | Route | Actions |
|---|---|---|
| Cooperates | `/finance/cooperates` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Discounts | `/finance/discounts` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Ledgers | `/finance/ledgers` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Currency Master | `/finance/currency-master` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Receipt Books | `/finance/receipt-books` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| General Settings | `/finance/gen-sets` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |

### Banking

| Page | Route | Actions |
|---|---|---|
| Banks | `/finance/banks` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Bank Branches | `/finance/bank-branches` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Proc Banks | `/finance/proc-banks` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Proc GL Accounts | `/finance/proc-gl-accounts` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |

---

## Student

None of Student's 10 pages gate any action on `permissions.xxx` today —
every action below is **not yet permission-gated**. This is the least
permission-aware module in the app.

### Student Records

| Page | Route | Actions |
|---|---|---|
| Student Master | `/student/student-master` | View · View detail (per student) |
| Student Statement | `/student/statement` | View · Load, Print, PDF |

### Operations

| Page | Route | Actions |
|---|---|---|
| Student Profile | `/student/profile` | View · Save Profile, Discard · Save & Sync (ID card) · Send Credentials via Email / WhatsApp (student + parent, separately) · Save (contact info) |
| Batch Transfer | `/student/batch-transfer` | View · Execute Transfer, Confirm & Execute (confirm modal) |
| Programme Transfer | `/student/prog-transfer` | View · Execute Transfer, Confirm & Execute (confirm modal) |
| Learning Mode | `/student/learning-mode` | View · Apply Mode Change |
| Intake Transfer | `/student/intake-transfer` | View · Execute Intake Transfer, Confirm & Execute (confirm modal) |

### Services

| Page | Route | Actions |
|---|---|---|
| Student Services | `/student/services` | View · Respond / View ticket · Send Response |

### Communications

| Page | Route | Actions |
|---|---|---|
| Send Communication | `/student/communications` | View · Preview · Send to N Students |

### Settings

| Page | Route | Actions |
|---|---|---|
| Category Masters | `/student/masters` | View · Add / Edit / Delete (Service Category and Student Category, two independent lists on one page) |
| Specialization Management | `/student/specialization` | View · Add Specialization, Edit · Add Discount, Edit |

---

## Employee

| Page | Route | Actions |
|---|---|---|
| Employee Master | `/employee/employee-master` | View · Add Employee (gated: `add`) · Edit (gated: `edit`) · Assign Permissions, Edit Permissions (gated: `assign`, falls back to `edit` — `const canAssignPermissions = permissions.assign ?? permissions.edit`) — no Delete action exists on this page |

---

## Config

### Organization

| Page | Route | Actions |
|---|---|---|
| Faculty Master | `/config/faculty-master` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Department Master | `/config/department-master` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Designation Master | `/config/designation-master` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Campus Master | `/config/campus-master` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Country Master | `/config/country-master` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |

### Academic Setup

| Page | Route | Actions |
|---|---|---|
| Specialization | `/config/specialization` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Skill Master | `/config/skill` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Unit Type Master | `/config/unit-type` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Unit Category Master | `/config/unit-category` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Weekdays | `/config/weekdays` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Batch Times | `/config/batch-times` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |

### Admissions

| Page | Route | Actions |
|---|---|---|
| Enquiry Status | `/config/enquiry-status` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Isbat Enquiry Source | `/config/enquiry-source` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Enquiry Source | `/config/enquiry-source-master` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Followup Status | `/config/followup-status` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Followup Mode | `/config/followup-mode` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |
| Interest Level | `/config/interest-level` | View · Add (gated: `add`) · Edit (gated: `edit`) · Delete (gated: `delete`) |

### Access Control

| Page | Route | Actions |
|---|---|---|
| Permission Master | `/config/permission-master` | View · Add (gated: `add`) · Edit (gated: `edit`) — no Delete action exists on this page |

---

## Pages with no sidebar/menu entry yet

Same action-audit treatment as above, for the routes listed in
`MENU_ROUTES_REFERENCE.md`'s "Pages with no sidebar/menu entry yet" section —
these exist and work but have no menu node, so they weren't covered by any
module section above.

| Page | Route | Actions |
|---|---|---|
| Applicant Profile | `/admission/applicant-profile` | View only (read-only tabs: Personal Info, Application Details, Qualification, Documents) |
| Enquiry Form | `/admission/enquiry-form` | View · Save Enquiry (not yet permission-gated) |
| Allocation | `/academic/allocation` | View · Manual Entry, Import from Excel, Edit / Assign → (per row) (not yet permission-gated) |
| Academic Access Gate | `/academic/access-gate` | View only (static reference page — payment/access rule matrix) |
| Class Test (legacy) | `/academic/class-test` | View · Schedule Class Test, View Marks / Manage / Schedule → (per row) (not yet permission-gated) |
| Coursework (legacy) | `/academic/coursework` | View · Schedule Coursework, View Marks / Manage / Schedule → (per row) (not yet permission-gated) |
| Fee Clearance | `/academic/fee-clearance` | View · Check Clearance (not yet permission-gated) |
| Grievance Management | `/academic/grievance` | View only (placeholder — "Module Not Yet Defined") |
| Qualification Equating | `/academic/qual-equating` | View · New Equating Request, View → / Follow Up (per row) (not yet permission-gated) |
| Results | `/academic/results` | View only (placeholder — "owned by the Assessment Module", pending KT session) |
| University Exam (legacy) | `/academic/university-exam` | View · Upload Question Paper, Vet QP → / View QP / Upload QP (per row) (not yet permission-gated) |
| ODeL Student Preview | `/academic/odel-student-preview` | View · Multi-tab wizard (Personal → Qualifications → Family → Documents → Payment), Save & Get Reference No., Proceed to Payment (not yet permission-gated) |
