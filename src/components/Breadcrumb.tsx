'use client'
import { useRouter } from 'next/navigation'

export interface BreadcrumbItem {
  label: string
  icon: string
  // Route id passed to router.push('/academic/' + id) — omit on the item
  // representing the current page, which renders as a plain non-clickable
  // pill instead of a button, same visual treatment programme-master's own
  // breadcrumb row already used for itself before this was pulled out.
  id?: string
}

// Shared breadcrumb row for Programme Level / Programme Group / Programme
// Master (and anywhere else that wants the same trail) — standardizes what
// was three near-identical, independently hand-rolled `<button onClick={() =>
// nav(...)}>` rows into one component so all three pages navigate/redirect
// the same way when an item is clicked, per the Intake Management/Program
// Master requirements doc (req. 1).
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const router = useRouter()
  function nav(id: string) { router.push('/academic/' + id) }

  return (
    <div className="flex items-center gap-2 mb-[18px] flex-wrap">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2">
          {item.id ? (
            <button className="btn btn-neu btn-sm text-[var(--fs-xs)]" onClick={() => nav(item.id!)}>
              <i className={item.icon}></i> {item.label}
            </button>
          ) : (
            <span className="bg-b50 border-[1.5px] border-[var(--b200)] rounded-[var(--rxs)] py-[5px] px-3 text-[var(--fs-xs)] font-bold text-b700">
              <i className={item.icon}></i> {item.label}
            </span>
          )}
          {i < items.length - 1 && <span className="text-g300 text-[var(--fs-2xl)]">→</span>}
        </div>
      ))}
    </div>
  )
}
