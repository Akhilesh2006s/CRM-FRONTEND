const User = require('../models/User');
const Leave = require('../models/Leave');
const DC = require('../models/DC');
const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const ExcelJS = require('exceljs');
const Role = require('../models/Role');
const { syncEmployeesAfterLeave } = require('../utils/leaveStatusSync');
const { validateStrictIndianMobile } = require('../utils/indianMobileValidation');

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

    const mobileCheck = validateStrictIndianMobile(body.mobile);
    if (!mobileCheck.ok) {
      return res.status(400).json({ message: mobileCheck.message });
    }
    body.mobile = mobileCheck.digits;
    
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

    // Module 1 KYC — mandatory fields
    const ALLOWED_RELATIONS = ['Wife', 'Brother', 'Sister', 'Father', 'Mother'];
    const refs = Array.isArray(body.references) ? body.references : [];
    if (refs.length !== 2) {
      return res.status(400).json({ message: 'Two references with relationship and mobile are required.' });
    }
    for (let i = 0; i < 2; i++) {
      const r = refs[i] || {};
      if (!ALLOWED_RELATIONS.includes(r.relation)) {
        return res.status(400).json({
          message: `Reference ${i + 1}: relationship must be one of ${ALLOWED_RELATIONS.join(', ')}.`,
        });
      }
      const refMobile = validateStrictIndianMobile(r.mobile);
      if (!refMobile.ok) {
        return res.status(400).json({ message: `Reference ${i + 1}: ${refMobile.message}` });
      }
      refs[i] = {
        relation: r.relation,
        name: (r.name || '').trim(),
        mobile: refMobile.digits,
      };
    }
    body.references = refs;

    if (!(body.temporaryAddress || '').trim()) {
      return res.status(400).json({ message: 'Temporary address is required.' });
    }
    if (!(body.permanentAddress || '').trim()) {
      return res.status(400).json({ message: 'Permanent address is required.' });
    }
    if (!(body.aadhaarUrl || '').trim()) {
      return res.status(400).json({ message: 'Aadhaar upload is required.' });
    }
    if (!(body.locationPhotoUrl || '').trim()) {
      return res.status(400).json({ message: 'Location upload is required.' });
    }

    // Keep address1 in sync for older screens
    if (!body.address1) {
      body.address1 = body.temporaryAddress;
    }
    
    if (body.mobile && (!body.phone || body.phone === '0')) {
      body.phone = body.mobile;
    }
    if (!body.phone) {
      body.phone = body.mobile || '';
    }

    // Assigning a zone also assigns that zone's manager by default
    if (body.zone && !body.executiveManagerId) {
      const Zone = require('../models/Zone');
      const zoneDoc = await Zone.findOne({
        $or: [
          { name: body.zone },
          { nameLower: String(body.zone).trim().toLowerCase() },
        ],
      });
      if (zoneDoc?.managerId) {
        body.executiveManagerId = zoneDoc.managerId;
      }
    }

    // Seed multi-approver verification (HR + Zonal manager; trainers also get training_head)
    body.verificationStatus = 'pending';
    const approvals = [
      { roleKey: 'hr_manager', status: 'pending' },
      { roleKey: 'zonal_manager', status: 'pending', userId: body.executiveManagerId || null },
    ];
    if (body.role === 'Trainer') {
      approvals.push({
        roleKey: 'training_head',
        status: 'pending',
        userId: body.verticalManagerId || null,
      });
      if (body.verticalManagerId) {
        approvals.push({
          roleKey: 'vertical_manager',
          status: 'pending',
          userId: body.verticalManagerId,
        });
      }
    }
    body.approvals = approvals;

    const employee = await User.create(body);
    const employeeData = await User.findById(employee._id)
      .select('-password')
      .populate('executiveManagerId', 'name email role')
      .populate('verticalManagerId', 'name email role');
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

    if (req.body.mobile !== undefined) {
      const mobileCheck = validateStrictIndianMobile(req.body.mobile);
      if (!mobileCheck.ok) {
        return res.status(400).json({ message: mobileCheck.message });
      }
      req.body.mobile = mobileCheck.digits;
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

// @desc    Clear bound mobile device so employee can re-bind
// @route   PUT /api/employees/:id/reset-device
// @access  Private (Admin / Super Admin via route middleware)
const resetEmployeeDevice = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.boundDeviceId = null;
    employee.boundDeviceAt = null;
    await employee.save();

    res.json({ message: 'Device binding cleared successfully' });
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

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const employeeUploadDir = path.join(__dirname, '../uploads/employees');
if (!fs.existsSync(employeeUploadDir)) {
  fs.mkdirSync(employeeUploadDir, { recursive: true });
}

const employeeUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, employeeUploadDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const uploadEmployeeFileMiddleware = multer({
  storage: employeeUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

// @desc    Upload employee KYC file (aadhaar / location)
// @route   POST /api/employees/upload
const uploadEmployeeFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const kind = (req.body?.kind || 'document').trim();
    const fileUrl = `/uploads/employees/${req.file.filename}`;
    res.status(201).json({ url: fileUrl, kind, message: 'Uploaded successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Upload failed' });
  }
};

function actorCanApproveRole(user, roleKey, approval) {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'Super Admin') return true;
  if (roleKey === 'hr_manager') return user.role === 'HR Manager';
  if (roleKey === 'zonal_manager') {
    if (user.role === 'Executive Manager' || user.role === 'Manager') {
      if (!approval?.userId) return true;
      return String(approval.userId) === String(user._id);
    }
    return false;
  }
  if (roleKey === 'training_head' || roleKey === 'vertical_manager') {
    return user.role === 'Manager' || user.role === 'Executive Manager' || user.role === 'Trainer';
  }
  return false;
}

// @desc    Submit / record an approval decision for employee onboarding
// @route   POST /api/employees/:id/approvals
const submitEmployeeApproval = async (req, res) => {
  try {
    const { roleKey, decision, note } = req.body;
    if (!roleKey || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'roleKey and decision (approve|reject) are required' });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const approval = (employee.approvals || []).find((a) => a.roleKey === roleKey);
    if (!approval) {
      return res.status(400).json({ message: `No approval slot for ${roleKey}` });
    }

    if (!actorCanApproveRole(req.user, roleKey, approval)) {
      return res.status(403).json({ message: 'You are not allowed to approve as this role' });
    }

    approval.status = decision === 'approve' ? 'approved' : 'rejected';
    approval.userId = req.user._id;
    approval.note = note || '';
    approval.at = new Date();

    if (decision === 'reject') {
      employee.verificationStatus = 'rejected';
    } else {
      const allApproved = (employee.approvals || []).every((a) => a.status === 'approved');
      employee.verificationStatus = allApproved ? 'approved' : 'pending';
    }

    await employee.save();
    const data = await User.findById(employee._id)
      .select('-password')
      .populate('executiveManagerId', 'name email role')
      .populate('verticalManagerId', 'name email role')
      .populate('approvals.userId', 'name email role');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List employees pending verification for current approver
// @route   GET /api/employees/verification/pending
const getPendingVerifications = async (req, res) => {
  try {
    const filter = { verificationStatus: 'pending', isActive: true };

    // HR Manager: only applications waiting for HR approval
    if (req.user?.role === 'HR Manager') {
      filter.approvals = {
        $elemMatch: { roleKey: 'hr_manager', status: 'pending' },
      };
    } else if (
      req.user?.role === 'Executive Manager' ||
      req.user?.role === 'Manager'
    ) {
      filter.approvals = {
        $elemMatch: { roleKey: 'zonal_manager', status: 'pending' },
      };
    }

    const employees = await User.find(filter)
      .select('-password')
      .populate('executiveManagerId', 'name email role')
      .populate('verticalManagerId', 'name email role')
      .sort({ createdAt: -1 });
    res.json(employees);
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
  resetEmployeeDevice,
  getEmployeeTracking,
  exportEmployeeTracking,
  uploadEmployeeFile,
  uploadEmployeeFileMiddleware,
  submitEmployeeApproval,
  getPendingVerifications,
};

