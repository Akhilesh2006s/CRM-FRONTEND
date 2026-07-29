const { loadUserPermissions, hasPermission, isSuperAdminUser } = require('../utils/permissions');

const requirePermission = (...keys) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (isSuperAdminUser(req.user)) {
        return next();
      }
      const { permissionKeys } = await loadUserPermissions(req.user);
      const allowed = keys.some((key) => hasPermission(permissionKeys, key, req.user));
      if (!allowed) {
        return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
      }
      req.permissionKeys = permissionKeys;
      next();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
};

const requireSuperAdmin = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    next();
  };
};

/** Run permission check only when predicate(req) is true */
const requirePermissionWhen = (predicate, ...keys) => {
  return async (req, res, next) => {
    try {
      if (!predicate(req)) return next();
      return requirePermission(...keys)(req, res, next);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
};

module.exports = { requirePermission, requireSuperAdmin, requirePermissionWhen };
