const Attendance = require('../models/Attendance');
const User = require('../models/User');

/** Active session: endTime unset or explicitly null */
const activeAttendanceFilter = (employeeId) => ({
  employeeId,
  $or: [{ endTime: null }, { endTime: { $exists: false } }],
});

// @desc    Check-in attendance (first time or regular)
// @route   POST /api/attendance/check-in
// @access  Private
const checkIn = async (req, res) => {
  try {
    const {
      attendanceReason,
      photo,
      latitude,
      longitude,
      pincode,
      town,
      remarks,
    } = req.body;

    // Validate required fields
    if (!attendanceReason || !photo || latitude === undefined || longitude === undefined || !pincode || !town) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const employeeId = req.user._id;
    
    // Check if this is first time setup
    const user = await User.findById(employeeId);
    const isFirstTime = !user.hasCompletedFirstTimeSetup;

    // Create attendance record
    const attendance = await Attendance.create({
      employeeId,
      attendanceReason,
      photo,
      latitude,
      longitude,
      startTime: new Date(),
      pincode,
      town,
      isFirstTime,
      remarks,
    });

    // Update user's first time setup status
    if (isFirstTime) {
      user.hasCompletedFirstTimeSetup = true;
      await user.save();
    }

    res.status(201).json({
      attendance,
      isFirstTime,
      message: isFirstTime ? 'First time setup completed successfully' : 'Attendance checked in successfully',
    });
  } catch (error) {
    console.error('Error checking in attendance:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check-out attendance
// @route   POST /api/attendance/check-out
// @access  Private
const checkOut = async (req, res) => {
  try {
    const employeeId = req.user._id;
    
    // Find today's active attendance (no endTime)
    const attendance = await Attendance.findOne(activeAttendanceFilter(employeeId)).sort({
      startTime: -1,
    });

    if (!attendance) {
      return res.status(404).json({ message: 'No active attendance found' });
    }

    attendance.endTime = new Date();
    await attendance.save();

    res.json({ message: 'Attendance checked out successfully', attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's attendance history
// @route   GET /api/attendance/history
// @access  Private
const getAttendanceHistory = async (req, res) => {
  try {
    const employeeId = req.user._id;
    const { fromDate, toDate } = req.query;

    const filter = { employeeId };
    
    if (fromDate || toDate) {
      filter.startTime = {};
      if (fromDate) filter.startTime.$gte = new Date(fromDate);
      if (toDate) filter.startTime.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    const attendance = await Attendance.find(filter)
      .sort({ startTime: -1 })
      .limit(100);

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current active attendance
// @route   GET /api/attendance/current
// @access  Private
const getCurrentAttendance = async (req, res) => {
  try {
    const employeeId = req.user._id;
    
    const attendance = await Attendance.findOne(activeAttendanceFilter(employeeId)).sort({
      startTime: -1,
    });

    if (!attendance) {
      return res.json({ attendance: null, isActive: false });
    }

    res.json({ attendance, isActive: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getCurrentAttendance,
};

