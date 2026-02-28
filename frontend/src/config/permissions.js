/**
 * Frontend Permission Matrix - mirrors backend PERMISSION_MATRIX
 * Role -> Module -> Set of actions (create, read, update, delete)
 */

const PERMISSION_MATRIX = {
  admin: {
    crm: new Set(['create', 'read', 'update', 'delete']),
    voiceAI: new Set(['create', 'read', 'update', 'delete']),
    marketing: new Set(['create', 'read', 'update', 'delete']),
    campaigns: new Set(['create', 'read', 'update', 'delete']),
    analytics: new Set(['create', 'read', 'update', 'delete']),
    helpdesk: new Set(['create', 'read', 'update', 'delete']),
    surveys: new Set(['create', 'read', 'update', 'delete']),
    billing: new Set(['create', 'read', 'update', 'delete']),
    tenants: new Set(['create', 'read', 'update', 'delete']),
    whiteLabel: new Set(['create', 'read', 'update', 'delete']),
    userManagement: new Set(['create', 'read', 'update', 'delete']),
    settings: new Set(['create', 'read', 'update', 'delete']),
    appointments: new Set(['create', 'read', 'update', 'delete']),
    automation: new Set(['create', 'read', 'update', 'delete']),
    inbox: new Set(['create', 'read', 'update', 'delete']),
    webhooks: new Set(['create', 'read', 'update', 'delete']),
  },
  manager: {
    crm: new Set(['create', 'read', 'update', 'delete']),
    voiceAI: new Set(['create', 'read', 'update', 'delete']),
    marketing: new Set(['create', 'read', 'update']),
    campaigns: new Set(['create', 'read', 'update', 'delete']),
    analytics: new Set(['read']),
    helpdesk: new Set(['create', 'read', 'update']),
    surveys: new Set(['create', 'read', 'update', 'delete']),
    billing: new Set([]),
    tenants: new Set([]),
    whiteLabel: new Set([]),
    userManagement: new Set(['read']),
    settings: new Set(['read', 'update']),
    appointments: new Set(['create', 'read', 'update', 'delete']),
    automation: new Set(['create', 'read', 'update']),
    inbox: new Set(['create', 'read', 'update']),
    webhooks: new Set(['create', 'read', 'update']),
  },
  agent: {
    crm: new Set(['create', 'read', 'update']),
    voiceAI: new Set(['create', 'read', 'update']),
    marketing: new Set([]),
    campaigns: new Set([]),
    analytics: new Set(['read']),
    helpdesk: new Set(['create', 'read', 'update']),
    surveys: new Set([]),
    billing: new Set([]),
    tenants: new Set([]),
    whiteLabel: new Set([]),
    userManagement: new Set([]),
    settings: new Set(['read']),
    appointments: new Set(['create', 'read', 'update']),
    automation: new Set([]),
    inbox: new Set(['create', 'read', 'update']),
    webhooks: new Set([]),
  },
  user: {
    crm: new Set(['read']),
    voiceAI: new Set(['read']),
    marketing: new Set([]),
    campaigns: new Set([]),
    analytics: new Set(['read']),
    helpdesk: new Set(['create', 'read', 'update']),
    surveys: new Set([]),
    billing: new Set([]),
    tenants: new Set([]),
    whiteLabel: new Set([]),
    userManagement: new Set([]),
    settings: new Set(['read']),
    appointments: new Set(['read']),
    automation: new Set([]),
    inbox: new Set(['read']),
    webhooks: new Set([]),
  },
  viewer: {
    crm: new Set(['read']),
    voiceAI: new Set(['read']),
    marketing: new Set(['read']),
    campaigns: new Set(['read']),
    analytics: new Set(['read']),
    helpdesk: new Set([]),
    surveys: new Set([]),
    billing: new Set([]),
    tenants: new Set([]),
    whiteLabel: new Set([]),
    userManagement: new Set([]),
    settings: new Set(['read']),
    appointments: new Set(['read']),
    automation: new Set([]),
    inbox: new Set([]),
    webhooks: new Set([]),
  },
};

/**
 * Check if a role has a specific permission on a module
 */
export function hasPermission(role, module, action) {
  const rolePerms = PERMISSION_MATRIX[role];
  if (!rolePerms) return false;
  const modulePerms = rolePerms[module];
  if (!modulePerms) return false;
  return modulePerms.has(action);
}

/**
 * Check if a role can access a module at all (has any permission)
 */
export function canAccessModule(role, module) {
  const rolePerms = PERMISSION_MATRIX[role];
  if (!rolePerms) return false;
  const modulePerms = rolePerms[module];
  if (!modulePerms) return false;
  return modulePerms.size > 0;
}

/**
 * Get list of module IDs accessible to a role
 */
export function getAccessibleModules(role) {
  const rolePerms = PERMISSION_MATRIX[role];
  if (!rolePerms) return [];
  return Object.entries(rolePerms)
    .filter(([, actions]) => actions.size > 0)
    .map(([module]) => module);
}

export default PERMISSION_MATRIX;
