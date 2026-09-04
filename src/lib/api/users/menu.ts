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
const FINANCE_PAYMENT_SECTIONS: MenuNode[] = [
  section('Payment Collection', [
    leaf('Dashboard', 'dashboard', 'dashboard'),
    leaf('Payment Console', 'credit-cards', 'payment-console'),
    leaf('Payment Console Adjustments', 'pencil-alt', 'payment-console-adjustments'),
    leaf('NCHE & Guild Payment', 'graduation', 'nche-guild-payment'),
    leaf('Discount Allocation', 'tag', 'discount-allocation'),
    leaf('Payment History', 'bar-chart', 'payment-history'),
    leaf('Ledger Adjustments', 'lock', 'ledger-adjustments'),
    leaf('Exchange Rates', 'world', 'exchange-rates'),
    leaf('Advanced Payments', 'wallet', 'advanced-payments'),
  ]),
  section('Reports & Statements', [
    leaf('Financial Reports', 'bar-chart', 'financial-reports'),
    leaf('Student Statements', 'files', 'student-statements'),
  ]),
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
    // Re-enabled and renamed from "Intake Transfer" to "Dropout Rejoin",
    // 2026-09-03 — same route (/student/intake-transfer), matching the page's
    // own "Dropout Rejoin" mode tab (its "Deferment / Period Shift" tab was
    // commented out on the page itself the same day, leaving Dropout Rejoin
    // as the page's only mode).
    leaf('Dropout Rejoin', 'calendar', '/student/intake-transfer'),
    leaf('Fee Structure Transfer', 'dollar', '/student/fee-structure-transfer'),
  ]),
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
  section('Settings', [
    leaf('Specialization Management', 'graduation', '/student/specialization'),
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
    leaf('Weight Configuration', 'cog', '/assessment/weight-config'),
    leaf('Assessment Schedule', 'calendar', '/assessment/schedule'),
    leaf('IA Creation', 'graduation', '/assessment/ia-creation'),
  ]),
  section('Coursework (CW)', [
    leaf('CW Overview', 'folder', '/assessment/cw-overview'),
    leaf('Question Bank Upload', 'upload', '/assessment/cw-qbank'),
    leaf('CW Submissions', 'files', '/assessment/cw-submissions'),
    leaf('CW Rectification', 'reload', '/assessment/cw-rectify'),
  ]),
  section('Class Test (CBT)', [
    leaf('CBT Overview', 'folder', '/assessment/cbt-overview'),
    leaf('CBT Question Upload', 'upload', '/assessment/cbt-qupload'),
    leaf('CBT Monitor', 'display', '/assessment/cbt-monitor'),
  ]),
  section('University Exam (UE)', [
    leaf('UE Schedule', 'calendar', '/assessment/ue-schedule'),
    leaf('QP Upload & Vetting', 'upload', '/assessment/qp-vetting'),
    leaf('Hall Ticket Issuance', 'ticket', '/assessment/hall-ticket'),
    leaf('Hall Ticket Print', 'printer', '/assessment/hall-print'),
  ]),
  section('Mark Entry & Results', [
    leaf('Mark Entry — CW', 'pencil-alt', '/assessment/mark-cw'),
    leaf('Mark Entry — CBT', 'pencil-alt', '/assessment/mark-cbt'),
    leaf('Mark Entry — UE', 'pencil-alt', '/assessment/mark-ue'),
    leaf('Result & Moderation', 'bar-chart', '/assessment/moderation'),
  ]),
  section('Resit & Disputes', [
    leaf('Resit Master', 'cogs', '/assessment/resit-configs'),
    leaf('Resit Calendar', 'calendar', '/assessment/resit-calendar'),
    leaf('Resit Seating Allocator', 'users', '/assessment/resit-seating'),
    leaf('CW Reevaluation', 'reload', '/assessment/reeval'),
    leaf('CW Recheck Hub', 'search-alt', '/assessment/recheck'),
  ]),
  section('Reports', [
    leaf('Pending QP Upload', 'folder', '/assessment/rpt-pending-qp'),
    leaf('Faculty Summary', 'users', '/assessment/rpt-faculty'),
  ]),
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
      leaf('Student Statement', 'files', '/student/statement'),
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
]

// TEMPORARY: the real /me/menu response has no Employee module yet (backend
// permission model isn't wired up for it) — Employee Master would otherwise
// vanish from the sidebar entirely. Force it in until the backend starts
// returning a real "Employee" node; this stops applying the moment it does,
// since the merge is skipped once one is present.
const HARDCODED_EMPLOYEE_MODULE: MenuNode = module_('Employee', 'briefcase', [
  section('Employee Records', [
    leaf('Employee Master', 'user', 'employee-master'),
  ]),
])

const HARDCODED_ASSESSMENT_MODULE: MenuNode = module_('Assessment', 'pencil-alt', ASSESSMENT_SECTIONS)

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
  if (financeIdx === -1) return [...menu, module_('Finance', 'dollar', FINANCE_PAYMENT_SECTIONS)]

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
      leaf('Payment Console Adjustments', 'pencil-alt', 'payment-console-adjustments'),
      leaf('NCHE & Guild Payment', 'graduation', 'nche-guild-payment'),
      leaf('Discount Allocation', 'tag', 'discount-allocation'),
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
  if (studentIdx === -1) {
    return [...menu, module_('Student', 'user', [
      section('Student Records', [
        leaf('Student Statement', 'files', '/student/statement'),
      ]),
      ...STUDENT_OPERATIONS_SECTIONS,
    ])]
  }

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
    const orderedRecordsLeaves = recordsSection.children.filter(l => l.name !== 'Batch Summary')
    const existingLeaves = new Set(orderedRecordsLeaves.map(l => l.name))
    const missingLeaves = [
      leaf('Student Statement', 'files', '/student/statement'),
    ].filter(l => !existingLeaves.has(l.name))
    if (orderedRecordsLeaves.length !== recordsSection.children.length || missingLeaves.length > 0) {
      const children = [...studentModule.children]
      children[recordsIdx] = { ...recordsSection, children: [...orderedRecordsLeaves, ...missingLeaves] }
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
  const finalModule = missingSections.length === 0
    ? studentModule
    : { ...studentModule, children: [...studentModule.children, ...missingSections] }

  const merged = [...menu]
  merged[studentIdx] = finalModule
  return merged
}

function mergeConfigSections(menu: MenuNode[]): MenuNode[] {
  const configIdx = menu.findIndex(n => n.name === 'Config')
  if (configIdx === -1) return [...menu, module_('Config', 'cog', CONFIG_SECTIONS)]

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
  const hasIaCreation = structSection.children.some(l => l.name === 'IA Creation')

  if (hasAssMaster && hasExamRules && hasFaqs && hasIaCreation) return menu

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

  // IA Creation — inject after Assessment Schedule if present, otherwise at end
  if (!hasIaCreation) {
    const scheduleIdx = children.findIndex(l => l.name === 'Assessment Schedule')
    if (scheduleIdx !== -1) {
      children.splice(scheduleIdx + 1, 0, leaf('IA Creation', 'graduation', '/assessment/ia-creation'))
    } else {
      children.push(leaf('IA Creation', 'graduation', '/assessment/ia-creation'))
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

export function getMenu(): Promise<MenuResult> {
  if (MOCK_MENU) return Promise.resolve({ menu: mockMenu, isFallback: false })
  return apiGet<MenuNode[] | null>('/api/v1/users/me/menu')
    .then(data => {
      const menu = data ?? []
      const withEmployee = menu.some(n => n.name === 'Employee') ? menu : [...menu, HARDCODED_EMPLOYEE_MODULE]
      const withApprovals = ensureEmployeeApprovals(withEmployee)
      const withAssessment = withApprovals.some(n => n.name === 'Assessment') ? withApprovals : [...withApprovals, HARDCODED_ASSESSMENT_MODULE]
      const withFinance = mergeFinanceSections(withAssessment)
      const withStudent = mergeStudentSections(withFinance)
      const withBulkEdit = ensureBulkIntakeEdit(withStudent)
      const withBatchSummary = ensureBatchSummary(withBulkEdit)
      const withConfig = mergeConfigSections(withBatchSummary)
      const withProgApp = ensureProgrammeApproval(withConfig)
      const withAssMaster = ensureAssessmentMaster(withProgApp)
      const finalMenu = ensureResitMaster(withAssMaster)
      return { menu: finalMenu, isFallback: false }
    })
    .catch(() => ({ menu: mockMenu, isFallback: true }))
}
