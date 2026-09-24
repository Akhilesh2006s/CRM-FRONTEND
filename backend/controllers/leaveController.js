const Leave = require('../models/Leave');
const User = require('../models/User');

/** Org-wide leave visibility: HR < Admin < Super Admin. */
function isOrgWideLeaveRole(role) {
  return role === 'HR Manager' || role === 'Admin' || role === 'Super Admin';
}

function isAdminOrSuperAdmin(role) {
  return role === 'Admin' || role === 'Super Admin';
}

/**
 * Employee IDs this actor may see in leave lists.
 * null = unrestricted (HR / Admin / Super Admin).
 */
async function resolveVisibleEmployeeIds(actor) {
  if (!actor) return [];
  if (isOrgWideLeaveRole(actor.role)) return null;

  if (actor.role === 'Executive Manager' || actor.role === 'Manager') {
    const [team, vertical] = await Promise.all([
      User.find({ executiveManagerId: actor._id }).select('_id'),
      User.find({ verticalManagerId: actor._id }).select('_id'),
    ]);
    const ids = new Set([
      ...team.map((u) => String(u._id)),
      ...vertical.map((u) => String(u._id)),
    ]);
    return [...ids];
  }

  const verticalOnly = await User.find({ verticalManagerId: actor._id }).select('_id');
  if (verticalOnly.length > 0) {
    return verticalOnly.map((u) => String(u._id));
  }

  return [String(actor._id)];
}

/**
 * Who can approve/reject a leave.
 * - HR Manager's own leave → Admin or Super Admin only
 * - Others → reporting/vertical manager, or HR / Admin / Super Admin
 * - Nobody can approve their own leave
 */
async function actorCanDecideLeave(actor, leave) {
  if (!actor || !leave) return false;

  const empId =
    leave.employeeId && leave.employeeId._id
      ? leave.employeeId._id
      : leave.employeeId;

  if (String(empId) === String(actor._id)) {
    return false;
  }

  const emp = await User.findById(empId).select(
    'executiveManagerId verticalManagerId role'
  );
  if (!emp) return false;

  // HR leave requests escalate to Admin / Super Admin only
  if (emp.role === 'HR Manager') {
    return isAdminOrSuperAdmin(actor.role);
  }

  if (isOrgWideLeaveRole(actor.role)) return true;

  if (
    emp.executiveManagerId &&
    String(emp.executiveManagerId) === String(actor._id)
  ) {
    return true;
  }
  if (
    emp.verticalManagerId &&
    String(emp.verticalManagerId) === String(actor._id)
  ) {
    return true;
  }
  return false;
}

// @desc    Get leaves (scoped by hierarchy)
// @route   GET /api/leaves
// @access  Private
const getLeaves = async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const filter = {};

    if (status) filter.status = status;

    const visibleIds = await resolveVisibleEmployeeIds(req.user);

    if (employeeId) {
      if (visibleIds !== null && !visibleIds.includes(String(employeeId))) {
        return res
          .status(403)
          .json({ message: "Not allowed to view this employee's leaves" });
      }
      filter.employeeId = employeeId;
    } else if (visibleIds !== null) {
      filter.employeeId = { $in: visibleIds };
    }

    // Pending queue for HR: do not show HR Manager applications (those go to Admin / Super Admin)
    if (req.user.role === 'HR Manager' && status === 'Pending' && !employeeId) {
      const hrUsers = await User.find({ role: 'HR Manager' }).select('_id');
      const hrIds = hrUsers.map((u) => u._id);
      if (hrIds.length > 0) {
        filter.employeeId = { $nin: hrIds };
      }
    }

    const leaves = await Leave.find(filter)
      .populate({
        path: 'employeeId',
        select: 'name email role zone cluster executiveManagerId verticalManagerId',
        populate: [
          { path: 'executiveManagerId', select: 'name email role' },
          { path: 'verticalManagerId', select: 'name email role' },
        ],
      })
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create leave request
// @route   POST /api/leaves/create
// @access  Private
const createLeave = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const days =
      Math.ceil(
        (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
      ) + 1;

    const leave = await Leave.create({
      ...req.body,
      employeeId: req.user._id,
      days,
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'name email role')
      .populate('approvedBy', 'name email');

    res.status(201).json(populatedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve/Reject leave
// @route   PUT /api/leaves/:id/approve
// @access  Private
const approveLeave = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res
        .status(400)
        .json({ message: 'status must be Approved or Rejected' });
    }

    if (status === 'Rejected') {
      const reason = String(rejectionReason || '').trim();
      if (!reason) {
        return res
          .status(400)
          .json({ message: 'Rejection reason is required' });
      }
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    if (leave.status !== 'Pending') {
      return res
        .status(400)
        .json({ message: `Leave is already ${leave.status}` });
    }

    const allowed = await actorCanDecideLeave(req.user, leave);
    if (!allowed) {
      const emp = await User.findById(leave.employeeId).select('role');
      const msg =
        emp?.role === 'HR Manager'
          ? 'HR leave requests can only be approved or rejected by Admin or Super Admin.'
          : 'You are not allowed to approve/reject this leave.';
      return res.status(403).json({ message: msg });
    }

    const updateData = {
      status,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    };

    if (status === 'Rejected') {
      updateData.rejectionReason = String(rejectionReason).trim();
    } else {
      updateData.rejectionReason = undefined;
    }

    const updated = await Leave.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    })
      .populate({
        path: 'employeeId',
        select: 'name email role zone cluster executiveManagerId verticalManagerId',
        populate: [
          { path: 'executiveManagerId', select: 'name email role' },
          { path: 'verticalManagerId', select: 'name email role' },
        ],
      })
      .populate('approvedBy', 'name email role');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLeaves,
  createLeave,
  approveLeave,
  resolveVisibleEmployeeIds,
  actorCanDecideLeave,
  isOrgWideLeaveRole,
};
