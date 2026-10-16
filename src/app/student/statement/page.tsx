import { redirect } from 'next/navigation'

// STU-006: Student Statement has been redesigned and moved to Finance module (/finance/student-statements).
// Any direct requests or bookmarks to /student/statement are automatically routed to the new location.
export default function StudentStatementRedirectPage() {
  redirect('/finance/student-statements')
}
