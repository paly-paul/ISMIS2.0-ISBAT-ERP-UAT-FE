'use client'
import { useEffect, useRef } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { PermissionGroup, PermissionGroupInput } from '@/lib/api/academic/permissionGroup'
import { moduleIcon, moduleLabel, CatalogPage } from '@/hooks/users/usePermissionCatalog'
import { usePermissionWizard } from '@/hooks/users/usePermissionWizard'
import { actionLabel, DESTRUCTIVE, CatalogSection, ModuleAccessMatrix, UncataloguedAccess, DestructiveCaution, ReviewStats } from '@/components/permissions/PermissionMatrix'

interface PermissionFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  permissionGroup: PermissionGroup | null
  createPermissionGroup: {
    mutate: (input: PermissionGroupInput, options?: { onSuccess?: () => void }) => void
    isPending: boolean
  }
  updatePermissionGroup: {
    mutate: (variables: { id: string; input: PermissionGroupInput }, options?: { onSuccess?: () => void }) => void
    isPending: boolean
  }
}

const MIN_SEARCH_CHARS = 2

function TriCheck({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return <input ref={ref} type="checkbox" className="pm-check" checked={checked} onChange={onChange} aria-label={label} />
}

export function PermissionFormModal({ isOpen, onClose, showToast, mode, permissionGroup, createPermissionGroup, updatePermissionGroup }: PermissionFormModalProps) {
  const isEdit = mode === 'edit'
  const {
    catalogLoaded, modules, sectionsByModule, permissionsByModule, permissionNameById, moduleByPermissionId,
    saved, setSaved, confirming, setConfirming,
    groupName, setGroupName, currentModule, setActiveModule, search, setSearch,
    selected, selections, selectedCount, canSubmit,
    togglePermission, toggleGroup, setMany, seedFromGroupPermissions, resetWizard,
  } = usePermissionWizard(isOpen)
  const paneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEdit && isOpen && permissionGroup) {
      seedFromGroupPermissions(permissionGroup.group, permissionGroup.permissions)
      setConfirming(false)
      setSearch('')
    }
    // Re-seed once the permission catalog is ready.
  }, [isEdit, isOpen, permissionGroup, moduleByPermissionId])

  // A new module starts at the top of the pane.
  useEffect(() => { paneRef.current?.scrollTo({ top: 0 }) }, [currentModule])

  if (!isOpen || (isEdit && !permissionGroup)) return null

  function handleClose() {
    resetWizard()
    onClose()
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Permission Group Updated!' : 'Permission Group Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new permission group has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  const allSelectedIds = selections.flatMap(s => s.permissions)
  const destructiveGranted = allSelectedIds.map(id => permissionNameById[id]).filter((n): n is string => !!n && DESTRUCTIVE.test(n))

  function handleCreate() {
    createPermissionGroup.mutate(
      { group: groupName.trim(), description: `Access to: ${selections.map(s => moduleLabel(s.module)).join(', ')}`, permissions: allSelectedIds },
      { onSuccess: () => { setSaved(true); showToast('Permission group added successfully') } },
    )
  }

  function handleSave() {
    if (!permissionGroup) return
    updatePermissionGroup.mutate(
      { id: permissionGroup.id, input: { group: groupName.trim(), description: permissionGroup.description, permissions: allSelectedIds } },
      { onSuccess: () => { setSaved(true); showToast('Permission group updated successfully') } },
    )
  }

  const isPending = isEdit ? updatePermissionGroup.isPending : createPermissionGroup.isPending

  // ---- Search across every module ------------------------------------------
  const term = search.trim().toLowerCase()
  const searching = term.length >= MIN_SEARCH_CHARS
  function filterSections(sections: CatalogSection[]): CatalogSection[] {
    return sections
      .map(s => ({
        section: s.section,
        pages: s.pages
          // A page-name match keeps the whole page; otherwise only the matching actions.
          .map(pg => pg.page.toLowerCase().includes(term) ? pg : { page: pg.page, permissions: pg.permissions.filter(p => p.permissionName.toLowerCase().includes(term)) })
          .filter(pg => pg.permissions.length > 0),
      }))
      .filter(s => s.pages.length > 0)
  }
  const searchResults = searching
    ? modules.map(m => ({ module: m, sections: filterSections(sectionsByModule[m] ?? []) })).filter(r => r.sections.length > 0)
    : []
  const matchCount = (module: string) => searchResults.find(r => r.module === module)?.sections.reduce((n, s) => n + s.pages.reduce((k, pg) => k + pg.permissions.length, 0), 0) ?? 0

  const countIn = (module: string) => (permissionsByModule[module] ?? []).filter(p => selected.has(p.intPermission)).length

  function renderPage(pg: CatalogPage) {
    const ids = pg.permissions.map(p => p.intPermission)
    const on = ids.filter(id => selected.has(id)).length
    // Two actions shortening to the same word (e.g. two different "View"
    // permissions on one page) would be indistinguishable — show both in full.
    const short = pg.permissions.map(p => actionLabel(p.permissionName, pg.page))
    const labels = short.map((l, i) => short.indexOf(l) !== short.lastIndexOf(l) ? pg.permissions[i].permissionName : l)
    return (
      <div key={pg.page} className={`pm-row${on === ids.length ? ' full' : ''}`}>
        <label className="pm-row-page">
          <TriCheck checked={on === ids.length} indeterminate={on > 0 && on < ids.length} onChange={() => toggleGroup(ids)} label={`All ${pg.page} permissions`} />
          <span>{pg.page}</span>
        </label>
        <div className="pm-chips" role="group" aria-label={pg.page}>
          {pg.permissions.map((p, i) => {
            const label = labels[i]
            const isOn = selected.has(p.intPermission)
            return (
              <button
                key={p.intPermission}
                type="button"
                role="checkbox"
                aria-checked={isOn}
                title={p.permissionName}
                className={`pm-chip${isOn ? ' on' : ''}${DESTRUCTIVE.test(label) ? ' danger' : ''}`}
                onClick={() => togglePermission(p.intPermission)}
              >
                <i className="lni lni-checkmark" aria-hidden="true"></i>{label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  function renderSections(sections: CatalogSection[]) {
    return sections.map(s => (
      <div key={s.section} className="pm-section">
        <div className="pm-section-title">{s.section}</div>
        {s.pages.map(renderPage)}
      </div>
    ))
  }

  const moduleIds = (permissionsByModule[currentModule] ?? []).map(p => p.intPermission)
  const moduleOn = countIn(currentModule)

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-permission-modal' : 'new-permission-modal'}>
      <div className="modal pm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-lock'}`}></i> {isEdit ? 'Edit Permission Group' : 'Add Permission Group'}</div>
          <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
        </div>

        {!confirming ? (
          <div className="pm-body">
            <div className="pm-top">
              <div>
                <label className="lbl" htmlFor="pm-group-name">Group name <span className="req">*</span></label>
                <input
                  id="pm-group-name"
                  className="ctrl"
                  type="text"
                  placeholder="e.g. Registrar"
                  value={groupName}
                  autoFocus={!isEdit}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>
              <div>
                <label className="lbl" htmlFor="pm-search">Find a permission</label>
                <div className="pm-search">
                  <i className="lni lni-search-alt" aria-hidden="true"></i>
                  <input
                    id="pm-search"
                    className="ctrl"
                    type="search"
                    placeholder="Search pages or actions in every module…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && <button type="button" className="pm-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><i className="lni lni-close"></i></button>}
                </div>
              </div>
            </div>

            <div className="pm-split">
              <nav className="pm-rail" aria-label="Modules">
                {modules.map(m => {
                  const total = (permissionsByModule[m] ?? []).length
                  const on = countIn(m)
                  const matches = searching ? matchCount(m) : 0
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`pm-rail-item${!searching && m === currentModule ? ' active' : ''}${on > 0 ? ' has' : ''}${searching && matches === 0 ? ' dim' : ''}`}
                      aria-current={!searching && m === currentModule ? 'true' : undefined}
                      onClick={() => { setActiveModule(m); setSearch('') }}
                    >
                      <span className="pm-rail-icon"><i className={`lni lni-${moduleIcon(m)}`}></i></span>
                      <span className="pm-rail-name">{moduleLabel(m)}</span>
                      <span className={`pm-rail-count${on === total && total > 0 ? ' full' : on > 0 ? ' some' : ''}`}>
                        {searching ? (matches > 0 ? `${matches} found` : '') : on === total && total > 0 ? 'All' : `${on}/${total}`}
                      </span>
                    </button>
                  )
                })}
              </nav>

              <section className="pm-pane" ref={paneRef} aria-live="polite">
                {!catalogLoaded ? (
                  <div className="pm-empty"><span className="pm-spinner" aria-hidden="true"></span> Loading permissions…</div>
                ) : searching ? (
                  searchResults.length === 0 ? (
                    <div className="pm-empty">
                      <i className="lni lni-search-alt" aria-hidden="true"></i>
                      <div><strong>Nothing matches &ldquo;{search.trim()}&rdquo;</strong><br />Try a page name like &ldquo;Intake Master&rdquo; or an action like &ldquo;Approve&rdquo;.</div>
                    </div>
                  ) : (
                    <div key="search" className="tab-panel-in">
                      {searchResults.map(r => (
                        <div key={r.module} className="pm-result">
                          <div className="pm-result-hdr">
                            <span className="pm-rail-icon has"><i className={`lni lni-${moduleIcon(r.module)}`}></i></span>
                            <span>{moduleLabel(r.module)}</span>
                            <button type="button" className="pm-link" onClick={() => { setActiveModule(r.module); setSearch('') }}>Open module <i className="lni lni-arrow-right"></i></button>
                          </div>
                          {renderSections(r.sections)}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div key={currentModule} className="tab-panel-in">
                    <div className="pm-pane-hdr">
                      <span className="pm-pane-icon"><i className={`lni lni-${moduleIcon(currentModule)}`}></i></span>
                      <div style={{ minWidth: 0 }}>
                        <h3 className="pm-pane-title">{moduleLabel(currentModule)}</h3>
                        <div className="pm-pane-sub"><strong>{moduleOn}</strong> of {moduleIds.length} permissions selected</div>
                      </div>
                      <div className="pm-pane-actions">
                        <button type="button" className="btn btn-neu btn-sm" disabled={moduleOn === moduleIds.length} onClick={() => setMany(moduleIds, true)}>
                          <i className="lni lni-checkmark-circle"></i> Select all
                        </button>
                        <button type="button" className="btn btn-neu btn-sm" disabled={moduleOn === 0} onClick={() => setMany(moduleIds, false)}>
                          Clear
                        </button>
                      </div>
                    </div>
                    {renderSections(sectionsByModule[currentModule] ?? [])}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="pm-review tab-panel-in">
            <div className="pm-review-hdr">
              <div style={{ minWidth: 0 }}>
                <h3 className="pm-pane-title">Review &ldquo;{groupName.trim()}&rdquo;</h3>
                <div className="pm-pane-sub">Check what members of this group will be able to do before {isEdit ? 'saving' : 'creating'} it.</div>
              </div>
              <ReviewStats items={[
                { label: 'Permissions', value: selectedCount },
                { label: 'Modules', value: selections.length },
                { label: 'Pages', value: selections.reduce((n, s) => n + (sectionsByModule[s.module] ?? []).reduce((k, sec) => k + sec.pages.filter(pg => pg.permissions.some(p => selected.has(p.intPermission))).length, 0), 0) },
              ]} />
            </div>

            <DestructiveCaution names={destructiveGranted} />

            {selections.map(s => s.module === 'Other'
              ? <UncataloguedAccess key={s.module} names={s.permissions.map(id => permissionNameById[id] ?? `Permission #${id}`)} />
              : <ModuleAccessMatrix
                  key={s.module}
                  module={s.module}
                  sections={sectionsByModule[s.module] ?? []}
                  isGranted={p => selected.has(p.intPermission)}
                  onEdit={() => { setActiveModule(s.module); setConfirming(false) }}
                />)}
          </div>
        )}

        <div className="modal-footer">
          {!confirming ? (
            <>
              <div className="pm-foot-summary" aria-live="polite">
                {selectedCount === 0
                  ? 'No permissions selected yet'
                  : <><strong>{selectedCount}</strong> permission{selectedCount === 1 ? '' : 's'} · <strong>{selections.length}</strong> module{selections.length === 1 ? '' : 's'}</>}
                {selectedCount > 0 && !groupName.trim() && <span className="pm-foot-warn"> — name the group to continue</span>}
              </div>
              <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" disabled={!canSubmit} onClick={() => setConfirming(true)}>
                Review <i className="lni lni-arrow-right"></i>
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-neu" onClick={() => setConfirming(false)} disabled={isPending}>
                <i className="lni lni-arrow-left"></i> Back
              </button>
              <button className="btn btn-success" disabled={isPending} onClick={isEdit ? handleSave : handleCreate}>
                <i className="lni lni-checkmark-circle"></i> {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Group')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
