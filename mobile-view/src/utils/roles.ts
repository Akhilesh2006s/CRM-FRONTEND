/**
 * Role helpers — keep aligned with navbar-landing/components/dashboard/Sidebar.tsx
 */

export type CrmUser = {
  role?: string;
  roles?: string[];
};

function normalizeRole(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

export function roleIncludes(user: CrmUser | null | undefined, match: string): boolean {
  const m = normalizeRole(match);
  const primary = normalizeRole(user?.role);
  const extras = (user?.roles ?? []).map(normalizeRole);
  return primary.includes(m) || extras.some((r) => r.includes(m));
}

export function getRoleFlags(user: CrmUser | null | undefined) {
  const role = (user?.role ?? '').trim();
  const roleLower = role.toLowerCase();
  return {
    role,
    isAdmin:
      roleLower === 'admin' ||
      roleLower === 'super admin' ||
      role === 'Admin' ||
      role === 'Super Admin',
    isSuperAdmin: roleLower === 'super admin' || role === 'Super Admin',
    isPartner: role === 'Partner' || role === 'Vendor' || roleLower === 'partner' || roleLower === 'vendor',
    isManager: role === 'Manager' || roleLower === 'manager',
    isCoordinator: role === 'Coordinator' || roleLower === 'coordinator',
    isSeniorCoordinator:
      role === 'Senior Coordinator' || roleLower === 'senior coordinator',
    isExecutiveManager:
      role === 'Executive Manager' ||
      roleLower === 'executive manager' ||
      roleIncludes(user, 'executive manager'),
    isRegionalManager: role === 'Regional Manager' || roleLower === 'regional manager',
    isRegionalHead: role === 'Regional Head' || roleLower === 'regional head',
    isNationalHead: role === 'National Head' || roleLower === 'national head',
    isTrainer: role === 'Trainer',
    isWarehouseExecutive: role === 'Warehouse Executive',
    isWarehouseManager: role === 'Warehouse Manager',
    isFinanceManager: roleIncludes(user, 'finance manager'),
    isExecutive: role === 'Executive',
    isEmployee: role === 'Executive' || roleIncludes(user, 'sales bde'),
  };
}
