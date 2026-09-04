'use client'
import { useMemo } from 'react'
import { ModalProps } from '../types'
import { PermissionGroup } from '@/lib/api/academic/permissionGroup'
import { usePermissionCatalog, moduleIcon, moduleLabel } from '@/hooks/users/usePermissionCatalog'

interface ViewPermissionModalProps extends ModalProps {
  permissionGroup: PermissionGroup | null
  onEdit?: () => void
  canEdit?: boolean
}

// Read-only mirror of PermissionFormModal's "Confirm Changes" summary step, minus the editable checkboxes.
// `permissions` only carries {id, name} with no module attribution, so module grouping is done by
// reconciling permissionName against the cached catalog, same as PermissionFormModal's own seeding does.
export function ViewPermissionModal({ isOpen, onClose, permissionGroup, onEdit, canEdit }: ViewPermissionModalProps) {
  const { data: catalog = [] } = usePermissionCatalog(isOpen)

  const moduleByPermissionName = useMemo(() => {
    const map: Record<string, string> = {}
    catalog.forEach(m => m.subModules.forEach(sm => sm.pages.forEach(pg => pg.permissions.forEach(p => {
      map[p.permissionName] = m.mainModule
    }))))
    return map
  }, [catalog])

  // Grouped before the isOpen/permissionGroup early return below, so this
  // hook always runs in the same order across renders regardless of
  // whether the modal happens to be open with data yet.
  const grouped = useMemo(() => {
    if (!permissionGroup) return []
    const byModule = new Map<string, string[]>()
    permissionGroup.permissions.forEach(p => {
      const mod = moduleByPermissionName[p.permissionName] ?? 'Other'
      if (!byModule.has(mod)) byModule.set(mod, [])
      byModule.get(mod)!.push(p.permissionName)
    })
    return Array.from(byModule.entries())
  }, [permissionGroup, moduleByPermissionName])

  if (!isOpen || !permissionGroup) return null

  return (
    <div className="modal-overlay open" id="view-permission-modal">
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Permission Group — <span className="font-mono">{permissionGroup.group}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid" style={{ marginBottom: 18 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>Group Name</div>
              <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{permissionGroup.group}</div>
            </div>
            {permissionGroup.description && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>Description</div>
                <div style={{ fontSize: '14px', color: 'var(--g900)', fontWeight: 500 }}>{permissionGroup.description}</div>
              </div>
            )}
          </div>

          <div className="sec-divider">Access Scope ({permissionGroup.permissions.length} permission{permissionGroup.permissions.length !== 1 ? 's' : ''})</div>

          {grouped.length === 0 ? (
            <div className="text-g400 italic" style={{ fontSize: 12.5, padding: '12px 0' }}>No permissions assigned to this group.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped.map(([mod, names]) => (
                <div key={mod} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', background: 'var(--surface)',
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center',
                    background: 'var(--b100)', color: 'var(--b700)', flexShrink: 0,
                  }}>
                    <i className={`lni lni-${moduleIcon(mod)}`}></i>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--g900)' }}>{moduleLabel(mod)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--g500)' }}>{names.join(', ')}</div>
                  </div>
                  <span className="badge badge-blue">{names.length}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={onEdit}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
