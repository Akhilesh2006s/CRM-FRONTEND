const User = require('../models/User');
const Leave = require('../models/Leave');
const Lead = require('../models/Lead');
const DC = require('../models/DC');
const Sale = require('../models/Sale');
const Attendance = require('../models/Attendance');

// @desc    Create Executive Manager
// @route   POST /api/executive-managers/create
// @access  Private (Admin only)
const createExecutiveManager = async (req, res) => {
  try {
    const { name, email, password, phone, department, ...otherFields } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create Executive Manager
    const executiveManager = await User.create({
      name,
      email,
      password: password || 'Password123',
      phone,
      department,
      role: 'Executive Manager',
      ...otherFields,
    });

    const managerData = await User.findById(executiveManager._id).select('-password');
    res.status(201).json(managerData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all Executive Managers
// @route   GET /api/executive-managers
// @access  Private
const getExecutiveManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: 'Executive Manager', isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });

    // Get employee count for each manager
    const managersWithCounts = await Promise.all(
      managers.map(async (manager) => {
        const employeeCount = await User.countDocuments({
          executiveManagerId: manager._id,
          isActive: true,
        });
        return {
          ...manager.toObject(),
          employeeCount,
        };
      })
    );

    res.json(managersWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign employees to Executive Manager
// @route   PUT /api/executive-managers/:managerId/assign-employees
// @access  Private (Admin only)
const assignEmployeesToManager = async (req, res) => {
  try {
    const { managerId } = req.params;
    const { employeeIds } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ message: 'employeeIds must be a non-empty array' });
    }

    // Verify manager exists and is Executive Manager
    const manager = await User.findById(managerId);
    if (!manager || manager.role !== 'Executive Manager') {
      return res.status(404).json({ message: 'Executive Manager not found' });
    }

    // Update employees
    const result = await User.updateMany(
      { _id: { $in: employeeIds } },
      { $set: { executiveManagerId: managerId } }
    );

    res.json({
      message: `Successfully assigned ${result.modifiedCount} employees to Executive Manager`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Executive Manager's state
// @route   PUT /api/executive-managers/:managerId/state
// @access  Private (Admin only)
const updateManagerState = async (req, res) => {
  try {
    const { managerId } = req.params;
    const { state } = req.body;

    if (!state || !state.trim()) {
      return res.status(400).json({ message: 'State is required' });
    }

    const manager = await User.findById(managerId);
    if (!manager || manager.role !== 'Executive Manager') {
      return res.status(404).json({ message: 'Executive Manager not found' });
    }

    // Update manager's assignedState
    manager.assignedState = state.trim();
    await manager.save();

    const managerData = await User.findById(manager._id).select('-password');
    res.json(managerData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign zone (city) to employee (by Executive Manager)
// @route   PUT /api/executive-managers/assign-zone
// @access  Private (Executive Manager only)
const assignZoneToEmployee = async (req, res) => {
  try {
    const { employeeId, zone } = req.body;

    if (!employeeId || !zone) {
      return res.status(400).json({ message: 'employeeId and zone (city) are required' });
    }

    // Get manager's assigned state (for Executive Managers) or allow Admins
    const isAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin';
    const manager = await User.findById(req.user._id);
    
    if (!isAdmin && (!manager || manager.role !== 'Executive Manager')) {
      return res.status(403).json({ message: 'Only Executive Managers or Admins can assign zones' });
    }

    // For Executive Managers, check if they have an assigned state
    if (!isAdmin && !manager.assignedState) {
      return res.status(400).json({ message: 'Executive Manager must have an assigned state first' });
    }

    // Verify employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // For Executive Managers, verify employee is assigned to them
    // Admins can assign zones to any employee
    if (!isAdmin) {
      if (employee.executiveManagerId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Employee is not assigned to you' });
      }
    }

    // Update employee zone (city)
    // Zone is stored in assignedCity field, and also in zone field for clarity
    employee.assignedCity = zone;
    employee.zone = zone;
    
    // Fix old 'Employee' role to 'Executive' if needed
    if (employee.role === 'Employee') {
      employee.role = 'Executive';
    }
    
    await employee.save();

    const employeeData = await User.findById(employee._id).select('-password');
    res.json(employeeData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign area to employee (by Executive)
// @route   PUT /api/executive-managers/assign-area
// @access  Private (Executive only)
const assignAreaToEmployee = async (req, res) => {
  try {
    const { employeeId, area } = req.body;

    if (!employeeId || !area) {
      return res.status(400).json({ message: 'employeeId and area are required' });
    }

    // Get employee first to check role
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Fix old 'Employee' role to 'Executive' if needed
    if (employee.role === 'Employee') {
      employee.role = 'Executive';
    }

    // Update employee area
    employee.assignedArea = area;
    await employee.save();

    const employeeData = await User.findById(employee._id).select('-password');
    res.json(employeeData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employees assigned to Executive Manager
// @route   GET /api/executive-managers/:managerId/employees
// @access  Private
const getManagerEmployees = async (req, res) => {
  try {
    const { managerId } = req.params;
    const { city, area, isActive } = req.query;

    const filter = { executiveManagerId: managerId };
    if (city) filter.assignedCity = city;
    if (area) filter.assignedArea = area;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const employees = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current Executive Manager's assigned executives
// @route   GET /api/executive-managers/my/executives
// @access  Private (Executive Manager only)
const getMyExecutives = async (req, res) => {
  try {
    // Get the current logged-in Executive Manager's ID
    const executiveManagerId = req.user._id;

    // Verify the user is an Executive Manager
    if (req.user.role !== 'Executive Manager') {
      return res.status(403).json({ message: 'Access denied. Only Executive Managers can view their executives.' });
    }

    // Get all executives assigned to this manager
    const executives = await User.find({ 
      executiveManagerId: executiveManagerId,
      role: 'Executive'
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(executives);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Executive Manager dashboard analytics
// @route   GET /api/executive-managers/:managerId/dashboard
// @access  Private
const getManagerDashboard = async (req, res) => {
  try {
    const { managerId } = req.params;
    const { fromDate, toDate } = req.query;

    // Check MongoDB connection first
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection is not available. Please check your MongoDB connection.',
        error: 'DATABASE_CONNECTION_ERROR',
        details: `Connection state: ${mongoose.connection.readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`
      });
    }

    // Verify manager exists with timeout and get manager's state
    const manager = await User.findById(managerId)
      .select('role state assignedState')
      .maxTimeMS(5000)
      .lean();
    
    if (!manager || manager.role !== 'Executive Manager') {
      return res.status(404).json({ message: 'Executive Manager not found' });
    }

    // Get manager's assigned state (prefer assignedState, fallback to state)
    const managerState = manager.assignedState || manager.state || null;

    // Get all employees assigned to this manager with timeout
    const employees = await User.find({ executiveManagerId: managerId, isActive: true })
      .select('_id name email phone mobile assignedCity assignedArea role department')
      .maxTimeMS(10000)
      .lean();

    const employeeIds = employees.map(u => u._id);

    if (employeeIds.length === 0) {
      return res.json({
        totalEmployees: 0,
        managerState,
        employeesByZone: {},
        employeesByArea: {},
        totalLeads: 0,
        leadsByStatus: {},
        totalDCs: 0,
        dcsByStatus: {},
        totalSales: 0,
        totalLeaves: 0,
        leavesByStatus: {},
        employeeDetails: [],
      });
    }

    // Date filter
    const dateFilter = {};
    if (fromDate || toDate) {
      dateFilter.createdAt = {};
      if (fromDate) dateFilter.createdAt.$gte = new Date(fromDate);
      if (toDate) dateFilter.createdAt.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    // Calculate employee distribution by zones (cities)
    const employeesByZone = {};
    const employeesByArea = {};
    employees.forEach(emp => {
      // Zones are cities assigned to employees
      if (emp.assignedCity) {
        employeesByZone[emp.assignedCity] = (employeesByZone[emp.assignedCity] || 0) + 1;
      }
      if (emp.assignedArea) {
        employeesByArea[emp.assignedArea] = (employeesByArea[emp.assignedArea] || 0) + 1;
      }
    });

    // Use aggregation for better performance - run queries in parallel with timeouts
    const [leads, dcs, sales, leaves, leadStatusCounts, dcStatusCounts, leaveStatusCounts, employeeStats] = await Promise.all([
      // Get leads count
      Lead.countDocuments({
        $or: [
          { createdBy: { $in: employeeIds } },
          { managed_by: { $in: employeeIds } },
        ],
        ...dateFilter,
      }).maxTimeMS(15000).catch(() => 0),

      // Get DCs count
      DC.countDocuments({
        $or: [
          { employeeId: { $in: employeeIds } },
          { createdBy: { $in: employeeIds } },
        ],
        ...dateFilter,
      }).maxTimeMS(15000).catch(() => 0),

      // Get sales count
      Sale.countDocuments({
        $or: [
          { employeeId: { $in: employeeIds } },
          { createdBy: { $in: employeeIds } },
        ],
        ...dateFilter,
      }).maxTimeMS(15000).catch(() => 0),

      // Get leaves count
      Leave.countDocuments({
        employeeId: { $in: employeeIds },
        ...dateFilter,
      }).maxTimeMS(15000).catch(() => 0),

      // Get lead status counts using aggregation
      Lead.aggregate([
        {
          $match: {
            $or: [
              { createdBy: { $in: employeeIds } },
              { managed_by: { $in: employeeIds } },
            ],
            ...dateFilter,
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ], { maxTimeMS: 15000, allowDiskUse: true }).catch(() => []),

      // Get DC status counts using aggregation
      DC.aggregate([
        {
          $match: {
            $or: [
              { employeeId: { $in: employeeIds } },
              { createdBy: { $in: employeeIds } },
            ],
            ...dateFilter,
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ], { maxTimeMS: 15000, allowDiskUse: true }).catch(() => []),

      // Get leave status counts using aggregation
      Leave.aggregate([
        {
          $match: {
            employeeId: { $in: employeeIds },
            ...dateFilter,
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ], { maxTimeMS: 15000, allowDiskUse: true }).catch(() => []),

      // Get employee stats using aggregation (more efficient than individual queries)
      Promise.all(employeeIds.map(async (empId) => {
        try {
          const [leads, dcs, sales, leaves, pendingLeaves] = await Promise.all([
            Lead.countDocuments({
              $or: [{ createdBy: empId }, { managed_by: empId }],
              ...dateFilter,
            }).maxTimeMS(10000).catch(() => 0),
            DC.countDocuments({
              $or: [{ employeeId: empId }, { createdBy: empId }],
              ...dateFilter,
            }).maxTimeMS(10000).catch(() => 0),
            Sale.countDocuments({
              $or: [{ employeeId: empId }, { createdBy: empId }],
              ...dateFilter,
            }).maxTimeMS(10000).catch(() => 0),
            Leave.countDocuments({
              employeeId: empId,
              ...dateFilter,
            }).maxTimeMS(10000).catch(() => 0),
            Leave.countDocuments({
              employeeId: empId,
              status: 'Pending',
              ...dateFilter,
            }).maxTimeMS(10000).catch(() => 0),
          ]);

          return { empId, leads, dcs, sales, leaves, pendingLeaves };
        } catch (err) {
          console.error(`Error getting stats for employee ${empId}:`, err.message);
          return { empId, leads: 0, dcs: 0, sales: 0, leaves: 0, pendingLeaves: 0 };
        }
      })).catch(() => []),
    ]);

    // Convert aggregation results to status objects
    const leadsByStatus = {};
    leadStatusCounts.forEach(item => {
      leadsByStatus[item._id] = item.count;
    });

    const dcsByStatus = {};
    dcStatusCounts.forEach(item => {
      dcsByStatus[item._id] = item.count;
    });

    const leavesByStatus = {};
    leaveStatusCounts.forEach(item => {
      leavesByStatus[item._id] = item.count;
    });

    // Create employee details map
    const statsMap = new Map(employeeStats.map(s => [s.empId.toString(), s]));

    // Build employee details
    const employeeDetails = employees.map(employee => {
      const stats = statsMap.get(employee._id.toString()) || { leads: 0, dcs: 0, sales: 0, leaves: 0, pendingLeaves: 0 };
      return {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone || employee.mobile,
        assignedCity: employee.assignedCity,
        assignedArea: employee.assignedArea,
        role: employee.role,
        department: employee.department,
        totalLeads: stats.leads,
        totalDCs: stats.dcs,
        totalSales: stats.sales,
        totalLeaves: stats.leaves,
        pendingLeaves: stats.pendingLeaves,
      };
    });

    res.json({
      totalEmployees: employees.length,
      managerState, // Include manager's state in response
      employeesByZone, // Zones are cities in the manager's state
      employeesByArea,
      totalLeads: leads,
      leadsByStatus,
      totalDCs: dcs,
      dcsByStatus,
      totalSales: sales,
      totalLeaves: leaves,
      leavesByStatus,
      employeeDetails,
    });
  } catch (error) {
    console.error('Error in getManagerDashboard:', error);
    
    // Check if it's a MongoDB connection error
    if (error.message && (
      error.message.includes('timeout') || 
      error.message.includes('connection') || 
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('maxTimeMS')
    )) {
      return res.status(503).json({ 
        message: 'Database connection failed. Please check your MongoDB connection settings.',
        error: 'DATABASE_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

// @desc    Get leaves for employees under Executive Manager
// @route   GET /api/executive-managers/:managerId/leaves
// @access  Private
const getManagerEmployeeLeaves = async (req, res) => {
  try {
    const { managerId } = req.params;
    const { status, employeeId, fromDate, toDate } = req.query;

    // Get all employees assigned to this manager
    const employeeIds = await User.find({ executiveManagerId: managerId })
      .select('_id')
      .then(users => users.map(u => u._id));

    if (employeeIds.length === 0) {
      return res.json([]);
    }

    const filter = { employeeId: { $in: employeeIds } };
    if (status) filter.status = status;
    if (employeeId) filter.employeeId = employeeId;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    const leaves = await Leave.find(filter)
      .populate({
        path: 'employeeId',
        select: 'name email phone mobile assignedCity assignedArea executiveManagerId',
        populate: { path: 'executiveManagerId', select: 'name email' },
      })
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve/Reject leave (by Executive Manager)
// @route   PUT /api/executive-managers/leaves/:leaveId/approve
// @access  Private (Executive Manager only)
const approveManagerEmployeeLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status, rejectionReason } = req.body;

    const leave = await Leave.findById(leaveId).populate('employeeId');
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }

    // Verify employee is assigned to this manager
    if (leave.employeeId.executiveManagerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only approve leaves for your assigned employees' });
    }

    const updateData = {
      status,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    };

    if (status === 'Rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const updatedLeave = await Leave.findByIdAndUpdate(leaveId, updateData, { new: true })
      .populate('employeeId', 'name email phone mobile assignedCity assignedArea')
      .populate('approvedBy', 'name email');

    const { setEmployeeOnLeave, syncEmployeesAfterLeave } = require('../utils/leaveStatusSync');
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
  createExecutiveManager,
  getExecutiveManagers,
  assignEmployeesToManager,
  updateManagerState,
  assignZoneToEmployee,
  assignAreaToEmployee,
  getManagerEmployees,
  getMyExecutives,
  getManagerDashboard,
  getManagerEmployeeLeaves,
  approveManagerEmployeeLeave,
};

