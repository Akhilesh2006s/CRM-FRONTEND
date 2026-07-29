/**
 * Seed permissions catalog and system role templates.
 * Run: node backend/scripts/seedPermissions.js (from navbar-landing root with MONGO_URI)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const User = require('../models/User');
const {
  ALL_PERMISSIONS,
  ROLE_TEMPLATE_KEYS,
  LEGACY_ROLE_TO_SLUG,
} = require('../constants/permissionsCatalog');

const SYSTEM_ROLES = [
  { name: 'Super Admin', slug: 'super-admin', isSystem: true },
  { name: 'Admin', slug: 'admin', isSystem: true },
  { name: 'Finance Manager', slug: 'finance-manager', isSystem: true },
  { name: 'Executive', slug: 'executive', isSystem: true },
  { name: 'Manager', slug: 'manager', isSystem: true },
  { name: 'Coordinator', slug: 'coordinator', isSystem: true },
  { name: 'Senior Coordinator', slug: 'senior-coordinator', isSystem: true },
  { name: 'Warehouse Executive', slug: 'warehouse-executive', isSystem: true },
  { name: 'Warehouse Manager', slug: 'warehouse-manager', isSystem: true },
  { name: 'Trainer', slug: 'trainer', isSystem: true },
  { name: 'Vendor', slug: 'vendor', isSystem: true },
];

async function seed() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected. Seeding permissions...');

  for (const p of ALL_PERMISSIONS) {
    await Permission.findOneAndUpdate({ key: p.key }, p, { upsert: true, new: true });
  }
  console.log(`Upserted ${ALL_PERMISSIONS.length} permissions`);

  for (const def of SYSTEM_ROLES) {
    const keys = ROLE_TEMPLATE_KEYS[def.slug] || [];
    await Role.findOneAndUpdate(
      { slug: def.slug },
      {
        name: def.name,
        slug: def.slug,
        isSystem: true,
        isActive: true,
        permissionKeys: keys,
        description: `System template: ${def.name}`,
      },
      { upsert: true, new: true }
    );
  }
  console.log(`Upserted ${SYSTEM_ROLES.length} system roles`);

  const users = await User.find({});
  let linked = 0;
  for (const user of users) {
    const slug = LEGACY_ROLE_TO_SLUG[user.role];
    if (!slug) continue;
    const role = await Role.findOne({ slug });
    if (role && String(user.roleId) !== String(role._id)) {
      user.roleId = role._id;
      await user.save();
      linked += 1;
    }
  }
  console.log(`Linked roleId on ${linked} users`);
  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
