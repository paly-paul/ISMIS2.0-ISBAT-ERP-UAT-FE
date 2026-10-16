import { redirect } from 'next/navigation'

// Old route — kept so bookmarked links still land on the merged page.
export default function Page() {
  redirect('/assessment/cw-qbank')
}
