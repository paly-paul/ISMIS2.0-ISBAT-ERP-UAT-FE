'use client'
import { moduleIcon, moduleLabel, CatalogModule, CatalogPage, CatalogPermission } from '@/hooks/users/usePermissionCatalog'

// Shared pieces of the permission picker / review UI (Permission Master's
// group editor and Employee Master's assign-permissions modal): action-label
// shortening, the pages × actions matrix, and the destructive-access note.

export interface CatalogSection {
  section: string
  pages: CatalogPage[]
}

// module → sidebar section → pages, in catalog order, merging catalog
// entries that share a module and dropping pages without permissions.
export function catalogSections(catalog: CatalogModule[]): { modules: string[]; sectionsByModule: Record<string, CatalogSection[]> } {
  const sectionsByModule: Record<string, CatalogSection[]> = {}
  for (const m of catalog) {
    const sections = (m.subModules ?? [])
      .map(sm => ({ section: sm.subModule, pages: (sm.pages ?? []).filter(pg => (pg.permissions ?? []).length > 0) }))
      .filter(s => s.pages.length > 0)
    sectionsByModule[m.mainModule] = [...(sectionsByModule[m.mainModule] ?? []), ...sections]
  }
  return { modules: Object.keys(sectionsByModule), sectionsByModule }
}

// "View Online Enquiry" on page "Online Enquiry" → "View". Permission names
// don't always repeat the page name ("Create Intake" on Intake Master, "View
// Academic" on Dashboard), so a leading standard verb also shortens to that
// verb. Anything else keeps its full name.
const STANDARD_VERB = /^(View|Create|Update|Delete)\b/i

export function actionLabel(permissionName: string, page: string): string {
  const i = permissionName.toLowerCase().indexOf(page.toLowerCase())
  if (i !== -1) {
    const rest = (permissionName.slice(0, i) + permissionName.slice(i + page.length)).replace(/\s+/g, ' ').trim()
    if (rest) return rest
  }
  const verb = permissionName.match(STANDARD_VERB)
  return verb ? verb[1].charAt(0).toUpperCase() + verb[1].slice(1).toLowerCase() : permissionName
}

export const DESTRUCTIVE = /^(delete|remove|cancel|terminate|block|reject|revoke)\b/i

// Matrix columns. A page's permission lands in one when its shortened label
// is exactly that verb; anything else (Assign Sponsor, Approve, a second
// "View …") goes to Other access by full name.
const VERBS = ['View', 'Create', 'Update', 'Delete'] as const
type Verb = typeof VERBS[number]

interface MatrixRow {
  page: string
  cells: Partial<Record<Verb, boolean>>
  others: { name: string; granted: boolean }[]
}

function matrixRow(pg: CatalogPage, isGranted: (p: CatalogPermission) => boolean): MatrixRow {
  const cells: Partial<Record<Verb, boolean>> = {}
  const others: MatrixRow['others'] = []
  for (const p of pg.permissions) {
    const label = actionLabel(p.permissionName, pg.page)
    const verb = VERBS.find(v => v.toLowerCase() === label.toLowerCase())
    const granted = isGranted(p)
    if (verb && !(verb in cells)) cells[verb] = granted
    // A second permission with the same verb (e.g. "View Student Detail"
    // after "View Student") keeps its full name so it's distinguishable.
    else others.push({ name: verb ? p.permissionName : label, granted })
  }
  return { page: pg.page, cells, others }
}

// One module's granted access as a pages × actions table. Only pages with at
// least one granted permission are listed; a cell shows granted (tick),
// available-but-not-granted (dashed ring) or not applicable (dash).
export function ModuleAccessMatrix({ module, sections, isGranted, onEdit }: {
  module: string
  sections: CatalogSection[]
  isGranted: (p: CatalogPermission) => boolean
  onEdit?: () => void
}) {
  const visible = sections
    .map(sec => ({ section: sec.section, rows: sec.pages.filter(pg => pg.permissions.some(isGranted)).map(pg => matrixRow(pg, isGranted)) }))
    .filter(sec => sec.rows.length > 0)
  if (visible.length === 0) return null
  const rows = visible.flatMap(sec => sec.rows)
  const verbs = VERBS.filter(v => rows.some(r => v in r.cells))
  const hasOther = rows.some(r => r.others.some(o => o.granted))
  const total = sections.reduce((n, s) => n + s.pages.reduce((k, pg) => k + pg.permissions.length, 0), 0)
  const granted = sections.reduce((n, s) => n + s.pages.reduce((k, pg) => k + pg.permissions.filter(isGranted).length, 0), 0)
  const cols = 1 + verbs.length + (hasOther ? 1 : 0)

  return (
    <section className="pm-review-module">
      <div className="pm-review-module-hdr">
        <span className="pm-rail-icon has"><i className={`lni lni-${moduleIcon(module)}`}></i></span>
        <span className="pm-review-module-name">{moduleLabel(module)}</span>
        <span className="pm-review-module-count">{granted === total ? 'Full access' : `${granted} of ${total}`}</span>
        {onEdit && <button type="button" className="pm-link" onClick={onEdit}><i className="lni lni-pencil"></i> Edit</button>}
      </div>
      <div className="pm-matrix-wrap">
        <table className="pm-matrix">
          <thead>
            <tr>
              <th scope="col">Page</th>
              {verbs.map(v => <th key={v} scope="col" className={`pm-mx-verb${v === 'Delete' ? ' danger' : ''}`}>{v}</th>)}
              {hasOther && <th scope="col">Other access</th>}
            </tr>
          </thead>
          {visible.map(sec => (
            <tbody key={sec.section}>
              {visible.length > 1 && <tr className="pm-mx-section"><th colSpan={cols} scope="rowgroup">{sec.section}</th></tr>}
              {sec.rows.map(r => (
                <tr key={r.page}>
                  <th scope="row">{r.page}</th>
                  {verbs.map(v => (
                    <td key={v} className="pm-mx-verb">
                      {!(v in r.cells)
                        ? <span className="pm-mx-na" aria-label="Not applicable"></span>
                        : r.cells[v]
                          ? <span className={`pm-mx-yes${v === 'Delete' ? ' danger' : ''}`} aria-label={`${v} granted`}><i className="lni lni-checkmark"></i></span>
                          : <span className="pm-mx-no" aria-label={`${v} not granted`}></span>}
                    </td>
                  ))}
                  {hasOther && (
                    <td>
                      <GrantList names={r.others.filter(o => o.granted).map(o => o.name)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}

// Permissions the catalog doesn't recognize (id/name drift between
// endpoints) — listed plainly so they're never silently dropped.
export function UncataloguedAccess({ names, onEdit }: { names: string[]; onEdit?: () => void }) {
  if (names.length === 0) return null
  return (
    <section className="pm-review-module">
      <div className="pm-review-module-hdr">
        <span className="pm-rail-icon has"><i className="lni lni-shield"></i></span>
        <span className="pm-review-module-name">Other</span>
        <span className="pm-review-module-count">{names.length} not in the catalog</span>
        {onEdit && <button type="button" className="pm-link" onClick={onEdit}><i className="lni lni-pencil"></i> Edit</button>}
      </div>
      <GrantList names={names} boxed />
    </section>
  )
}

function GrantList({ names, boxed }: { names: string[]; boxed?: boolean }) {
  return (
    <ul className={`pm-grant-list${boxed ? ' pm-matrix-wrap' : ''}`} style={boxed ? { padding: '10px 14px' } : undefined}>
      {names.map(n => (
        <li key={n} className={DESTRUCTIVE.test(n) ? 'danger' : undefined}><i className="lni lni-checkmark" aria-hidden="true"></i>{n}</li>
      ))}
    </ul>
  )
}

export function DestructiveCaution({ names, subject = 'Members' }: { names: string[]; subject?: string }) {
  if (names.length === 0) return null
  return (
    <div className="pm-caution" role="note">
      <span className="warn-badge"><i className="lni lni-warning"></i></span>
      <div>
        <strong>Includes {names.length} destructive permission{names.length === 1 ? '' : 's'}</strong>
        <div className="pm-caution-sub">
          {subject} will be able to {names.slice(0, 4).map(n => n.charAt(0).toLowerCase() + n.slice(1)).join(', ')}{names.length > 4 ? ` and ${names.length - 4} more` : ''}.
        </div>
      </div>
    </div>
  )
}

export function ReviewStats({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="pm-stats">
      {items.map(i => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}
    </dl>
  )
}
