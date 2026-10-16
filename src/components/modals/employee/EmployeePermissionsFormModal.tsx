'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { EmployeeListItem } from '@/lib/api/employee/employee'
import { AuthError } from '@/lib/api/client'
import { usePermissionGroups, PermissionGroup } from '@/hooks/config/usePermissionGroups'
import { usePermissionCatalog } from '@/hooks/users/usePermissionCatalog'
import { useAssignEmployeePermissionGroups, useEmployeePermissionGroups } from '@/hooks/employee/useEmployees'
import { catalogSections, ModuleAccessMatrix, UncataloguedAccess, DestructiveCaution, ReviewStats, DESTRUCTIVE } from '@/components/permissions/PermissionMatrix'

// Assign and Edit are two entry points into the same form — they only ever
// differed in title/icon, success/failure copy, and the confirm-step button
// labels. Both seed from what's already assigned and save through the same
// PUT; kept as separate row actions per product request, just sharing one
// component via mode.
interface EmployeePermissionsFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  employee: EmployeeListItem | null
}

// Group permissions are matched to the catalog by name — the two endpoints
// don't always share ids (see PermissionGroup's comment in permissionGroup.ts).
const namesOf = (gs: PermissionGroup[]) => new Set(gs.flatMap(g => g.permissions.map(p => p.permissionName)))

export function EmployeePermissionsFormModal({ isOpen, onClose, showToast, mode, employee }: EmployeePermissionsFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: groups = [] } = usePermissionGroups()
  const { data: catalog = [] } = usePermissionCatalog()
  const { modules, sectionsByModule } = useMemo(() => catalogSections(catalog), [catalog])
  const catalogNames = useMemo(
    () => new Set(Object.values(sectionsByModule).flat().flatMap(s => s.pages.flatMap(pg => pg.permissions.map(p => p.permissionName)))),
    [sectionsByModule],
  )

  const assignPermissionGroups = useAssignEmployeePermissionGroups()
  const {
    data: assignedGroupIds,
    isLoading: loadingAssignedGroups,
    isError: assignedGroupsErrored,
    error: assignedGroupsError,
  } = useEmployeePermissionGroups(employee?.employeeGuid ?? null, isOpen)

  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [initialIds, setInitialIds] = useState<string[]>([])
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  // Tracks which employee we've already seeded for, so a background refetch
  // of the assigned-groups query doesn't clobber in-progress edits.
  const seededForRef = useRef<string | null>(null)

  const employeeName = employee ? `${employee.title} ${employee.firstName} ${employee.surname}` : ''

  // Seed from whatever the employee is already assigned, once per employee
  // per time the modal is open — not on every background refetch.
  useEffect(() => {
    if (!isOpen || !employee) {
      seededForRef.current = null
      return
    }
    if (loadingAssignedGroups || !assignedGroupIds) return
    if (seededForRef.current === employee.employeeGuid) return
    const validIds = assignedGroupIds.filter(id => groups.some(g => g.id === id))
    setAssignedIds(validIds)
    setInitialIds(validIds)
    setPreviewId(validIds[0] ?? groups[0]?.id ?? null)
    seededForRef.current = employee.employeeGuid
  }, [isOpen, employee, loadingAssignedGroups, assignedGroupIds, groups])

  useEffect(() => { paneRef.current?.scrollTo({ top: 0 }) }, [previewId])

  const assignedGroups = useMemo(() => groups.filter(g => assignedIds.includes(g.id)), [groups, assignedIds])
  const combinedNames = useMemo(() => namesOf(assignedGroups), [assignedGroups])

  if (!isOpen || !employee) return null

  function handleClose() {
    setAssignedIds([])
    setInitialIds([])
    setPreviewId(null)
    setSearch('')
    setConfirming(false)
    setSaved(false)
    setFailure(null)
    seededForRef.current = null
    onClose()
  }

  function toggleAssigned(id: string) {
    setAssignedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Permissions Updated!' : 'Permissions Assigned!'}
            subtitle={isEdit ? `Permissions have been updated for ${employeeName}.` : `Permissions have been assigned to ${employeeName}.`}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title={isEdit ? "Couldn't Update Permissions" : "Couldn't Assign Permissions"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (assignedGroupsErrored) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Current Permissions"
            subtitle={assignedGroupsError instanceof AuthError ? (assignedGroupsError.message || 'Failed to load this employee’s current permissions.') : 'Failed to load this employee’s current permissions.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  const title = (
    <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil-alt' : 'lni-lock'}`}></i> {isEdit ? 'Edit Permissions' : 'Assign Permissions'} — {employeeName}</div>
  )

  if (loadingAssignedGroups) {
    return (
      <div className="modal-overlay open" id={isEdit ? 'edit-employee-permissions-modal' : 'assign-employee-permissions-modal'}>
        <div className="modal pm-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            {title}
            <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
          </div>
          <div className="pm-empty"><span className="pm-spinner" aria-hidden="true"></span> Loading current permissions…</div>
        </div>
      </div>
    )
  }

  const employeeGuid = employee.employeeGuid

  function handleSubmit() {
    assignPermissionGroups.mutate(
      { employeeGuid, permissionGroupGuids: assignedIds },
      {
        onSuccess: () => { setSaved(true); showToast(isEdit ? 'Permissions updated successfully' : 'Permissions assigned successfully') },
        onError: (error: Error) => {
          // A missing record usually means the employee was deleted while the modal was open.
          const notFound = error instanceof AuthError && error.code === 'not_found'
          setFailure(notFound ? 'This employee no longer exists — it may have been deleted.' : (error.message || `Failed to ${isEdit ? 'update' : 'assign'} permissions. Please try again.`))
        },
      },
    )
  }

  // Granted access for a set of permission names, module by module.
  function renderAccess(names: Set<string>, onEdit?: () => void) {
    const uncatalogued = Array.from(names).filter(n => !catalogNames.has(n))
    return (
      <>
        {modules.map(m => (
          <ModuleAccessMatrix key={m} module={m} sections={sectionsByModule[m] ?? []} isGranted={p => names.has(p.permissionName)} />
        ))}
        <UncataloguedAccess names={uncatalogued} onEdit={onEdit} />
      </>
    )
  }

  const modulesTouched = (names: Set<string>) =>
    modules.filter(m => (sectionsByModule[m] ?? []).some(s => s.pages.some(pg => pg.permissions.some(p => names.has(p.permissionName))))).length

  const term = search.trim().toLowerCase()
  const visibleGroups = term ? groups.filter(g => `${g.group} ${g.description}`.toLowerCase().includes(term)) : groups
  const previewGroup = groups.find(g => g.id === previewId) ?? null
  const previewNames = previewGroup ? namesOf([previewGroup]) : new Set<string>()
  const previewAssigned = !!previewGroup && assignedIds.includes(previewGroup.id)

  const added = groups.filter(g => assignedIds.includes(g.id) && !initialIds.includes(g.id))
  const removed = groups.filter(g => initialIds.includes(g.id) && !assignedIds.includes(g.id))
  const kept = groups.filter(g => assignedIds.includes(g.id) && initialIds.includes(g.id))
  const destructive = Array.from(combinedNames).filter(n => DESTRUCTIVE.test(n))
  const canReview = assignedIds.length > 0 && combinedNames.size > 0

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-employee-permissions-modal' : 'assign-employee-permissions-modal'}>
      <div className="modal pm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          {title}
          <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
        </div>

        {!confirming ? (
          <div className="pm-body">
            <div className="pm-top" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <div>
                <label className="lbl" htmlFor="ep-search">Permission groups</label>
                <div className="pm-search">
                  <i className="lni lni-search-alt" aria-hidden="true"></i>
                  <input
                    id="ep-search"
                    className="ctrl"
                    type="search"
                    placeholder="Search groups by name or description…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && <button type="button" className="pm-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><i className="lni lni-close"></i></button>}
                </div>
              </div>
            </div>

            <div className="pm-split">
              <nav className="pm-rail" aria-label="Permission groups">
                {visibleGroups.length === 0 ? (
                  <div className="pm-rail-empty">{groups.length === 0 ? 'No permission groups yet. Create one in Permission Master.' : 'No group matches your search.'}</div>
                ) : visibleGroups.map(g => {
                  const on = assignedIds.includes(g.id)
                  return (
                    <div key={g.id} className={`pm-rail-item pm-group-item${g.id === previewId ? ' active' : ''}${on ? ' has' : ''}`}>
                      <input
                        type="checkbox"
                        className="pm-check"
                        checked={on}
                        onChange={() => toggleAssigned(g.id)}
                        aria-label={`${on ? 'Unassign' : 'Assign'} ${g.group}`}
                      />
                      <button type="button" className="pm-group-btn" onClick={() => setPreviewId(g.id)} aria-current={g.id === previewId ? 'true' : undefined}>
                        <span className="pm-rail-name">{g.group}</span>
                        <span className="pm-rail-count">{g.permissions.length}</span>
                      </button>
                    </div>
                  )
                })}
              </nav>

              <section className="pm-pane" ref={paneRef} aria-live="polite">
                {!previewGroup ? (
                  <div className="pm-empty">
                    <i className="lni lni-shield" aria-hidden="true"></i>
                    <div><strong>Pick a group to preview</strong><br />Tick a group to assign it — access from every ticked group combines.</div>
                  </div>
                ) : (
                  <div key={previewGroup.id} className="tab-panel-in">
                    <div className="pm-pane-hdr">
                      <span className="pm-pane-icon"><i className="lni lni-shield"></i></span>
                      <div style={{ minWidth: 0 }}>
                        <h3 className="pm-pane-title">{previewGroup.group}</h3>
                        <div className="pm-pane-sub">
                          <strong>{previewNames.size}</strong> permission{previewNames.size === 1 ? '' : 's'} across <strong>{modulesTouched(previewNames)}</strong> module{modulesTouched(previewNames) === 1 ? '' : 's'}
                          {previewAssigned && <span className="badge badge-green" style={{ marginLeft: 8 }}>Assigned</span>}
                        </div>
                      </div>
                      <div className="pm-pane-actions">
                        <button type="button" className={`btn btn-sm ${previewAssigned ? 'btn-neu' : 'btn-primary'}`} onClick={() => toggleAssigned(previewGroup.id)}>
                          {previewAssigned ? <><i className="lni lni-close"></i> Unassign</> : <><i className="lni lni-plus"></i> Assign group</>}
                        </button>
                      </div>
                    </div>
                    {previewNames.size === 0
                      ? <div className="pm-empty">This group has no permissions yet.</div>
                      : renderAccess(previewNames)}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="pm-review tab-panel-in">
            <div className="pm-review-hdr">
              <div style={{ minWidth: 0 }}>
                <h3 className="pm-pane-title">Review access for {employeeName}</h3>
                <div className="pm-pane-sub">This is everything {employee.firstName} will be able to do, combined across the assigned groups.</div>
              </div>
              <ReviewStats items={[
                { label: 'Groups', value: assignedIds.length },
                { label: 'Permissions', value: combinedNames.size },
                { label: 'Modules', value: modulesTouched(combinedNames) },
              ]} />
            </div>

            <div className="pm-group-changes">
              {added.map(g => <span key={g.id} className="pm-group-chip added"><i className="lni lni-plus"></i>{g.group}</span>)}
              {removed.map(g => <span key={g.id} className="pm-group-chip removed"><i className="lni lni-minus"></i>{g.group}</span>)}
              {kept.map(g => <span key={g.id} className="pm-group-chip">{g.group}</span>)}
            </div>

            <DestructiveCaution names={destructive} subject={employee.firstName} />
            {renderAccess(combinedNames)}
          </div>
        )}

        <div className="modal-footer">
          {!confirming ? (
            <>
              <div className="pm-foot-summary" aria-live="polite">
                {assignedIds.length === 0
                  ? 'No groups assigned yet'
                  : <><strong>{assignedIds.length}</strong> group{assignedIds.length === 1 ? '' : 's'} · <strong>{combinedNames.size}</strong> permission{combinedNames.size === 1 ? '' : 's'}</>}
              </div>
              <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" disabled={!canReview} onClick={() => setConfirming(true)}>
                Review <i className="lni lni-arrow-right"></i>
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-neu" onClick={() => setConfirming(false)} disabled={assignPermissionGroups.isPending}>
                <i className="lni lni-arrow-left"></i> Back
              </button>
              <button className="btn btn-success" disabled={assignPermissionGroups.isPending} onClick={handleSubmit}>
                <i className="lni lni-checkmark-circle"></i> {assignPermissionGroups.isPending ? (isEdit ? 'Saving…' : 'Assigning…') : (isEdit ? 'Save Changes' : 'Assign Permissions')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
