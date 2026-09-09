import { redirect } from 'next/navigation'

// This standalone page is retired (2026-09-08) — its "Apply Advance" fields/
// functionality/APIs moved into Payment Console's own Semester Payment tab,
// behind a Regular Payment/Apply Advance toggle (same
// useAdvanceDeposits/useAdvanceBalance/useAdjustmentsByAdvance/
// useAdjustmentLedgerBreakdown/useCreateAdjustment hooks, ported as-is — see
// payment-console/page.tsx's own comments on tuitionMode). Kept as a
// redirect rather than deleted outright so any existing bookmark/link/nav
// entry (including the one the real backend's own permission menu may still
// register — see menu.ts's mergeFinanceSections note) lands somewhere real
// instead of a 404.
export default function PaymentConsoleAdjustmentsPage() {
  redirect('/finance/payment-console')
}
