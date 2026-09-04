import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface CatalogPermission {
  intPermission: number
  permissionName: string
}

// A "page" is a checkbox group title within a subModule — e.g. subModule
// 'Academic Core' has pages 'Intake Master' and 'Faculty Master', each with
// their own Create/Update/Delete/View permissions.
export interface CatalogPage {
  page: string
  permissions: CatalogPermission[]
}

export interface CatalogSubModule {
  subModule: string
  pages: CatalogPage[]
}

export interface CatalogModule {
  mainModule: string
  subModules: CatalogSubModule[]
}

// FULL frontend-authored permission catalog — every module/section/page in
// the app, one CatalogPage per page audited in docs/PAGE_PERMISSIONS_ACTIONS.md
// (dated 2026-08-24), including that doc's "pages with no sidebar/menu entry
// yet" sections (grouped here under a subModule literally named "No menu
// entry yet" within their owning module). mainModule/subModule/page names
// mirror the real module/section tree in MENU_ROUTES_REFERENCE.md (the 7
// real app modules: Admission, Academic, Finance, Student, Employee, Config,
// Assessment — not the old vague "System" / "Academics" / "Administration"
// 3-bucket scheme).
//
// In mock mode this full catalog is sourced from the frontend. In real mode,
// getPermissionCatalog() uses the backend catalog so the wizard submits only
// permission IDs that the backend recognizes. The frontend catalog still
// documents the complete page/action surface and keeps mock mode useful.
//
// ID CAVEAT: only 11 permission ids below are confirmed against a real
// backend response — reused verbatim here (Super Admin/Campus create+view,
// Faculty create/update/view, Intake view, Course Unit view, Programme
// view, Employee create/view). Every other id (100 and up, assigned
// sequentially in catalog emission order) is a frontend-invented placeholder
// and may not be recognized server-side until the backend's own catalog
// endpoint is complete. This is a known, accepted trade-off, not a bug.
const fullCatalog: CatalogModule[] = [
  {
    mainModule: 'Admission',
    subModules: [
      {
        subModule: 'Enquiry',
        pages: [
          {
            page: 'Online Enquiry',
            permissions: [
              { intPermission: 100, permissionName: 'View Online Enquiry' },
              { intPermission: 101, permissionName: 'Create Online Enquiry' },
            ],
          },
          {
            page: 'Self-Service Kiosk',
            permissions: [
              { intPermission: 102, permissionName: 'View Self-Service Kiosk Enquiry' },
              { intPermission: 103, permissionName: 'Create Kiosk Enquiry' },
            ],
          },
          {
            page: 'On-Desk Enquiry',
            permissions: [
              { intPermission: 104, permissionName: 'View On-Desk Enquiry' },
              { intPermission: 105, permissionName: 'Create On-Desk Enquiry' },
            ],
          },
          {
            page: 'Enquiry List',
            permissions: [
              { intPermission: 106, permissionName: 'View Enquiry' },
              { intPermission: 107, permissionName: 'Create Enquiry' },
              { intPermission: 108, permissionName: 'Update Enquiry' },
              { intPermission: 109, permissionName: 'Convert Enquiry to Application Payment' },
            ],
          },
          {
            page: 'Enquiry Followup Master',
            permissions: [
              { intPermission: 110, permissionName: 'View Enquiry Followup Master' },
              { intPermission: 111, permissionName: 'Create Follow-up' },
              { intPermission: 112, permissionName: 'Update Enquiry Followup' },
              { intPermission: 113, permissionName: 'Convert Enquiry to Application Payment' },
            ],
          },
          {
            page: 'Enquiry Followup',
            permissions: [
              { intPermission: 114, permissionName: 'View Enquiry Followup' },
              { intPermission: 115, permissionName: 'Update Enquiry Followup' },
              { intPermission: 116, permissionName: 'Convert Enquiry to Application Payment' },
            ],
          },
        ],
      },
      {
        subModule: 'Admission Flow',
        pages: [
          {
            page: 'Dashboard',
            permissions: [
              { intPermission: 117, permissionName: 'View Admission Dashboard' },
              { intPermission: 118, permissionName: 'Create Application' },
            ],
          },
          {
            page: 'Application Payment',
            permissions: [
              { intPermission: 119, permissionName: 'View Application Payment' },
              { intPermission: 120, permissionName: 'Import Application Payment' },
              { intPermission: 121, permissionName: 'Create Application Payment' },
              { intPermission: 122, permissionName: 'Print Application Payment Receipt' },
              { intPermission: 123, permissionName: 'Proceed to Application Filing' },
            ],
          },
          {
            page: 'Application Filing',
            permissions: [
              { intPermission: 124, permissionName: 'View Application Filing' },
              { intPermission: 125, permissionName: 'Create Application Filing' },
              { intPermission: 126, permissionName: 'Create Qualification Row' },
              { intPermission: 127, permissionName: 'Delete Qualification Row' },
              { intPermission: 128, permissionName: 'Create Experience Entry' },
              { intPermission: 129, permissionName: 'Upload Application Photo' },
              { intPermission: 130, permissionName: 'Submit Application for Vetting' },
            ],
          },
          {
            page: 'Vetting Desk',
            permissions: [
              { intPermission: 131, permissionName: 'View Vetting Desk' },
              { intPermission: 132, permissionName: 'Review Application' },
              { intPermission: 133, permissionName: 'Mark Application Wait' },
              { intPermission: 134, permissionName: 'Approve Application and Issue Provisional Letter' },
              { intPermission: 135, permissionName: 'Reject Application' },
            ],
          },
          {
            page: "Registrar's Desk",
            permissions: [
              { intPermission: 136, permissionName: "View Registrar's Desk" },
              { intPermission: 137, permissionName: 'Register Applicant' },
            ],
          },
        ],
      },
      {
        subModule: 'Records',
        pages: [
          {
            page: 'All Applicants',
            permissions: [
              { intPermission: 138, permissionName: 'View All Applicants' },
              { intPermission: 139, permissionName: 'Export Applicants' },
              { intPermission: 140, permissionName: "View Applicant in Registrar's Desk" },
            ],
          },
          {
            page: 'Receipts',
            permissions: [],
          },
          {
            page: 'Reports',
            permissions: [],
          },
        ],
      },
      {
        subModule: 'No menu entry yet',
        pages: [
          {
            page: 'Applicant Profile',
            permissions: [
              { intPermission: 141, permissionName: 'View Applicant Profile' },
            ],
          },
          {
            page: 'Enquiry Form',
            permissions: [
              { intPermission: 142, permissionName: 'View Enquiry Form' },
              { intPermission: 143, permissionName: 'Create Enquiry Form' },
            ],
          },
        ],
      },
    ],
  },
  {
    mainModule: 'Academic',
    subModules: [
      {
        subModule: 'Overview',
        pages: [
          {
            page: 'Dashboard',
            permissions: [
              { intPermission: 144, permissionName: 'View Academic Dashboard' },
              { intPermission: 145, permissionName: 'Export Academic Dashboard' },
            ],
          },
        ],
      },
      {
        subModule: 'Academic Core',
        pages: [
          {
            page: 'Intake Master',
            permissions: [
              { intPermission: 46, permissionName: 'View Intake' },
              { intPermission: 146, permissionName: 'Create Intake' },
              { intPermission: 147, permissionName: 'Update Intake' },
              { intPermission: 148, permissionName: 'Delete Intake' },
            ],
          },
          {
            page: 'Bulk Intake Edit',
            permissions: [
              { intPermission: 149, permissionName: 'View Bulk Intake Edit' },
              { intPermission: 150, permissionName: 'Update Bulk Intake Edit' },
              { intPermission: 151, permissionName: 'Reset Bulk Intake Edit' },
            ],
          },
          {
            page: 'Skill Management',
            permissions: [
              { intPermission: 152, permissionName: 'View Skill' },
              { intPermission: 153, permissionName: 'Create Skill' },
              { intPermission: 154, permissionName: 'Update Skill' },
              { intPermission: 155, permissionName: 'Delete Skill' },
              { intPermission: 156, permissionName: 'Proceed to Skill Allocation' },
            ],
          },
          {
            page: 'Batch Management',
            permissions: [
              { intPermission: 157, permissionName: 'View Batch' },
              { intPermission: 158, permissionName: 'Create Batch' },
              { intPermission: 159, permissionName: 'Update Batch' },
              { intPermission: 160, permissionName: 'Delete Batch' },
            ],
          },
          {
            page: 'Room Management',
            permissions: [
              { intPermission: 161, permissionName: 'View Room' },
              { intPermission: 162, permissionName: 'Create Room' },
              { intPermission: 163, permissionName: 'Update Room' },
              { intPermission: 164, permissionName: 'Delete Room' },
            ],
          },
          {
            page: 'Session Movement',
            permissions: [
              { intPermission: 165, permissionName: 'View Session Movement' },
              { intPermission: 166, permissionName: 'Preview Session Movement Results' },
              { intPermission: 167, permissionName: 'Download Session Movement Preview CSV' },
              { intPermission: 168, permissionName: 'Cancel Session Movement' },
              { intPermission: 169, permissionName: 'Confirm and Execute Session Movement' },
            ],
          },
        ],
      },
      {
        subModule: 'Course Unit Master',
        pages: [
          {
            page: 'Repetition Tag',
            permissions: [
              { intPermission: 170, permissionName: 'View Repetition Tag' },
              { intPermission: 171, permissionName: 'Create Repetition Tag' },
              { intPermission: 172, permissionName: 'Update Repetition Tag' },
              { intPermission: 173, permissionName: 'Delete Repetition Tag' },
            ],
          },
          {
            page: 'Course Units',
            permissions: [
              { intPermission: 34, permissionName: 'View Course Unit' },
              { intPermission: 174, permissionName: 'Create Course Unit' },
              { intPermission: 175, permissionName: 'Update Course Unit' },
              { intPermission: 176, permissionName: 'Delete Course Unit' },
              { intPermission: 177, permissionName: 'Export Course Unit' },
            ],
          },
        ],
      },
      {
        subModule: 'Programme Master',
        pages: [
          {
            page: 'Programme Level',
            permissions: [
              { intPermission: 178, permissionName: 'View Programme Level' },
              { intPermission: 179, permissionName: 'Create Programme Level' },
              { intPermission: 180, permissionName: 'Update Programme Level' },
              { intPermission: 181, permissionName: 'Delete Programme Level' },
            ],
          },
          {
            page: 'Programme Group',
            permissions: [
              { intPermission: 182, permissionName: 'View Programme Group' },
              { intPermission: 183, permissionName: 'Create Programme Group' },
              { intPermission: 184, permissionName: 'Update Programme Group' },
              { intPermission: 185, permissionName: 'Delete Programme Group' },
              { intPermission: 186, permissionName: 'Export Programme Group' },
            ],
          },
          {
            page: 'Programme Master',
            permissions: [
              { intPermission: 50, permissionName: 'View Programme' },
              { intPermission: 187, permissionName: 'Create Programme' },
              { intPermission: 188, permissionName: 'Update Programme' },
              { intPermission: 189, permissionName: 'Delete Programme' },
              { intPermission: 190, permissionName: 'Export Programme' },
            ],
          },
          {
            page: 'Programme Approval',
            permissions: [
              { intPermission: 191, permissionName: 'View Programme Approval' },
              { intPermission: 192, permissionName: 'Approve Programme' },
              { intPermission: 193, permissionName: 'Delete Programme Approval' },
            ],
          },
          {
            page: 'Fee Structure',
            permissions: [
              { intPermission: 194, permissionName: 'View Fee Structure' },
              { intPermission: 195, permissionName: 'Create Fee Structure' },
              { intPermission: 196, permissionName: 'Update Fee Structure' },
              { intPermission: 197, permissionName: 'Delete Fee Structure' },
              { intPermission: 198, permissionName: 'Duplicate Fee Structure' },
            ],
          },
        ],
      },
      {
        subModule: 'Timetable',
        pages: [
          {
            page: 'Timetable',
            permissions: [
              { intPermission: 199, permissionName: 'View Timetable' },
              { intPermission: 200, permissionName: 'Manage Timetable Rooms' },
              { intPermission: 201, permissionName: 'Import Timetable Excel' },
              { intPermission: 202, permissionName: 'Create Timetable Slot' },
              { intPermission: 203, permissionName: 'Update Timetable Slot' },
              { intPermission: 204, permissionName: 'Publish Timetable to Students' },
              { intPermission: 205, permissionName: 'Publish Timetable to Faculty' },
            ],
          },
        ],
      },
      {
        subModule: 'ODL Applications',
        pages: [
          {
            page: 'ODL Applications',
            permissions: [
              { intPermission: 206, permissionName: 'View ODL Applications' },
              { intPermission: 207, permissionName: 'Create ODL Application' },
              { intPermission: 208, permissionName: 'Proceed to ODL Payment' },
              { intPermission: 209, permissionName: 'Reconcile ODL Application' },
              { intPermission: 210, permissionName: 'View ODL Application Detail' },
              { intPermission: 211, permissionName: 'Export ODL Applications' },
            ],
          },
          {
            page: 'Payment Reconciliation',
            permissions: [
              { intPermission: 212, permissionName: 'View Payment Reconciliation' },
              { intPermission: 213, permissionName: 'Verify Reconciliation Token' },
              { intPermission: 214, permissionName: 'Reject Reconciliation' },
              { intPermission: 215, permissionName: 'Confirm Reconciliation' },
            ],
          },
        ],
      },
      {
        subModule: 'Cross-Module',
        pages: [
          {
            page: 'Student Lookup',
            permissions: [
              { intPermission: 216, permissionName: 'View Student Lookup' },
              { intPermission: 217, permissionName: 'Update Student Lookup' },
            ],
          },
        ],
      },
      {
        subModule: 'No menu entry yet',
        pages: [
          {
            page: 'Allocation',
            permissions: [
              { intPermission: 218, permissionName: 'View Allocation' },
              { intPermission: 219, permissionName: 'Create Allocation' },
              { intPermission: 220, permissionName: 'Import Allocation from Excel' },
              { intPermission: 221, permissionName: 'Update Allocation' },
            ],
          },
          {
            page: 'Academic Access Gate',
            permissions: [
              { intPermission: 222, permissionName: 'View Academic Access Gate' },
            ],
          },
          {
            page: 'Class Test (legacy)',
            permissions: [
              { intPermission: 223, permissionName: 'View Class Test (Legacy)' },
              { intPermission: 224, permissionName: 'Schedule Class Test' },
              { intPermission: 225, permissionName: 'View Class Test Marks' },
              { intPermission: 226, permissionName: 'Manage Class Test' },
            ],
          },
          {
            page: 'Coursework (legacy)',
            permissions: [
              { intPermission: 227, permissionName: 'View Coursework (Legacy)' },
              { intPermission: 228, permissionName: 'Schedule Coursework' },
              { intPermission: 229, permissionName: 'View Coursework Marks' },
              { intPermission: 230, permissionName: 'Manage Coursework' },
            ],
          },
          {
            page: 'Fee Clearance',
            permissions: [
              { intPermission: 231, permissionName: 'View Fee Clearance' },
              { intPermission: 232, permissionName: 'Check Fee Clearance' },
            ],
          },
          {
            page: 'Grievance Management',
            permissions: [
              { intPermission: 233, permissionName: 'View Grievance Management' },
            ],
          },
          {
            page: 'Qualification Equating',
            permissions: [
              { intPermission: 234, permissionName: 'View Qualification Equating' },
              { intPermission: 235, permissionName: 'Create Qualification Equating Request' },
              { intPermission: 236, permissionName: 'View Qualification Equating Detail' },
              { intPermission: 237, permissionName: 'Follow Up Qualification Equating' },
            ],
          },
          {
            page: 'Results',
            permissions: [
              { intPermission: 238, permissionName: 'View Results' },
            ],
          },
          {
            page: 'University Exam (legacy)',
            permissions: [
              { intPermission: 239, permissionName: 'View University Exam (Legacy)' },
              { intPermission: 240, permissionName: 'Upload UE Question Paper' },
              { intPermission: 241, permissionName: 'Vet UE Question Paper' },
              { intPermission: 242, permissionName: 'View UE Question Paper' },
            ],
          },
          {
            page: 'ODeL Student Preview',
            permissions: [
              { intPermission: 243, permissionName: 'View ODeL Student Preview' },
              { intPermission: 244, permissionName: 'Create ODeL Student Application' },
              { intPermission: 245, permissionName: 'Proceed to ODeL Payment' },
            ],
          },
        ],
      },
    ],
  },
  {
    mainModule: 'Finance',
    subModules: [
      {
        subModule: 'Payment Collection',
        pages: [
          {
            page: 'Dashboard',
            permissions: [
              { intPermission: 246, permissionName: 'View Finance Dashboard' },
              { intPermission: 247, permissionName: 'Collect Payment' },
              { intPermission: 248, permissionName: 'View All Payments' },
            ],
          },
          {
            page: 'Payment Console',
            permissions: [
              { intPermission: 249, permissionName: 'View Payment Console' },
              { intPermission: 250, permissionName: 'Search Student for Payment' },
              { intPermission: 251, permissionName: 'Save Payment' },
              { intPermission: 252, permissionName: 'Clear Payment Console' },
              { intPermission: 253, permissionName: 'Print Payment Receipt' },
              { intPermission: 254, permissionName: 'Create New Payment' },
            ],
          },
          {
            page: 'Payment History',
            permissions: [
              { intPermission: 255, permissionName: 'View Payment History' },
              { intPermission: 256, permissionName: 'Open Payment Receipt' },
            ],
          },
          {
            page: 'Ledger Adjustments',
            permissions: [
              { intPermission: 257, permissionName: 'View Ledger Adjustments' },
              { intPermission: 258, permissionName: 'Load Ledger' },
              { intPermission: 259, permissionName: 'Adjust Ledger Line' },
            ],
          },
          {
            page: 'Exchange Rates',
            permissions: [
              { intPermission: 260, permissionName: 'View Exchange Rates' },
              { intPermission: 261, permissionName: 'Save All Exchange Rates' },
              { intPermission: 262, permissionName: 'Save Exchange Rate' },
            ],
          },
          {
            page: 'Advanced Payments',
            permissions: [
              { intPermission: 263, permissionName: 'View Advanced Payments' },
              { intPermission: 264, permissionName: 'Create Advanced Payment Deposit' },
            ],
          },
        ],
      },
      {
        subModule: 'Reports & Statements',
        pages: [
          {
            page: 'Financial Reports',
            permissions: [
              { intPermission: 265, permissionName: 'View Financial Reports' },
              { intPermission: 266, permissionName: 'Export Financial Report' },
            ],
          },
          {
            page: 'Student Statements',
            permissions: [
              { intPermission: 267, permissionName: 'View Student Statements' },
              { intPermission: 268, permissionName: 'Generate Student Statement' },
              { intPermission: 269, permissionName: 'Print Student Statement' },
              { intPermission: 270, permissionName: 'Email Student Statement' },
            ],
          },
        ],
      },
      {
        subModule: 'Finance Core',
        pages: [
          {
            page: 'Cooperates',
            permissions: [
              { intPermission: 271, permissionName: 'View Cooperate' },
              { intPermission: 272, permissionName: 'Create Cooperate' },
              { intPermission: 273, permissionName: 'Update Cooperate' },
              { intPermission: 274, permissionName: 'Delete Cooperate' },
            ],
          },
          {
            page: 'Discounts',
            permissions: [
              { intPermission: 275, permissionName: 'View Discount' },
              { intPermission: 276, permissionName: 'Create Discount' },
              { intPermission: 277, permissionName: 'Update Discount' },
              { intPermission: 278, permissionName: 'Delete Discount' },
            ],
          },
          {
            page: 'Ledgers',
            permissions: [
              { intPermission: 279, permissionName: 'View Ledger' },
              { intPermission: 280, permissionName: 'Create Ledger' },
              { intPermission: 281, permissionName: 'Update Ledger' },
              { intPermission: 282, permissionName: 'Delete Ledger' },
            ],
          },
          {
            page: 'Currency Master',
            permissions: [
              { intPermission: 283, permissionName: 'View Currency' },
              { intPermission: 284, permissionName: 'Create Currency' },
              { intPermission: 285, permissionName: 'Update Currency' },
              { intPermission: 286, permissionName: 'Delete Currency' },
            ],
          },
          {
            page: 'Receipt Books',
            permissions: [
              { intPermission: 287, permissionName: 'View Receipt Book' },
              { intPermission: 288, permissionName: 'Create Receipt Book' },
              { intPermission: 289, permissionName: 'Update Receipt Book' },
              { intPermission: 290, permissionName: 'Delete Receipt Book' },
            ],
          },
          {
            page: 'General Settings',
            permissions: [
              { intPermission: 291, permissionName: 'View General Setting' },
              { intPermission: 292, permissionName: 'Create General Setting' },
              { intPermission: 293, permissionName: 'Update General Setting' },
              { intPermission: 294, permissionName: 'Delete General Setting' },
            ],
          },
        ],
      },
      {
        subModule: 'Banking',
        pages: [
          {
            page: 'Banks',
            permissions: [
              { intPermission: 295, permissionName: 'View Bank' },
              { intPermission: 296, permissionName: 'Create Bank' },
              { intPermission: 297, permissionName: 'Update Bank' },
              { intPermission: 298, permissionName: 'Delete Bank' },
            ],
          },
          {
            page: 'Bank Branches',
            permissions: [
              { intPermission: 299, permissionName: 'View Bank Branch' },
              { intPermission: 300, permissionName: 'Create Bank Branch' },
              { intPermission: 301, permissionName: 'Update Bank Branch' },
              { intPermission: 302, permissionName: 'Delete Bank Branch' },
            ],
          },
          {
            page: 'Proc Banks',
            permissions: [
              { intPermission: 303, permissionName: 'View Proc Bank' },
              { intPermission: 304, permissionName: 'Create Proc Bank' },
              { intPermission: 305, permissionName: 'Update Proc Bank' },
              { intPermission: 306, permissionName: 'Delete Proc Bank' },
            ],
          },
          {
            page: 'Proc GL Accounts',
            permissions: [
              { intPermission: 307, permissionName: 'View Proc GL Account' },
              { intPermission: 308, permissionName: 'Create Proc GL Account' },
              { intPermission: 309, permissionName: 'Update Proc GL Account' },
              { intPermission: 310, permissionName: 'Delete Proc GL Account' },
            ],
          },
        ],
      },
    ],
  },
  {
    mainModule: 'Student',
    subModules: [
      {
        subModule: 'Student Records',
        pages: [
          {
            page: 'Student Master',
            permissions: [
              { intPermission: 311, permissionName: 'View Student' },
              { intPermission: 312, permissionName: 'View Student Detail' },
            ],
          },
          {
            page: 'Batch Summary',
            permissions: [
              { intPermission: 313, permissionName: 'View Batch Summary' },
              { intPermission: 314, permissionName: 'Export Batch Summary' },
            ],
          },
          {
            page: 'Student Statement',
            permissions: [
              { intPermission: 315, permissionName: 'View Student Statement' },
              { intPermission: 316, permissionName: 'Load Student Statement' },
              { intPermission: 317, permissionName: 'Print Student Statement' },
              { intPermission: 318, permissionName: 'Download Student Statement PDF' },
            ],
          },
        ],
      },
      {
        subModule: 'Operations',
        pages: [
          {
            page: 'Student Profile',
            permissions: [
              { intPermission: 319, permissionName: 'View Student Profile' },
              { intPermission: 320, permissionName: 'Save Student Profile' },
              { intPermission: 321, permissionName: 'Discard Student Profile Changes' },
              { intPermission: 322, permissionName: 'Sync Student ID Card' },
              { intPermission: 323, permissionName: 'Send Student Credentials via Email' },
              { intPermission: 324, permissionName: 'Send Student Credentials via WhatsApp' },
              { intPermission: 325, permissionName: 'Send Parent Credentials via Email' },
              { intPermission: 326, permissionName: 'Send Parent Credentials via WhatsApp' },
              { intPermission: 327, permissionName: 'Save Student Contact Info' },
            ],
          },
          {
            page: 'Batch Transfer',
            permissions: [
              { intPermission: 328, permissionName: 'View Batch Transfer' },
              { intPermission: 329, permissionName: 'Execute Batch Transfer' },
              { intPermission: 330, permissionName: 'Confirm Batch Transfer' },
            ],
          },
          {
            page: 'Programme Transfer',
            permissions: [
              { intPermission: 331, permissionName: 'View Programme Transfer' },
              { intPermission: 332, permissionName: 'Execute Programme Transfer' },
              { intPermission: 333, permissionName: 'Confirm Programme Transfer' },
            ],
          },
          {
            page: 'Learning Mode',
            permissions: [
              { intPermission: 334, permissionName: 'View Learning Mode' },
              { intPermission: 335, permissionName: 'Apply Learning Mode Change' },
            ],
          },
          {
            page: 'Intake Transfer',
            permissions: [
              { intPermission: 336, permissionName: 'View Intake Transfer' },
              { intPermission: 337, permissionName: 'Execute Intake Transfer' },
              { intPermission: 338, permissionName: 'Confirm Intake Transfer' },
            ],
          },
        ],
      },
      {
        subModule: 'Services',
        pages: [
          {
            page: 'Student Services',
            permissions: [
              { intPermission: 339, permissionName: 'View Student Services' },
              { intPermission: 340, permissionName: 'View Student Ticket' },
              { intPermission: 341, permissionName: 'Send Student Service Response' },
            ],
          },
        ],
      },
      {
        subModule: 'Communications',
        pages: [
          {
            page: 'Send Communication',
            permissions: [
              { intPermission: 342, permissionName: 'View Send Communication' },
              { intPermission: 343, permissionName: 'Preview Communication' },
              { intPermission: 344, permissionName: 'Send Communication to Students' },
            ],
          },
        ],
      },
      {
        subModule: 'Settings',
        pages: [
          {
            page: 'Category Masters',
            permissions: [
              { intPermission: 345, permissionName: 'View Category Master' },
              { intPermission: 346, permissionName: 'Create Service Category' },
              { intPermission: 347, permissionName: 'Update Service Category' },
              { intPermission: 348, permissionName: 'Delete Service Category' },
              { intPermission: 349, permissionName: 'Create Student Category' },
              { intPermission: 350, permissionName: 'Update Student Category' },
              { intPermission: 351, permissionName: 'Delete Student Category' },
            ],
          },
          {
            page: 'Specialization Management',
            permissions: [
              { intPermission: 352, permissionName: 'View Specialization' },
              { intPermission: 353, permissionName: 'Create Specialization' },
              { intPermission: 354, permissionName: 'Update Specialization' },
              { intPermission: 355, permissionName: 'Create Specialization Discount' },
              { intPermission: 356, permissionName: 'Update Specialization Discount' },
            ],
          },
        ],
      },
    ],
  },
  {
    mainModule: 'Employee',
    subModules: [
      {
        subModule: 'Employee Records',
        pages: [
          {
            page: 'Employee Master',
            permissions: [
              { intPermission: 4, permissionName: 'View Employee' },
              { intPermission: 1, permissionName: 'Create Employee' },
              { intPermission: 357, permissionName: 'Update Employee' },
              { intPermission: 358, permissionName: 'Assign Employee Permissions' },
            ],
          },
        ],
      },
    ],
  },
  {
    mainModule: 'Config',
    subModules: [
      {
        subModule: 'Organization',
        pages: [
          {
            page: 'Faculty Master',
            permissions: [
              { intPermission: 42, permissionName: 'View Faculty' },
              { intPermission: 39, permissionName: 'Create Faculty' },
              { intPermission: 41, permissionName: 'Update Faculty' },
              { intPermission: 359, permissionName: 'Delete Faculty' },
            ],
          },
          {
            page: 'Department Master',
            permissions: [
              { intPermission: 360, permissionName: 'View Department' },
              { intPermission: 361, permissionName: 'Create Department' },
              { intPermission: 362, permissionName: 'Update Department' },
              { intPermission: 363, permissionName: 'Delete Department' },
            ],
          },
          {
            page: 'Designation Master',
            permissions: [
              { intPermission: 364, permissionName: 'View Designation' },
              { intPermission: 365, permissionName: 'Create Designation' },
              { intPermission: 366, permissionName: 'Update Designation' },
              { intPermission: 367, permissionName: 'Delete Designation' },
            ],
          },
          {
            page: 'Campus Master',
            permissions: [
              { intPermission: 30, permissionName: 'View Campus' },
              { intPermission: 27, permissionName: 'Create Campus' },
              { intPermission: 368, permissionName: 'Update Campus' },
              { intPermission: 369, permissionName: 'Delete Campus' },
              { intPermission: 25, permissionName: 'Super Admin - All Permissions' },
            ],
          },
          {
            page: 'Country Master',
            permissions: [
              { intPermission: 370, permissionName: 'View Country' },
              { intPermission: 371, permissionName: 'Create Country' },
              { intPermission: 372, permissionName: 'Update Country' },
              { intPermission: 373, permissionName: 'Delete Country' },
            ],
          },
        ],
      },
      {
        subModule: 'Academic Setup',
        pages: [
          {
            page: 'Specialization',
            permissions: [
              { intPermission: 374, permissionName: 'View Specialization' },
              { intPermission: 375, permissionName: 'Create Specialization' },
              { intPermission: 376, permissionName: 'Update Specialization' },
              { intPermission: 377, permissionName: 'Delete Specialization' },
            ],
          },
          {
            page: 'Skill Master',
            permissions: [
              { intPermission: 378, permissionName: 'View Skill' },
              { intPermission: 379, permissionName: 'Create Skill' },
              { intPermission: 380, permissionName: 'Update Skill' },
              { intPermission: 381, permissionName: 'Delete Skill' },
            ],
          },
          {
            page: 'Unit Type Master',
            permissions: [
              { intPermission: 382, permissionName: 'View Unit Type' },
              { intPermission: 383, permissionName: 'Create Unit Type' },
              { intPermission: 384, permissionName: 'Update Unit Type' },
              { intPermission: 385, permissionName: 'Delete Unit Type' },
            ],
          },
          {
            page: 'Unit Category Master',
            permissions: [
              { intPermission: 386, permissionName: 'View Unit Category' },
              { intPermission: 387, permissionName: 'Create Unit Category' },
              { intPermission: 388, permissionName: 'Update Unit Category' },
              { intPermission: 389, permissionName: 'Delete Unit Category' },
            ],
          },
          {
            page: 'Weekdays',
            permissions: [
              { intPermission: 390, permissionName: 'View Weekday' },
              { intPermission: 391, permissionName: 'Create Weekday' },
              { intPermission: 392, permissionName: 'Update Weekday' },
              { intPermission: 393, permissionName: 'Delete Weekday' },
            ],
          },
          {
            page: 'Batch Times',
            permissions: [
              { intPermission: 394, permissionName: 'View Batch Time' },
              { intPermission: 395, permissionName: 'Create Batch Time' },
              { intPermission: 396, permissionName: 'Update Batch Time' },
              { intPermission: 397, permissionName: 'Delete Batch Time' },
            ],
          },
        ],
      },
      {
        subModule: 'Admissions',
        pages: [
          {
            page: 'Enquiry Status',
            permissions: [
              { intPermission: 398, permissionName: 'View Enquiry Status' },
              { intPermission: 399, permissionName: 'Create Enquiry Status' },
              { intPermission: 400, permissionName: 'Update Enquiry Status' },
              { intPermission: 401, permissionName: 'Delete Enquiry Status' },
            ],
          },
          {
            page: 'Isbat Enquiry Source',
            permissions: [
              { intPermission: 402, permissionName: 'View Isbat Enquiry Source' },
              { intPermission: 403, permissionName: 'Create Isbat Enquiry Source' },
              { intPermission: 404, permissionName: 'Update Isbat Enquiry Source' },
              { intPermission: 405, permissionName: 'Delete Isbat Enquiry Source' },
            ],
          },
          {
            page: 'Enquiry Source',
            permissions: [
              { intPermission: 406, permissionName: 'View Enquiry Source' },
              { intPermission: 407, permissionName: 'Create Enquiry Source' },
              { intPermission: 408, permissionName: 'Update Enquiry Source' },
              { intPermission: 409, permissionName: 'Delete Enquiry Source' },
            ],
          },
          {
            page: 'Followup Status',
            permissions: [
              { intPermission: 410, permissionName: 'View Followup Status' },
              { intPermission: 411, permissionName: 'Create Followup Status' },
              { intPermission: 412, permissionName: 'Update Followup Status' },
              { intPermission: 413, permissionName: 'Delete Followup Status' },
            ],
          },
          {
            page: 'Followup Mode',
            permissions: [
              { intPermission: 414, permissionName: 'View Followup Mode' },
              { intPermission: 415, permissionName: 'Create Followup Mode' },
              { intPermission: 416, permissionName: 'Update Followup Mode' },
              { intPermission: 417, permissionName: 'Delete Followup Mode' },
            ],
          },
          {
            page: 'Interest Level',
            permissions: [
              { intPermission: 418, permissionName: 'View Interest Level' },
              { intPermission: 419, permissionName: 'Create Interest Level' },
              { intPermission: 420, permissionName: 'Update Interest Level' },
              { intPermission: 421, permissionName: 'Delete Interest Level' },
            ],
          },
        ],
      },
      {
        subModule: 'Access Control',
        pages: [
          {
            page: 'Permission Master',
            permissions: [
              { intPermission: 422, permissionName: 'View Permission Group' },
              { intPermission: 423, permissionName: 'Create Permission Group' },
              { intPermission: 424, permissionName: 'Update Permission Group' },
            ],
          },
        ],
      },
    ],
  },
  {
    mainModule: 'Assessment',
    subModules: [
      {
        subModule: 'Overview',
        pages: [
          {
            page: 'Assessment Dashboard',
            permissions: [
              { intPermission: 425, permissionName: 'View Assessment Dashboard' },
              { intPermission: 426, permissionName: 'Export Assessment Summary' },
            ],
          },
        ],
      },
      {
        subModule: 'Assessment Structure',
        pages: [
          {
            page: 'Weight Configuration',
            permissions: [
              { intPermission: 427, permissionName: 'View Weight Configuration' },
              { intPermission: 428, permissionName: 'Export Weight Configuration' },
            ],
          },
          {
            page: 'Assessment Schedule',
            permissions: [
              { intPermission: 429, permissionName: 'View Assessment Schedule' },
              { intPermission: 430, permissionName: 'Create Assessment Schedule' },
              { intPermission: 431, permissionName: 'Update Assessment Schedule' },
              { intPermission: 432, permissionName: 'Delete Assessment Schedule' },
            ],
          },
        ],
      },
      {
        subModule: 'Coursework (CW)',
        pages: [
          {
            page: 'CW Overview',
            permissions: [
              { intPermission: 433, permissionName: 'View CW Overview' },
              { intPermission: 434, permissionName: 'Schedule Coursework' },
              { intPermission: 435, permissionName: 'View Coursework Details' },
            ],
          },
          {
            page: 'Question Bank Upload',
            permissions: [
              { intPermission: 436, permissionName: 'View Question Bank Upload' },
              { intPermission: 437, permissionName: 'Download Question Bank Template' },
              { intPermission: 438, permissionName: 'Import Coursework Questions' },
            ],
          },
          {
            page: 'CW Submissions',
            permissions: [
              { intPermission: 439, permissionName: 'View CW Submissions' },
              { intPermission: 440, permissionName: 'Save CW Mark Entry' },
            ],
          },
          {
            page: 'CW Rectification',
            permissions: [
              { intPermission: 441, permissionName: 'View CW Rectification' },
            ],
          },
        ],
      },
      {
        subModule: 'Class Test (CBT)',
        pages: [
          {
            page: 'CBT Overview',
            permissions: [
              { intPermission: 442, permissionName: 'View CBT Overview' },
              { intPermission: 443, permissionName: 'Schedule CBT' },
              { intPermission: 444, permissionName: 'View CBT Details' },
            ],
          },
          {
            page: 'CBT Schedule',
            permissions: [
              { intPermission: 445, permissionName: 'View CBT Schedule' },
              { intPermission: 446, permissionName: 'Schedule CBT' },
            ],
          },
          {
            page: 'CBT Question Upload',
            permissions: [
              { intPermission: 447, permissionName: 'View CBT Question Upload' },
              { intPermission: 448, permissionName: 'Import CBT Questions' },
            ],
          },
          {
            page: 'CBT Monitor',
            permissions: [
              { intPermission: 449, permissionName: 'View CBT Monitor' },
              { intPermission: 450, permissionName: 'View CBT Monitor Details' },
            ],
          },
        ],
      },
      {
        subModule: 'University Exam (UE)',
        pages: [
          {
            page: 'UE Schedule',
            permissions: [
              { intPermission: 451, permissionName: 'View UE Schedule' },
              { intPermission: 452, permissionName: 'Create UE Slot' },
              { intPermission: 453, permissionName: 'Update UE Slot' },
            ],
          },
          {
            page: 'QP Upload & Vetting',
            permissions: [
              { intPermission: 454, permissionName: 'View QP Upload & Vetting' },
              { intPermission: 455, permissionName: 'Submit QP to Vetting Queue' },
              { intPermission: 456, permissionName: 'View QP Vetting Queue Row' },
            ],
          },
          {
            page: 'Hall Ticket Issuance',
            permissions: [
              { intPermission: 457, permissionName: 'View Hall Ticket Issuance' },
              { intPermission: 458, permissionName: 'Issue Hall Ticket' },
            ],
          },
          {
            page: 'Hall Ticket Print',
            permissions: [
              { intPermission: 459, permissionName: 'View Hall Ticket Print' },
              { intPermission: 460, permissionName: 'Print All Ready Hall Tickets' },
              { intPermission: 461, permissionName: 'Preview and Print Hall Ticket' },
            ],
          },
        ],
      },
      {
        subModule: 'Mark Entry & Results',
        pages: [
          {
            page: 'Mark Entry — CW',
            permissions: [
              { intPermission: 462, permissionName: 'View Mark Entry CW' },
              { intPermission: 463, permissionName: 'Save All CW Marks' },
            ],
          },
          {
            page: 'Mark Entry — CBT',
            permissions: [
              { intPermission: 464, permissionName: 'View Mark Entry CBT' },
              { intPermission: 465, permissionName: 'View CBT Mark Log' },
              { intPermission: 466, permissionName: 'Override CBT Mark' },
            ],
          },
          {
            page: 'Mark Entry — UE',
            permissions: [
              { intPermission: 467, permissionName: 'View Mark Entry UE' },
              { intPermission: 468, permissionName: 'Save All UE Marks' },
              { intPermission: 469, permissionName: 'View UE Mark Row' },
            ],
          },
          {
            page: 'Result & Moderation',
            permissions: [
              { intPermission: 470, permissionName: 'View Result and Moderation' },
              { intPermission: 471, permissionName: 'Publish Results' },
              { intPermission: 472, permissionName: 'View Result Row' },
            ],
          },
        ],
      },
      {
        subModule: 'Resit & Disputes',
        pages: [
          {
            page: 'Resit Calendar',
            permissions: [
              { intPermission: 473, permissionName: 'View Resit Calendar' },
              { intPermission: 474, permissionName: 'Open Resit Window' },
              { intPermission: 475, permissionName: 'View Resit Window' },
            ],
          },
          {
            page: 'Resit Seating Allocator',
            permissions: [
              { intPermission: 476, permissionName: 'View Resit Seating Allocator' },
              { intPermission: 477, permissionName: 'Publish Resit Seating Plan' },
            ],
          },
          {
            page: 'CW Reevaluation',
            permissions: [
              { intPermission: 478, permissionName: 'View CW Reevaluation' },
              { intPermission: 479, permissionName: 'View Reevaluation Log' },
              { intPermission: 480, permissionName: 'Escalate Reevaluation to Dean' },
            ],
          },
          {
            page: 'CW Recheck Hub',
            permissions: [
              { intPermission: 481, permissionName: 'View CW Recheck Hub' },
              { intPermission: 482, permissionName: 'Assign Recheck Auditor' },
              { intPermission: 483, permissionName: 'Confirm and Dispatch Recheck' },
            ],
          },
        ],
      },
      {
        subModule: 'Reports',
        pages: [
          {
            page: 'Pending QP Upload',
            permissions: [
              { intPermission: 484, permissionName: 'View Pending QP Upload' },
              { intPermission: 485, permissionName: 'Send Bulk QP Reminder' },
              { intPermission: 486, permissionName: 'Export Pending QP Upload' },
              { intPermission: 487, permissionName: 'View Faculty Profile' },
            ],
          },
          {
            page: 'Faculty Summary',
            permissions: [
              { intPermission: 488, permissionName: 'View Faculty Summary' },
              { intPermission: 489, permissionName: 'Export Faculty Summary Report' },
              { intPermission: 490, permissionName: 'View Faculty Summary Details' },
              { intPermission: 491, permissionName: 'Send Faculty Summary Reminder' },
            ],
          },
        ],
      },
    ],
  },
]

export function getPermissionCatalog(): Promise<CatalogModule[]> {
  if (MOCK_AUTH) return Promise.resolve(fullCatalog)
  return apiGet<CatalogModule[] | null>('/api/v1/users/admin/permission-groups/permissions').then(data => data ?? [])
}
