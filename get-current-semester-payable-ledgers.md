# GET /api/v1/finance/payment-console/current-semester-payable/{applicationGuid}

**API ID:** `finance-service.payment-console.current-semester-payable`
**Service:** erp-finance-compliance-service
**Module:** Finance
**Auth:** Required — validated via `erp_access` cookie at the gateway; no fine-grained permission beyond being an authenticated user.

## Description
Returns the student's **current-semester** outstanding ledgers with any applicable discount already computed, for a "what do I owe this semester" summary — no proposed payment amount required.

This differs from [GET /payment-console/payable-ledgers](./get-payable-ledgers.md), which simulates how a specific `amount` would cascade across ledgers (needed because partial payments can fail to earn a discount). Here there is no amount to simulate, so each discount-eligible ledger group is assumed to be paid in full and its discount is shown unconditionally — the "does this payment cover enough of the group to earn the discount" gate from the real allocation engine does not apply.

Scoping reuses the same "current semester" rules as [GET /payment-console/outstanding-ledgers/{applicationGuid}](./get-outstanding-ledgers.md): the current semester's fee lines, plus the semester-1 registration fee (RF/AF) carried forward for non-regular/non-existing students per the RRF/RF/AF GenSet conditions.

## Path params
| Name | Type | Required | Notes |
|---|---|---|---|
| `applicationGuid` | Guid | Yes | |

## Query params
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `studentGuid` | Guid | No | Supply it once the applicant has become a student. Without it the handler cannot resolve the student's discount assignment or academic status, and falls back to the application's own semester. |

## Request body
None.

## Validation
None.

## Response 200
Returns a flat `List<CurrentSemesterPayableLedgerDto>` as the `data` payload — one row per outstanding ledger, ordered by semester code then `ledgerNum`. There is no wrapper object and no `totals` block; sum client-side, per currency. See [api/README.md](../../README.md) for the envelope.

```json
{
  "success": true,
  "data": [
    {
      "ledgerGuid": "09ead344-05e3-4f6a-a660-96856cbc8c8b",
      "semesterGuid": "4025379b-c299-4bc2-b08b-79e058105cd4",
      "ledgerName": "Semester Entry Fee",
      "ledgerNum": 1,
      "currencyGuid": "0691a617-9091-43f7-834d-2410738b2e0d",
      "currencyCode": "USD",
      "currencyName": "US Dollar",
      "ledgerAmount": 200.00,
      "paidAmount": 0,
      "outstanding": 200.00,
      "discountGuid": null,
      "discountName": null,
      "discountCalcType": null,
      "discountAmtPer": null,
      "discountGroupLedgerNums": [],
      "discountAmount": 0,
      "discountMessage": null,
      "discountExcessAmount": 0,
      "discountWarning": null,
      "netPayable": 200.00
    },
    {
      "ledgerGuid": "0d50f27e-ddeb-4ad6-a526-2837f48c161d",
      "semesterGuid": "4025379b-c299-4bc2-b08b-79e058105cd4",
      "ledgerName": "Tuition Fee",
      "ledgerNum": 2,
      "currencyGuid": "0691a617-9091-43f7-834d-2410738b2e0d",
      "currencyCode": "USD",
      "currencyName": "US Dollar",
      "ledgerAmount": 750.00,
      "paidAmount": 0,
      "outstanding": 750.00,
      "discountGuid": "d78d16a5-9e44-476f-8b06-f03516bf1870",
      "discountName": "TALENT 1-10%",
      "discountCalcType": 2,
      "discountAmtPer": 10,
      "discountGroupLedgerNums": [2],
      "discountAmount": 75.00,
      "discountMessage": "TALENT 1-10%: 75.00 USD off if this group is paid in full",
      "discountExcessAmount": 0,
      "discountWarning": null,
      "netPayable": 675.00
    }
  ],
  "message": null,
  "code": null,
  "errors": null
}
```

| Field | Notes |
|---|---|
| `currencyCode` / `currencyName` | Resolved from the ledger's currency; `currencyName` falls back to the fee-line currency name |
| `discountGuid` / `discountName` | `null` when the ledger has no applicable discount (wrong ledger type, ineligible semester/program, or the student has none) |
| `discountCalcType` | `DiscountCalcType`: `1` Amount, `2` Percentage. `null` when no discount |
| `discountAmtPer` | The configured flat amount or percentage |
| `discountGroupLedgerNums` | The `ledgerNum`s in this ledger's discount group; `[]` when no discount |
| `discountAmount` | The ledger's apportioned share of its discount group's total discount, rounded to 2dp |
| `discountMessage` / `discountWarning` | Display strings from the discount formatter; `discountWarning` is non-null only when the discount needs the cashier's attention |
| `discountExcessAmount` | Portion of the discount that exceeds this ledger's outstanding and cannot be applied here |
| `netPayable` | `outstanding - discountAmount`, floored at 0 |

## Errors
| Status | Code | Reason |
|---|---|---|
| 400 | (generic failure) | `"Fee structure not assigned to this application."` or `"Could not resolve the student's current semester."` |
| 401 | `unauthorized` | Missing/invalid/expired `erp_access` cookie |
| 404 | `not_found` | `"Application not found."`, `"No fee structure lines found."`, or `"No outstanding ledgers found."` — the last one means **fully paid**, a normal state, not an error to show as one |

## Used by pages
_(no page docs reference this yet)_

## Changelog

| Date | Changed by | Change |
|---|---|---|
| 2026-08-27 | Nebu Salim | Initial version created |
| 2026-09-03 | Nebu Salim | Response is now a flat `List<CurrentSemesterPayableLedgerDto>` — removed the `CurrentSemesterPayableResultDto` wrapper and its `totals[]` block (the handler no longer computes per-currency totals). Added `currencyCode` and the discount detail fields (`discountCalcType`, `discountAmtPer`, `discountGroupLedgerNums`, `discountMessage`, `discountExcessAmount`, `discountWarning`) |
