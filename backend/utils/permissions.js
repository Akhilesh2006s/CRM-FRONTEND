const User = require('../models/User');
const Role = require('../models/Role');
const {
  ALL_PERMISSION_KEYS,
  LEGACY_ROLE_TO_SLUG,
  ROLE_TEMPLATE_KEYS,
} = require('../constants/permissionsCatalog');

function isRbacEnabled() {
  return process.env.RBAC_ENABLED !== 'false';
}

function getSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS || 'amenityforge@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isSuperAdminUser(user) {
  if (!user) return false;
  const email = String(user.email || '').toLowerCase();
  if (getSuperAdminEmails().includes(email)) return true;
  return user.role === 'Super Admin';
}

async function resolveRoleForUser(user) {
  if (!user) return null;
  if (user.roleId) {
    const byId = await Role.findById(user.roleId);
    if (byId && byId.isActive) return byId;
  }
  const slug = LEGACY_ROLE_TO_SLUG[user.role];
  if (slug) {
    return Role.findOne({ slug, isActive: true });
  }
  return null;
}

async function loadUserPermissions(user) {
  if (!isRbacEnabled()) {
    return {
      permissionKeys: ALL_PERMISSION_KEYS,
      isSuperAdmin: isSuperAdminUser(user),
      roleName: user?.role || null,
      roleId: user?.roleId || null,
    };
  }

  if (isSuperAdminUser(user)) {
    return {
      permissionKeys: ALL_PERMISSION_KEYS,
      isSuperAdmin: true,
      roleName: user?.role || 'Super Admin',
      roleId: user?.roleId || null,
    };
  }

  const role = await resolveRoleForUser(user);
  if (!role) {
    const slug = LEGACY_ROLE_TO_SLUG[user?.role];
    const fallback = slug ? ROLE_TEMPLATE_KEYS[slug] || [] : [];
    return {
      permissionKeys: fallback,
      isSuperAdmin: false,
      roleName: user?.role || null,
      roleId: null,
    };
  }

  const fromDb = Array.isArray(role.permissionKeys) ? role.permissionKeys : [];
  // System roles: keep DB keys and ensure catalog template keys (e.g. Request DC for Executive)
  const template =
    role.isSystem && role.slug && ROLE_TEMPLATE_KEYS[role.slug]
      ? ROLE_TEMPLATE_KEYS[role.slug]
      : [];
  const permissionKeys =
    template.length > 0 ? [...new Set([...fromDb, ...template])] : fromDb;

  return {
    permissionKeys,
    isSuperAdmin: false,
    roleName: role.name,
    roleId: role._id,
  };
}

function hasPermission(permissionKeys, key, user) {
  if (!key) return true;
  if (isSuperAdminUser(user)) return true;
  if (!permissionKeys || !Array.isArray(permissionKeys)) return false;
  return permissionKeys.includes(key);
}

function hasAnyPermission(permissionKeys, keys, user) {
  if (isSuperAdminUser(user)) return true;
  return keys.some((k) => hasPermission(permissionKeys, k, user));
}

async function buildAuthPayload(user, token) {
  const { permissionKeys, isSuperAdmin, roleName, roleId } = await loadUserPermissions(user);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleId: roleId || user.roleId || null,
    roleName: roleName || user.role,
    roles: user.roles || [],
    hasCompletedFirstTimeSetup: user.hasCompletedFirstTimeSetup || false,
    permissions: permissionKeys,
    isSuperAdmin,
    rbacEnabled: isRbacEnabled(),
    token,
  };
}

module.exports = {
  isRbacEnabled,
  isSuperAdminUser,
  resolveRoleForUser,
  loadUserPermissions,
  hasPermission,
  hasAnyPermission,
  buildAuthPayload,
};
