const User = require('../models/User');
const Leave = require('../models/Leave');

/**
 * Reactivate employees whose approved leave has ended.
 */
async function syncEmployeesAfterLeave() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const onLeaveUsers = await User.find({
    isActive: false,
    inactiveReason: 'on_leave',
  }).select('_id');

  for (const user of onLeaveUsers) {
    const activeLeave = await Leave.findOne({
      employeeId: user._id,
      status: 'Approved',
      endDate: { $gte: today },
    }).sort({ endDate: -1 });

    if (!activeLeave) {
      await User.findByIdAndUpdate(user._id, {
        isActive: true,
        $unset: { inactiveReason: '' },
      });
    }
  }
}

async function setEmployeeOnLeave(employeeId) {
  await User.findByIdAndUpdate(employeeId, {
    isActive: false,
    inactiveReason: 'on_leave',
  });
}

module.exports = { syncEmployeesAfterLeave, setEmployeeOnLeave };
