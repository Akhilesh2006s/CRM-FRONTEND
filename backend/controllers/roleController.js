const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const Permission = require('../models/Permission');
const { isSuperAdminUser } = require('../utils/permissions');
const { LEGACY_ROLE_TO_SLUG, ALL_PERMISSIONS } = require('../constants/permissionsCatalog');

const ALLOWED_USER_ROLES = new Set(User.schema.path('role').enumValues || []);

function legacyRoleForRoleDocument(role) {
  if (!role) return null;
  for (const [legacy, slug] of Object.entries(LEGACY_ROLE_TO_SLUG)) {
    if (slug === role.slug && ALLOWED_USER_ROLES.has(legacy)) return legacy;
  }
  if (ALLOWED_USER_ROLES.has(role.name)) return role.name;
  return null;
}

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensurePermissionCatalogSeeded() {
  const count = await Permission.estimatedDocumentCount();
  if (count > 0) return;
  if (!Array.isArray(ALL_PERMISSIONS) || ALL_PERMISSIONS.length === 0) return;
  await Permission.insertMany(ALL_PERMISSIONS, { ordered: false }).catch(() => {});
}

const listRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ isSystem: -1, name: 1 });
    res.json(roles);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createRole = async (req, res) => {
  try {
    const { name, description, cloneFromRoleId } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }
    let permissionKeys = [];
    let clonedFrom = null;
    if (cloneFromRoleId) {
      const source = await Role.findById(cloneFromRoleId);
      if (!source) return res.status(404).json({ message: 'Source role not found' });
      permissionKeys = [...(source.permissionKeys || [])];
      clonedFrom = source._id;
    }
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let n = 1;
    while (await Role.findOne({ slug })) {
      slug = `${baseSlug}-${n++}`;
    }
    const role = await Role.create({
      name: name.trim(),
      slug,
      description: description || '',
      isSystem: false,
      isActive: true,
      clonedFrom,
      permissionKeys,
    });
    res.status(201).json(role);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    const { name, description, isActive } = req.body;
    if (name?.trim()) role.name = name.trim();
    if (description !== undefined) role.description = description;
    if (isActive !== undefined && !role.isSystem) role.isActive = isActive;
    await role.save();
    res.json(role);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem) {
      return res.status(400).json({ message: 'System roles cannot be deleted' });
    }
    const inUse = await User.countDocuments({ roleId: role._id });
    if (inUse > 0) {
      return res.status(400).json({ message: 'Role is assigned to users. Reassign them first.' });
    }
    await Role.findByIdAndDelete(req.params.id);
    res.json({ message: 'Role deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getRolePermissions = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    res.json({ roleId: role._id, permissionKeys: role.permissionKeys || [] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateRolePermissions = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    const { permissionKeys } = req.body;
    if (!Array.isArray(permissionKeys)) {
      return res.status(400).json({ message: 'permissionKeys must be an array' });
    }
    const valid = await Permission.find({ key: { $in: permissionKeys } }).distinct('key');
    const validSet = new Set(valid);
    role.permissionKeys = permissionKeys.filter((k) => validSet.has(k));
    await role.save();
    res.json({ roleId: role._id, permissionKeys: role.permissionKeys });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const listPermissionsCatalog = async (req, res) => {
  try {
    await ensurePermissionCatalogSeeded();
    const permissions = await Permission.find().sort({ module: 1, type: 1, label: 1 });
    const grouped = {};
    for (const p of permissions) {
      const g = p.group || p.module;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(p);
    }
    res.json({ permissions, grouped });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const assignUserRole = async (req, res) => {
  try {
    const { roleId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (roleId) {
      if (!mongoose.Types.ObjectId.isValid(roleId)) {
        return res.status(400).json({ message: 'Invalid roleId' });
      }
      const role = await Role.findById(roleId);
      if (!role || !role.isActive) return res.status(404).json({ message: 'Role not found' });
      user.roleId = role._id;
      const legacyRole = legacyRoleForRoleDocument(role);
      if (legacyRole) {
        user.role = legacyRole;
      }
    } else {
      user.roleId = null;
    }
    await user.save();
    const updated = await User.findById(user._id).select('-password');
    res.json(updated);
  } catch (e) {
    console.error('assignUserRole failed:', e);
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  updateRolePermissions,
  listPermissionsCatalog,
  assignUserRole,
};
