import { apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface PermissionGroupPermission {
  intPermission: number
  permissionName: string
}

// Real backend shape: permissions are stored as {id, name} pairs, not grouped
// by module — module attribution only exists in the permission catalog
// (src/lib/api/users/permissionCatalog.ts). The group's own reported id can
// drift from the catalog's id for the "same" permission (two separate
// endpoints), so callers should reconcile by permissionName against the
// cached catalog rather than trusting these ids blindly — see
// usePermissionWizard's seedFromGroupPermissions.
export interface PermissionGroup {
  id: string
  group: string
  description: string
  permissions: PermissionGroupPermission[]
}

// What's actually sent to create/update — just the resolved catalog ids.
export interface PermissionGroupInput {
  group: string
  description: string
  permissions: number[]
}

// Shape shared by GET (list) and POST (create) responses.
interface PermissionGroupApiItem {
  permissionGroupGuid: string
  groupName: string
  description: string
  permissions: PermissionGroupPermission[]
}

function fromApi(item: PermissionGroupApiItem): PermissionGroup {
  return {
    id: item.permissionGroupGuid,
    group: item.groupName,
    description: item.description,
    permissions: item.permissions,
  }
}

// intPermission ids/names below are drawn from the real permission catalog
// (GET /api/v1/users/admin/permission-groups/permissions — see
// src/lib/api/users/permissionCatalog.ts) so these rows stay valid whether
// the catalog is mocked or real. There's no 'Finance' module yet, so Finance
// Officer has no permissions assigned until that lands. Only used when
// NEXT_PUBLIC_AUTH_MOCK=true.
const mockPermissionGroups: PermissionGroup[] = [
  {
    id: '1',
    group: 'Super Admin',
    description: 'Full system access — every module and permission',
    permissions: [{ intPermission: 25, permissionName: 'Super Admin - All Permissions' }],
  },
  {
    id: '2',
    group: 'Registrar',
    description: 'Manage admissions, registrations, faculty records and academic calendars',
    permissions: [
      { intPermission: 46, permissionName: 'View Intake' },
      { intPermission: 50, permissionName: 'View Programme' },
      { intPermission: 42, permissionName: 'View Faculty' },
      { intPermission: 4, permissionName: 'View Employee' },
    ],
  },
  {
    id: '3',
    group: 'Faculty Dean',
    description: 'View and approve programme, course unit and faculty-level records',
    permissions: [
      { intPermission: 42, permissionName: 'View Faculty' },
      { intPermission: 50, permissionName: 'View Programme' },
      { intPermission: 34, permissionName: 'View Course Unit' },
    ],
  },
  {
    id: '4',
    group: 'Lecturer',
    description: 'Access assigned course units, submit results and manage class attendance',
    permissions: [{ intPermission: 34, permissionName: 'View Course Unit' }],
  },
  {
    id: '5',
    group: 'Finance Officer',
    description: 'Manage fee structures, payments and financial reconciliation',
    permissions: [],
  },
  {
    id: '6',
    group: 'Read Only',
    description: 'View-only access across modules — no create, edit or delete permissions',
    permissions: [
      { intPermission: 42, permissionName: 'View Faculty' },
      { intPermission: 50, permissionName: 'View Programme' },
      { intPermission: 34, permissionName: 'View Course Unit' },
      { intPermission: 46, permissionName: 'View Intake' },
      { intPermission: 4, permissionName: 'View Employee' },
    ],
  },
]

export function getPermissionGroups(): Promise<PermissionGroup[]> {
  if (MOCK_AUTH) return Promise.resolve(mockPermissionGroups)
  return apiGet<PermissionGroupApiItem[] | null>('/api/v1/users/admin/permission-groups').then(data => (data ?? []).map(fromApi))
}

export function createPermissionGroup(input: PermissionGroupInput): Promise<PermissionGroup> {
  if (MOCK_AUTH) {
    const group: PermissionGroup = {
      id: String(mockPermissionGroups.length + 1),
      group: input.group,
      description: input.description,
      permissions: input.permissions.map(id => ({ intPermission: id, permissionName: `Permission #${id}` })),
    }
    mockPermissionGroups.push(group)
    return Promise.resolve(group)
  }
  return apiPost<PermissionGroupApiItem>('/api/v1/users/admin/permission-groups', {
    groupName: input.group,
    description: input.description,
    permissionIds: input.permissions,
  }).then(fromApi)
}

export function updatePermissionGroup(id: string, input: PermissionGroupInput): Promise<PermissionGroup> {
  if (MOCK_AUTH) {
    const existing = mockPermissionGroups.find(g => g.id === id)
    if (!existing) return Promise.reject(new Error('Permission group not found'))
    existing.group = input.group
    existing.description = input.description
    existing.permissions = input.permissions.map(permId => {
      const known = existing.permissions.find(p => p.intPermission === permId)
      return known ?? { intPermission: permId, permissionName: `Permission #${permId}` }
    })
    return Promise.resolve(existing)
  }
  return apiPut<PermissionGroupApiItem>(`/api/v1/users/admin/permission-groups/${id}`, {
    groupName: input.group,
    description: input.description,
    permissionIds: input.permissions,
  }).then(fromApi)
}
