export const ROLES = {
  VIEWER: 'viewer',
  OPERATOR: 'operator',
  ADMIN: 'admin'
};

export function canCreateTest(role) {
  return role === ROLES.OPERATOR || role === ROLES.ADMIN;
}

export function canSyncTests(role) {
  return role === ROLES.OPERATOR || role === ROLES.ADMIN;
}

export function canResolveAlert(role) {
  return role === ROLES.OPERATOR || role === ROLES.ADMIN;
}

export function canManageUsers(role) {
  return role === ROLES.ADMIN;
}
