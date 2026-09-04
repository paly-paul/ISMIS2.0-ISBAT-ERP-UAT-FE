'use client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { EmployeeListItem } from '@/lib/api/employee/employee'
import { AuthError } from '@/lib/api/client'
import { usePermissionGroups } from '@/hooks/config/usePermissionGroups'
import { usePermissionCatalog, moduleIcon, moduleLabel } from '@/hooks/users/usePermissionCatalog'
import { useAssignEmployeePermissionGroups, useEmployeePermissionGroups } from '@/hooks/employee/useEmployees'
import { buildBreakdown } from '@/lib/permissionBreakdown'

// Assign and Edit are two entry points into the same form — they only ever
// differed in title/icon, success/failure copy, and the confirm-step button
// labels. Both seed from what's already assigned and save through the same
// PUT; kept as separate row actions per product request, just sharing one
// component via mode.
interface EmployeePermissionsFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  employee: EmployeeListItem | null
}

export function EmployeePermissionsFormModal({ isOpen, onClose, showToast, mode, employee }: EmployeePermissionsFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: groups = [] } = usePermissionGroups()
  const { data: catalog = [] } = usePermissionCatalog()

  const assignPermissionGroups = useAssignEmployeePermissionGroups()
  const {
    data: assignedGroupIds,
    isLoading: loadingAssignedGroups,
    isError: assignedGroupsErrored,
    error: assignedGroupsError,
  } = useEmployeePermissionGroups(employee?.employeeGuid ?? null, isOpen)

  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [loadedGroupIds, setLoadedGroupIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [openModule, setOpenModule] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const tabRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  // Tracks which employee we've already seeded loadedGroupIds for, so a
  // background refetch of the assigned-groups query (e.g. window refocus)
  // doesn't clobber in-progress edits while the modal stays open.
  const seededForRef = useRef<string | null>(null)

  const employeeName = employee ? `${employee.title} ${employee.firstName} ${employee.surname}` : ''

  const groupOptions = useMemo(
    () => groups.map(g => ({ value: g.id, label: g.group + (loadedGroupIds.includes(g.id) ? ' (Added)' : '') })),
    [groups, loadedGroupIds],
  )
  const loadedGroups = useMemo(() => groups.filter(g => loadedGroupIds.includes(g.id)), [groups, loadedGroupIds])

  // What actually gets saved is the union across every loaded group,
  // regardless of which group's tab is currently being previewed.
  const combinedBreakdown = useMemo(() => buildBreakdown(loadedGroups, catalog), [loadedGroups, catalog])

  // Each tab previews just that one group's own grants.
  const activeGroup = loadedGroups.find(g => g.id === activeTab) ?? null
  const activeBreakdown = useMemo(
    () => buildBreakdown(activeGroup ? [activeGroup] : [], catalog),
    [activeGroup, catalog],
  )

  const hasGrantedPermissions = combinedBreakdown.some(b => b.grantedCount > 0)

  // Accordion — switching tabs starts on the first module; otherwise keep
  // whatever's open if still present.
  useEffect(() => {
    setOpenModule(prev => (prev && activeBreakdown.some(b => b.module === prev)) ? prev : (activeBreakdown[0]?.module ?? null))
  }, [activeBreakdown])

  // Fall back to the first remaining tab if the group it was showing gets removed.
  useEffect(() => {
    if (activeTab && !loadedGroupIds.includes(activeTab)) setActiveTab(loadedGroupIds[0] ?? null)
  }, [activeTab, loadedGroupIds])

  useLayoutEffect(() => {
    const el = activeTab ? tabRefs.current[activeTab] : undefined
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab, loadedGroups, isOpen])

  // Seed the tabs from whatever the employee is already assigned, once per
  // employee per time the modal is open — not on every background refetch.
  useEffect(() => {
    if (!isOpen || !employee) {
      seededForRef.current = null
      return
    }
    if (loadingAssignedGroups || !assignedGroupIds) return
    if (seededForRef.current === employee.employeeGuid) return
    const validIds = assignedGroupIds.filter(id => groups.some(g => g.id === id))
    setLoadedGroupIds(validIds)
    setActiveTab(validIds[0] ?? null)
    seededForRef.current = employee.employeeGuid
  }, [isOpen, employee, loadingAssignedGroups, assignedGroupIds, groups])

  if (!isOpen || !employee) return null

  function handleClose() {
    setSelectedGroupId('')
    setLoadedGroupIds([])
    setActiveTab(null)
    setOpenModule(null)
    setConfirming(false)
    setSaved(false)
    setFailure(null)
    seededForRef.current = null
    onClose()
  }

  function handleAddGroup() {
    if (!selectedGroupId) return
    setLoadedGroupIds(prev => prev.includes(selectedGroupId) ? prev : [...prev, selectedGroupId])
    setActiveTab(selectedGroupId)
  }

  function removeGroup(id: string) {
    setLoadedGroupIds(prev => prev.filter(gid => gid !== id))
  }

  function toggleModuleOpen(module: string) {
    setOpenModule(prev => prev === module ? null : module)
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

  if (loadingAssignedGroups) {
    return (
      <div className="modal-overlay open" id={isEdit ? 'edit-employee-permissions-modal' : 'assign-employee-permissions-modal'}>
        <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil-alt' : 'lni-lock'}`}></i> {isEdit ? 'Edit Permissions' : 'Assign Permissions'} — <span className="font-mono">{employeeName}</span></div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
            <span style={{ color: 'var(--g400)' }}>Loading current permissions…</span>
          </div>
        </div>
      </div>
    )
  }

  const employeeGuid = employee.employeeGuid

  function handleSubmit() {
    assignPermissionGroups.mutate(
      { employeeGuid, permissionGroupGuids: loadedGroupIds },
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

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-employee-permissions-modal' : 'assign-employee-permissions-modal'}>
      <div className="modal modal-xl modal-flex" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil-alt' : 'lni-lock'}`}></i> {isEdit ? 'Edit Permissions' : 'Assign Permissions'} — <span className="font-mono">{employeeName}</span></div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll">
          {!confirming ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="g3">
                <div className="fg span2">
                  <div className="lbl">Permission Group</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SearchSelect placeholder="Select permission group…" options={groupOptions} value={selectedGroupId} onChange={setSelectedGroupId} />
                    </div>
                    <button
                      type="button"
                      className="btn btn-neu"
                      style={{ width: 40, padding: 0, justifyContent: 'center', flexShrink: 0 }}
                      title="Add group permissions"
                      disabled={!selectedGroupId}
                      onClick={handleAddGroup}
                    >
                      <i className="lni lni-checkmark"></i>
                    </button>
                  </div>
                </div>
              </div>

              {loadedGroups.length > 0 ? (
                <div className="fg" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div className="lbl">Permissions</div>
                  <div className="tab-bar" style={{ marginBottom: 12 }}>
                    {loadedGroups.map(g => (
                      <button
                        key={g.id}
                        ref={el => { if (el) tabRefs.current[g.id] = el }}
                        type="button"
                        className={`tab-btn${activeTab === g.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(g.id)}
                      >
                        {g.group}
                        <i
                          className="lni lni-close"
                          style={{ fontSize: 10 }}
                          title={`Remove ${g.group}`}
                          onClick={e => { e.stopPropagation(); removeGroup(g.id) }}
                        ></i>
                      </button>
                    ))}
                    <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
                  </div>
                  <div key={activeTab} className="perm-blocks-scroll tab-panel-in">
                    {activeBreakdown.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--g400)', fontStyle: 'italic', padding: '8px 2px' }}>No permissions found in the catalog.</div>
                    ) : activeBreakdown.map(b => (
                      <div key={b.module} className={`perm-block${openModule === b.module ? '' : ' closed'}`}>
                        <div className="perm-block-hdr" onClick={() => toggleModuleOpen(b.module)}>
                          <i className={`lni lni-${moduleIcon(b.module)}`}></i>
                          {moduleLabel(b.module)}
                          <span className="badge badge-blue" style={{ marginLeft: 6 }}>{b.grantedCount}/{b.totalCount} Accessible</span>
                          <i className="lni lni-chevron-down perm-block-chevron" style={{ marginLeft: 'auto' }}></i>
                        </div>
                        <div className="perm-block-body">
                          {b.pages.map(pg => {
                            const accessible = pg.permissions.filter(p => p.granted)
                            const notAccessible = pg.permissions.filter(p => !p.granted)
                            return (
                              <div key={pg.page} style={{ gridColumn: '1 / -1' }}>
                                <div className="perm-page-title">
                                  <i className="lni lni-folder"></i>
                                  {pg.page}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                  <div style={{ borderRight: '1px dashed var(--g200)', paddingRight: 16 }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>
                                      <i className="lni lni-checkmark-circle" style={{ marginRight: 4 }}></i>Accessible
                                    </div>
                                    {accessible.length > 0 ? (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {accessible.map((p, i) => (
                                          <span key={`${p.name}-${i}`} className="badge badge-green">{p.name}</span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 11.5, color: 'var(--g400)', fontStyle: 'italic' }}>None</div>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>
                                      <i className="lni lni-lock" style={{ marginRight: 4 }}></i>Not Accessible
                                    </div>
                                    {notAccessible.length > 0 ? (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {notAccessible.map((p, i) => (
                                          <span key={`${p.name}-${i}`} className="badge badge-grey">{p.name}</span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 11.5, color: 'var(--g400)', fontStyle: 'italic' }}>None</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="perm-empty-hint">
                  <i className="lni lni-arrow-up perm-empty-arrow"></i>
                  <div className="perm-empty-icon-wrap">
                    <i className="lni lni-graduation perm-empty-icon"></i>
                    <span className="perm-empty-orbit book"><i className="lni lni-book"></i></span>
                    <span className="perm-empty-orbit pencil"><i className="lni lni-pencil-alt"></i></span>
                  </div>
                  <div className="perm-empty-title">Pick a permission group above to get started</div>
                  <div className="perm-empty-sub">Choose a group, then tap the tick button to preview the access it grants. Add more groups the same way — their access combines.</div>
                </div>
              )}
            </div>
          ) : (
            <div className="tab-panel-in" style={{ padding: '4px 2px 8px' }}>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                  background: 'var(--b50)', border: '1.5px solid var(--b200)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <i className="lni lni-shield" style={{ fontSize: 24, color: 'var(--b600)' }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--g900)' }}>{isEdit ? 'Confirm Permission Update' : 'Confirm Permission Assignment'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--g500)', marginTop: 4 }}>
                  {isEdit ? 'Review the access scope before saving changes for this employee' : 'Review the access scope before assigning it to this employee'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {combinedBreakdown.filter(b => b.grantedCount > 0).map(b => (
                  <div key={b.module} style={{
                    padding: '12px 14px',
                    border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', background: 'var(--surface)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center',
                        background: 'var(--b100)', color: 'var(--b700)', flexShrink: 0,
                      }}>
                        <i className={`lni lni-${moduleIcon(b.module)}`}></i>
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--g900)', flex: 1, minWidth: 0 }}>{moduleLabel(b.module)}</div>
                      <span className="badge badge-green">{b.grantedCount} Accessible</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {b.pages.flatMap(pg => pg.permissions.filter(p => p.granted).map((p, i) => (
                        <span key={`${pg.page}-${p.name}-${i}`} className="badge badge-green">{p.name}</span>
                      )))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!confirming ? (
            <>
              <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" disabled={loadedGroups.length === 0 || !hasGrantedPermissions} onClick={() => setConfirming(true)}>
                <i className="lni lni-checkmark"></i> {isEdit ? 'Review Changes' : 'Submit'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-neu" onClick={() => setConfirming(false)}>
                <i className="lni lni-arrow-left"></i> Back
              </button>
              <button className="btn btn-success" disabled={assignPermissionGroups.isPending} onClick={handleSubmit}>
                <i className="lni lni-checkmark-circle"></i> {assignPermissionGroups.isPending ? (isEdit ? 'Saving…' : 'Assigning…') : (isEdit ? 'Confirm & Save' : 'Confirm & Assign')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
