const User = require('../models/User');
const Leave = require('../models/Leave');
const DC = require('../models/DC');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const ExcelJS = require('exceljs');
const { syncEmployeesAfterLeave } = require('../utils/leaveStatusSync');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
const getEmployees = async (req, res) => {
  try {
    await syncEmployeesAfterLeave();

    const { isActive, role, department } = req.query;
    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (role) filter.role = role;
    if (department) filter.department = department;

    const employees = await User.find(filter)
      .select('-password')
      .populate('executiveManagerId', 'name email')
      .sort({ createdAt: -1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private
const getEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).select('-password');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create employee
// @route   POST /api/employees/create
// @access  Private
const Role = require('../models/Role');

const createEmployee = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.roleId) {
      const roleDoc = await Role.findById(body.roleId);
      if (roleDoc?.isActive) {
        body.role = roleDoc.name;
      }
    }
    if (!body.password) {
      body.password = 'Password123';
    }
    if (!body.name && body.firstName) {
      body.name = `${body.firstName} ${body.lastName || ''}`.trim();
    }
    
    // Validate cluster uniqueness for Executive role
    if (body.role === 'Executive' && body.cluster) {
      const existingEmployee = await User.findOne({ 
        role: 'Executive', 
        cluster: body.cluster.trim() 
      });
      if (existingEmployee) {
        return res.status(400).json({ message: 'Cluster value must be unique. This cluster is already assigned to another executive.' });
      }
    }
    
    if (body.mobile && (!body.phone || body.phone === '0')) {
      body.phone = body.mobile;
    }
    if (!body.phone) {
      body.phone = body.mobile || '';
    }

    const employee = await User.create(body);
    const employeeData = await User.findById(employee._id).select('-password');
    res.status(201).json(employeeData);
  } catch (error) {
    // Duplicate email (MongoDB E11000)
    if (error.code === 11000 || error.code === 11001) {
      return res.status(400).json({ message: 'Email already exists. Please use a different email.' });
    }
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message).join('. ');
      return res.status(400).json({ message: messages || error.message });
    }
    console.error('Create employee error:', error);
    res.status(500).json({ message: error.message || 'Failed to create employee' });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private
const updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Validate cluster uniqueness for Executive role if cluster is being updated
    const newRole = req.body.role !== undefined ? req.body.role : employee.role;
    const newCluster = req.body.cluster !== undefined ? req.body.cluster : employee.cluster;
    
    if (newRole === 'Executive' && newCluster) {
      const existingEmployee = await User.findOne({ 
        role: 'Executive', 
        cluster: newCluster.trim(),
        _id: { $ne: employee._id } // Exclude current employee
      });
      if (existingEmployee) {
        return res.status(400).json({ message: 'Cluster value must be unique. This cluster is already assigned to another executive.' });
      }
    }

    if (req.body.isActive === true) {
      employee.isActive = true;
      employee.inactiveReason = undefined;
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== '__v' && key !== 'inactiveReason') {
        employee[key] = req.body[key];
      }
    });

    if (req.body.isActive === false && req.body.inactiveReason) {
      employee.inactiveReason = req.body.inactiveReason;
    }

    // If password is being updated, ensure it's set (will be hashed by pre-save hook)
    if (req.body.password) {
      employee.password = req.body.password;
    }

    await employee.save();

    const employeeData = await User.findById(employee._id).select('-password');
    res.json(employeeData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset employee password to default
// @route   PUT /api/employees/:id/reset-password
// @access  Private
const resetEmployeePassword = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.password = 'Password123';
    await employee.save();

    res.json({ message: 'Password reset to Password123 successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee leaves
// @route   GET /api/employees/:id/leaves
// @access  Private
const getEmployeeLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ employeeId: req.params.id })
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function formatAttendanceLocation(att) {
  if (att.town && att.pincode) return `${att.town} (${att.pincode})`;
  if (att.town) return att.town;
  if (att.latitude != null && att.longitude != null) {
    return `${att.latitude.toFixed(5)}, ${att.longitude.toFixed(5)}`;
  }
  return '';
}

async function buildEmployeeTrackingRow(employee, fromDate, toDate) {
  const dcFilter = {
    $or: [{ employeeId: employee._id }, { createdBy: employee._id }],
  };

  const leadFilter = {
    $or: [
      { createdBy: employee._id },
      { managed_by: employee._id },
      { assigned_by: employee._id },
    ],
  };

  const attendanceFilter = { employeeId: employee._id };

  if (fromDate || toDate) {
    const dateFilter = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate + 'T23:59:59.999Z');

    dcFilter.createdAt = dateFilter;
    leadFilter.createdAt = dateFilter;
    attendanceFilter.$or = [
      { startTime: dateFilter },
      { endTime: dateFilter },
      { createdAt: dateFilter },
    ];
  }

  const [dcs, leads, attendances] = await Promise.all([
    DC.find(dcFilter).populate('dcOrderId', 'location zone').sort({ createdAt: 1 }),
    Lead.find(leadFilter).sort({ createdAt: 1 }),
    Attendance.find(attendanceFilter).sort({ startTime: 1 }),
  ]);

  const allActivities = [
    ...dcs.map((dc) => ({
      type: 'DC',
      date: dc.createdAt,
      location: dc.dcOrderId?.location || dc.customerAddress || '',
    })),
    ...leads.map((lead) => ({
      type: 'Lead',
      date: lead.createdAt,
      location: lead.location || '',
    })),
    ...attendances.map((att) => ({
      type: 'Attendance',
      date: att.endTime || att.startTime || att.createdAt,
      location: formatAttendanceLocation(att),
      latitude: att.latitude,
      longitude: att.longitude,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const started =
    allActivities.length > 0 ? allActivities[0].date : employee.createdAt;
  const lastActivity =
    allActivities.length > 0 ? allActivities[allActivities.length - 1] : null;
  const lastUsed = lastActivity
    ? lastActivity.date
    : employee.lastLogin || employee.updatedAt;
  let lastLocation = lastActivity?.location || '';
  const lastLat = lastActivity?.latitude;
  const lastLng = lastActivity?.longitude;

  if (!lastLocation && employee.zone) {
    lastLocation = employee.zone;
  }

  return {
    _id: employee._id,
    employeeName: employee.name,
    mobileNo: employee.mobile || employee.phone || '',
    zone: employee.zone || '',
    started,
    lastUsed,
    lastLocation,
    lastLatitude: lastLat,
    lastLongitude: lastLng,
    logCount: allActivities.length,
  };
}

// @desc    Get employee tracking data
// @route   GET /api/employees/tracking
// @access  Private
const getEmployeeTracking = async (req, res) => {
  try {
    const { employeeId, fromDate, toDate } = req.query;

    const employeeFilter = { isActive: true };
    if (employeeId) {
      employeeFilter._id = employeeId;
    } else {
      employeeFilter.role = { $in: ['Executive', 'Manager'] };
    }

    const employees = await User.find(employeeFilter).select('-password');

    const trackingData = await Promise.all(
      employees.map((employee) => buildEmployeeTrackingRow(employee, fromDate, toDate))
    );

    res.json(trackingData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export employee tracking to Excel
// @route   GET /api/employees/tracking/export
// @access  Private
const exportEmployeeTracking = async (req, res) => {
  try {
    const { employeeId, fromDate, toDate } = req.query;

    const employeeFilter = { isActive: true };
    if (employeeId) {
      employeeFilter._id = employeeId;
    } else {
      employeeFilter.role = { $in: ['Executive', 'Manager'] };
    }

    const employees = await User.find(employeeFilter).select('-password');

    const trackingData = await Promise.all(
      employees.map((employee) => buildEmployeeTrackingRow(employee, fromDate, toDate))
    );
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employee Tracking Report');

    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Mobile No', key: 'mobileNo', width: 15 },
      { header: 'Zone', key: 'zone', width: 20 },
      { header: 'Started', key: 'started', width: 20 },
      { header: 'Last Used', key: 'lastUsed', width: 20 },
      { header: 'Last Location', key: 'lastLocation', width: 50 },
      { header: 'Log Count', key: 'logCount', width: 12 },
    ];

    trackingData.forEach((data, index) => {
      worksheet.addRow({
        sno: index + 1,
        employeeName: data.employeeName,
        mobileNo: data.mobileNo,
        zone: data.zone,
        started: data.started ? new Date(data.started).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        lastUsed: data.lastUsed ? new Date(data.lastUsed).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        lastLocation: data.lastLocation,
        logCount: data.logCount,
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Employee_Tracking_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  getEmployeeLeaves,
  resetEmployeePassword,
  getEmployeeTracking,
  exportEmployeeTracking,
};

