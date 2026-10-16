import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Role-based menu/permissions has its own toggle, separate from
// NEXT_PUBLIC_AUTH_MOCK — that flag also controls login and every other API
// module, so flipping it to test the real permission-driven sidebar means
// mocking (or un-mocking) everything else too. NEXT_PUBLIC_RBAC_MOCK lets the
// menu source be flipped on its own; when unset it just follows AUTH_MOCK, so
// existing .env files keep working with no change.
const MOCK_MENU = process.env.NEXT_PUBLIC_RBAC_MOCK !== undefined
  ? process.env.NEXT_PUBLIC_RBAC_MOCK === 'true'
  : MOCK_AUTH

// Per-action flags on a leaf node (e.g. { add, edit, delete, get }). Shape is
// backend-defined and not yet standardized across domains — treat as a loose
// bag of booleans, not a fixed set of keys.
export interface MenuPermissions {
  [action: string]: boolean
}

// A node with children is a rail/section (icon/url/permissions all null); a
// node with an empty children array is a leaf page. A leaf can still have
// url: null (e.g. Admission > Records > Receipts) for a nav entry that's
// visible but has no page behind it yet.
export interface MenuNode {
  name: string
  icon: string | null
  url: string | null
  permissions: MenuPermissions | null
  children: MenuNode[]
}

function leaf(name: string, icon: string, url: string | null): MenuNode {
  return {
    name,
    icon: `lni lni-${icon}`,
    url,
    permissions: url ? { add: true, edit: true, delete: true, get: true } : {},
    children: [],
  }
}

function section(name: string, children: MenuNode[]): MenuNode {
  return { name, icon: null, url: null, permissions: null, children }
}

function module_(name: string, icon: string, children: MenuNode[]): MenuNode {
  return { name, icon: `lni lni-${icon}`, url: null, permissions: null, children }
}

// Shared between mockMenu below and the real-menu merge fallback in
// getMenu() — the backend hasn't registered these two sections on its
// permission model yet (see the TEMPORARY note by mergeFinanceSections),
// so both mock mode and the temporary merge need the identical definitions.
//
// 'Payment Console Adjustments' removed (2026-09-08) — its "Apply Advance"
// fields/functionality moved into Payment Console's own Semester Payment
// tab, behind a Regular Payment/Apply Advance toggle; the standalone page
// now just redirects there, so it no longer needs its own nav entry.
const FINANCE_PAYMENT_SECTIONS: MenuNode[] = [
  section('Payment Collection', [
    leaf('Dashboard', 'dashboard', 'dashboard'),
    leaf('Payment Console', 'credit-cards', 'payment-console'),
    leaf('Payment Refund', 'reload', 'payment-refund'),
    leaf('NCHE & Guild Payment', 'graduation', 'nche-guild-payment'),
    leaf('Discount Allocation', 'tag', 'discount-allocation'),
    // Same refugee-status workflow as Student Master's row-menu modal, as a
    // standalone page for Finance (it changes the student's fees).
    leaf('Refugee Status', 'shield', 'refugee-status'),
    leaf('Payment History', 'bar-chart', 'payment-history'),
    leaf('Ledger Adjustments', 'lock', 'ledger-adjustments'),
    leaf('Exchange Rates', 'world', 'exchange-rates'),
    leaf('Advanced Payments', 'wallet', 'advanced-payments'),
  ]),
  section('Reports & Statements', [
    leaf('Financial Reports', 'bar-chart', 'financial-reports'),
    // discount-report-page.md, 2026-10-11 — no backend page registration
    // yet; mergeFinanceSections adds it to a real Reports & Statements too.
    leaf('Discount Report', 'tag', 'reports/discount'),
    // transaction-report-page.md / outstanding-report-page.md, 2026-10-13 —
    // same "added client-side until the backend registers them" treatment.
    leaf('Transaction Report', 'list', 'reports/transaction'),
    leaf('Outstanding Report', 'alarm-clock', 'reports/outstanding'),
    leaf('Student Statement', 'files', 'student-statements'),
  ]),
]

// The report pages above that the backend menu may not list yet, in display
// order. Each is slotted after the previous one (the first after Financial
// Reports) when missing from a real Reports & Statements section.
const CLIENT_REPORT_LEAVES = [
  { name: 'Discount Report', icon: 'tag', url: 'reports/discount' },
  { name: 'Transaction Report', icon: 'list', url: 'reports/transaction' },
  { name: 'Outstanding Report', icon: 'alarm-clock', url: 'reports/outstanding' },
]

// Shared between mockMenu below and the real-menu merge in getMenu() (see
// mergeStudentSections) — same "no backend permission model for this
// workflow yet" situation as Finance's Payment Collection above. Ported
// from isbat_student_module.html; Dashboard and Student Directory were
// skipped (Student Master already covers the directory role).
const STUDENT_OPERATIONS_SECTIONS: MenuNode[] = [
  section('Operations', [
    leaf('Student Profile', 'user', '/student/profile'),
    leaf('Batch Transfer', 'shuffle', '/student/batch-transfer'),
    leaf('Programme Transfer', 'graduation', '/student/prog-transfer'),
    leaf('Learning Mode', 'display', '/student/learning-mode'),
    // Approval queue for Learning Mode's change requests, 2026-09-30 — no
    // backend page registration yet, so the Operations merge in getMenu()
    // appends it as a missing leaf in real mode too.
    leaf('Learning Mode Approval', 'checkmark-circle', '/student/learning-mode-approval'),
    // Approval queue for refugee-status requests (assign now only raises a
    // request — post-approve-refugee-status.md, 2026-10-05). Same "appended
    // as a missing leaf in real mode" situation as Learning Mode Approval.
    leaf('Refugee Status Approval', 'checkmark-circle', '/student/refugee-approval'),
    // Re-enabled and renamed from "Intake Transfer" to "Dropout Rejoin",
    // 2026-09-03 — same route (/student/intake-transfer), matching the page's
    // own "Dropout Rejoin" mode tab (its "Deferment / Period Shift" tab was
    // commented out on the page itself the same day, leaving Dropout Rejoin
    // as the page's only mode).
    leaf('Dropout Rejoin', 'calendar', '/student/intake-transfer'),
    leaf('Fee Structure Transfer', 'dollar', '/student/fee-structure-transfer'),
    // POST /students/{studentGuid}/terminate (student-termination/
    // post-terminate-student.md) — added 2026-09-15.
    leaf('Terminate Student', 'shield', '/student/terminate-student'),
    // GET .../passout-confirmation/candidates + POST .../{studentGuid}/confirm
    // (passout-confirmation/*.md) — manual Passout confirmation for PCSE/PCIM
    // students, which have no marks data anywhere to drive an automated
    // decision. Added 2026-09-18.
    leaf('Passout Confirmation', 'graduation', '/student/passout-confirmation'),
  ]),
  // Learning Mode Report split out of the Learning Mode page into its own
  // page, 2026-09-29 (GET /students/learning-mode/report). Hidden from the
  // sidebar per request, 2026-10-01 — the page still exists at
  // /student/learning-mode-report, just not linked to. Commented out whole
  // for the same "childless section renders as Soon" reason as Services below.
  // section('Reports', [
  //   leaf('Learning Mode Report', 'bar-chart', '/student/learning-mode-report'),
  // ]),
  // Services section hidden from the sidebar per request, 2026-09-02 — its
  // one leaf (Student Services) still exists at /student/services, just not
  // linked to. Commented out whole (not just the leaf) since Sidebar.tsx
  // renders a childless section as a disabled "Soon" item instead of
  // skipping it (see sbItem/sbSection in Sidebar.tsx).
  // section('Services', [
  //   leaf('Student Services', 'ticket', '/student/services'),
  // ]),
  section('Communications', [
    leaf('Send Communication', 'envelope', '/student/communications'),
  ]),
  section('Events and Announcements', [
    leaf('Event Management', 'calendar', '/student/event-management'),
    leaf('Announcement Management', 'bullhorn', '/student/announcement-management'),
  ]),
  section('Settings', [
    leaf('Specialization Management', 'graduation', '/student/specialization'),
    // M_TERMINATION_REASON master (termination-reasons/*.md) — the reason
    // picker behind POST /students/{studentGuid}/terminate. Added 2026-09-15
    // alongside the Refund-Eligibility Search work.
    leaf('Termination Reason Master', 'shield', '/student/termination-reasons'),
    // Course feedback forms + questions per intake (feedback-master/*.md,
    // 2026-10-06) — no backend page registration yet, so the Settings merge
    // in mergeStudentSections appends it in real mode too.
    leaf('Feedback Master', 'comments', '/student/feedback-master'),
  ]),
]

const CONFIG_SECTIONS: MenuNode[] = [
  section('Students', [
    // Moved out of the Student module's Settings section — these are config
    // masters (sponsor/student categories and ticketing categories), not
    // day-to-day student operations, so they belong alongside the rest of
    // Config's setup masters instead.
    leaf('Student Category Master', 'users', '/config/student-category-master'),
    leaf('Service Category Master', 'list', '/config/service-category-master'),
  ]),
  section('Organization', [
    leaf('Faculty Master', 'library', '/config/faculty-master'),
    leaf('Department Master', 'briefcase', '/config/department-master'),
    leaf('Designation Master', 'tag', '/config/designation-master'),
    leaf('Campus Master', 'home', '/config/campus-master'),
    leaf('Country Master', 'world', '/config/country-master'),
  ]),
  section('Academic Setup', [
    leaf('Specialization', 'certificate', '/config/specialization'),
    leaf('Skill Master', 'bulb', '/config/skill'),
    leaf('Unit Type Master', 'tag', '/config/unit-type'),
    leaf('Unit Category Master', 'tag', '/config/unit-category'),
    leaf('Weekdays', 'calendar', '/config/weekdays'),
    leaf('Batch Times', 'timer', '/config/batch-times'),
  ]),
  section('Admissions', [
    leaf('Enquiry Status', 'flag', '/config/enquiry-status'),
    leaf('Isbat Enquiry Source', 'compass', '/config/enquiry-source'),
    leaf('Enquiry Source', 'volume', '/config/enquiry-source-master'),
    leaf('Followup Status', 'phone', '/config/followup-status'),
    leaf('Followup Mode', 'comments', '/config/followup-mode'),
    leaf('Interest Level', 'signal', '/config/interest-level'),
  ]),
  section('Access Control', [
    leaf('Permission Master', 'lock', '/config/permission-master'),
  ]),
]

const ASSESSMENT_SECTIONS: MenuNode[] = [
  section('Overview', [
    leaf('Assessment Dashboard', 'dashboard', '/assessment/dashboard'),
  ]),
  section('Assessment Structure', [
    leaf('Fee Clearance Master', 'list', '/assessment/assessment-master'),
    leaf('Exam Rules Master', 'files', '/assessment/exam-rules'),
    leaf('Question FAQs', 'comments', '/assessment/question-faqs'),
    // leaf('Weight Configuration', 'cog', '/assessment/weight-config'),
    // leaf('Assessment Schedule', 'calendar', '/assessment/schedule'),
    leaf('Bulk Exam Scheduler', 'calendar', '/assessment/bulk-exam-scheduler'),
    leaf('Assessment Scheduler', 'graduation', '/assessment/ia-creation'),
    leaf('IA Evaluation', 'checkmark-circle', '/assessment/ia-evaluation'),
  ]),
  section('Coursework (CW)', [
    // leaf('CW Overview', 'folder', '/assessment/cw-overview'),
    leaf('Question Bank Upload', 'upload', '/assessment/cw-qbank'),
    // leaf('CW Submissions', 'files', '/assessment/cw-submissions'),
    leaf('CW Rectification', 'reload', '/assessment/cw-rectify'),
    leaf('Project Proposals', 'folder', '/assessment/project-proposals'),
    leaf('Project Reviews', 'folder', '/assessment/project-reviews'),
  ]),
  section('Class Test (CBT)', [
    // leaf('CBT Overview', 'folder', '/assessment/cbt-overview'),
    // leaf('CBT Question Upload', 'upload', '/assessment/cbt-qupload'),
    // leaf('CBT Monitor', 'display', '/assessment/cbt-monitor'),
    leaf('Exam Cancel', 'timer', '/assessment/exam-cancel'),
  ]),
  section('University Exam (UE)', [
    // leaf('UE Schedule', 'calendar', '/assessment/ue-schedule'),
    leaf('Question Paper Vetting', 'upload', '/assessment/qp-vetting'),
    leaf('UE Practical QBank', 'upload', '/assessment/question-bank-practical'),
    leaf('Hall Ticket Issuance', 'ticket', '/assessment/hall-ticket'),
    leaf('Hall Ticket Print', 'printer', '/assessment/hall-print'),
    // Whole-intake combined PDF (hall-ticket-print-all-page.md, 2026-10-06)
    // — injected in real mode by ensureHallTicketPrintAll below.
    leaf('Hall Ticket Print All', 'printer', '/assessment/hall-ticket-print-all'),
    leaf('UE Material Print', 'printer', '/assessment/university-exam-material-print'),
    leaf('UE QP/Booklet Print', 'printer', '/assessment/university-exam-qp-booklet-print'),
    leaf('UE Practical QP Print', 'printer', '/assessment/university-exam-practical-qp-print'),
    leaf('UE Project Booklet Print', 'printer', '/assessment/university-exam-project-booklet-print'),
    leaf('Resit Question Print', 'printer', '/assessment/resit-question-print'),
    leaf('UE Attendance', 'users', '/assessment/ue-attendance'),
    leaf('UE Mark Import', 'upload', '/assessment/ue-mark-import'),
  ]),
  section('Mark Entry & Results', [
    // leaf('Mark Entry — CW', 'pencil-alt', '/assessment/mark-cw'),
    // leaf('Mark Entry — CBT', 'pencil-alt', '/assessment/mark-cbt'),
    leaf('Mark Entry — UE', 'pencil-alt', '/assessment/mark-ue'),
    leaf('Mark Verify — UE', 'shield', '/assessment/mark-ue-verify'),
    leaf('Result & Moderation', 'bar-chart', '/assessment/moderation'),
    leaf('Exam Mark Import', 'upload', '/assessment/exam-mark-import'),
    leaf('Generate Result', 'cogs', '/assessment/generate-result'),
    leaf('Transcript Print', 'printer', '/assessment/transcript-print'),
    leaf('Graduate Transcript', 'certificate', '/assessment/graduate-transcript'),
    leaf('HEC Graduate Transcript', 'certificate', '/assessment/hec-graduate-transcript'),
    leaf('Transcript Collection', 'check-box', '/assessment/graduate-transcript/collection'),
    leaf('Gown Collection', 'check-box', '/assessment/gown-collection'),
  ]),
  section('Resit & Disputes', [
    leaf('Resit Master', 'cogs', '/assessment/resit-configs'),
    // leaf('Resit Calendar', 'calendar', '/assessment/resit-calendar'),
    leaf('Resit Applications', 'folder', '/assessment/resit-applications'),
    leaf('Resit Apply', 'pencil-alt', '/assessment/resit-apply'),
    leaf('Resit Scheduling', 'calendar', '/assessment/resit-scheduling'),
    leaf('Resit IA Evaluation', 'checkmark-circle', '/assessment/resit-evaluation'),
    leaf('Resit IA Result', 'bar-chart', '/assessment/resit-ia-results'),
    leaf('Resit UE Mark Import', 'upload', '/assessment/resit-ue-mark-import'),
    leaf('Resit Mark Update', 'reload', '/assessment/resit-mark-update'),
    // leaf('Resit Seating Allocator', 'users', '/assessment/resit-seating'),
    // leaf('CW Reevaluation', 'reload', '/assessment/reeval'),
    // leaf('CW Recheck Hub', 'search-alt', '/assessment/recheck'),
    leaf('Exam Grievances', 'files', '/assessment/exam-grievances'),
  ]),
  // Student Services hidden from the sidebar per request, 2026-10-15 — page
  // still exists on disk. Commented out whole (its only leaf) for the same
  // reason as Reports below.
  // section('Student Services', [
  //   leaf('Service Tickets', 'ticket', '/assessment/service-tickets'),
  // ]),
  // Reports section hidden from the sidebar per request, 2026-10-05 — both
  // pages still exist on disk. Commented out whole since Sidebar.tsx renders
  // a childless section as a disabled "Soon" item.
  // section('Reports', [
  //   leaf('Pending QP Upload', 'folder', '/assessment/rpt-pending-qp'),
  //   leaf('Faculty Summary', 'users', '/assessment/rpt-faculty'),
  // ]),
]

// Mirrors docs/MENU_ROUTES_REFERENCE.md — full access to everything, matching
// the app's pre-permission behavior, so mock mode still exercises every page.
const mockMenu: MenuNode[] = [
  module_('Admission', 'clipboard', [
    section('Enquiry', [
      leaf('Online Enquiry', 'display', '/admission/online-enquiry'),
      leaf('Self-Service Kiosk', 'tab', '/admission/kiosk-enquiry'),
      leaf('On-Desk Enquiry', 'pencil-alt', '/admission/ondesk-enquiry'),
      leaf('Enquiry List', 'folder', '/admission/enquiry-list'),
      leaf('Enquiry Followup Master', 'calendar', '/admission/enquiry-followup-master'),
      leaf('Enquiry Followup', 'phone', '/admission/enquiry-followup'),
      // enquiry-report-page.md, 2026-10-14 — see ensureEnquiryReport.
      leaf('Enquiry Report', 'bar-chart', '/admission/reports/enquiry'),
    ]),
    section('Admission Flow', [
      leaf('Dashboard', 'dashboard', '/admission/dashboard'),
      leaf('Application Payment', 'credit-cards', '/admission/payment'),
      leaf('Application Filing', 'pencil-alt', '/admission/filing'),
      leaf('Vetting Desk', 'search-alt', '/admission/vetting'),
      leaf("Registrar's Desk", 'graduation', '/admission/registration'),
    ]),
    section('Records', [
      leaf('All Applicants', 'users', '/admission/applicants'),
      // application-status-report-page.md, 2026-10-14 — see ensureEnquiryReport.
      leaf('Application Status Report', 'bar-chart', '/admission/reports/application-status'),
      leaf('Receipts', 'files', null),
      leaf('Reports', 'bar-chart', null),
    ]),
  ]),
  module_('Academic', 'graduation', [
    section('Overview', [
      leaf('Dashboard', 'dashboard', '/academic/acad-dashboard'),
    ]),
    section('Academic Core', [
      leaf('Intake Master', 'calendar', '/academic/intake-master'),
      leaf('Bulk Intake Edit', 'layers', '/academic/bulk-intake-edit'),
      leaf('Skill Management', 'bulb', '/academic/skill-master'),
      leaf('Batch Management', 'users', '/academic/batch-management'),
      // Moved from Student > Student Records, 2026-09-02 — the page already
      // pulled from the academic/batchSummary API, not a students endpoint.
      leaf('Batch Summary', 'grid-alt', '/academic/batch-summary'),
      leaf('Room Management', 'home', '/academic/room-management'),
      leaf('Session Movement', 'reload', '/academic/session-movement'),
    ]),
    section('Course Unit Master', [
      leaf('Repetition Tag', 'reload', '/academic/repetition-tag'),
      leaf('Course Units', 'book', '/academic/course-units'),
      leaf('Course Allocation', 'agenda', '/academic/course-allocation'),
    ]),
    section('Programme Master', [
      leaf('Programme Level', 'layers', '/academic/programme-level'),
      leaf('Programme Group', 'folder', '/academic/programme-group'),
      leaf('Programme Master', 'graduation', '/academic/programme-master'),
      leaf('Programme Approval', 'check-box', '/academic/programme-approval'),
      leaf('Fee Structure', 'dollar', '/academic/fee-structure'),
    ]),
    section('Timetable', [
      leaf('Timetable', 'calendar', '/academic/timetable'),
    ]),
    section('ODL Applications', [
      leaf('ODL Applications', 'world', '/academic/odl-applications'),
      leaf('Payment Reconciliation', 'credit-cards', '/academic/odl-reconciliation'),
    ]),
    section('Cross-Module', [
      leaf('Student Lookup', 'user', '/academic/student-lookup'),
    ]),
  ]),
  module_('Finance', 'dollar', [
    ...FINANCE_PAYMENT_SECTIONS,
    section('Finance Core', [
      leaf('Cooperates', 'handshake', '/finance/cooperates'),
      leaf('Discounts', 'tag', '/finance/discounts'),
      leaf('Ledgers', 'book', '/finance/ledgers'),
      leaf('Other Ledgers', 'book', '/finance/ledger-others'),
      leaf('Currency Master', 'dollar', '/finance/currency-master'),
      leaf('Receipt Books', 'ticket', '/finance/receipt-books'),
      leaf('General Settings', 'cog', '/finance/gen-sets'),
    ]),
    section('Banking', [
      leaf('Banks', 'coin', '/finance/banks'),
      leaf('Bank Branches', 'map-marker', '/finance/bank-branches'),
      leaf('Proc Banks', 'wallet', '/finance/proc-banks'),
      leaf('Proc GL Accounts', 'calculator', '/finance/proc-gl-accounts'),
    ]),
  ]),
  module_('Student', 'user', [
    section('Student Records', [
      leaf('Student Master', 'graduation', '/student/student-master'),
    ]),
    ...STUDENT_OPERATIONS_SECTIONS,
  ]),
  module_('Employee', 'briefcase', [
    section('Employee Records', [
      leaf('Employee Master', 'user', '/employee/employee-master'),
      leaf('Employee Approvals', 'checkmark-circle', '/employee/employee-approve'),
    ]),
  ]),

  module_('Assessment', 'pencil-alt', ASSESSMENT_SECTIONS),
  // Listed here directly — mergeConfigSections only patches a Config module
  // the real response already has, so the mock tree must carry its own.
  module_('Config', 'cog', CONFIG_SECTIONS),
  module_('Activity Log', 'list', [
    section('Audit Trail', [
      leaf('Activity Log', 'list', '/activity-log/logs'),
    ]),
  ]),
]

// Whole-module fallbacks (HARDCODED_EMPLOYEE_MODULE / HARDCODED_ASSESSMENT_MODULE /
// HARDCODED_ACTIVITY_LOG_MODULE, and the "module missing → inject it anyway"
// branches previously in mergeFinanceSections/mergeStudentSections/
// mergeConfigSections below) were removed 2026-09-07. They were built to
// paper over "the backend hasn't registered this module on its permission
// model yet", but real /me/menu responses now prove the backend correctly
// scopes whole modules per role (e.g. a response containing only "Academic"
// for a role that genuinely has nothing else) — so a missing module means
// "this role doesn't have it", not "not registered yet", and injecting it
// back in with hardcoded full access was actively wrong. A module absent
// from the real response is now just absent from the sidebar. The
// leaf/section-level "ensure"/merge patches below are unaffected — those
// only ever touch a module that IS present in the real response (patching in
// one new frontend-only page/section inside an already-granted module), a
// different and much lower-risk case that stays as-is.

// TEMPORARY: unlike Employee above, the real /me/menu response DOES have a
// Finance module (it backs the already-real Cooperates/Discounts/Ledgers/
// Banking masters) — but the "Payment Collection" and "Reports & Statements"
// sections (8 pages built from a reference HTML mockup; all mock/static,
// since no backend spec exists for this workflow yet) aren't registered on
// its permission model, so they're silently missing from the real tree even
// though the pages themselves exist and work. Force in whichever of the two
// sections isn't already present, per-section rather than whole-module like
// the Employee case; each stops applying the moment the backend starts
// returning that specific section for real.
function mergeFinanceSections(menu: MenuNode[]): MenuNode[] {
  const financeIdx = menu.findIndex(n => n.name === 'Finance')
  // Module genuinely absent from the real response (role has no Finance
  // access at all) — leave it out rather than injecting a full-access
  // module back in. See the note above mergeConfigSections for context.
  if (financeIdx === -1) return menu

  let financeModule = menu[financeIdx]

  // Payment Collection needs the same "leaf-level fixup, not just
  // fill-in-if-missing" treatment mergeStudentSections' own Settings/Student
  // Records fixups use — the real backend already registers this section
  // (it backs Payment Console/Payment History/etc.), so the whole-section-
  // missing check below never touches it, and NCHE/Guild Payment (new
  // frontend-only pages, no backend permission entry yet) would otherwise
  // stay missing forever even once the section itself exists for real.
  const collectionIdx = financeModule.children.findIndex(c => c.name === 'Payment Collection')
  if (collectionIdx !== -1) {
    const collectionSection = financeModule.children[collectionIdx]
    const existingLeaves = new Set(collectionSection.children.map(l => l.name))
    const missingLeaves = [
      leaf('Payment Refund', 'reload', 'payment-refund'),
      leaf('NCHE & Guild Payment', 'graduation', 'nche-guild-payment'),
      leaf('Discount Allocation', 'tag', 'discount-allocation'),
      leaf('Refugee Status', 'shield', 'refugee-status'),
    ].filter(l => !existingLeaves.has(l.name))
    if (missingLeaves.length > 0) {
      // Inserted right after Payment Console, matching their position in
      // FINANCE_PAYMENT_SECTIONS above, rather than tacked onto the end.
      const consoleIdx = collectionSection.children.findIndex(l => l.name === 'Payment Console')
      const children = [...collectionSection.children]
      if (consoleIdx !== -1) children.splice(consoleIdx + 1, 0, ...missingLeaves)
      else children.push(...missingLeaves)
      const mergedFinanceChildren = [...financeModule.children]
      mergedFinanceChildren[collectionIdx] = { ...collectionSection, children }
      financeModule = { ...financeModule, children: mergedFinanceChildren }
    }
  }

  // Same leaf-level fixup for Reports & Statements: when the backend already
  // returns the section, the whole-section check below never adds the new
  // report pages to it. Each missing one is slotted after the one before it
  // in CLIENT_REPORT_LEAVES (the first after Financial Reports).
  const reportsIdx = financeModule.children.findIndex(c => c.name === 'Reports & Statements')
  if (reportsIdx !== -1) {
    const reportsSection = financeModule.children[reportsIdx]
    const children = [...reportsSection.children]
    let changed = false
    let anchorName = 'Financial Reports'
    for (const r of CLIENT_REPORT_LEAVES) {
      if (!children.some(l => l.url === r.url || l.name === r.name)) {
        const afterIdx = children.findIndex(l => l.name === anchorName)
        const reportLeaf = leaf(r.name, r.icon, r.url)
        if (afterIdx !== -1) children.splice(afterIdx + 1, 0, reportLeaf)
        else children.push(reportLeaf)
        changed = true
      }
      anchorName = children.find(l => l.url === r.url)?.name ?? r.name
    }
    if (changed) {
      const mergedFinanceChildren = [...financeModule.children]
      mergedFinanceChildren[reportsIdx] = { ...reportsSection, children }
      financeModule = { ...financeModule, children: mergedFinanceChildren }
    }
  }

  const existingSections = new Set(financeModule.children.map(c => c.name))
  const missingSections = FINANCE_PAYMENT_SECTIONS.filter(s => !existingSections.has(s.name))

  const merged = [...menu]
  if (missingSections.length === 0) {
    merged[financeIdx] = financeModule
    return merged
  }
  // Prepended, not appended — Payment Collection is meant to lead the
  // Finance panel (see its position in mockMenu above), not trail behind
  // whatever real sections the backend already returns.
  merged[financeIdx] = { ...financeModule, children: [...missingSections, ...financeModule.children] }
  return merged
}

// TEMPORARY: same situation as mergeFinanceSections above — the real
// /me/menu response's Student module only has "Student Records" (Student
// Master), so the Operations/Services/Communications/Settings sections built
// from isbat_student_module.html are forced in per-section until the backend
// registers them for real.
function mergeStudentSections(menu: MenuNode[]): MenuNode[] {
  const studentIdx = menu.findIndex(n => n.name === 'Student')
  // Module genuinely absent from the real response (role has no Student
  // access at all) — leave it out. See the note above mergeConfigSections.
  if (studentIdx === -1) return menu

  let studentModule = menu[studentIdx]

  // Student Statement extends the existing "Student Records" section rather
  // than getting its own section. Batch Summary used to live here too, but
  // moved to Academic > Academic Core on 2026-09-02 (see
  // ensureBatchSummary below) — filtered out of Student Records here in
  // case the real backend still registers it, so a stale entry pointing at
  // the now-removed /student/batch-summary route doesn't linger.
  const recordsIdx = studentModule.children.findIndex(c => c.name === 'Student Records')
  if (recordsIdx !== -1) {
    const recordsSection = studentModule.children[recordsIdx]
    const orderedRecordsLeaves = recordsSection.children.filter(l => l.name !== 'Batch Summary' && l.name !== 'Student Statement')
    if (orderedRecordsLeaves.length !== recordsSection.children.length) {
      const children = [...studentModule.children]
      children[recordsIdx] = { ...recordsSection, children: orderedRecordsLeaves }
      studentModule = { ...studentModule, children }
    }
  }

  // Operations icons are frontend-owned, not backend-owned: the real
  // /me/menu response already registers this whole section (so the
  // whole-section-missing check at the bottom of this function never
  // touches it), but its per-leaf icon values are backend-assigned and
  // inconsistent/blank rather than matching STUDENT_OPERATIONS_SECTIONS
  // above. Stamp the frontend-defined icon over whatever the backend sent,
  // by name, without touching url/permissions (those stay backend-real).
  const operationsIdx = studentModule.children.findIndex(c => c.name === 'Operations')
  if (operationsIdx !== -1) {
    const operationsSection = studentModule.children[operationsIdx]
    const operationsDef = STUDENT_OPERATIONS_SECTIONS.find(s => s.name === 'Operations')!
    const iconByName = new Map(operationsDef.children.map(l => [l.name, l.icon]))

    const existingLeaves = new Set(operationsSection.children.map(l => l.name))
    const missingLeaves = operationsDef.children.filter(l => !existingLeaves.has(l.name))

    const children = [
      // "Intake Transfer" renamed to "Dropout Rejoin" 2026-09-03 (see
      // STUDENT_OPERATIONS_SECTIONS above) — filtered out here too in case
      // the real backend still registers the old name, so a stale entry
      // pointing at it under the old label doesn't linger alongside the
      // renamed one from missingLeaves below.
      ...operationsSection.children.filter(l => l.name !== 'Intake Transfer').map(l =>
        iconByName.has(l.name) ? { ...l, icon: iconByName.get(l.name)! } : l,
      ),
      ...missingLeaves
    ]
    studentModule = { ...studentModule, children: [...studentModule.children.slice(0, operationsIdx), { ...operationsSection, children }, ...studentModule.children.slice(operationsIdx + 1)] }
  }

  // Settings needs the same "leaf-level fixup, not just fill-in-if-missing"
  // treatment as Student Records above — the real backend still registers
  // this section with the old single "Category Masters" leaf (see
  // permissionCatalog.ts's 'View Category Master' permission, not yet split
  // on the backend either), so the whole-section-missing check below would
  // never touch it and the sidebar would keep showing the pre-split link
  // forever. Swap that one leaf for the two real pages it became, in place,
  // rather than appending duplicates alongside it.
  const settingsIdx = studentModule.children.findIndex(c => c.name === 'Settings')
  if (settingsIdx !== -1) {
    const settingsSection = studentModule.children[settingsIdx]
    // Discount Management (per-student assignment moved to Finance's own
    // Discount Allocation page, and this page's other half — the discount
    // catalogue CRUD — was always a duplicate of Finance > Discounts) is
    // dropped from this page entirely, 2026-09-02 — filtered out here too
    // in case the real backend still has it registered, so a stale entry
    // pointing at the now-removed /student/discount-management route
    // doesn't linger in the sidebar. Student Category Master and Service
    // Category Master moved to Config > Students the same day (see
    // CONFIG_SECTIONS) — filtered out here too so a stale entry pointing at
    // the now-removed /student/student-category-master and
    // /student/service-category-master routes doesn't linger either;
    // mergeConfigSections is what adds them back under Config.
    const orderedLeaves = settingsSection.children.filter(l => l.name !== 'Category Masters' && l.name !== 'Discount Management' && l.name !== 'Student Category Master' && l.name !== 'Service Category Master')
    const existingSettingsLeaves = new Set(orderedLeaves.map(l => l.name))
    const missingSettingsLeaves = [
      leaf('Specialization Management', 'graduation', '/student/specialization'),
      leaf('Termination Reason Master', 'shield', '/student/termination-reasons'),
      leaf('Feedback Master', 'comments', '/student/feedback-master'),
    ].filter(l => !existingSettingsLeaves.has(l.name))
    if (orderedLeaves.length !== settingsSection.children.length || missingSettingsLeaves.length > 0) {
      const children = [...studentModule.children]
      children[settingsIdx] = { ...settingsSection, children: [...orderedLeaves, ...missingSettingsLeaves] }
      studentModule = { ...studentModule, children }
    }
  }

  // Services hidden from the sidebar per request, 2026-09-02 — dropped
  // entirely (whole section, not just its one leaf) in case the real
  // backend still registers it, so it doesn't linger for users on the real
  // (non-mock) menu tree. See STUDENT_OPERATIONS_SECTIONS above for why the
  // whole section is commented out there rather than left with 0 children.
  const withoutServices = studentModule.children.filter(c => c.name !== 'Services')
  if (withoutServices.length !== studentModule.children.length) {
    studentModule = { ...studentModule, children: withoutServices }
  }

  const existingSections = new Set(studentModule.children.map(c => c.name))
  const missingSections = STUDENT_OPERATIONS_SECTIONS.filter(s => !existingSections.has(s.name))
  // Reports goes right after Operations (its position in
  // STUDENT_OPERATIONS_SECTIONS) rather than trailing below Settings; every
  // other missing section is still appended at the end as before.
  const missingReports = missingSections.find(s => s.name === 'Reports')
  const otherMissing = missingSections.filter(s => s !== missingReports)
  let finalChildren = [...studentModule.children, ...otherMissing]
  if (missingReports) {
    const opsIdx = finalChildren.findIndex(c => c.name === 'Operations')
    if (opsIdx !== -1) finalChildren.splice(opsIdx + 1, 0, missingReports)
    else finalChildren.push(missingReports)
  }
  const finalModule = missingSections.length === 0
    ? studentModule
    : { ...studentModule, children: finalChildren }

  const merged = [...menu]
  merged[studentIdx] = finalModule
  return merged
}

// Module-absent fallbacks removed 2026-09-07 — see the note above
// mergeFinanceSections/mergeStudentSections/getMenu() for why. A module
// missing from the real response now just stays missing.
function mergeConfigSections(menu: MenuNode[]): MenuNode[] {
  const configIdx = menu.findIndex(n => n.name === 'Config')
  if (configIdx === -1) return menu

  const configModule = menu[configIdx]
  const children = [...configModule.children]
  for (const configSection of CONFIG_SECTIONS) {
    const sectionIdx = children.findIndex(sectionNode => sectionNode.name === configSection.name)
    if (sectionIdx === -1) {
      children.push(configSection)
      continue
    }

    const existingSection = children[sectionIdx]
    const existingNames = new Set(existingSection.children.map(item => item.name))
    const missingItems = configSection.children.filter(item => !existingNames.has(item.name))
    if (missingItems.length > 0) {
      children[sectionIdx] = { ...existingSection, children: [...existingSection.children, ...missingItems] }
    }
  }

  const mergedMenu = [...menu]
  mergedMenu[configIdx] = { ...configModule, children }
  return mergedMenu
}

export interface MenuResult {
  menu: MenuNode[]
  isFallback: boolean
}

// Same idea as ensureProgrammeApproval below, one section over: Bulk Intake
// Edit is a new frontend-only page (no backend permission entry yet), so it
// would otherwise vanish from the real /me/menu tree even though the page
// exists and works. Injected right after Intake Master, matching its
// position in mockMenu above.
function ensureBulkIntakeEdit(menu: MenuNode[]): MenuNode[] {
  const acadIdx = menu.findIndex(n => n.name === 'Academic')
  if (acadIdx === -1) return menu

  const acadModule = menu[acadIdx]
  const coreIdx = acadModule.children.findIndex(c => c.name === 'Academic Core')
  if (coreIdx === -1) return menu

  const coreSection = acadModule.children[coreIdx]
  if (coreSection.children.some(l => l.name === 'Bulk Intake Edit')) return menu

  const children = [...coreSection.children]
  const intakeIdx = children.findIndex(l => l.name === 'Intake Master')
  const bulkEditLeaf = leaf('Bulk Intake Edit', 'layers', '/academic/bulk-intake-edit')

  if (intakeIdx !== -1) {
    children.splice(intakeIdx + 1, 0, bulkEditLeaf)
  } else {
    children.push(bulkEditLeaf)
  }

  const mergedSection = { ...coreSection, children }

  const mergedAcad = { ...acadModule }
  mergedAcad.children = [...acadModule.children]
  mergedAcad.children[coreIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[acadIdx] = mergedAcad
  return mergedMenu
}

// TEMPORARY: Batch Summary moved from Student > Student Records to Academic
// > Academic Core, 2026-09-02 — mergeStudentSections() above strips it out
// of Student Records if the real backend still has it registered there, and
// this adds it into Academic Core (right after Batch Management) if the
// backend doesn't register it there yet. Same shape as ensureBulkIntakeEdit.
// New page, no confirmed backend yet (no menu/permission registration for
// it) — same "patch it into the real menu client-side" pattern as
// ensureBatchSummary etc. immediately below. Targets "Course Unit Master"
// specifically, inserted right after "Course Units" since that's the
// page it's most closely related to (assigning lecturers to the units
// listed there).
function ensureCourseAllocation(menu: MenuNode[]): MenuNode[] {
  const acadIdx = menu.findIndex(n => n.name === 'Academic')
  if (acadIdx === -1) return menu

  const acadModule = menu[acadIdx]
  const cuSectionIdx = acadModule.children.findIndex(c => c.name === 'Course Unit Master')
  if (cuSectionIdx === -1) return menu

  const cuSection = acadModule.children[cuSectionIdx]
  if (cuSection.children.some(l => l.name === 'Course Allocation')) return menu

  const children = [...cuSection.children]
  const courseUnitsIdx = children.findIndex(l => l.name === 'Course Units')
  const courseAllocationLeaf = leaf('Course Allocation', 'agenda', '/academic/course-allocation')

  if (courseUnitsIdx !== -1) {
    children.splice(courseUnitsIdx + 1, 0, courseAllocationLeaf)
  } else {
    children.push(courseAllocationLeaf)
  }

  const mergedSection = { ...cuSection, children }

  const mergedAcad = { ...acadModule }
  mergedAcad.children = [...acadModule.children]
  mergedAcad.children[cuSectionIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[acadIdx] = mergedAcad
  return mergedMenu
}

function ensureBatchSummary(menu: MenuNode[]): MenuNode[] {
  const acadIdx = menu.findIndex(n => n.name === 'Academic')
  if (acadIdx === -1) return menu

  const acadModule = menu[acadIdx]
  const coreIdx = acadModule.children.findIndex(c => c.name === 'Academic Core')
  if (coreIdx === -1) return menu

  const coreSection = acadModule.children[coreIdx]
  if (coreSection.children.some(l => l.name === 'Batch Summary')) return menu

  const children = [...coreSection.children]
  const batchMgmtIdx = children.findIndex(l => l.name === 'Batch Management')
  const batchSummaryLeaf = leaf('Batch Summary', 'grid-alt', '/academic/batch-summary')

  if (batchMgmtIdx !== -1) {
    children.splice(batchMgmtIdx + 1, 0, batchSummaryLeaf)
  } else {
    children.push(batchSummaryLeaf)
  }

  const mergedSection = { ...coreSection, children }

  const mergedAcad = { ...acadModule }
  mergedAcad.children = [...acadModule.children]
  mergedAcad.children[coreIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[acadIdx] = mergedAcad
  return mergedMenu
}

function ensureProgrammeApproval(menu: MenuNode[]): MenuNode[] {
  const acadIdx = menu.findIndex(n => n.name === 'Academic')
  if (acadIdx === -1) return menu

  const acadModule = menu[acadIdx]
  const progMasterIdx = acadModule.children.findIndex(c => c.name === 'Programme Master')
  if (progMasterIdx === -1) return menu

  const progMasterSection = acadModule.children[progMasterIdx]
  if (progMasterSection.children.some(l => l.name === 'Programme Approval')) {
    return menu
  }

  const children = [...progMasterSection.children]
  const pmNodeIdx = children.findIndex(l => l.name === 'Programme Master')

  if (pmNodeIdx !== -1) {
    children.splice(pmNodeIdx + 1, 0, leaf('Programme Approval', 'check-box', '/academic/programme-approval'))
  } else {
    children.push(leaf('Programme Approval', 'check-box', '/academic/programme-approval'))
  }

  const mergedSection = {
    ...progMasterSection,
    children
  }

  const mergedAcad = { ...acadModule }
  mergedAcad.children = [...acadModule.children]
  mergedAcad.children[progMasterIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[acadIdx] = mergedAcad
  return mergedMenu
}

// TEMPORARY: same reasoning as ensureProgrammeApproval above — the real
// Employee module (when the backend does return one) has no permission
// entry for this page yet, so it would otherwise be missing even though
// HARDCODED_EMPLOYEE_MODULE only fires when the whole module is absent.
// Runs after that merge, so it patches whichever "Employee" module ended up
// in the menu — real or hardcoded — and is a no-op the moment the backend
// starts returning the leaf itself.
function ensureEmployeeApprovals(menu: MenuNode[]): MenuNode[] {
  const empIdx = menu.findIndex(n => n.name === 'Employee')
  if (empIdx === -1) return menu

  const empModule = menu[empIdx]
  const recordsIdx = empModule.children.findIndex(c => c.name === 'Employee Records')
  if (recordsIdx === -1) return menu

  const recordsSection = empModule.children[recordsIdx]
  if (recordsSection.children.some(l => l.name === 'Employee Approvals')) return menu

  const children = [...recordsSection.children]
  const masterIdx = children.findIndex(l => l.name === 'Employee Master')
  const approvalsLeaf = leaf('Employee Approvals', 'checkmark-circle', '/employee/employee-approve')

  if (masterIdx !== -1) {
    children.splice(masterIdx + 1, 0, approvalsLeaf)
  } else {
    children.push(approvalsLeaf)
  }

  const mergedSection = { ...recordsSection, children }

  const mergedEmp = { ...empModule }
  mergedEmp.children = [...empModule.children]
  mergedEmp.children[recordsIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[empIdx] = mergedEmp
  return mergedMenu
}

function ensureAssessmentMaster(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const structIdx = assessModule.children.findIndex(c => c.name === 'Assessment Structure')
  if (structIdx === -1) return menu

  const structSection = assessModule.children[structIdx]
  const hasAssMaster = structSection.children.some(l => l.name === 'Fee Clearance Master')
  const hasExamRules = structSection.children.some(l => l.name === 'Exam Rules Master')
  const hasFaqs = structSection.children.some(l => l.name === 'Question FAQs')
  const hasIaCreation = structSection.children.some(l => l.name === 'Assessment Scheduler' || l.name === 'IA Creation' || l.url === '/assessment/ia-creation')
  const hasIaEvaluation = structSection.children.some(l => l.name === 'IA Evaluation')

  if (hasAssMaster && hasExamRules && hasFaqs && hasIaCreation && hasIaEvaluation) return menu

  const children = [...structSection.children]

  if (!hasFaqs) {
    const examRuleIdx = children.findIndex(l => l.name === 'Exam Rules Master')
    if (examRuleIdx !== -1) {
      children.splice(examRuleIdx + 1, 0, leaf('Question FAQs', 'comments', '/assessment/question-faqs'))
    } else {
      children.unshift(leaf('Question FAQs', 'comments', '/assessment/question-faqs'))
    }
  }

  if (!hasExamRules) children.unshift(leaf('Exam Rules Master', 'files', '/assessment/exam-rules'))
  if (!hasAssMaster) children.unshift(leaf('Fee Clearance Master', 'list', '/assessment/assessment-master'))

  // Assessment Scheduler (formerly IA Creation) — inject after Assessment Schedule if present, otherwise at end
  if (!hasIaCreation) {
    const scheduleIdx = children.findIndex(l => l.name === 'Assessment Schedule')
    if (scheduleIdx !== -1) {
      children.splice(scheduleIdx + 1, 0, leaf('Assessment Scheduler', 'graduation', '/assessment/ia-creation'))
    } else {
      children.push(leaf('Assessment Scheduler', 'graduation', '/assessment/ia-creation'))
    }
  }

  // IA Evaluation — inject after Assessment Scheduler / IA Creation if present, otherwise at end
  if (!hasIaEvaluation) {
    const iaCreationIdx = children.findIndex(l => l.name === 'Assessment Scheduler' || l.name === 'IA Creation')
    if (iaCreationIdx !== -1) {
      children.splice(iaCreationIdx + 1, 0, leaf('IA Evaluation', 'checkmark-circle', '/assessment/ia-evaluation'))
    } else {
      children.push(leaf('IA Evaluation', 'checkmark-circle', '/assessment/ia-evaluation'))
    }
  }

  const mergedSection = { ...structSection, children }

  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[structIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureResitMaster(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const resitIdx = assessModule.children.findIndex(c => c.name === 'Resit & Disputes')
  if (resitIdx === -1) return menu

  const resitSection = assessModule.children[resitIdx]
  if (resitSection.children.some(l => l.name === 'Resit Master')) return menu

  const children = [leaf('Resit Master', 'cogs', '/assessment/resit-configs'), ...resitSection.children]

  const mergedSection = { ...resitSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[resitIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureUeMaterialPrint(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const ueIdx = assessModule.children.findIndex(c => c.name === 'University Exam (UE)')
  if (ueIdx === -1) return menu

  const ueSection = assessModule.children[ueIdx]
  if (ueSection.children.some(l => l.name === 'UE Material Print')) return menu

  const children = [...ueSection.children, leaf('UE Material Print', 'printer', '/assessment/university-exam-material-print'), leaf('UE QP/Booklet Print', 'printer', '/assessment/university-exam-qp-booklet-print'), leaf('UE Practical QP Print', 'printer', '/assessment/university-exam-practical-qp-print'), leaf('UE Project Booklet Print', 'printer', '/assessment/university-exam-project-booklet-print'), leaf('Resit Question Print', 'printer', '/assessment/resit-question-print')]

  const mergedSection = { ...ueSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[ueIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}


// Hall Ticket Print All (2026-10-06) has no backend page registration yet —
// slotted right after Hall Ticket Print when present, else at the end of UE.
function ensureHallTicketPrintAll(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const ueIdx = assessModule.children.findIndex(c => c.name === 'University Exam (UE)')
  if (ueIdx === -1) return menu

  const ueSection = assessModule.children[ueIdx]
  if (ueSection.children.some(l => l.url === '/assessment/hall-ticket-print-all')) return menu

  const children = [...ueSection.children]
  const printIdx = children.findIndex(l => l.url === '/assessment/hall-print')
  const newLeaf = leaf('Hall Ticket Print All', 'printer', '/assessment/hall-ticket-print-all')
  if (printIdx !== -1) children.splice(printIdx + 1, 0, newLeaf)
  else children.push(newLeaf)

  const mergedAssess = { ...assessModule, children: [...assessModule.children] }
  mergedAssess.children[ueIdx] = { ...ueSection, children }

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureResitApplications(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const resitIdx = assessModule.children.findIndex(c => c.name === 'Resit & Disputes')
  if (resitIdx === -1) return menu

  const resitSection = assessModule.children[resitIdx]
  const hasApps = resitSection.children.some(l => l.name === 'Resit Applications')
  const hasApply = resitSection.children.some(l => l.name === 'Resit Apply')
  const hasScheduling = resitSection.children.some(l => l.name === 'Resit Scheduling')
  if (hasApps && hasApply && hasScheduling) return menu

  let children = [...resitSection.children]
  if (!hasApps) children.push(leaf('Resit Applications', 'folder', '/assessment/resit-applications'))
  if (!hasApply) children.push(leaf('Resit Apply', 'pencil-alt', '/assessment/resit-apply'))
  if (!hasScheduling) children.push(leaf('Resit Scheduling', 'calendar', '/assessment/resit-scheduling'))

  const mergedSection = { ...resitSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[resitIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// Enquiry Report (enquiry-report-page.md, 2026-10-14) has no backend menu
// registration yet: appended to Admission's Enquiry section when missing.
// Leaves the menu untouched if the role has no Admission module or no
// Enquiry section.
// Same for Application Status Report (application-status-report-page.md),
// appended to Admission's Records section.
function ensureAdmissionReportLeaf(menu: MenuNode[], sectionName: string, name: string, url: string): MenuNode[] {
  const admIdx = menu.findIndex(n => n.name === 'Admission')
  if (admIdx === -1) return menu
  const admModule = menu[admIdx]
  const secIdx = admModule.children.findIndex(c => c.name === sectionName)
  if (secIdx === -1) return menu
  const sec = admModule.children[secIdx]
  if (sec.children.some(l => l.name === name || l.url === url)) return menu

  const mergedAdm = { ...admModule, children: [...admModule.children] }
  mergedAdm.children[secIdx] = { ...sec, children: [...sec.children, leaf(name, 'bar-chart', url)] }
  const mergedMenu = [...menu]
  mergedMenu[admIdx] = mergedAdm
  return mergedMenu
}
function ensureEnquiryReport(menu: MenuNode[]): MenuNode[] {
  const withEnquiry = ensureAdmissionReportLeaf(menu, 'Enquiry', 'Enquiry Report', '/admission/reports/enquiry')
  return ensureAdmissionReportLeaf(withEnquiry, 'Records', 'Application Status Report', '/admission/reports/application-status')
}

function ensureUeMarkImport(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const ueIdx = assessModule.children.findIndex(c => c.name === 'University Exam (UE)')
  if (ueIdx === -1) return menu

  const ueSection = assessModule.children[ueIdx]
  if (ueSection.children.some(l => l.name === 'UE Mark Import')) return menu

  const children = [...ueSection.children, leaf('UE Mark Import', 'upload', '/assessment/ue-mark-import')]

  const mergedSection = { ...ueSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[ueIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureUeAttendance(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const ueIdx = assessModule.children.findIndex(c => c.name === 'University Exam (UE)')
  if (ueIdx === -1) return menu

  const ueSection = assessModule.children[ueIdx]
  if (ueSection.children.some(l => l.name === 'UE Attendance')) return menu

  const children = [...ueSection.children, leaf('UE Attendance', 'users', '/assessment/ue-attendance')]

  const mergedSection = { ...ueSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[ueIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureTranscriptPrint(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const markIdx = assessModule.children.findIndex(c => c.name === 'Mark Entry & Results')
  if (markIdx === -1) return menu

  const markSection = assessModule.children[markIdx]
  if (markSection.children.some(l => l.name === 'Transcript Print')) return menu

  const children = [...markSection.children, leaf('Transcript Print', 'printer', '/assessment/transcript-print')]

  const mergedSection = { ...markSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[markIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureGraduateTranscript(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const markIdx = assessModule.children.findIndex(c => c.name === 'Mark Entry & Results')
  if (markIdx === -1) return menu

  const markSection = assessModule.children[markIdx]
  if (markSection.children.some(l => l.name === 'Graduate Transcript')) return menu

  const children = [...markSection.children, leaf('Graduate Transcript', 'certificate', '/assessment/graduate-transcript')]

  const mergedSection = { ...markSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[markIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureTranscriptCollection(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const markIdx = assessModule.children.findIndex(c => c.name === 'Mark Entry & Results')
  if (markIdx === -1) return menu

  const markSection = assessModule.children[markIdx]
  if (markSection.children.some(l => l.name === 'Transcript Collection')) return menu

  const children = [...markSection.children, leaf('Transcript Collection', 'check-box', '/assessment/graduate-transcript/collection')]

  const mergedSection = { ...markSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[markIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureResultModeration(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const markIdx = assessModule.children.findIndex(c => c.name === 'Mark Entry & Results')
  if (markIdx === -1) return menu

  const markSection = assessModule.children[markIdx]
  if (markSection.children.some(l => l.name === 'Result & Moderation')) return menu

  const children = [...markSection.children, leaf('Result & Moderation', 'bar-chart', '/assessment/moderation')]

  const mergedSection = { ...markSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[markIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureProjectProposals(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const cwIdx = assessModule.children.findIndex(c => c.name === 'Coursework (CW)')
  if (cwIdx === -1) return menu

  const cwSection = assessModule.children[cwIdx]
  if (cwSection.children.some(l => l.name === 'Project Proposals')) {
    if (!cwSection.children.some(l => l.name === 'Project Reviews')) {
      const pIdx = cwSection.children.findIndex(l => l.name === 'Project Proposals')
      cwSection.children.splice(pIdx + 1, 0, leaf('Project Reviews', 'folder', '/assessment/project-reviews'))
    }
    return menu
  }

  const children = [...cwSection.children, leaf('Project Proposals', 'folder', '/assessment/project-proposals'), leaf('Project Reviews', 'folder', '/assessment/project-reviews')]

  const mergedSection = { ...cwSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[cwIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function stripLectureMaster(menu: MenuNode[]): MenuNode[] {
  return menu.map(mod => {
    const isLectureMatch = (name: string) => {
      const n = name.trim().toLowerCase()
      return n === 'lecture master' || n === 'lecturer master'
    }
    if (!mod.children.some(c => isLectureMatch(c.name))) return mod
    return {
      ...mod,
      children: mod.children.filter(c => !isLectureMatch(c.name)),
    }
  })
}

function ensureResitMarkUpdate(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const resitIdx = assessModule.children.findIndex(c => c.name === 'Resit & Disputes')
  if (resitIdx === -1) return menu

  const resitSection = assessModule.children[resitIdx]
  if (resitSection.children.some(l => l.name === 'Resit Mark Update')) return menu

  const children = [...resitSection.children]
  const schedulingIdx = children.findIndex(l => l.name === 'Resit Scheduling')
  const newLeaf = leaf('Resit Mark Update', 'reload', '/assessment/resit-mark-update')
  if (schedulingIdx !== -1) {
    children.splice(schedulingIdx + 1, 0, newLeaf)
  } else {
    children.push(newLeaf)
  }

  const mergedSection = { ...resitSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[resitIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// New page, no backend menu registration yet — same "patch it into the real
// menu client-side" pattern as ensureResitMarkUpdate above. Inserted right
// after Resit Scheduling (falls back to the end), so it lands between
// Scheduling and Mark Update once ensureResitMarkUpdate has run.
function ensureResitEvaluation(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const resitIdx = assessModule.children.findIndex(c => c.name === 'Resit & Disputes')
  if (resitIdx === -1) return menu

  const resitSection = assessModule.children[resitIdx]
  if (resitSection.children.some(l => l.name === 'Resit IA Evaluation')) return menu

  const children = [...resitSection.children]
  const schedulingIdx = children.findIndex(l => l.name === 'Resit Scheduling')
  const newLeaf = leaf('Resit IA Evaluation', 'checkmark-circle', '/assessment/resit-evaluation')
  if (schedulingIdx !== -1) {
    children.splice(schedulingIdx + 1, 0, newLeaf)
  } else {
    children.push(newLeaf)
  }

  const mergedSection = { ...resitSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[resitIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// New page, no backend menu registration yet — same pattern as
// ensureResitEvaluation above. Inserted right before Resit Mark Update
// (imported UE marks feed that page), else at the end of the section.
function ensureResitUeMarkImport(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const resitIdx = assessModule.children.findIndex(c => c.name === 'Resit & Disputes')
  if (resitIdx === -1) return menu

  const resitSection = assessModule.children[resitIdx]
  if (resitSection.children.some(l => l.name === 'Resit UE Mark Import')) return menu

  const children = [...resitSection.children]
  const markUpdateIdx = children.findIndex(l => l.name === 'Resit Mark Update')
  const newLeaf = leaf('Resit UE Mark Import', 'upload', '/assessment/resit-ue-mark-import')
  if (markUpdateIdx !== -1) {
    children.splice(markUpdateIdx, 0, newLeaf)
  } else {
    children.push(newLeaf)
  }

  const mergedSection = { ...resitSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[resitIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// New page, no backend menu registration yet. Inserted right after Resit IA
// Evaluation (it lists that page's submitted marks), else at the end.
function ensureResitIaResults(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const resitIdx = assessModule.children.findIndex(c => c.name === 'Resit & Disputes')
  if (resitIdx === -1) return menu

  const resitSection = assessModule.children[resitIdx]
  if (resitSection.children.some(l => l.name === 'Resit IA Result')) return menu

  const children = [...resitSection.children]
  const evaluationIdx = children.findIndex(l => l.name === 'Resit IA Evaluation')
  const newLeaf = leaf('Resit IA Result', 'bar-chart', '/assessment/resit-ia-results')
  if (evaluationIdx !== -1) {
    children.splice(evaluationIdx + 1, 0, newLeaf)
  } else {
    children.push(newLeaf)
  }

  const mergedSection = { ...resitSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[resitIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureGownCollection(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const markEntryIdx = assessModule.children.findIndex(c => c.name === 'Mark Entry & Results')
  if (markEntryIdx === -1) return menu

  const markEntrySection = assessModule.children[markEntryIdx]
  if (markEntrySection.children.some(l => l.name === 'Gown Collection')) return menu

  const children = [...markEntrySection.children]
  const graduateIdx = children.findIndex(l => l.name === 'Transcript Collection')
  const newLeaf = leaf('Gown Collection', 'check-box', '/assessment/gown-collection')
  if (graduateIdx !== -1) {
    children.splice(graduateIdx + 1, 0, newLeaf)
  } else {
    children.push(newLeaf)
  }

  const mergedSection = { ...markEntrySection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[markEntryIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// New page, no backend menu registration yet (service-ticket-staff-page.md;
// APIs not deployed). Adds a "Student Services" section to Assessment —
// before Reports when present, otherwise at the end.
function ensureServiceTickets(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const hasPage = assessModule.children.some(s => s.children.some(l => l.url === '/assessment/service-tickets'))
  if (hasPage) return menu

  const newLeaf = leaf('Service Tickets', 'ticket', '/assessment/service-tickets')
  const children = [...assessModule.children]
  const servicesIdx = children.findIndex(c => c.name === 'Student Services')
  if (servicesIdx !== -1) {
    children[servicesIdx] = { ...children[servicesIdx], children: [...children[servicesIdx].children, newLeaf] }
  } else {
    const reportsIdx = children.findIndex(c => c.name === 'Reports')
    children.splice(reportsIdx === -1 ? children.length : reportsIdx, 0, section('Student Services', [newLeaf]))
  }

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = { ...assessModule, children }
  return mergedMenu
}

// New page, no backend menu registration yet (exam-grievance-management-page.md;
// APIs not deployed). Appended to Resit & Disputes.
function ensureExamGrievances(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const resitIdx = assessModule.children.findIndex(c => c.name === 'Resit & Disputes')
  if (resitIdx === -1) return menu

  const resitSection = assessModule.children[resitIdx]
  if (resitSection.children.some(l => l.url === '/assessment/exam-grievances')) return menu

  const mergedSection = { ...resitSection, children: [...resitSection.children, leaf('Exam Grievances', 'files', '/assessment/exam-grievances')] }
  const mergedAssess = { ...assessModule, children: [...assessModule.children] }
  mergedAssess.children[resitIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// New page, no backend menu registration yet (generate-result/*.md). Placed
// right after Result & Moderation in Mark Entry & Results (falls back to the end).
function ensureGenerateResult(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const sectionIdx = assessModule.children.findIndex(c => c.name === 'Mark Entry & Results')
  if (sectionIdx === -1) return menu

  const markEntrySection = assessModule.children[sectionIdx]
  if (markEntrySection.children.some(l => l.url === '/assessment/generate-result')) return menu

  const children = [...markEntrySection.children]
  const moderationIdx = children.findIndex(l => l.name === 'Result & Moderation')
  const newLeaf = leaf('Generate Result', 'cogs', '/assessment/generate-result')
  if (moderationIdx !== -1) children.splice(moderationIdx + 1, 0, newLeaf)
  else children.push(newLeaf)

  const mergedAssess = { ...assessModule, children: [...assessModule.children] }
  mergedAssess.children[sectionIdx] = { ...markEntrySection, children }

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// New page, no backend menu registration yet (exam-cancel/*.md). Appended to
// Class Test (CBT) — it cancels Class Test / coursework attempts and gives
// Class Test extra time.
function ensureExamCancel(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const sectionIdx = assessModule.children.findIndex(c => c.name === 'Class Test (CBT)')
  if (sectionIdx === -1) return menu

  const cbtSection = assessModule.children[sectionIdx]
  if (cbtSection.children.some(l => l.url === '/assessment/exam-cancel')) return menu

  const mergedAssess = { ...assessModule, children: [...assessModule.children] }
  mergedAssess.children[sectionIdx] = { ...cbtSection, children: [...cbtSection.children, leaf('Exam Cancel', 'timer', '/assessment/exam-cancel')] }

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function ensureQuestionBankPractical(menu: MenuNode[]): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  const ueIdx = assessModule.children.findIndex(c => c.name === 'University Exam (UE)')
  if (ueIdx === -1) return menu

  const ueSection = assessModule.children[ueIdx]
  if (ueSection.children.some(l => l.url === '/assessment/question-bank-practical')) return menu

  const children = [...ueSection.children]
  const qpIdx = children.findIndex(l => l.name === 'Question Paper Vetting')
  const newLeaf = leaf('UE Practical QBank', 'upload', '/assessment/question-bank-practical')
  if (qpIdx !== -1) {
    children.splice(qpIdx + 1, 0, newLeaf)
  } else {
    children.push(newLeaf)
  }

  const mergedSection = { ...ueSection, children }
  const mergedAssess = { ...assessModule }
  mergedAssess.children = [...assessModule.children]
  mergedAssess.children[ueIdx] = mergedSection

  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

// New pages with no backend menu registration yet (exam-mark-import-page.md,
// hec-graduate-transcript-page.md) — appended to Mark Entry & Results when
// Assessment is present and the url isn't there already.
function ensureMarkResultsLeaf(menu: MenuNode[], name: string, icon: string, url: string): MenuNode[] {
  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu
  const assessModule = menu[assessIdx]
  if (assessModule.children.some(s => s.children.some(l => l.url === url))) return menu
  const markIdx = assessModule.children.findIndex(c => c.name === 'Mark Entry & Results')
  if (markIdx === -1) return menu
  const markSection = assessModule.children[markIdx]
  const mergedAssess = { ...assessModule, children: [...assessModule.children] }
  mergedAssess.children[markIdx] = { ...markSection, children: [...markSection.children, leaf(name, icon, url)] }
  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

function stripUnintegratedPages(menu: MenuNode[]): MenuNode[] {
  const hiddenUrls = [
    '/assessment/resit-calendar',
    '/assessment/resit-seating',
    '/assessment/reeval',
    '/assessment/recheck',
    // Hidden from the sidebar per request, 2026-10-15 — pages still exist.
    '/assessment/weight-config',
    '/assessment/schedule',
    '/assessment/service-tickets',
  ]
  // The real /me/menu may send bare slugs ("weight-config"), so match on
  // the last path segment too.
  const hiddenSlugs = hiddenUrls.map(u => u.slice(u.lastIndexOf('/') + 1))
  const isHidden = (url: string | null) => !!url && (hiddenUrls.includes(url) || hiddenSlugs.includes(url))

  const assessIdx = menu.findIndex(n => n.name === 'Assessment')
  if (assessIdx === -1) return menu

  const assessModule = menu[assessIdx]
  let changed = false
  const sections = assessModule.children.flatMap(s => {
    const kept = s.children.filter(l => !isHidden(l.url))
    if (kept.length === s.children.length) return [s]
    changed = true
    // Sidebar.tsx renders a childless section as a disabled "Soon" item, so
    // drop a section this emptied.
    return kept.length ? [{ ...s, children: kept }] : []
  })

  if (!changed) return menu

  const mergedAssess = { ...assessModule, children: sections }
  const mergedMenu = [...menu]
  mergedMenu[assessIdx] = mergedAssess
  return mergedMenu
}

export interface AppPage {
  name: string
  url: string
  module: string
  section: string | null
}

// Every navigable page in a menu tree, flattened — for "did you mean"
// suggestions and page search on the 404 page. Pass the user's own
// (RBAC-filtered) menu from getMenu()/useMenu(), so only pages they can open
// are offered. The real /me/menu sends bare slugs ("permission-master");
// those resolve against the module's route segment ("Activity Log" →
// /activity-log/…), same as the sidebar's resolveHref.
export function flattenMenuPages(menu: MenuNode[]): AppPage[] {
  const pages: AppPage[] = []
  for (const m of menu) {
    const base = '/' + m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const walk = (nodes: MenuNode[], section: string | null) => {
      for (const n of nodes) {
        if (n.url) pages.push({ name: n.name, url: n.url.startsWith('/') ? n.url : `${base}/${n.url}`, module: m.name, section })
        if (n.children.length) walk(n.children, n.url ? section : n.name)
      }
    }
    walk(m.children, null)
  }
  return pages
}

// Every page the app knows as a menu item, i.e. the full menu before RBAC
// filtering (same tree getMenu() falls back to). Built once, on first use.
let catalogCache: { modules: Set<string>; pages: Set<string> } | null = null
function menuCatalog() {
  if (!catalogCache) {
    const pages = flattenMenuPages(stripUnintegratedPages(stripLectureMaster(renameIaCreation(mockMenu))))
    catalogCache = {
      modules: new Set(pages.map(p => p.url.split('/')[1])),
      pages: new Set(pages.map(p => p.url)),
    }
  }
  return catalogCache
}

// Whether the user's own (RBAC-filtered) menu lets them open `pathname`.
// Denied: anything under a module missing from their menu, and any known
// menu page that their menu leaves out or marks `get: false`. Routes that
// aren't menu items (profile, detail pages like /student/profile, dashboards
// not in the catalog) are allowed — the backend still authorizes each call.
export function isRouteAllowed(menu: MenuNode[], pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  const catalog = menuCatalog()
  const moduleSeg = path.split('/')[1]
  if (!catalog.modules.has(moduleSeg)) return true

  const pages = flattenMenuPages(menu)
  if (!pages.some(p => p.url.split('/')[1] === moduleSeg)) return false
  if (!catalog.pages.has(path)) return true

  const permissions = findLeafPermissions(menu, path)
  return permissions !== undefined && permissions?.get !== false
}

// undefined: the page isn't in the menu; null: it is, with no permission data.
function findLeafPermissions(menu: MenuNode[], path: string): MenuPermissions | null | undefined {
  for (const m of menu) {
    const base = '/' + m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const walk = (nodes: MenuNode[]): MenuPermissions | null | undefined => {
      for (const n of nodes) {
        if (n.url && (n.url.startsWith('/') ? n.url : `${base}/${n.url}`) === path) return n.permissions
        const found = n.children.length ? walk(n.children) : undefined
        if (found !== undefined) return found
      }
      return undefined
    }
    const found = walk(m.children)
    if (found !== undefined) return found
  }
  return undefined
}

function renameIaCreation(menu: MenuNode[]): MenuNode[] {
  return menu.map(mod => {
    if (mod.name !== 'Assessment') return mod
    return {
      ...mod,
      children: mod.children.map(sec => ({
        ...sec,
        children: sec.children.map(leafNode => {
          if (
            leafNode.name === 'IA Creation' ||
            leafNode.url === '/assessment/ia-creation' ||
            leafNode.url === 'ia-creation'
          ) {
            return { ...leafNode, name: 'Assessment Scheduler' }
          }
          return leafNode
        }),
      })),
    }
  })
}

export function getMenu(): Promise<MenuResult> {
  if (MOCK_MENU) return Promise.resolve({ menu: stripUnintegratedPages(stripLectureMaster(renameIaCreation(mockMenu))), isFallback: false })
  return apiGet<MenuNode[] | null>('/api/v1/users/me/menu')
    .then(data => {
      const menu = data ?? []
      // No more whole-module injection here — a module absent from the real
      // response (Employee, Assessment, Activity Log, Finance, Student,
      // Config) means this role genuinely doesn't have it, and is left out.
      // Every step below only ever patches a module that IS present.
      const withApprovals = ensureEmployeeApprovals(menu)
      const withFinance = mergeFinanceSections(withApprovals)
      const withStudent = mergeStudentSections(withFinance)
      const withBulkEdit = ensureBulkIntakeEdit(withStudent)
      const withBatchSummary = ensureBatchSummary(withBulkEdit)
      const withCourseAllocation = ensureCourseAllocation(withBatchSummary)
      const withConfig = mergeConfigSections(withCourseAllocation)
      const withProgApp = ensureProgrammeApproval(withConfig)
      const withAssMaster = ensureAssessmentMaster(withProgApp)
      const withResit = ensureResitMaster(withAssMaster)
      const withResitApps = ensureResitApplications(withResit)
      const withResitMarkUpdate = ensureResitMarkUpdate(withResitApps)
      const withResitEvaluation = ensureResitEvaluation(withResitMarkUpdate)
      const withResitIaResults = ensureResitIaResults(withResitEvaluation)
      const withResitUeImport = ensureResitUeMarkImport(withResitIaResults)
      const withUePrint = ensureUeMaterialPrint(withResitUeImport)
      const withHallPrintAll = ensureHallTicketPrintAll(withUePrint)
      const withUeAttendance = ensureUeAttendance(withHallPrintAll)
      const withUeMarkImport = ensureUeMarkImport(withUeAttendance)
      const withModeration = ensureResultModeration(withUeMarkImport)
      const withProjectProposals = ensureProjectProposals(withModeration)
      const withTranscriptPrint = ensureTranscriptPrint(withProjectProposals)
      const withGraduateTranscript = ensureGraduateTranscript(withTranscriptPrint)
      const withTranscriptCollection = ensureTranscriptCollection(withGraduateTranscript)
      const withGownCollection = ensureGownCollection(withTranscriptCollection)
      // Service Tickets hidden from the sidebar per request, 2026-10-15.
      // const withServiceTickets = ensureServiceTickets(withGownCollection)
      const withExamGrievances = ensureExamGrievances(withGownCollection)
      const withGenerateResult = ensureGenerateResult(withExamGrievances)
      const withExamCancel = ensureExamCancel(withGenerateResult)
      const withQuestionBankPractical = ensureQuestionBankPractical(withExamCancel)
      const withExamMarkImport = ensureMarkResultsLeaf(withQuestionBankPractical, 'Exam Mark Import', 'upload', '/assessment/exam-mark-import')
      const withHecTranscript = ensureMarkResultsLeaf(withExamMarkImport, 'HEC Graduate Transcript', 'certificate', '/assessment/hec-graduate-transcript')
      const withUeMarkVerify = ensureMarkResultsLeaf(withHecTranscript, 'Mark Verify — UE', 'shield', '/assessment/mark-ue-verify')
      const withEnquiryReport = ensureEnquiryReport(withUeMarkVerify)
      const finalMenu = stripUnintegratedPages(stripLectureMaster(renameIaCreation(withEnquiryReport)))
      return { menu: finalMenu, isFallback: false }
    })
    .catch(() => ({ menu: stripUnintegratedPages(stripLectureMaster(renameIaCreation(mockMenu))), isFallback: true }))
}
