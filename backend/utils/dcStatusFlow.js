/** Roles that may move a DC to pending_dc (Closed Sales → Pending DC). */
const ROLES_MAY_SET_PENDING_DC = new Set([
  'Admin',
  'Super Admin',
  'Manager',
  'Coordinator',
  'Senior Coordinator',
  'Warehouse',
  'Executive Manager',
]);

/** Employee-side roles: Request DC must go to Closed Sales (DcOrder dc_requested) first. */
const EMPLOYEE_REQUEST_ROLES = new Set(['Executive', 'Sales BDE', 'Employee']);

/** DC statuses that have not yet been raised from Closed Sales. */
const PRE_PENDING_DC_STATUSES = new Set(['created', 'po_submitted', 'scheduled_for_later']);

/**
 * @returns {{ allowed: boolean, message?: string, coercedStatus?: string }}
 */
function validateSetPendingDc(dc, userRole, nextStatus) {
  if (nextStatus !== 'pending_dc') {
    return { allowed: true };
  }

  if (ROLES_MAY_SET_PENDING_DC.has(userRole)) {
    return { allowed: true };
  }

  const current = dc?.status;
  if (!PRE_PENDING_DC_STATUSES.has(current)) {
    return { allowed: true };
  }

  if (EMPLOYEE_REQUEST_ROLES.has(userRole)) {
    return {
      allowed: false,
      message:
        'DC must go through Closed Sales first. Your request should set the school to dc_requested; an admin or coordinator must Raise DC from Closed Sales before Pending DC.',
      coercedStatus: 'po_submitted',
    };
  }

  return { allowed: true };
}

module.exports = {
  ROLES_MAY_SET_PENDING_DC,
  EMPLOYEE_REQUEST_ROLES,
  PRE_PENDING_DC_STATUSES,
  validateSetPendingDc,
};
