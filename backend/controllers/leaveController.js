const Leave = require('../models/Leave');
const User = require('../models/User');
const { syncEmployeesAfterLeave, setEmployeeOnLeave } = require('../utils/leaveStatusSync');

const LEAVE_ORG_VIEW_ROLES = ['Admin', 'Super Admin', 'Executive Manager', 'Manager'];

const getLeaves = async (req, res) => {
  try {
    await syncEmployeesAfterLeave();

    const { status, employeeId } = req.query;
    const filter = {};
    const role = req.user?.role;

    if (status) filter.status = status;

    if (LEAVE_ORG_VIEW_ROLES.includes(role)) {
      if (employeeId) filter.employeeId = employeeId;
    } else {
      filter.employeeId = req.user._id;
    }

    const leaves = await Leave.find(filter)
      .populate({
        path: 'employeeId',
        select: 'name email phone mobile executiveManagerId',
        populate: { path: 'executiveManagerId', select: 'name email' },
      })
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createLeave = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await Leave.create({
      ...req.body,
      employeeId: req.user._id,
      days,
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'name email')
      .populate('approvedBy', 'name email');

    res.status(201).json(populatedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveLeave = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    const leave = await Leave.findById(req.params.id).populate('employeeId');
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    const approverRole = req.user.role;
    if (approverRole === 'Executive Manager') {
      const emp = leave.employeeId;
      if (!emp || emp.executiveManagerId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: 'You can only approve leaves for employees assigned to you',
        });
      }
    }

    const updateData = {
      status,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    };

    if (status === 'Rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const updatedLeave = await Leave.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('employeeId', 'name email phone mobile executiveManagerId')
      .populate('approvedBy', 'name email');

    if (status === 'Approved' && leave.employeeId?._id) {
      await setEmployeeOnLeave(leave.employeeId._id);
    }

    await syncEmployeesAfterLeave();

    res.json(updatedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLeaves,
  createLeave,
  approveLeave,
};
