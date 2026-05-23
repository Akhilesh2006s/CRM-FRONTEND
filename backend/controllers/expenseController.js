const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getExpensePolicy } = require('../utils/expensePolicy');
const { validateExpensePayload, summarizeBatchTotals } = require('../utils/expenseValidation');
const { calculateRouteDistanceKm } = require('../utils/expenseDistance');

// Configure multer for expense bill uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/expenses');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'expense-' + uniqueSuffix + ext);
  }
});

// File filter to accept images and PDFs
const fileFilter = (req, file, cb) => {
  // Accept images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG) and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

function parseExpenseBody(body) {
  const bodyData = { ...body };
  const numericFields = ['amount', 'approxKms', 'claimedDistanceKm', 'gpsDistance'];
  for (const key of numericFields) {
    if (bodyData[key] !== undefined && bodyData[key] !== '') {
      bodyData[key] = parseFloat(bodyData[key]);
    }
  }
  Object.keys(bodyData).forEach((key) => {
    if (bodyData[key] === 'undefined' || bodyData[key] === 'null' || bodyData[key] === '') {
      delete bodyData[key];
    }
  });
  return bodyData;
}

function applyUploadedFiles(expenseData, files) {
  const billFile = files?.bill?.[0] || (files?.bill && !Array.isArray(files.bill) ? files.bill : null);
  const ticketFile = files?.ticket?.[0] || (files?.ticket && !Array.isArray(files.ticket) ? files.ticket : null);
  if (billFile) expenseData.receipt = `/uploads/expenses/${billFile.filename}`;
  if (ticketFile) expenseData.ticketReceipt = `/uploads/expenses/${ticketFile.filename}`;
}

async function finalizeManagerApproval(updateData, expenseId, userId, approvedAmount) {
  const policy = await getExpensePolicy();
  if (policy.skipFinanceStage) {
    updateData.approvedBy = userId;
    updateData.approvedAt = new Date();
  }
  if (approvedAmount !== undefined && approvedAmount !== null) {
    updateData.approvedAmount = approvedAmount;
  } else {
    const expense = await Expense.findById(expenseId);
    if (expense) {
      updateData.approvedAmount = expense.approvedAmount ?? expense.amount;
      if (!expense.employeeAmount) updateData.employeeAmount = expense.amount;
    }
  }
}

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
const getExpenses = async (req, res) => {
  try {
    const { status, category, startDate, endDate, my } = req.query;
    const filter = {};

    // If my=true, filter by current user's created expenses only
    // This ensures employees only see expenses they themselves created/submitted
    if (my === 'true') {
      filter.createdBy = req.user._id;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('managerApprovedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
const getExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid expense ID format' });
    }

    const expense = await Expense.findById(id)
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('managerApprovedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Calculate GPS/route distance for travel
// @route   POST /api/expenses/calculate-distance
// @access  Private
const calculateRouteDistance = async (req, res) => {
  try {
    const { from, to } = req.body;
    const result = await calculateRouteDistanceKm(from, to);
    if (result.error && result.gpsDistance == null) {
      return res.status(200).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get expense policy (for create UI + finance nav)
// @route   GET /api/expenses/policy
// @access  Private
const getExpensePolicySettings = async (req, res) => {
  try {
    const policy = await getExpensePolicy();
    res.json(policy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create expense
// @route   POST /api/expenses/create
// @access  Private
const createExpense = async (req, res) => {
  try {
    const policy = await getExpensePolicy();
    const bodyData = parseExpenseBody(req.body);
    const { errors, data } = validateExpensePayload(bodyData, policy, req.files);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const expenseData = {
      ...data,
      status: 'Pending',
      createdBy: req.user._id,
    };

    if (['Executive', 'Sales BDE', 'Employee', 'Trainer'].includes(req.user.role) && !expenseData.employeeId) {
      expenseData.employeeId = req.user._id;
    }

    applyUploadedFiles(expenseData, req.files);

    const expense = await Expense.create(expenseData);
    const populatedExpense = await Expense.findById(expense._id)
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('createdBy', 'name email');

    res.status(201).json(populatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create multiple expenses in one submission (JSON; receipts via separate create or pre-uploaded URLs)
// @route   POST /api/expenses/create-batch
// @access  Private
const createExpenseBatch = async (req, res) => {
  try {
    const policy = await getExpensePolicy();
    const { expenses: lines, submissionBatchId } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: 'expenses array is required' });
    }

    const batchId =
      submissionBatchId ||
      `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const created = [];

    for (const line of lines) {
      const bodyData = parseExpenseBody({ ...line, submissionBatchId: batchId });
      const { errors, data } = validateExpensePayload(bodyData, policy, {});
      if (errors.length) {
        return res.status(400).json({ message: errors.join(' '), line });
      }
      const expenseData = {
        ...data,
        status: 'Pending',
        createdBy: req.user._id,
        submissionBatchId: batchId,
      };
      if (line.receipt) expenseData.receipt = line.receipt;
      if (line.ticketReceipt) expenseData.ticketReceipt = line.ticketReceipt;
      if (['Executive', 'Sales BDE', 'Employee', 'Trainer'].includes(req.user.role)) {
        expenseData.employeeId = req.user._id;
      }
      const expense = await Expense.create(expenseData);
      created.push(expense);
    }

    const populated = await Expense.find({ _id: { $in: created.map((e) => e._id) } })
      .populate('createdBy', 'name email')
      .populate('employeeId', 'name email');

    res.status(201).json({
      submissionBatchId: batchId,
      expenses: populated,
      totals: summarizeBatchTotals(populated),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resubmit expense after Needs Correction
// @route   PUT /api/expenses/:id/resubmit
// @access  Private
const resubmitExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    if (expense.status !== 'Needs Correction') {
      return res.status(400).json({ message: 'Only expenses marked Needs Correction can be resubmitted' });
    }
    if (String(expense.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the submitter can resubmit this expense' });
    }

    const policy = await getExpensePolicy();
    const bodyData = parseExpenseBody(req.body);
    const { errors, data } = validateExpensePayload(bodyData, policy, req.files);
    if (errors.length) return res.status(400).json({ message: errors.join(' ') });

    applyUploadedFiles(data, req.files);

    Object.assign(expense, data, {
      status: 'Pending',
      rejectionReason: '',
      returnedBy: undefined,
      returnedAt: undefined,
      executiveManagerApprovedBy: undefined,
      executiveManagerApprovedAt: undefined,
      managerApprovedBy: undefined,
      managerApprovedAt: undefined,
      approvedBy: undefined,
      approvedAt: undefined,
      approvedAmount: undefined,
    });
    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload expense bill
// @route   POST /api/expenses/upload-bill
// @access  Private
const uploadExpenseBill = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Generate URL for the uploaded file
    const fileUrl = `/uploads/expenses/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Bill uploaded successfully',
      fileUrl: fileUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error('Error uploading expense bill:', error);
    res.status(500).json({ message: error.message || 'Failed to upload bill' });
  }
};

// @desc    Get manager pending expenses
// Shows: Only Executive Manager Approved expenses (expenses that have been approved by Executive Manager)
// Managers and Super Admins only see expenses after Executive Manager approval
// @route   GET /api/expenses/manager-pending
// @access  Private
const getManagerPendingExpenses = async (req, res) => {
  try {
    const { employeeId, trainerId } = req.query;
    
    // Only show expenses that have been approved by Executive Manager
    const filter = {
      status: 'Executive Manager Approved',
    };

    if (employeeId && employeeId !== 'all') {
      filter.employeeId = employeeId;
    }
    
    if (trainerId && trainerId !== 'all') {
      filter.trainerId = trainerId;
    }

    const expenses = await Expense.find(filter)
      .populate('employeeId', 'name email executiveManagerId')
      .populate('trainerId', 'name email')
      .populate('createdBy', 'name email')
      .populate('executiveManagerApprovedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(expenses);
  } catch (error) {
    console.error('Error fetching manager pending expenses:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get expenses by employee for manager update
// @route   GET /api/expenses/employee/:employeeId
// @access  Private
const getExpensesByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { fromDate, toDate, status: statusQuery } = req.query;

    const isExecutiveManager = req.user.role === 'Executive Manager';
    const defaultStatus = isExecutiveManager ? 'Pending' : 'Executive Manager Approved';
    const status = statusQuery || defaultStatus;
    
    const filter = {
      $or: [
        { employeeId: employeeId },
        { trainerId: employeeId }
      ],
      status,
    };

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    const expenses = await Expense.find(filter)
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve multiple expenses (Executive Manager or Manager approval)
// @route   POST /api/expenses/approve-multiple
// @access  Private
const approveMultipleExpenses = async (req, res) => {
  try {
    const { expenses, approvalType } = req.body; // Array of { id, approvedAmount, managerRemarks }, approvalType: 'executive-manager' or 'manager'

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ message: 'Expenses array is required' });
    }

    // Determine approval type based on user role or explicit parameter
    const policy = await getExpensePolicy();
    const isExecutiveManager = req.user.role === 'Executive Manager';
    let targetStatus =
      approvalType === 'executive-manager' || isExecutiveManager
        ? 'Executive Manager Approved'
        : 'Approved';

    const updatedExpenses = [];

    for (const exp of expenses) {
      const { id, approvedAmount, managerRemarks, employeeRemarks, status: rowStatus } = exp;

      if (rowStatus === 'Needs Correction' || rowStatus === 'Rejected') {
        const rowUpdate = {
          status: rowStatus,
          managerRemarks: managerRemarks || '',
        };
        if (rowStatus === 'Rejected') {
          rowUpdate.rejectionReason = managerRemarks || 'Rejected';
        } else {
          rowUpdate.returnedBy = req.user._id;
          rowUpdate.returnedAt = new Date();
          rowUpdate.rejectionReason = managerRemarks || 'Sent back for correction';
        }
        const updated = await Expense.findByIdAndUpdate(id, rowUpdate, { new: true })
          .populate('employeeId', 'name email')
          .populate('createdBy', 'name email');
        if (updated) updatedExpenses.push(updated);
        continue;
      }

      const updateData = { status: targetStatus };

      if (targetStatus === 'Executive Manager Approved') {
        updateData.executiveManagerApprovedBy = req.user._id;
        updateData.executiveManagerApprovedAt = new Date();
      } else if (targetStatus === 'Approved') {
        updateData.managerApprovedBy = req.user._id;
        updateData.managerApprovedAt = new Date();
        if (policy.skipFinanceStage) {
          updateData.approvedBy = req.user._id;
          updateData.approvedAt = new Date();
        }
      }

      if (approvedAmount !== undefined && approvedAmount !== null) {
        updateData.approvedAmount = approvedAmount;
      } else {
        const expense = await Expense.findById(id);
        if (expense) {
          updateData.approvedAmount = expense.amount;
          if (!expense.employeeAmount) {
            updateData.employeeAmount = expense.amount;
          }
        }
      }

      if (managerRemarks !== undefined) {
        updateData.managerRemarks = managerRemarks;
      }

      if (employeeRemarks !== undefined) {
        updateData.employeeRemarks = employeeRemarks;
      }

      const updated = await Expense.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      )
        .populate('employeeId', 'name email')
        .populate('trainerId', 'name email')
        .populate('executiveManagerApprovedBy', 'name email')
        .populate('managerApprovedBy', 'name email');

      if (updated) {
        updatedExpenses.push(updated);
      }
    }

    res.json({ 
      message: `${updatedExpenses.length} expense(s) approved successfully`,
      expenses: updatedExpenses 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending expenses for Executive Manager's employees
// @route   GET /api/expenses/executive-manager-pending
// @access  Private
const getExecutiveManagerPendingExpenses = async (req, res) => {
  try {
    // Verify user is Executive Manager
    if (req.user.role !== 'Executive Manager') {
      return res.status(403).json({ message: 'Access denied. Only Executive Managers can access this endpoint.' });
    }

    // Get the Executive Manager's ID from the authenticated user
    const executiveManagerId = req.user._id;

    // Find all employees assigned to this Executive Manager
    const User = require('../models/User');
    
    const employees = await User.find({ 
      executiveManagerId: executiveManagerId,
      isActive: true 
    }).select('_id name');

    const employeeIds = employees.map(emp => emp._id);

    console.log(`Executive Manager ${executiveManagerId} has ${employeeIds.length} assigned employees`);

    // If no employees assigned, return empty array with message
    if (employeeIds.length === 0) {
      console.log('No employees assigned to Executive Manager');
      return res.json([]);
    }

    // Get pending expenses for these employees
    // Expenses can be linked via employeeId OR createdBy (when employee creates expense)
    let filter = {
      status: 'Pending',
      $or: [
        { employeeId: { $in: employeeIds } },
        { createdBy: { $in: employeeIds } }
      ]
    };

    // If specific employeeId is requested, validate it's in the assigned employees list
    const { employeeId } = req.query;
    if (employeeId && employeeId !== 'all') {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({ message: 'Invalid employee ID format' });
      }

      const requestedEmployeeId = new mongoose.Types.ObjectId(employeeId);

      // Validate that the requested employee is actually assigned to this Executive Manager
      const isAssigned = employeeIds.some(id => id.toString() === requestedEmployeeId.toString());
      if (!isAssigned) {
        return res.status(403).json({ message: 'Access denied. Employee not assigned to this Executive Manager.' });
      }
      
      filter = {
        status: 'Pending',
        $or: [
          { employeeId: requestedEmployeeId },
          { createdBy: requestedEmployeeId }
        ]
      };
    }

    console.log('Filter for expenses:', JSON.stringify(filter));
    console.log('Employee IDs being searched:', employeeIds.map(id => id.toString()));

    const expenses = await Expense.find(filter)
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    console.log(`Found ${expenses.length} pending expenses for Executive Manager`);

    res.json(expenses);
  } catch (error) {
    console.error('Error fetching Executive Manager pending expenses:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch expenses' });
  }
};

// @desc    Get finance pending expenses
// @route   GET /api/expenses/finance-pending
// @access  Private
const getFinancePendingExpenses = async (req, res) => {
  try {
    const policy = await getExpensePolicy();
    if (policy.skipFinanceStage) {
      return res.json([]);
    }

    const { employeeId, trainerId } = req.query;
    const filter = {
      status: 'Approved',
      approvedBy: { $exists: false },
    };

    if (employeeId && employeeId !== 'all') {
      filter.employeeId = employeeId;
    }
    if (trainerId && trainerId !== 'all') {
      filter.trainerId = trainerId;
    }

    const expenses = await Expense.find(filter)
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('executiveManagerApprovedBy', 'name email')
      .populate('managerApprovedBy', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Ensure all expenses have the required fields with defaults
    const formattedExpenses = expenses.map(expense => {
      const expenseObj = expense.toObject ? expense.toObject() : expense;
      return {
        ...expenseObj,
        employeeAmount: expenseObj.employeeAmount || expenseObj.amount || 0,
        approvedAmount: expenseObj.approvedAmount || expenseObj.amount || 0,
      };
    });

    res.json(formattedExpenses);
  } catch (error) {
    console.error('Error fetching finance pending expenses:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch finance pending expenses',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Approve expense
// @route   PUT /api/expenses/:id/approve
// @access  Private
const approveExpense = async (req, res) => {
  try {
    const { status, rejectionReason, approvedAmount } = req.body;

    const updateData = {
      status,
    };

    if (status === 'Executive Manager Approved') {
      // Executive Manager approval
      updateData.executiveManagerApprovedBy = req.user._id;
      updateData.executiveManagerApprovedAt = new Date();
      if (approvedAmount !== undefined) {
        updateData.approvedAmount = approvedAmount;
      }
      // Set employeeAmount if not already set
      const expense = await Expense.findById(req.params.id);
      if (expense && !expense.employeeAmount) {
        updateData.employeeAmount = expense.amount;
      }
    } else if (status === 'Approved') {
      // Check if this is Manager approval or Finance approval
      const isManager = req.user.role === 'Manager' || req.user.role === 'Super Admin';
      if (isManager) {
        // Manager/Super Admin approval
        updateData.managerApprovedBy = req.user._id;
        updateData.managerApprovedAt = new Date();
        if (approvedAmount !== undefined) {
          updateData.approvedAmount = approvedAmount;
        }
        // Set employeeAmount if not already set
        const expense = await Expense.findById(req.params.id);
        if (expense && !expense.employeeAmount) {
          updateData.employeeAmount = expense.amount;
        }
      } else {
        // Finance approval
        updateData.approvedBy = req.user._id;
        updateData.approvedAt = new Date();
      }
    } else if (status === 'Rejected') {
      updateData.rejectionReason = rejectionReason || req.body.managerRemarks || '';
    } else if (status === 'Needs Correction') {
      updateData.rejectionReason = rejectionReason || req.body.managerRemarks || 'Sent back for correction';
      updateData.managerRemarks = req.body.managerRemarks || updateData.rejectionReason;
      updateData.returnedBy = req.user._id;
      updateData.returnedAt = new Date();
    }

    if (status === 'Approved') {
      const policy = await getExpensePolicy();
      const isManager = req.user.role === 'Manager' || req.user.role === 'Super Admin' || req.user.role === 'Admin';
      if (isManager && policy.skipFinanceStage) {
        updateData.approvedBy = req.user._id;
        updateData.approvedAt = new Date();
      }
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('executiveManagerApprovedBy', 'name email')
      .populate('managerApprovedBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!updatedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(updatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get expenses report
// @route   GET /api/expenses/report
// @access  Private
const getExpensesReport = async (req, res) => {
  try {
    const { zone, employeeId, status, fromDate, toDate } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (employeeId && employeeId !== 'all') {
      filter.$or = [
        { employeeId: employeeId },
        { trainerId: employeeId }
      ];
    }

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    let expenses = await Expense.find(filter)
      .populate('employeeId', 'name email zone')
      .populate('trainerId', 'name email zone')
      .populate('managerApprovedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Filter by zone if provided (check populated fields)
    if (zone && zone !== 'all') {
      expenses = expenses.filter(exp => {
        const empZone = exp.employeeId?.zone || exp.trainerId?.zone || '';
        return empZone.toLowerCase().includes(zone.toLowerCase());
      });
    }

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export expenses to Excel
// @route   GET /api/expenses/export
// @access  Private
const exportExpenses = async (req, res) => {
  try {
    const { zone, employeeId, status, fromDate, toDate } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (employeeId && employeeId !== 'all') {
      filter.$or = [
        { employeeId: employeeId },
        { trainerId: employeeId }
      ];
    }

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    let expenses = await Expense.find(filter)
      .populate('employeeId', 'name email zone')
      .populate('trainerId', 'name email zone')
      .populate('managerApprovedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Filter by zone if provided
    if (zone && zone !== 'all') {
      expenses = expenses.filter(exp => {
        const empZone = exp.employeeId?.zone || exp.trainerId?.zone || '';
        return empZone.toLowerCase().includes(zone.toLowerCase());
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses Report');

    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Exp No', key: 'expNo', width: 12 },
      { header: 'Created On', key: 'createdOn', width: 20 },
      { header: 'Exp Date', key: 'expDate', width: 15 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Approved Manager', key: 'approvedManager', width: 25 },
      { header: 'Approved Fin', key: 'approvedFin', width: 20 },
      { header: 'Expense Amount', key: 'expenseAmount', width: 15 },
      { header: 'Approved Amount', key: 'approvedAmount', width: 15 },
      { header: 'Approved Remarks', key: 'approvedRemarks', width: 30 },
      { header: 'Status', key: 'status', width: 20 },
    ];

    expenses.forEach((expense, index) => {
      const employeeName = expense.employeeId?.name || expense.trainerId?.name || '';
      const approvedManager = expense.managerApprovedBy?.name || '';
      const approvedFin = expense.approvedBy?.name || 'Vishwam Edutech';
      const status = expense.status === 'Pending' ? 'Pending at Manager' : 
                     expense.status === 'Approved' ? 'Approved' :
                     expense.status;

      worksheet.addRow({
        sno: index + 1,
        expNo: expense.expItemId || expense._id.toString().slice(-5),
        createdOn: new Date(expense.createdAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        expDate: new Date(expense.date).toISOString().split('T')[0],
        employeeName: employeeName,
        approvedManager: approvedManager,
        approvedFin: approvedFin,
        expenseAmount: expense.employeeAmount || expense.amount || 0,
        approvedAmount: expense.approvedAmount || 0,
        approvedRemarks: expense.managerRemarks || '',
        status: status,
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expenses_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res) => {
  try {
    const existing = await Expense.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Expense not found' });

    if (existing.status === 'Needs Correction') {
      if (String(existing.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Only the submitter can edit this expense' });
      }
    }

    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate('employeeId', 'name email')
      .populate('trainerId', 'name email')
      .populate('managerApprovedBy', 'name email')
      .populate('createdBy', 'name email');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getExpenses,
  getExpense,
  createExpense,
  createExpenseBatch,
  calculateRouteDistance,
  getExpensePolicySettings,
  resubmitExpense,
  approveExpense,
  getManagerPendingExpenses,
  getExecutiveManagerPendingExpenses,
  getFinancePendingExpenses,
  getExpensesByEmployee,
  approveMultipleExpenses,
  getExpensesReport,
  exportExpenses,
  updateExpense,
  uploadExpenseBill,
  uploadExpenseBillMiddleware: upload.fields([
    { name: 'bill', maxCount: 1 },
    { name: 'ticket', maxCount: 1 },
  ]),
  uploadExpenseBillSingleMiddleware: upload.single('bill'),
};

