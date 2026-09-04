# Menu Routes & Icons Reference — for Backend (Menu API)

Companion doc for the permission-driven sidebar menu API (`GET` response with
`{ name, icon, url, permissions, children }` nodes). Below is the same JSON
shape, with `icon` and `url` filled in for every node — cross-checked against
the merged/final tree built in `src/lib/api/users/menu.ts` (mockMenu plus its
`ensureBulkIntakeEdit` / `ensureBatchSummary` / `ensureProgrammeApproval` /
`mergeFinanceSections` / `mergeStudentSections` merge functions), the actual
`page.tsx` routes on disk
under `src/app/*`, and `src/components/Sidebar.tsx` (the single source of
truth for what the sidebar actually renders) for rail ordering/icons. One
top-level module per rail. Each leaf's `permissions` field reflects the real
`permissions.xxx` gating found in that page's own code (via
`usePagePermissions()`), not a placeholder — see
`docs/PAGE_PERMISSIONS_ACTIONS.md` for the full per-action breakdown this
doc doesn't attempt to capture.

## Icon format

Icon library: **[LineIcons 4.0](https://lineicons.com/icons)**, loaded via
CDN in `src/app/layout.tsx`. The frontend renders an icon as:

```html
<i class="lni lni-{icon}"></i>
```

The `icon` value below is the **full class string** (`lni lni-calendar`),
not just the LineIcons name — copy it as-is into the `icon` field.

## Which tree actually renders

`getMenu()` in `menu.ts` picks between two sources at request time, gated by
`NEXT_PUBLIC_RBAC_MOCK` (falls back to `NEXT_PUBLIC_AUTH_MOCK` if unset):

- `true` → `mockMenu`, the literal tree documented below — full access, no
  role restrictions.
- `false` → the real `GET /api/v1/users/me/menu` response, run through the
  `merge*`/`ensure*` functions this doc's per-module notes describe —
  permission-gated per the logged-in user's role, with certain sections/
  leaves/icons patched in or overridden where the backend doesn't fully
  match this reference yet (see the per-module notes below for which).

## `url` format

Full path from the app root (e.g. `/config/faculty-master`), not a bare
slug. Note `Sidebar.tsx` itself resolves a *bare* slug from the real
`/me/menu` response against the current rail (`resolveHref`) — the full
paths below are what this doc and `mockMenu` use, and are equally valid
since `resolveHref` passes an already-absolute path (starting with `/`)
through unchanged.

---

## Admission

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
          "permissions": { "add": true },
          "children": []
        },
        {
          "name": "Self-Service Kiosk",
          "icon": "lni lni-tab",
          "url": "/admission/kiosk-enquiry",
          "permissions": { "add": true },
          "children": []
        },
        {
          "name": "On-Desk Enquiry",
          "icon": "lni lni-pencil-alt",
          "url": "/admission/ondesk-enquiry",
          "permissions": { "add": true },
          "children": []
        },
        {
          "name": "Enquiry List",
          "icon": "lni lni-folder",
          "url": "/admission/enquiry-list",
          "permissions": { "add": true, "edit": true },
          "children": []
        },
        {
          "name": "Enquiry Followup Master",
          "icon": "lni lni-calendar",
          "url": "/admission/enquiry-followup-master",
          "permissions": { "add": true, "edit": true },
          "children": []
        },
        {
          "name": "Enquiry Followup",
          "icon": "lni lni-phone",
          "url": "/admission/enquiry-followup",
          "permissions": { "edit": true },
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
          "permissions": {},
          "children": []
        },
        {
          "name": "Application Payment",
          "icon": "lni lni-credit-cards",
          "url": "/admission/payment",
          "permissions": { "add": true },
          "children": []
        },
        {
          "name": "Application Filing",
          "icon": "lni lni-pencil-alt",
          "url": "/admission/filing",
          "permissions": { "add": true, "delete": true },
          "children": []
        },
        {
          "name": "Vetting Desk",
          "icon": "lni lni-search-alt",
          "url": "/admission/vetting",
          "permissions": {},
          "children": []
        },
        {
          "name": "Registrar's Desk",
          "icon": "lni lni-graduation",
          "url": "/admission/registration",
          "permissions": {},
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
          "permissions": {},
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

> `Receipts` and `Reports` are real sidebar links with **no page behind them
> yet** — they'll 404 until built. Keep `url: null` until then.

> Application Filing's `delete` gate is scoped to removing a *saved
> qualification row* mid-form (`permissions.delete` on
> `handleDeleteQualRow`), not the application record itself — `add` covers
> saving qualification rows, the general info step, the photo upload, and
> final submission.

---

## Academic

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
          "permissions": {},
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Bulk Intake Edit",
          "icon": "lni lni-layers",
          "url": "/academic/bulk-intake-edit",
          "permissions": {},
          "children": []
        },
        {
          "name": "Skill Management",
          "icon": "lni lni-bulb",
          "url": "/academic/skill-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Batch Management",
          "icon": "lni lni-users",
          "url": "/academic/batch-management",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Batch Summary",
          "icon": "lni lni-grid-alt",
          "url": "/academic/batch-summary",
          "permissions": {},
          "children": []
        },
        {
          "name": "Room Management",
          "icon": "lni lni-home",
          "url": "/academic/room-management",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Session Movement",
          "icon": "lni lni-reload",
          "url": "/academic/session-movement",
          "permissions": {},
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Course Units",
          "icon": "lni lni-book",
          "url": "/academic/course-units",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Programme Group",
          "icon": "lni lni-folder",
          "url": "/academic/programme-group",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Programme Master",
          "icon": "lni lni-graduation",
          "url": "/academic/programme-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Programme Approval",
          "icon": "lni lni-check-box",
          "url": "/academic/programme-approval",
          "permissions": { "delete": true, "edit": true },
          "children": []
        },
        {
          "name": "Fee Structure",
          "icon": "lni lni-dollar",
          "url": "/academic/fee-structure",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
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
          "permissions": {},
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
          "permissions": {},
          "children": []
        },
        {
          "name": "Payment Reconciliation",
          "icon": "lni lni-credit-cards",
          "url": "/academic/odl-reconciliation",
          "permissions": {},
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
          "permissions": {},
          "children": []
        }
      ]
    }
  ]
}
```

> `Faculty Master` and `Lecturer Master` were previously listed here — Faculty
> Master has since moved to the **Config** module below (`/config/faculty-master`);
> Lecturer Master was a placeholder that was never actually implemented and
> has been dropped.

> `Programme Approval`'s `edit` gate actually controls an **Approve** button
> (`handleApprove`), not a field-edit form — there is no `add` action on this
> page (it's an approval queue over records created in Programme Master), so
> `add` is intentionally omitted rather than set `false`.

> Several pages above (`Skill Management`, `Batch Management`, `Room
> Management`, `Repetition Tag`, `Programme Group`, `Fee Structure`) were
> previously listed with `permissions: {}` in this doc — corrected here after
> re-reading each `page.tsx`; all six do gate Add/Edit/Delete via
> `usePagePermissions()`, they just weren't reflected accurately before.

---

## Finance

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
          "permissions": {},
          "children": []
        },
        {
          "name": "Payment Console",
          "icon": "lni lni-credit-cards",
          "url": "/finance/payment-console",
          "permissions": {},
          "children": []
        },
        {
          "name": "Payment Console Adjustments",
          "icon": "lni lni-pencil-alt",
          "url": "/finance/payment-console-adjustments",
          "permissions": {},
          "children": []
        },
        {
          "name": "NCHE & Guild Payment",
          "icon": "lni lni-graduation",
          "url": "/finance/nche-guild-payment",
          "permissions": {},
          "children": []
        },
        {
          "name": "Discount Allocation",
          "icon": "lni lni-tag",
          "url": "/finance/discount-allocation",
          "permissions": {},
          "children": []
        },
        {
          "name": "Payment History",
          "icon": "lni lni-bar-chart",
          "url": "/finance/payment-history",
          "permissions": {},
          "children": []
        },
        {
          "name": "Ledger Adjustments",
          "icon": "lni lni-lock",
          "url": "/finance/ledger-adjustments",
          "permissions": {},
          "children": []
        },
        {
          "name": "Exchange Rates",
          "icon": "lni lni-world",
          "url": "/finance/exchange-rates",
          "permissions": {},
          "children": []
        },
        {
          "name": "Advanced Payments",
          "icon": "lni lni-wallet",
          "url": "/finance/advanced-payments",
          "permissions": {},
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
          "permissions": {},
          "children": []
        },
        {
          "name": "Student Statements",
          "icon": "lni lni-files",
          "url": "/finance/student-statements",
          "permissions": {},
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Discounts",
          "icon": "lni lni-tag",
          "url": "/finance/discounts",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Ledgers",
          "icon": "lni lni-book",
          "url": "/finance/ledgers",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Currency Master",
          "icon": "lni lni-dollar",
          "url": "/finance/currency-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Receipt Books",
          "icon": "lni lni-ticket",
          "url": "/finance/receipt-books",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "General Settings",
          "icon": "lni lni-cog",
          "url": "/finance/gen-sets",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Bank Branches",
          "icon": "lni lni-map-marker",
          "url": "/finance/bank-branches",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Proc Banks",
          "icon": "lni lni-wallet",
          "url": "/finance/proc-banks",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Proc GL Accounts",
          "icon": "lni lni-calculator",
          "url": "/finance/proc-gl-accounts",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        }
      ]
    }
  ]
}
```

> `Payment Collection` and `Reports & Statements` are new sections, ported
> from `isbat_student_module.html`'s sibling Finance mockup — all 11 pages are
> mock/static (no backend permission entries exist for this workflow yet),
> forced into the real menu tree by `mergeFinanceSections()` in `menu.ts`.
> None of the 11 gate on `permissions.xxx` in code, hence `{}` throughout.
> `Payment Console Adjustments`, `NCHE & Guild Payment` and `Discount
> Allocation` are newer additions inserted right after `Payment Console` —
> `mergeFinanceSections()` fixes these three in at the leaf level even when
> the `Payment Collection` section itself is already present from the real
> backend (same pattern `mergeStudentSections()` uses for `Student Records`/
> `Settings` below).
>
> `NCHE & Guild Payment` (2026-09-01) consolidates what used to be three
> separate leaves — `NCHE Payment` (`/finance/nche-payment`), `Guild Payment`
> (`/finance/guild-payment`) and `Guild Payment Console`
> (`/finance/guild-console`) — into one page at `/finance/nche-guild-payment`;
> the three old routes no longer exist on disk. `Payment Console Adjustments`
> and `Discount Allocation` (both 2026-09-02) are net-new pages — the latter
> replaces the per-student discount assignment half of `Student` >
> `Discount Management`, which was dropped the same day (see the `Student`
> module's notes below); the catalogue-CRUD half of that old page duplicated
> `Finance` > `Discounts` and was likewise removed rather than ported.

> `Finance Core` and `Banking` were previously listed with `permissions: {}`
> in this doc — corrected here; all 10 pages do gate Add/Edit/Delete via
> `usePagePermissions()`.

---

## Student

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
          "permissions": {},
          "children": []
        },
        {
          "name": "Student Statement",
          "icon": "lni lni-files",
          "url": "/student/statement",
          "permissions": {},
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
          "permissions": {},
          "children": []
        },
        {
          "name": "Batch Transfer",
          "icon": "lni lni-shuffle",
          "url": "/student/batch-transfer",
          "permissions": {},
          "children": []
        },
        {
          "name": "Programme Transfer",
          "icon": "lni lni-graduation",
          "url": "/student/prog-transfer",
          "permissions": {},
          "children": []
        },
        {
          "name": "Learning Mode",
          "icon": "lni lni-display",
          "url": "/student/learning-mode",
          "permissions": {},
          "children": []
        },
        {
          "name": "Dropout Rejoin",
          "icon": "lni lni-calendar",
          "url": "/student/intake-transfer",
          "permissions": {},
          "children": []
        },
        {
          "name": "Fee Structure Transfer",
          "icon": "lni lni-dollar",
          "url": "/student/fee-structure-transfer",
          "permissions": {},
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
          "permissions": {},
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
          "permissions": {},
          "children": []
        }
      ]
    }
  ]
}
```

> `Operations`, `Services`, `Communications` and `Settings` are new sections,
> ported from `isbat_student_module.html` — all mock/static (no backend
> permission entries exist for this workflow yet), forced into the real menu
> tree by `mergeStudentSections()` in `menu.ts`. `Student Statement` extends
> the existing `Student Records` section rather than getting its own. 9 of
> these 10 pages don't gate on `permissions.xxx` in code (all `{}`) — this is
> the least permission-aware module in the app today.

> `Batch Summary` moved out of `Student Records` into `Academic` >
> `Academic Core` on 2026-09-02 (see the `Academic` section above) — the
> page already pulled from the academic batch-summary API, not a students
> endpoint. `mergeStudentSections()` filters it out of `Student Records`
> here in case the real backend still registers it, and `ensureBatchSummary`
> adds it into `Academic Core` (right after `Batch Management`) if the
> backend doesn't register it there yet.

> The whole `Services` section (`Student Services`) was hidden from the
> sidebar on 2026-09-02 — `mergeStudentSections()` filters it out (so a
> stale entry doesn't linger for users on the real, non-mock menu tree). The
> page still exists at `/student/services`, just not linked to.
>
> `Intake Transfer` (`Operations`) was likewise hidden on 2026-09-02, then
> re-enabled and renamed to `Dropout Rejoin` on 2026-09-03 — same route
> (`/student/intake-transfer`), matching the page's own "Dropout Rejoin"
> mode tab. The page also had a second mode, "Deferment / Period Shift",
> commented out on the page itself the same day (no backend contract exists
> for it — always page-local mock data), leaving Dropout Rejoin as the
> page's only reachable mode. `mergeStudentSections()` filters the old
> `Intake Transfer` name out of `Operations` in case the real backend still
> registers it under that label, so a stale entry doesn't linger alongside
> the renamed one.

> `Category Masters` (`/student/masters`) was later split into two unrelated
> resources sharing that one page — **Student Category Master** (real
> sponsor-categories CRUD) and **Service Category Master** (mock ticketing
> categories) — `mergeStudentSections()` swapped the old single leaf for both
> in place rather than appending duplicates. Both were then moved out of this
> module entirely (2026-09-02) into `Config` > `Students` (see the `Config`
> section below) — `mergeStudentSections()` now filters both names out of
> `Settings` here so a stale entry pointing at the removed
> `/student/student-category-master` / `/student/service-category-master`
> routes doesn't linger for users still on the old real menu tree.

> `Discount Management` (`/student/discount-management`) was dropped from
> `Settings` entirely on 2026-09-02 — its per-student assignment half moved
> to Finance's new `Discount Allocation` page, and its other half (the
> discount catalogue CRUD) duplicated `Finance` > `Discounts`, so the whole
> page was retired rather than ported. `mergeStudentSections()` filters the
> name out of `Settings` here too, so a stale entry pointing at the
> now-removed route doesn't linger for users still on the old real menu
> tree. `Settings` is now just `Specialization Management`, which — unlike
> the rest of this module — does gate `add`/`edit`/`delete` via
> `usePagePermissions()` (no `get` action exists on the page).

> `Operations`' icons are frontend-owned, not backend-owned: even when the
> real `/me/menu` response already registers the whole `Operations` section
> (so the earlier "append only if the section is missing" logic never
> touches it), `mergeStudentSections()` still stamps the icon values above
> over whatever the backend sends for each leaf, by name — `url` and
> `permissions` are left as the backend's real values. `Batch Transfer`
> specifically was changed from `lni lni-transfer` to `lni lni-shuffle`
> (2026-09-01) after confirming `lni-transfer` isn't a real LineIcons 4.0
> class (it silently rendered nothing).

---

## Employee

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
          "permissions": { "add": true, "assign": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Employee Approvals",
          "icon": "lni lni-checkmark-circle",
          "url": "/employee/employee-approve",
          "permissions": {},
          "children": []
        }
      ]
    }
  ]
}
```

> Corrected from a previous `"approve"` key — the code's actual custom flag
> is `permissions.assign` (`const canAssignPermissions = permissions.assign
> ?? permissions.edit`, gating the row's "Assign Permissions" / "Edit
> Permissions" actions). There is no `delete` action on this page at all
> (employees can't be deleted from the UI today), so `delete` is omitted
> rather than set `false`.

> `Employee Approvals` is a new leaf — mock/static, doesn't gate on
> `permissions.xxx` (`{}`) — inserted right after `Employee Master` by
> `ensureEmployeeApprovals()` in `menu.ts`, which patches whichever
> `Employee` module ends up in the tree (real or the temporary hardcoded
> one) since it's a no-op once the backend starts returning the leaf itself.

---

## Config

Previously scattered under "Academics" (Faculty Master only) and
"Administration" in this doc — now its own module/rail, matching the app.

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
          "permissions": {},
          "children": []
        },
        {
          "name": "Service Category Master",
          "icon": "lni lni-list",
          "url": "/config/service-category-master",
          "permissions": {},
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Department Master",
          "icon": "lni lni-briefcase",
          "url": "/config/department-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Designation Master",
          "icon": "lni lni-tag",
          "url": "/config/designation-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Campus Master",
          "icon": "lni lni-home",
          "url": "/config/campus-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Country Master",
          "icon": "lni lni-world",
          "url": "/config/country-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Skill Master",
          "icon": "lni lni-bulb",
          "url": "/config/skill",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Unit Type Master",
          "icon": "lni lni-tag",
          "url": "/config/unit-type",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Unit Category Master",
          "icon": "lni lni-tag",
          "url": "/config/unit-category",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Weekdays",
          "icon": "lni lni-calendar",
          "url": "/config/weekdays",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Batch Times",
          "icon": "lni lni-timer",
          "url": "/config/batch-times",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
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
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Isbat Enquiry Source",
          "icon": "lni lni-compass",
          "url": "/config/enquiry-source",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Enquiry Source",
          "icon": "lni lni-volume",
          "url": "/config/enquiry-source-master",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Followup Status",
          "icon": "lni lni-phone",
          "url": "/config/followup-status",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Followup Mode",
          "icon": "lni lni-comments",
          "url": "/config/followup-mode",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
          "children": []
        },
        {
          "name": "Interest Level",
          "icon": "lni lni-signal",
          "url": "/config/interest-level",
          "permissions": { "add": true, "delete": true, "edit": true, "get": true },
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
          "permissions": { "add": true, "edit": true, "get": true },
          "children": []
        }
      ]
    }
  ]
}
```

> `Students` is a new section (2026-09-02), moved here from the `Student`
> module's own `Settings` section — see the `Student` module's notes above.
> Like the rest of that former section, neither page gates on
> `permissions.xxx` in code (both `{}`).

> `/config/enquiry-source` ("Isbat Enquiry Source") and
> `/config/enquiry-source-master` ("Enquiry Source") are two **genuinely
> different backend resources** with their own guid spaces — not a typo,
> don't merge them.

> Every master under `Organization`, `Academic Setup` and `Admissions` was
> previously listed with `permissions: {}` in this doc except Faculty
> Master — corrected here after re-reading each `page.tsx`; all of them gate
> Add/Edit/Delete via `usePagePermissions()`, identically to Faculty Master.
> `Permission Master` is corrected from a previous `{ add, assign, delete,
> edit, get }` set — the code only gates `add` and `edit` (no `assign`, no
> `delete` action exists on this page at all).

---

## Assessment

New module/rail — had no entry in the previous version of this doc. Mirrors
`ASSESSMENT_SECTIONS` in `menu.ts`. None of its 29 pages gate on
`permissions.xxx` in code yet (all `{}`) — it's the newest module in the app.

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
          "permissions": {},
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
          "permissions": {},
          "children": []
        },
        {
          "name": "Exam Rules Master",
          "icon": "lni lni-files",
          "url": "/assessment/exam-rules",
          "permissions": {},
          "children": []
        },
        {
          "name": "Question FAQs",
          "icon": "lni lni-comments",
          "url": "/assessment/question-faqs",
          "permissions": {},
          "children": []
        },
        {
          "name": "Weight Configuration",
          "icon": "lni lni-cog",
          "url": "/assessment/weight-config",
          "permissions": {},
          "children": []
        },
        {
          "name": "Assessment Schedule",
          "icon": "lni lni-calendar",
          "url": "/assessment/schedule",
          "permissions": {},
          "children": []
        },
        {
          "name": "IA Creation",
          "icon": "lni lni-graduation",
          "url": "/assessment/ia-creation",
          "permissions": {},
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
          "name": "CW Overview",
          "icon": "lni lni-folder",
          "url": "/assessment/cw-overview",
          "permissions": {},
          "children": []
        },
        {
          "name": "Question Bank Upload",
          "icon": "lni lni-upload",
          "url": "/assessment/cw-qbank",
          "permissions": {},
          "children": []
        },
        {
          "name": "CW Submissions",
          "icon": "lni lni-files",
          "url": "/assessment/cw-submissions",
          "permissions": {},
          "children": []
        },
        {
          "name": "CW Rectification",
          "icon": "lni lni-reload",
          "url": "/assessment/cw-rectify",
          "permissions": {},
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
          "name": "CBT Overview",
          "icon": "lni lni-folder",
          "url": "/assessment/cbt-overview",
          "permissions": {},
          "children": []
        },
        {
          "name": "CBT Question Upload",
          "icon": "lni lni-upload",
          "url": "/assessment/cbt-qupload",
          "permissions": {},
          "children": []
        },
        {
          "name": "CBT Monitor",
          "icon": "lni lni-display",
          "url": "/assessment/cbt-monitor",
          "permissions": {},
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
          "name": "UE Schedule",
          "icon": "lni lni-calendar",
          "url": "/assessment/ue-schedule",
          "permissions": {},
          "children": []
        },
        {
          "name": "QP Upload & Vetting",
          "icon": "lni lni-upload",
          "url": "/assessment/qp-vetting",
          "permissions": {},
          "children": []
        },
        {
          "name": "Hall Ticket Issuance",
          "icon": "lni lni-ticket",
          "url": "/assessment/hall-ticket",
          "permissions": {},
          "children": []
        },
        {
          "name": "Hall Ticket Print",
          "icon": "lni lni-printer",
          "url": "/assessment/hall-print",
          "permissions": {},
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
          "name": "Mark Entry — CW",
          "icon": "lni lni-pencil-alt",
          "url": "/assessment/mark-cw",
          "permissions": {},
          "children": []
        },
        {
          "name": "Mark Entry — CBT",
          "icon": "lni lni-pencil-alt",
          "url": "/assessment/mark-cbt",
          "permissions": {},
          "children": []
        },
        {
          "name": "Mark Entry — UE",
          "icon": "lni lni-pencil-alt",
          "url": "/assessment/mark-ue",
          "permissions": {},
          "children": []
        },
        {
          "name": "Result & Moderation",
          "icon": "lni lni-bar-chart",
          "url": "/assessment/moderation",
          "permissions": {},
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
          "permissions": {},
          "children": []
        },
        {
          "name": "Resit Calendar",
          "icon": "lni lni-calendar",
          "url": "/assessment/resit-calendar",
          "permissions": {},
          "children": []
        },
        {
          "name": "Resit Seating Allocator",
          "icon": "lni lni-users",
          "url": "/assessment/resit-seating",
          "permissions": {},
          "children": []
        },
        {
          "name": "CW Reevaluation",
          "icon": "lni lni-reload",
          "url": "/assessment/reeval",
          "permissions": {},
          "children": []
        },
        {
          "name": "CW Recheck Hub",
          "icon": "lni lni-search-alt",
          "url": "/assessment/recheck",
          "permissions": {},
          "children": []
        }
      ]
    },
    {
      "name": "Reports",
      "icon": null,
      "url": null,
      "permissions": null,
      "children": [
        {
          "name": "Pending QP Upload",
          "icon": "lni lni-folder",
          "url": "/assessment/rpt-pending-qp",
          "permissions": {},
          "children": []
        },
        {
          "name": "Faculty Summary",
          "icon": "lni lni-users",
          "url": "/assessment/rpt-faculty",
          "permissions": {},
          "children": []
        }
      ]
    }
  ]
}
```

> `Fee Clearance Master`, `Exam Rules Master`, `Question FAQs` and `IA
> Creation` are newer leaves under `Assessment Structure` — fixed in at the
> leaf level by `ensureAssessmentMaster()` even when the section itself is
> already present. `Fee Clearance Master` was named `Assessment Master`
> until it was renamed (same route, `/assessment/assessment-master`) to
> better reflect what the page actually does — `ensureAssessmentMaster()`
> matches on the current name. `Resit Master` is the equivalent addition to
> `Resit & Disputes` (`ensureResitMaster()`), inserted before `Resit
> Calendar`. `CBT Schedule` was dropped from `Class Test (CBT)` — its page
> still exists on disk but is no longer linked from this menu; see the "no
> sidebar/menu entry" table below.

---

## Pages with no sidebar/menu entry yet

These `page.tsx` routes exist on disk and work — they're just not reachable
from any menu node in `menu.ts` today, so the backend doesn't need to model
menu permissions for them yet. Most are reached only via an in-app button/nav
call rather than the sidebar; a couple (`enquiry-form`) appear to be dead
routes with no inbound navigation left in the codebase at all.

| Page | Route | Notes |
|---|---|---|
| Applicant Profile | `/admission/applicant-profile` | Read-only profile view opened from `VettingReviewModal` / `CompleteRegistrationModal` via `applicantProfileHref()` — never a sidebar link. |
| Enquiry Form | `/admission/enquiry-form` | Standalone enquiry form; `enquiry-list` opens a modal (`enquiry-form-modal`) instead. No other page links here — appears orphaned. |
| Allocation | `/academic/allocation` | Reached via Skill Management's "Proceed to Allocation" button (`nav('allocation')`), not the sidebar. |
| Academic Access Gate | `/academic/access-gate` | Cross-module reference page (fee-payment access rules); not linked from the sidebar or any button found. |
| Class Test (legacy) | `/academic/class-test` | Superseded by the Assessment module's CBT pages (`/assessment/cbt-*`); no inbound nav found. |
| Coursework (legacy) | `/academic/coursework` | Superseded by the Assessment module's CW pages (`/assessment/cw-*`); no inbound nav found. |
| Fee Clearance | `/academic/fee-clearance` | Standalone "Check Clearance" utility page; no inbound nav found. |
| Grievance Management | `/academic/grievance` | Placeholder — "Module Not Yet Defined" per the page's own copy; no inbound nav. |
| Qualification Equating | `/academic/qual-equating` | Standalone equating-request page; no inbound nav found. |
| Results | `/academic/results` | Placeholder — page states this functionality is "owned by the Assessment Module" and pending a KT session. |
| University Exam (legacy) | `/academic/university-exam` | Superseded by the Assessment module's UE pages (`/assessment/ue-*`); no inbound nav found. |
| ODeL Student Preview | `/academic/odel-student-preview` | Reached via `nav('acad-dashboard')`/back-link only; not linked *to* from anywhere found — appears to be a preview/demo page. |
| CBT Schedule | `/assessment/cbt-schedule` | No longer in `ASSESSMENT_SECTIONS`' `Class Test (CBT)` section; page still exists on disk but has no inbound sidebar link. |

---

## Planned / not yet implemented (rail-level, still `locked` in the UI)

These correspond to greyed-out, non-clickable rail icons in `Sidebar.tsx` —
no routes exist for them yet. Listed here for awareness, not as menu nodes
to return from the API today. (Assessment previously appeared here in an
earlier draft of this doc — it now has a real rail slot and 21 working
pages, so it's been moved into the module list above and removed from this
table. The "Admin / User & Role" placeholder that used to sit here has been
commented out of `Sidebar.tsx` entirely, not just hidden, so it's dropped
from this table too — it may come back if a real backend-driven module
takes its place.)

| Item | Rail icon |
|---|---|
| Attendance | `lni lni-alarm-clock` |
| Analytics | `lni lni-bar-chart` |

---

## Rail (top-level module) icons

Listed in the actual left-to-right/top-to-bottom order rendered in
`Sidebar.tsx` (the two locked placeholders above sit between Student and
Employee in that render order).

| Rail | Icon class |
|---|---|
| Admission | `lni lni-clipboard` |
| Academic | `lni lni-graduation` |
| Finance | `lni lni-dollar` |
| Student | `lni lni-user` |
| *(Attendance — locked placeholder)* | `lni lni-alarm-clock` |
| *(Analytics — locked placeholder)* | `lni lni-bar-chart` |
| Employee | `lni lni-briefcase` |
| Assessment | `lni lni-pencil-alt` |
| Config | `lni lni-cog` |
