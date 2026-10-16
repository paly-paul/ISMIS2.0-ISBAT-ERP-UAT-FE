# Menu Routes, Icons & Page Events — for Backend (Menu API)

Reference for the permission-driven sidebar menu API, `GET /api/v1/users/me/menu`.
Each node has the shape `{ name, icon, url, permissions, children }`.

**Last updated: 2026-10-15.** The tree below is generated from the live frontend menu
(`mockMenu` in `src/lib/api/users/menu.ts`), so it lists every page that is in the
sidebar today. The events on each page come from reading the buttons and actions in
that page's code.

## Node shapes

- **Module / section** (has children): `icon` is the module's rail icon for modules
  and `null` for sections. `url` and `permissions` are `null`.
- **Page** (leaf, `children: []`): `icon`, `url` and a `permissions` bag.
  A page with `url: null` is a visible nav entry with no page behind it yet, and its
  bag is `{}`.

## Icon format

Icon library: **[LineIcons 4.0](https://lineicons.com/icons)**, loaded from a CDN in
`src/app/layout.tsx`. The `icon` value is the **full class string**
(`lni lni-calendar`). Copy it as-is.

## `url` format

Full path from the app root (`/config/faculty-master`). The frontend also accepts a
bare slug (`payment-console`), which it resolves against the module name
(`/finance/payment-console`). Finance's Payment Collection and Reports & Statements
pages are bare slugs in the frontend fallback today. Full paths are preferred.

## `permissions` — page events

Every key is lowercase and `true` when the user may do that event. Leave a key out (or
send `false`) to deny it. `get` means the user can open the page and see its list and
details. Every page with a URL has `get`.

| Key | Event |
|---|---|
| `get` | Open the page and view its list and details |
| `add` | Create a new record |
| `edit` | Change an existing record |
| `delete` | Delete or remove a record |
| `approve` | Approve or confirm a request |
| `reject` | Reject a request |
| `hold` | Put a request on hold |
| `cancel` | Cancel something already in effect (a discount, an exam attempt) |
| `assign` | Assign something to a person (counsellor, permissions, specialization) |
| `verify` | Verify (an email, an exam) |
| `submit` | Submit work forward for review or approval |
| `send` | Send a message or credentials |
| `execute` | Run a one-way operation (transfer, session movement, termination) |
| `register` | Register an applicant as a student |
| `import` | Upload or import data from a file |
| `export` | Export or download a report or list |
| `print` | Print a document |
| `download` | Download a template or document |
| `generate` | Generate a document or result |
| `publish` | Publish or push results and marks |

Student Master also uses its own per-row flags: `view`, `learningMode`, `refugee` and
`sponsor`. The page already reads these keys, so they keep their existing names.

### Frontend checks today: please read before changing keys

Each module table has a **Frontend checks today** column listing the keys that page's
code actually reads right now. Most pages read the same keys as their events. On
**18 pages** the code still gates an event on an older generic key. For example,
Learning Mode Approval's Approve button checks `edit`, not `approve`.

On those pages, **send both the event keys and the keys in "Frontend checks today"**
until the frontend is switched to the new keys. Otherwise the button disappears. A
page whose column says `none` doesn't hide any buttons by permission yet. It is open
to everyone who has the page.

The pages that need this are:

| Page | URL | Frontend checks | Events |
|---|---|---|---|
| Programme Approval | `/academic/programme-approval` | `edit` `delete` | `approve` `delete` |
| Payment Reconciliation | `/academic/odl-reconciliation` | `edit` `delete` | `approve` `reject` |
| Discount Allocation | `/finance/discount-allocation` | `add` `edit` `delete` | `add` `edit` `cancel` |
| Advanced Payments | `/finance/advanced-payments` | `create` | `add` |
| Student Master | `/student/student-master` | also `get`, `edit` as fallbacks | `view` `learningMode` `refugee` `sponsor` |
| Batch Transfer | `/student/batch-transfer` | `edit` | `execute` |
| Programme Transfer | `/student/prog-transfer` | `edit` | `execute` |
| Learning Mode | `/student/learning-mode` | `edit` | `submit` |
| Learning Mode Approval | `/student/learning-mode-approval` | `edit` | `approve` `download` |
| Refugee Status Approval | `/student/refugee-approval` | `edit` | `approve` `download` |
| Dropout Rejoin | `/student/intake-transfer` | `edit` | `execute` |
| Fee Structure Transfer | `/student/fee-structure-transfer` | `edit` | `execute` |
| Terminate Student | `/student/terminate-student` | `add` | `execute` |
| Passout Confirmation | `/student/passout-confirmation` | `edit` | `approve` |
| Send Communication | `/student/communications` | `add` | `send` |
| Specialization Management | `/student/specialization` | `edit` | `assign` |
| Employee Approvals | `/employee/employee-approve` | `edit` | `approve` |
| UE Material Print | `/assessment/university-exam-material-print` | `add` | `print` |

If the menu call fails, or a page isn't in the response, the frontend shows every
action. Real access control still has to be enforced by each API.

## Rail (top-level module) icons

| Rail | Icon class |
|---|---|
| Admission | `lni lni-clipboard` |
| Academic | `lni lni-graduation` |
| Finance | `lni lni-dollar` |
| Student | `lni lni-user` |
| Employee | `lni lni-briefcase` |
| Assessment | `lni lni-pencil-alt` |
| Config | `lni lni-cog` |
| Activity Log | `lni lni-list` |

---

## Admission

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Enquiry | Online Enquiry | `/admission/online-enquiry` | `get` `add` | `add` |  |
| Enquiry | Self-Service Kiosk | `/admission/kiosk-enquiry` | `get` `add` | `add` |  |
| Enquiry | On-Desk Enquiry | `/admission/ondesk-enquiry` | `get` `add` | `add` |  |
| Enquiry | Enquiry List | `/admission/enquiry-list` | `get` `add` `edit` `assign` `verify` | `add` `edit` | `assign` = assign counsellor; `verify` = verify enquirer email |
| Enquiry | Enquiry Followup Master | `/admission/enquiry-followup-master` | `get` `add` `edit` `assign` | `add` `edit` | `add` = log follow-up; `assign` = assign counsellor |
| Enquiry | Enquiry Followup | `/admission/enquiry-followup` | `get` `edit` `assign` | `edit` | `assign` = assign counsellor |
| Enquiry | Enquiry Report | `/admission/reports/enquiry` | `get` `export` | none | Preview + Excel export; exports land in the shared Downloads list |
| Admission Flow | Dashboard | `/admission/dashboard` | `get` | none |  |
| Admission Flow | Application Payment | `/admission/payment` | `get` `add` `import` `print` | `add` | `import` = from Enquiry / ODeL / CRM; `print` = receipt PDF after saving (normal payments only, not exemptions) |
| Admission Flow | Application Filing | `/admission/filing` | `get` `add` `delete` `submit` | `add` `delete` | `submit` = submit application for vetting |
| Admission Flow | Vetting Desk | `/admission/vetting` | `get` `approve` `reject` `hold` | none | `hold` = Wait (awaiting original documents) |
| Admission Flow | Registrar's Desk | `/admission/registration` | `get` `register` `print` | none | `print` = onboarding print-out |
| Records | All Applicants | `/admission/applicants` | `get` `export` | none |  |
| Records | Application Status Report | `/admission/reports/application-status` | `get` `export` | none | Preview with count per stage + Excel export; exports land in the shared Downloads list |
| Records | Receipts | *(none)* | — | — | no page yet |
| Records | Reports | *(none)* | — | — | no page yet |

```json
{
  "name": "Admission",
  "icon": "lni lni-clipboard",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Enquiry",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Online Enquiry",
          "icon": "lni lni-display",
          "url": "/admission/online-enquiry",
          "permissions": { "get": true, "add": true },
          "children": []
        },
        {
          "name": "Self-Service Kiosk",
          "icon": "lni lni-tab",
          "url": "/admission/kiosk-enquiry",
          "permissions": { "get": true, "add": true },
          "children": []
        },
        {
          "name": "On-Desk Enquiry",
          "icon": "lni lni-pencil-alt",
          "url": "/admission/ondesk-enquiry",
          "permissions": { "get": true, "add": true },
          "children": []
        },
        {
          "name": "Enquiry List",
          "icon": "lni lni-folder",
          "url": "/admission/enquiry-list",
          "permissions": { "get": true, "add": true, "edit": true, "assign": true, "verify": true },
          "children": []
        },
        {
          "name": "Enquiry Followup Master",
          "icon": "lni lni-calendar",
          "url": "/admission/enquiry-followup-master",
          "permissions": { "get": true, "add": true, "edit": true, "assign": true },
          "children": []
        },
        {
          "name": "Enquiry Followup",
          "icon": "lni lni-phone",
          "url": "/admission/enquiry-followup",
          "permissions": { "get": true, "edit": true, "assign": true },
          "children": []
        },
        {
          "name": "Enquiry Report",
          "icon": "lni lni-bar-chart",
          "url": "/admission/reports/enquiry",
          "permissions": { "get": true, "export": true },
          "children": []
        }
      ]
    },
    {
      "name": "Admission Flow",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Dashboard",
          "icon": "lni lni-dashboard",
          "url": "/admission/dashboard",
          "permissions": { "get": true },
          "children": []
        },
        {
          "name": "Application Payment",
          "icon": "lni lni-credit-cards",
          "url": "/admission/payment",
          "permissions": { "get": true, "add": true, "import": true, "print": true },
          "children": []
        },
        {
          "name": "Application Filing",
          "icon": "lni lni-pencil-alt",
          "url": "/admission/filing",
          "permissions": { "get": true, "add": true, "delete": true, "submit": true },
          "children": []
        },
        {
          "name": "Vetting Desk",
          "icon": "lni lni-search-alt",
          "url": "/admission/vetting",
          "permissions": { "get": true, "approve": true, "reject": true, "hold": true },
          "children": []
        },
        {
          "name": "Registrar's Desk",
          "icon": "lni lni-graduation",
          "url": "/admission/registration",
          "permissions": { "get": true, "register": true, "print": true },
          "children": []
        }
      ]
    },
    {
      "name": "Records",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "All Applicants",
          "icon": "lni lni-users",
          "url": "/admission/applicants",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Application Status Report",
          "icon": "lni lni-bar-chart",
          "url": "/admission/reports/application-status",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Receipts",
          "icon": "lni lni-files",
          "url": null,
          "permissions": {},
          "children": []
        },
        {
          "name": "Reports",
          "icon": "lni lni-bar-chart",
          "url": null,
          "permissions": {},
          "children": []
        }
      ]
    }
  ]
}
```

---

## Academic

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Overview | Dashboard | `/academic/acad-dashboard` | `get` `export` | none |  |
| Academic Core | Intake Master | `/academic/intake-master` | `get` `add` `edit` `delete` `export` | `add` `edit` `delete` |  |
| Academic Core | Bulk Intake Edit | `/academic/bulk-intake-edit` | `get` `edit` | none |  |
| Academic Core | Skill Management | `/academic/skill-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Core | Batch Management | `/academic/batch-management` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Core | Batch Summary | `/academic/batch-summary` | `get` `export` | none |  |
| Academic Core | Room Management | `/academic/room-management` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Core | Session Movement | `/academic/session-movement` | `get` `execute` | none | `execute` = single and bulk Move Session |
| Course Unit Master | Repetition Tag | `/academic/repetition-tag` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Course Unit Master | Course Units | `/academic/course-units` | `get` `add` `edit` `delete` `export` | `add` `edit` `delete` |  |
| Course Unit Master | Course Allocation | `/academic/course-allocation` | `get` `add` `delete` | `add` `delete` | `delete` = remove allocation |
| Programme Master | Programme Level | `/academic/programme-level` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Programme Master | Programme Group | `/academic/programme-group` | `get` `add` `edit` `delete` `export` | `add` `edit` `delete` |  |
| Programme Master | Programme Master | `/academic/programme-master` | `get` `add` `edit` `delete` `export` | `add` `edit` `delete` | `edit` also covers Renew; `add` covers New Version |
| Programme Master | Programme Approval | `/academic/programme-approval` | `get` `delete` `approve` | `edit` `delete` |  |
| Programme Master | Fee Structure | `/academic/fee-structure` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Timetable | Timetable | `/academic/timetable` | `get` `add` `edit` `delete` `import` | `add` `edit` `delete` | `import` = Excel import |
| ODL Applications | ODL Applications | `/academic/odl-applications` | `get` `export` | none |  |
| ODL Applications | Payment Reconciliation | `/academic/odl-reconciliation` | `get` `approve` `reject` | `edit` `delete` | `approve` = confirm reconciliation |
| Cross-Module | Student Lookup | `/academic/student-lookup` | `get` `edit` | `edit` |  |

```json
{
  "name": "Academic",
  "icon": "lni lni-graduation",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Overview",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Dashboard",
          "icon": "lni lni-dashboard",
          "url": "/academic/acad-dashboard",
          "permissions": { "get": true, "export": true },
          "children": []
        }
      ]
    },
    {
      "name": "Academic Core",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Intake Master",
          "icon": "lni lni-calendar",
          "url": "/academic/intake-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true, "export": true },
          "children": []
        },
        {
          "name": "Bulk Intake Edit",
          "icon": "lni lni-layers",
          "url": "/academic/bulk-intake-edit",
          "permissions": { "get": true, "edit": true },
          "children": []
        },
        {
          "name": "Skill Management",
          "icon": "lni lni-bulb",
          "url": "/academic/skill-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Batch Management",
          "icon": "lni lni-users",
          "url": "/academic/batch-management",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Batch Summary",
          "icon": "lni lni-grid-alt",
          "url": "/academic/batch-summary",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Room Management",
          "icon": "lni lni-home",
          "url": "/academic/room-management",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Session Movement",
          "icon": "lni lni-reload",
          "url": "/academic/session-movement",
          "permissions": { "get": true, "execute": true },
          "children": []
        }
      ]
    },
    {
      "name": "Course Unit Master",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Repetition Tag",
          "icon": "lni lni-reload",
          "url": "/academic/repetition-tag",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Course Units",
          "icon": "lni lni-book",
          "url": "/academic/course-units",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true, "export": true },
          "children": []
        },
        {
          "name": "Course Allocation",
          "icon": "lni lni-agenda",
          "url": "/academic/course-allocation",
          "permissions": { "get": true, "add": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Programme Master",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Programme Level",
          "icon": "lni lni-layers",
          "url": "/academic/programme-level",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Programme Group",
          "icon": "lni lni-folder",
          "url": "/academic/programme-group",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true, "export": true },
          "children": []
        },
        {
          "name": "Programme Master",
          "icon": "lni lni-graduation",
          "url": "/academic/programme-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true, "export": true },
          "children": []
        },
        {
          "name": "Programme Approval",
          "icon": "lni lni-check-box",
          "url": "/academic/programme-approval",
          "permissions": { "get": true, "delete": true, "approve": true },
          "children": []
        },
        {
          "name": "Fee Structure",
          "icon": "lni lni-dollar",
          "url": "/academic/fee-structure",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Timetable",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Timetable",
          "icon": "lni lni-calendar",
          "url": "/academic/timetable",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true, "import": true },
          "children": []
        }
      ]
    },
    {
      "name": "ODL Applications",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "ODL Applications",
          "icon": "lni lni-world",
          "url": "/academic/odl-applications",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Payment Reconciliation",
          "icon": "lni lni-credit-cards",
          "url": "/academic/odl-reconciliation",
          "permissions": { "get": true, "approve": true, "reject": true },
          "children": []
        }
      ]
    },
    {
      "name": "Cross-Module",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Student Lookup",
          "icon": "lni lni-user",
          "url": "/academic/student-lookup",
          "permissions": { "get": true, "edit": true },
          "children": []
        }
      ]
    }
  ]
}
```

---

## Finance

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Payment Collection | Dashboard | `/finance/dashboard` | `get` | none |  |
| Payment Collection | Payment Console | `/finance/payment-console` | `get` `add` `edit` `print` | `add` `edit` | `add` = save payment / apply advance; `edit` = edit a saved payment |
| Payment Collection | Payment Refund | `/finance/payment-refund` | `get` `add` | `add` | `add` = submit refund |
| Payment Collection | NCHE & Guild Payment | `/finance/nche-guild-payment` | `get` `add` `edit` `delete` | `edit` `delete` |  |
| Payment Collection | Discount Allocation | `/finance/discount-allocation` | `get` `add` `edit` `cancel` | `add` `edit` `delete` | `cancel` = cancel discount (now or from next semester) |
| Payment Collection | Refugee Status | `/finance/refugee-status` | `get` `add` `edit` `delete` | none | `add` = grant status; `delete` = remove status |
| Payment Collection | Payment History | `/finance/payment-history` | `get` `edit` `print` | `edit` |  |
| Payment Collection | Ledger Adjustments | `/finance/ledger-adjustments` | `get` `edit` | `edit` | `edit` = adjust ledger line |
| Payment Collection | Exchange Rates | `/finance/exchange-rates` | `get` `add` `edit` `delete` | `add` `edit` `delete` | `edit` = save rates |
| Payment Collection | Advanced Payments | `/finance/advanced-payments` | `get` `add` | `create` | `add` = new deposit |
| Reports & Statements | Financial Reports | `/finance/financial-reports` | `get` `export` | none |  |
| Reports & Statements | Discount Report | `/finance/reports/discount` | `get` `export` | none | Preview + Excel export; each user sees only their own exports. Downloads icon lives in the app header |
| Reports & Statements | Transaction Report | `/finance/reports/transaction` | `get` `export` | none | Same preview + Excel export flow as Discount Report; exports land in the shared Downloads list |
| Reports & Statements | Outstanding Report | `/finance/reports/outstanding` | `get` `export` | none | Same preview + Excel export flow as Discount Report; exports land in the shared Downloads list |
| Reports & Statements | Student Statement | `/finance/student-statements` | `get` `print` | none |  |
| Finance Core | Cooperates | `/finance/cooperates` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Finance Core | Discounts | `/finance/discounts` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Finance Core | Ledgers | `/finance/ledgers` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Finance Core | Other Ledgers | `/finance/ledger-others` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Finance Core | Currency Master | `/finance/currency-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Finance Core | Receipt Books | `/finance/receipt-books` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Finance Core | General Settings | `/finance/gen-sets` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Banking | Banks | `/finance/banks` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Banking | Bank Branches | `/finance/bank-branches` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Banking | Proc Banks | `/finance/proc-banks` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Banking | Proc GL Accounts | `/finance/proc-gl-accounts` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |

```json
{
  "name": "Finance",
  "icon": "lni lni-dollar",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Payment Collection",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Dashboard",
          "icon": "lni lni-dashboard",
          "url": "/finance/dashboard",
          "permissions": { "get": true },
          "children": []
        },
        {
          "name": "Payment Console",
          "icon": "lni lni-credit-cards",
          "url": "/finance/payment-console",
          "permissions": { "get": true, "add": true, "edit": true, "print": true },
          "children": []
        },
        {
          "name": "Payment Refund",
          "icon": "lni lni-reload",
          "url": "/finance/payment-refund",
          "permissions": { "get": true, "add": true },
          "children": []
        },
        {
          "name": "NCHE & Guild Payment",
          "icon": "lni lni-graduation",
          "url": "/finance/nche-guild-payment",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Discount Allocation",
          "icon": "lni lni-tag",
          "url": "/finance/discount-allocation",
          "permissions": { "get": true, "add": true, "edit": true, "cancel": true },
          "children": []
        },
        {
          "name": "Refugee Status",
          "icon": "lni lni-shield",
          "url": "/finance/refugee-status",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Payment History",
          "icon": "lni lni-bar-chart",
          "url": "/finance/payment-history",
          "permissions": { "get": true, "edit": true, "print": true },
          "children": []
        },
        {
          "name": "Ledger Adjustments",
          "icon": "lni lni-lock",
          "url": "/finance/ledger-adjustments",
          "permissions": { "get": true, "edit": true },
          "children": []
        },
        {
          "name": "Exchange Rates",
          "icon": "lni lni-world",
          "url": "/finance/exchange-rates",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Advanced Payments",
          "icon": "lni lni-wallet",
          "url": "/finance/advanced-payments",
          "permissions": { "get": true, "add": true },
          "children": []
        }
      ]
    },
    {
      "name": "Reports & Statements",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Financial Reports",
          "icon": "lni lni-bar-chart",
          "url": "/finance/financial-reports",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Discount Report",
          "icon": "lni lni-tag",
          "url": "/finance/reports/discount",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Transaction Report",
          "icon": "lni lni-list",
          "url": "/finance/reports/transaction",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Outstanding Report",
          "icon": "lni lni-alarm-clock",
          "url": "/finance/reports/outstanding",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Student Statement",
          "icon": "lni lni-files",
          "url": "/finance/student-statements",
          "permissions": { "get": true, "print": true },
          "children": []
        }
      ]
    },
    {
      "name": "Finance Core",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Cooperates",
          "icon": "lni lni-handshake",
          "url": "/finance/cooperates",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Discounts",
          "icon": "lni lni-tag",
          "url": "/finance/discounts",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Ledgers",
          "icon": "lni lni-book",
          "url": "/finance/ledgers",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Other Ledgers",
          "icon": "lni lni-book",
          "url": "/finance/ledger-others",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Currency Master",
          "icon": "lni lni-dollar",
          "url": "/finance/currency-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Receipt Books",
          "icon": "lni lni-ticket",
          "url": "/finance/receipt-books",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "General Settings",
          "icon": "lni lni-cog",
          "url": "/finance/gen-sets",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Banking",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Banks",
          "icon": "lni lni-coin",
          "url": "/finance/banks",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Bank Branches",
          "icon": "lni lni-map-marker",
          "url": "/finance/bank-branches",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Proc Banks",
          "icon": "lni lni-wallet",
          "url": "/finance/proc-banks",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Proc GL Accounts",
          "icon": "lni lni-calculator",
          "url": "/finance/proc-gl-accounts",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    }
  ]
}
```

---

## Student

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Student Records | Student Master | `/student/student-master` | `get` `view` `learningMode` `refugee` `sponsor` | `get` `view` `edit` `learningMode` `refugee` `sponsor` | row actions use their own flags: View, Learning Mode, Refugee Status, Sponsor |
| Operations | Student Profile | `/student/profile` | `get` `edit` `send` `print` `download` | `edit` | `print`/`download` = ID card; `send` = credentials via email/WhatsApp |
| Operations | Batch Transfer | `/student/batch-transfer` | `get` `execute` | `edit` |  |
| Operations | Programme Transfer | `/student/prog-transfer` | `get` `execute` | `edit` |  |
| Operations | Learning Mode | `/student/learning-mode` | `get` `submit` | `edit` | `submit` = raise change request for approval |
| Operations | Learning Mode Approval | `/student/learning-mode-approval` | `get` `approve` `download` | `edit` |  |
| Operations | Refugee Status Approval | `/student/refugee-approval` | `get` `approve` `download` | `edit` |  |
| Operations | Dropout Rejoin | `/student/intake-transfer` | `get` `execute` | `edit` | `execute` = rejoin student |
| Operations | Fee Structure Transfer | `/student/fee-structure-transfer` | `get` `execute` | `edit` |  |
| Operations | Terminate Student | `/student/terminate-student` | `get` `execute` | `add` | `execute` = terminate |
| Operations | Passout Confirmation | `/student/passout-confirmation` | `get` `approve` | `edit` | `approve` = confirm passout |
| Communications | Send Communication | `/student/communications` | `get` `send` | `add` |  |
| Events and Announcements | Event Management | `/student/event-management` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Events and Announcements | Announcement Management | `/student/announcement-management` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Settings | Specialization Management | `/student/specialization` | `get` `assign` | `edit` | `assign` = assign specialization to students |
| Settings | Termination Reason Master | `/student/termination-reasons` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Settings | Feedback Master | `/student/feedback-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |

```json
{
  "name": "Student",
  "icon": "lni lni-user",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Student Records",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Student Master",
          "icon": "lni lni-graduation",
          "url": "/student/student-master",
          "permissions": { "get": true, "view": true, "learningMode": true, "refugee": true, "sponsor": true },
          "children": []
        }
      ]
    },
    {
      "name": "Operations",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Student Profile",
          "icon": "lni lni-user",
          "url": "/student/profile",
          "permissions": { "get": true, "edit": true, "send": true, "print": true, "download": true },
          "children": []
        },
        {
          "name": "Batch Transfer",
          "icon": "lni lni-shuffle",
          "url": "/student/batch-transfer",
          "permissions": { "get": true, "execute": true },
          "children": []
        },
        {
          "name": "Programme Transfer",
          "icon": "lni lni-graduation",
          "url": "/student/prog-transfer",
          "permissions": { "get": true, "execute": true },
          "children": []
        },
        {
          "name": "Learning Mode",
          "icon": "lni lni-display",
          "url": "/student/learning-mode",
          "permissions": { "get": true, "submit": true },
          "children": []
        },
        {
          "name": "Learning Mode Approval",
          "icon": "lni lni-checkmark-circle",
          "url": "/student/learning-mode-approval",
          "permissions": { "get": true, "approve": true, "download": true },
          "children": []
        },
        {
          "name": "Refugee Status Approval",
          "icon": "lni lni-checkmark-circle",
          "url": "/student/refugee-approval",
          "permissions": { "get": true, "approve": true, "download": true },
          "children": []
        },
        {
          "name": "Dropout Rejoin",
          "icon": "lni lni-calendar",
          "url": "/student/intake-transfer",
          "permissions": { "get": true, "execute": true },
          "children": []
        },
        {
          "name": "Fee Structure Transfer",
          "icon": "lni lni-dollar",
          "url": "/student/fee-structure-transfer",
          "permissions": { "get": true, "execute": true },
          "children": []
        },
        {
          "name": "Terminate Student",
          "icon": "lni lni-shield",
          "url": "/student/terminate-student",
          "permissions": { "get": true, "execute": true },
          "children": []
        },
        {
          "name": "Passout Confirmation",
          "icon": "lni lni-graduation",
          "url": "/student/passout-confirmation",
          "permissions": { "get": true, "approve": true },
          "children": []
        }
      ]
    },
    {
      "name": "Communications",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Send Communication",
          "icon": "lni lni-envelope",
          "url": "/student/communications",
          "permissions": { "get": true, "send": true },
          "children": []
        }
      ]
    },
    {
      "name": "Events and Announcements",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Event Management",
          "icon": "lni lni-calendar",
          "url": "/student/event-management",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Announcement Management",
          "icon": "lni lni-bullhorn",
          "url": "/student/announcement-management",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Settings",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Specialization Management",
          "icon": "lni lni-graduation",
          "url": "/student/specialization",
          "permissions": { "get": true, "assign": true },
          "children": []
        },
        {
          "name": "Termination Reason Master",
          "icon": "lni lni-shield",
          "url": "/student/termination-reasons",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Feedback Master",
          "icon": "lni lni-comments",
          "url": "/student/feedback-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    }
  ]
}
```

---

## Employee

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Employee Records | Employee Master | `/employee/employee-master` | `get` `add` `edit` `assign` | `add` `edit` `assign` | `assign` = assign/edit employee permissions |
| Employee Records | Employee Approvals | `/employee/employee-approve` | `get` `approve` | `edit` |  |

```json
{
  "name": "Employee",
  "icon": "lni lni-briefcase",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Employee Records",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Employee Master",
          "icon": "lni lni-user",
          "url": "/employee/employee-master",
          "permissions": { "get": true, "add": true, "edit": true, "assign": true },
          "children": []
        },
        {
          "name": "Employee Approvals",
          "icon": "lni lni-checkmark-circle",
          "url": "/employee/employee-approve",
          "permissions": { "get": true, "approve": true },
          "children": []
        }
      ]
    }
  ]
}
```

---

## Assessment

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Overview | Assessment Dashboard | `/assessment/dashboard` | `get` `export` | none |  |
| Assessment Structure | Fee Clearance Master | `/assessment/assessment-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Assessment Structure | Exam Rules Master | `/assessment/exam-rules` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Assessment Structure | Question FAQs | `/assessment/question-faqs` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Assessment Structure | Bulk Exam Scheduler | `/assessment/bulk-exam-scheduler` | `get` `add` | none |  |
| Assessment Structure | IA Creation | `/assessment/ia-creation` | `get` `add` `edit` | none | `add` = create structure; `edit` = edit CW/CT/UE schedule |
| Assessment Structure | IA Evaluation | `/assessment/ia-evaluation` | `get` `edit` `submit` | none | `edit` = save marks; `submit` = finalize |
| Coursework (CW) | Question Bank Upload | `/assessment/cw-qbank` | `get` `add` `edit` `delete` `import` `download` | none | `import` = Excel import; `download` = template |
| Coursework (CW) | CW Rectification | `/assessment/cw-rectify` | `get` `edit` `delete` | none | `edit` = reopen / re-evaluate attempt |
| Coursework (CW) | Project Proposals | `/assessment/project-proposals` | `get` `add` `edit` `delete` | none |  |
| Coursework (CW) | Project Reviews | `/assessment/project-reviews` | `get` `add` `edit` `delete` | none |  |
| Class Test (CBT) | Exam Cancel | `/assessment/exam-cancel` | `get` `edit` `cancel` | none | `cancel` = cancel attempt; `edit` = extra time |
| University Exam (UE) | Question Paper Vetting | `/assessment/qp-vetting` | `get` `add` `edit` `approve` | none | `approve` = vetting committee sign-off |
| University Exam (UE) | UE Practical QBank | `/assessment/question-bank-practical` | `get` `delete` `import` `download` | none |  |
| University Exam (UE) | Hall Ticket Issuance | `/assessment/hall-ticket` | `get` `add` | none | `add` = issue (single or bulk) |
| University Exam (UE) | Hall Ticket Print | `/assessment/hall-print` | `get` `print` | none |  |
| University Exam (UE) | Hall Ticket Print All | `/assessment/hall-ticket-print-all` | `get` `print` | none |  |
| University Exam (UE) | UE Material Print | `/assessment/university-exam-material-print` | `get` `print` | `add` |  |
| University Exam (UE) | UE QP/Booklet Print | `/assessment/university-exam-qp-booklet-print` | `get` `print` `generate` | none |  |
| University Exam (UE) | UE Practical QP Print | `/assessment/university-exam-practical-qp-print` | `get` `delete` `print` `download` `generate` | none |  |
| University Exam (UE) | UE Project Booklet Print | `/assessment/university-exam-project-booklet-print` | `get` `print` `download` | none |  |
| University Exam (UE) | Resit Question Print | `/assessment/resit-question-print` | `get` `delete` `print` `generate` | none |  |
| University Exam (UE) | UE Attendance | `/assessment/ue-attendance` | `get` `edit` | none |  |
| University Exam (UE) | UE Mark Import | `/assessment/ue-mark-import` | `get` `import` | none |  |
| Mark Entry & Results | Mark Entry — UE | `/assessment/mark-ue` | `get` `verify` | none |  |
| Mark Entry & Results | Result & Moderation | `/assessment/moderation` | `get` `edit` | none |  |
| Mark Entry & Results | Exam Mark Import | `/assessment/exam-mark-import` | `get` `import` `download` `publish` | none |  |
| Mark Entry & Results | Generate Result | `/assessment/generate-result` | `get` `edit` `delete` `export` `generate` `publish` | none | `edit` = apply moderation; `publish` also covers withdraw |
| Mark Entry & Results | Transcript Print | `/assessment/transcript-print` | `get` `print` | none |  |
| Mark Entry & Results | Graduate Transcript | `/assessment/graduate-transcript` | `get` `generate` | none |  |
| Mark Entry & Results | HEC Graduate Transcript | `/assessment/hec-graduate-transcript` | `get` `generate` | none |  |
| Mark Entry & Results | Transcript Collection | `/assessment/graduate-transcript/collection` | `get` `add` | none | `add` = record collection |
| Mark Entry & Results | Gown Collection | `/assessment/gown-collection` | `get` `add` | none | `add` = record collection |
| Resit & Disputes | Resit Master | `/assessment/resit-configs` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Resit & Disputes | Resit Applications | `/assessment/resit-applications` | `get` | none |  |
| Resit & Disputes | Resit Apply | `/assessment/resit-apply` | `get` `add` `edit` `delete` | none |  |
| Resit & Disputes | Resit Scheduling | `/assessment/resit-scheduling` | `get` `add` `edit` | none |  |
| Resit & Disputes | Resit IA Evaluation | `/assessment/resit-evaluation` | `get` `submit` | none | `submit` = submit evaluation |
| Resit & Disputes | Resit IA Result | `/assessment/resit-ia-results` | `get` `export` | none |  |
| Resit & Disputes | Resit UE Mark Import | `/assessment/resit-ue-mark-import` | `get` `import` `download` | none |  |
| Resit & Disputes | Resit Mark Update | `/assessment/resit-mark-update` | `get` `publish` | none | `publish` = push marks |
| Resit & Disputes | Exam Grievances | `/assessment/exam-grievances` | `get` `edit` | none | `edit` = respond (save & email) |

```json
{
  "name": "Assessment",
  "icon": "lni lni-pencil-alt",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Overview",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Assessment Dashboard",
          "icon": "lni lni-dashboard",
          "url": "/assessment/dashboard",
          "permissions": { "get": true, "export": true },
          "children": []
        }
      ]
    },
    {
      "name": "Assessment Structure",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Fee Clearance Master",
          "icon": "lni lni-list",
          "url": "/assessment/assessment-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Exam Rules Master",
          "icon": "lni lni-files",
          "url": "/assessment/exam-rules",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Question FAQs",
          "icon": "lni lni-comments",
          "url": "/assessment/question-faqs",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Bulk Exam Scheduler",
          "icon": "lni lni-calendar",
          "url": "/assessment/bulk-exam-scheduler",
          "permissions": { "get": true, "add": true },
          "children": []
        },
        {
          "name": "IA Creation",
          "icon": "lni lni-graduation",
          "url": "/assessment/ia-creation",
          "permissions": { "get": true, "add": true, "edit": true },
          "children": []
        },
        {
          "name": "IA Evaluation",
          "icon": "lni lni-checkmark-circle",
          "url": "/assessment/ia-evaluation",
          "permissions": { "get": true, "edit": true, "submit": true },
          "children": []
        }
      ]
    },
    {
      "name": "Coursework (CW)",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Question Bank Upload",
          "icon": "lni lni-upload",
          "url": "/assessment/cw-qbank",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true, "import": true, "download": true },
          "children": []
        },
        {
          "name": "CW Rectification",
          "icon": "lni lni-reload",
          "url": "/assessment/cw-rectify",
          "permissions": { "get": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Project Proposals",
          "icon": "lni lni-folder",
          "url": "/assessment/project-proposals",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Project Reviews",
          "icon": "lni lni-folder",
          "url": "/assessment/project-reviews",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Class Test (CBT)",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Exam Cancel",
          "icon": "lni lni-timer",
          "url": "/assessment/exam-cancel",
          "permissions": { "get": true, "edit": true, "cancel": true },
          "children": []
        }
      ]
    },
    {
      "name": "University Exam (UE)",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Question Paper Vetting",
          "icon": "lni lni-upload",
          "url": "/assessment/qp-vetting",
          "permissions": { "get": true, "add": true, "edit": true, "approve": true },
          "children": []
        },
        {
          "name": "UE Practical QBank",
          "icon": "lni lni-upload",
          "url": "/assessment/question-bank-practical",
          "permissions": { "get": true, "delete": true, "import": true, "download": true },
          "children": []
        },
        {
          "name": "Hall Ticket Issuance",
          "icon": "lni lni-ticket",
          "url": "/assessment/hall-ticket",
          "permissions": { "get": true, "add": true },
          "children": []
        },
        {
          "name": "Hall Ticket Print",
          "icon": "lni lni-printer",
          "url": "/assessment/hall-print",
          "permissions": { "get": true, "print": true },
          "children": []
        },
        {
          "name": "Hall Ticket Print All",
          "icon": "lni lni-printer",
          "url": "/assessment/hall-ticket-print-all",
          "permissions": { "get": true, "print": true },
          "children": []
        },
        {
          "name": "UE Material Print",
          "icon": "lni lni-printer",
          "url": "/assessment/university-exam-material-print",
          "permissions": { "get": true, "print": true },
          "children": []
        },
        {
          "name": "UE QP/Booklet Print",
          "icon": "lni lni-printer",
          "url": "/assessment/university-exam-qp-booklet-print",
          "permissions": { "get": true, "print": true, "generate": true },
          "children": []
        },
        {
          "name": "UE Practical QP Print",
          "icon": "lni lni-printer",
          "url": "/assessment/university-exam-practical-qp-print",
          "permissions": { "get": true, "delete": true, "print": true, "download": true, "generate": true },
          "children": []
        },
        {
          "name": "UE Project Booklet Print",
          "icon": "lni lni-printer",
          "url": "/assessment/university-exam-project-booklet-print",
          "permissions": { "get": true, "print": true, "download": true },
          "children": []
        },
        {
          "name": "Resit Question Print",
          "icon": "lni lni-printer",
          "url": "/assessment/resit-question-print",
          "permissions": { "get": true, "delete": true, "print": true, "generate": true },
          "children": []
        },
        {
          "name": "UE Attendance",
          "icon": "lni lni-users",
          "url": "/assessment/ue-attendance",
          "permissions": { "get": true, "edit": true },
          "children": []
        },
        {
          "name": "UE Mark Import",
          "icon": "lni lni-upload",
          "url": "/assessment/ue-mark-import",
          "permissions": { "get": true, "import": true },
          "children": []
        }
      ]
    },
    {
      "name": "Mark Entry & Results",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Mark Entry — UE",
          "icon": "lni lni-pencil-alt",
          "url": "/assessment/mark-ue",
          "permissions": { "get": true, "verify": true },
          "children": []
        },
        {
          "name": "Result & Moderation",
          "icon": "lni lni-bar-chart",
          "url": "/assessment/moderation",
          "permissions": { "get": true, "edit": true },
          "children": []
        },
        {
          "name": "Exam Mark Import",
          "icon": "lni lni-upload",
          "url": "/assessment/exam-mark-import",
          "permissions": { "get": true, "import": true, "download": true, "publish": true },
          "children": []
        },
        {
          "name": "Generate Result",
          "icon": "lni lni-cogs",
          "url": "/assessment/generate-result",
          "permissions": { "get": true, "edit": true, "delete": true, "export": true, "generate": true, "publish": true },
          "children": []
        },
        {
          "name": "Transcript Print",
          "icon": "lni lni-printer",
          "url": "/assessment/transcript-print",
          "permissions": { "get": true, "print": true },
          "children": []
        },
        {
          "name": "Graduate Transcript",
          "icon": "lni lni-certificate",
          "url": "/assessment/graduate-transcript",
          "permissions": { "get": true, "generate": true },
          "children": []
        },
        {
          "name": "HEC Graduate Transcript",
          "icon": "lni lni-certificate",
          "url": "/assessment/hec-graduate-transcript",
          "permissions": { "get": true, "generate": true },
          "children": []
        },
        {
          "name": "Transcript Collection",
          "icon": "lni lni-check-box",
          "url": "/assessment/graduate-transcript/collection",
          "permissions": { "get": true, "add": true },
          "children": []
        },
        {
          "name": "Gown Collection",
          "icon": "lni lni-check-box",
          "url": "/assessment/gown-collection",
          "permissions": { "get": true, "add": true },
          "children": []
        }
      ]
    },
    {
      "name": "Resit & Disputes",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Resit Master",
          "icon": "lni lni-cogs",
          "url": "/assessment/resit-configs",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Resit Applications",
          "icon": "lni lni-folder",
          "url": "/assessment/resit-applications",
          "permissions": { "get": true },
          "children": []
        },
        {
          "name": "Resit Apply",
          "icon": "lni lni-pencil-alt",
          "url": "/assessment/resit-apply",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Resit Scheduling",
          "icon": "lni lni-calendar",
          "url": "/assessment/resit-scheduling",
          "permissions": { "get": true, "add": true, "edit": true },
          "children": []
        },
        {
          "name": "Resit IA Evaluation",
          "icon": "lni lni-checkmark-circle",
          "url": "/assessment/resit-evaluation",
          "permissions": { "get": true, "submit": true },
          "children": []
        },
        {
          "name": "Resit IA Result",
          "icon": "lni lni-bar-chart",
          "url": "/assessment/resit-ia-results",
          "permissions": { "get": true, "export": true },
          "children": []
        },
        {
          "name": "Resit UE Mark Import",
          "icon": "lni lni-upload",
          "url": "/assessment/resit-ue-mark-import",
          "permissions": { "get": true, "import": true, "download": true },
          "children": []
        },
        {
          "name": "Resit Mark Update",
          "icon": "lni lni-reload",
          "url": "/assessment/resit-mark-update",
          "permissions": { "get": true, "publish": true },
          "children": []
        },
        {
          "name": "Exam Grievances",
          "icon": "lni lni-files",
          "url": "/assessment/exam-grievances",
          "permissions": { "get": true, "edit": true },
          "children": []
        }
      ]
    }
  ]
}
```

---

## Config

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Students | Student Category Master | `/config/student-category-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Students | Service Category Master | `/config/service-category-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Organization | Faculty Master | `/config/faculty-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Organization | Department Master | `/config/department-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Organization | Designation Master | `/config/designation-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Organization | Campus Master | `/config/campus-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Organization | Country Master | `/config/country-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Setup | Specialization | `/config/specialization` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Setup | Skill Master | `/config/skill` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Setup | Unit Type Master | `/config/unit-type` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Setup | Unit Category Master | `/config/unit-category` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Setup | Weekdays | `/config/weekdays` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Academic Setup | Batch Times | `/config/batch-times` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Admissions | Enquiry Status | `/config/enquiry-status` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Admissions | Isbat Enquiry Source | `/config/enquiry-source` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Admissions | Enquiry Source | `/config/enquiry-source-master` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Admissions | Followup Status | `/config/followup-status` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Admissions | Followup Mode | `/config/followup-mode` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Admissions | Interest Level | `/config/interest-level` | `get` `add` `edit` `delete` | `add` `edit` `delete` |  |
| Access Control | Permission Master | `/config/permission-master` | `get` `add` `edit` | `add` `edit` | no delete on this page |

```json
{
  "name": "Config",
  "icon": "lni lni-cog",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Students",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Student Category Master",
          "icon": "lni lni-users",
          "url": "/config/student-category-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Service Category Master",
          "icon": "lni lni-list",
          "url": "/config/service-category-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Organization",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Faculty Master",
          "icon": "lni lni-library",
          "url": "/config/faculty-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Department Master",
          "icon": "lni lni-briefcase",
          "url": "/config/department-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Designation Master",
          "icon": "lni lni-tag",
          "url": "/config/designation-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Campus Master",
          "icon": "lni lni-home",
          "url": "/config/campus-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Country Master",
          "icon": "lni lni-world",
          "url": "/config/country-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Academic Setup",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Specialization",
          "icon": "lni lni-certificate",
          "url": "/config/specialization",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Skill Master",
          "icon": "lni lni-bulb",
          "url": "/config/skill",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Unit Type Master",
          "icon": "lni lni-tag",
          "url": "/config/unit-type",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Unit Category Master",
          "icon": "lni lni-tag",
          "url": "/config/unit-category",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Weekdays",
          "icon": "lni lni-calendar",
          "url": "/config/weekdays",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Batch Times",
          "icon": "lni lni-timer",
          "url": "/config/batch-times",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Admissions",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Enquiry Status",
          "icon": "lni lni-flag",
          "url": "/config/enquiry-status",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Isbat Enquiry Source",
          "icon": "lni lni-compass",
          "url": "/config/enquiry-source",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Enquiry Source",
          "icon": "lni lni-volume",
          "url": "/config/enquiry-source-master",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Followup Status",
          "icon": "lni lni-phone",
          "url": "/config/followup-status",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Followup Mode",
          "icon": "lni lni-comments",
          "url": "/config/followup-mode",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        },
        {
          "name": "Interest Level",
          "icon": "lni lni-signal",
          "url": "/config/interest-level",
          "permissions": { "get": true, "add": true, "edit": true, "delete": true },
          "children": []
        }
      ]
    },
    {
      "name": "Access Control",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Permission Master",
          "icon": "lni lni-lock",
          "url": "/config/permission-master",
          "permissions": { "get": true, "add": true, "edit": true },
          "children": []
        }
      ]
    }
  ]
}
```

---

## Activity Log

| Section | Page | URL | Events | Frontend checks today | Notes |
|---|---|---|---|---|---|
| Audit Trail | Activity Log | `/activity-log/logs` | `get` | none |  |

```json
{
  "name": "Activity Log",
  "icon": "lni lni-list",
  "url": null,
  "permissions": null,
  "children": [
    {
      "name": "Audit Trail",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Activity Log",
          "icon": "lni lni-list",
          "url": "/activity-log/logs",
          "permissions": { "get": true },
          "children": []
        }
      ]
    }
  ]
}
```

---

## Pages hidden from the sidebar

These pages still exist in the code but are deliberately left out of the menu. Don't
add them to the menu response. If they are sent, the frontend removes Weight
Configuration, Assessment Schedule, Service Tickets and the four Resit & Disputes
ones itself (`stripUnintegratedPages`, which also drops a section left empty), and
removes any "Lecturer Master" / "Lecture Master" node (`stripLectureMaster`).

| Module | Page | URL |
|---|---|---|
| Student | Learning Mode Report | `/student/learning-mode-report` |
| Student | Student Services | `/student/services` |
| Assessment | Weight Configuration | `/assessment/weight-config` |
| Assessment | Assessment Schedule | `/assessment/schedule` |
| Assessment | Service Tickets | `/assessment/service-tickets` |
| Assessment | CW Overview | `/assessment/cw-overview` |
| Assessment | CW Submissions | `/assessment/cw-submissions` |
| Assessment | CBT Overview | `/assessment/cbt-overview` |
| Assessment | CBT Question Upload | `/assessment/cbt-qupload` |
| Assessment | CBT Monitor | `/assessment/cbt-monitor` |
| Assessment | UE Schedule | `/assessment/ue-schedule` |
| Assessment | Mark Entry — CW | `/assessment/mark-cw` |
| Assessment | Mark Entry — CBT | `/assessment/mark-cbt` |
| Assessment | Resit Calendar | `/assessment/resit-calendar` |
| Assessment | Resit Seating Allocator | `/assessment/resit-seating` |
| Assessment | CW Reevaluation | `/assessment/reeval` |
| Assessment | CW Recheck Hub | `/assessment/recheck` |
| Assessment | Pending QP Upload | `/assessment/rpt-pending-qp` |
| Assessment | Faculty Summary | `/assessment/rpt-faculty` |

## Changes since the previous version (2026-10-09)

- Hid **Assessment › Assessment Structure › Weight Configuration**
  (`/assessment/weight-config`) and **Assessment Schedule** (`/assessment/schedule`),
  and **Assessment › Student Services › Service Tickets**
  (`/assessment/service-tickets`), from the sidebar (2026-10-15). The pages still exist.
  Please remove them from the menu response; until then the frontend strips them
  itself, and drops the now-empty Student Services section.
- Added **Finance › Reports & Statements › Transaction Report**
  (`/finance/reports/transaction`) and **Outstanding Report**
  (`/finance/reports/outstanding`), both with `get` and `export`. Please register them
  in the menu API; until then the frontend adds them to the sidebar itself, after
  Discount Report.
- Application Payment's `print` event now does something: it opens the application
  payment receipt PDF after saving. No change to its events.
- Added **Admission › Enquiry › Enquiry Report** (`/admission/reports/enquiry`), with
  `get` and `export`. Please register it in the menu API; until then the frontend adds
  it to the end of the Enquiry section itself.
- Added **Admission › Records › Application Status Report**
  (`/admission/reports/application-status`), with `get` and `export`. Please register
  it in the menu API; until then the frontend adds it to the end of the Records section.

## Changes in the 2026-10-09 version (since 2026-09-07)

- Module names now match the frontend rails: **Admission, Academic, Finance, Student,
  Employee, Assessment, Config, Activity Log**. The old "Academics", "Admissions" and
  "Administration" groupings are gone.
- Added the full **Student**, **Employee**, **Assessment**, **Config** and
  **Activity Log** trees, which weren't documented before.
- Moved Faculty Master from Academic Core to Config › Organization.
- Removed Lecturer Master, Admission › Settings and Online Preview, and Finance's
  Payment Console Adjustments (now a tab inside Payment Console).
- Added Batch Summary, Course Allocation, Refugee Status, Enquiry Followup Master and
  Enquiry Followup, and everything under Student Operations, Assessment and Config.
- Replaced the generic `add`/`edit`/`delete`/`get` bag on every page with each page's
  real events.
