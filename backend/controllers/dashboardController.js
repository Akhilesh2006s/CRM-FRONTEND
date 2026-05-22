const mockDataService = require('../services/mockDataService');
const Lead = require('../models/Lead');
const DC = require('../models/DC');
const DcOrder = require('../models/DcOrder');
const Payment = require('../models/Payment');
const Training = require('../models/Training');
const Service = require('../models/Service');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const Attendance = require('../models/Attendance');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const stats = await mockDataService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get leads by zone
// @route   GET /api/dashboard/leads-by-zone
// @access  Private
const getLeadsByZone = async (req, res) => {
  try {
    // Filter by executive if user is an Executive
    const isExecutive = req.user.role === 'Executive';
    const executiveId = req.user._id;
    
    if (isExecutive) {
      // Get leads for this executive grouped by zone
      const leadsFilter = {
        $or: [
          { createdBy: executiveId },
          { managed_by: executiveId }
        ]
      };
      
      const leads = await Lead.find(leadsFilter);
      const zoneDataMap = {};
      
      leads.forEach(lead => {
        const zone = lead.zone || 'Unknown';
        if (!zoneDataMap[zone]) {
          zoneDataMap[zone] = {
            zone: zone,
            total: 0,
            hot: 0,
            warm: 0,
            cold: 0
          };
        }
        zoneDataMap[zone].total++;
        const priority = lead.priority || 'Cold';
        if (priority === 'Hot') zoneDataMap[zone].hot++;
        else if (priority === 'Warm') zoneDataMap[zone].warm++;
        else zoneDataMap[zone].cold++;
      });
      
      res.json(Object.values(zoneDataMap));
    } else {
      const zoneData = await mockDataService.getLeadsByZone();
      res.json(zoneData);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/recent-activities
// @access  Private
const getRecentActivities = async (req, res) => {
  try {
    // Filter by executive if user is an Executive
    const isExecutive = req.user.role === 'Executive';
    const executiveId = req.user._id;
    
    if (isExecutive) {
      const activities = [];
      const limit = 10;
      
      // Get recent leads created by this executive
      const recentLeads = await Lead.find({
        $or: [
          { createdBy: executiveId },
          { managed_by: executiveId }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('createdBy', 'name')
        .lean();
      
      recentLeads.forEach((lead, idx) => {
        activities.push({
          id: `lead_${lead._id}`,
          type: 'lead_created',
          message: `New lead ${lead.name || 'Unknown'} created`,
          timestamp: lead.createdAt,
          user: lead.createdBy?.name || 'You'
        });
      });
      
      // Get recent DCs/sales created by this executive
      const recentDCs = await DC.find({
        createdBy: executiveId
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('createdBy', 'name')
        .lean();
      
      recentDCs.forEach((dc) => {
        activities.push({
          id: `dc_${dc._id}`,
          type: 'sale_made',
          message: `Sale of ₹${(dc.totalAmount || 0).toLocaleString('en-IN')} completed`,
          timestamp: dc.createdAt,
          user: dc.createdBy?.name || 'You'
        });
      });
      
      // Get recent trainings assigned to this executive
      const recentTrainings = await Training.find({
        $or: [
          { createdBy: executiveId },
          { employeeId: executiveId }
        ],
        status: 'Completed'
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('employeeId', 'name')
        .lean();
      
      recentTrainings.forEach((training) => {
        activities.push({
          id: `training_${training._id}`,
          type: 'training_completed',
          message: `${training.subject || 'Training'} completed`,
          timestamp: training.createdAt,
          user: training.employeeId?.name || 'You'
        });
      });
      
      // Sort all activities by timestamp and limit to most recent
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      res.json(activities.slice(0, limit));
    } else {
      const activities = [
        {
          id: '1',
          type: 'lead_created',
          message: 'New lead ABC School created',
          timestamp: new Date(),
          user: 'Pavan Simhadri'
        },
        {
          id: '2',
          type: 'training_completed',
          message: 'Digital Marketing Training completed',
          timestamp: new Date(Date.now() - 3600000),
          user: 'John Doe'
        },
        {
          id: '3',
          type: 'sale_made',
          message: 'Sale of ₹50,000 completed',
          timestamp: new Date(Date.now() - 7200000),
          user: 'Pavan Simhadri'
        }
      ];
      res.json(activities);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get revenue trends
// @route   GET /api/dashboard/revenue-trends
// @access  Private
const getRevenueTrends = async (req, res) => {
  try {
    // Get last 7 days of data
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const trends = [];
    
    // Filter by executive if user is an Executive
    const isExecutive = req.user.role === 'Executive';
    const executiveId = req.user._id;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get leads created on this day
      const leadsFilter = {
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      };
      if (isExecutive) {
        leadsFilter.$or = [
          { createdBy: executiveId },
          { managed_by: executiveId }
        ];
      }
      const leadsCount = await Lead.countDocuments(leadsFilter);
      
      // Get sales (DCs) created on this day
      const dcFilter = {
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      };
      if (isExecutive) {
        dcFilter.createdBy = executiveId;
      }
      const salesCount = await DC.countDocuments(dcFilter);
      
      // Get revenue from payments on this day
      const paymentFilter = {
        paymentDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'Approved'
      };
      if (isExecutive) {
        paymentFilter.createdBy = executiveId;
      }
      const payments = await Payment.find(paymentFilter);
      const revenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      trends.push({
        name: days[date.getDay() === 0 ? 6 : date.getDay() - 1],
        leads: leadsCount,
        sales: salesCount,
        revenue: revenue
      });
    }
    
    res.json(trends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get leads volume by hour
// @route   GET /api/dashboard/leads-volume
// @access  Private
const getLeadsVolume = async (req, res) => {
  try {
    const range = String(req.query.range || '24h').toLowerCase();
    const isExecutive = req.user.role === 'Executive';
    const executiveFilter = isExecutive
      ? {
          $or: [
            { createdBy: req.user._id },
            { managed_by: req.user._id },
          ],
        }
      : null;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      const start = new Date(today);
      start.setDate(start.getDate() - (days - 1));

      const leadsFilter = {
        createdAt: { $gte: start, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
      };
      if (executiveFilter) Object.assign(leadsFilter, executiveFilter);

      const leads = await Lead.find(leadsFilter).select('createdAt').lean();
      const buckets = [];

      for (let i = 0; i < days; i++) {
        const dayStart = new Date(start);
        dayStart.setDate(start.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        const label = dayStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        buckets.push({
          hour: label,
          value: 0,
          dayStart: dayStart.getTime(),
        });
      }

      leads.forEach((lead) => {
        const t = new Date(lead.createdAt).getTime();
        for (let i = buckets.length - 1; i >= 0; i--) {
          const dayStart = buckets[i].dayStart;
          const dayEnd = dayStart + 24 * 60 * 60 * 1000;
          if (t >= dayStart && t < dayEnd) {
            buckets[i].value++;
            break;
          }
        }
      });

      return res.json(buckets.map(({ hour, value }) => ({ hour, value })));
    }

    // Default: 24h hourly buckets for today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const leadsFilter = {
      createdAt: { $gte: today, $lt: tomorrow },
    };
    if (executiveFilter) Object.assign(leadsFilter, executiveFilter);

    const leads = await Lead.find(leadsFilter).select('createdAt').lean();
    const volume = [];

    for (let hour = 1; hour <= 24; hour++) {
      volume.push({ hour: `${hour.toString().padStart(2, '0')}:00`, value: 0 });
    }

    leads.forEach((lead) => {
      const h = new Date(lead.createdAt).getHours() + 1;
      if (h >= 1 && h <= 24) {
        volume[h - 1].value++;
      }
    });

    res.json(volume);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get alerts
// @route   GET /api/dashboard/alerts
// @access  Private
const getAlerts = async (req, res) => {
  try {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filter by executive if user is an Executive
    const isExecutive = req.user.role === 'Executive';
    const executiveId = req.user._id;
    
    // Check for hot leads that need follow-up today
    const hotLeadsFilter = {
      priority: 'Hot',
      follow_up_date: { $lte: today },
      status: { $in: ['Pending', 'Processing'] }
    };
    if (isExecutive) {
      hotLeadsFilter.$or = [
        { createdBy: executiveId },
        { managed_by: executiveId }
      ];
    }
    const hotLeadsPending = await Lead.countDocuments(hotLeadsFilter);
    
    if (hotLeadsPending > 0) {
      alerts.push({
        level: 'warning',
        text: `Follow-up pending for ${hotLeadsPending} hot lead${hotLeadsPending > 1 ? 's' : ''} today`
      });
    }
    
    // Check for trainings scheduled this week
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const trainingFilter = {
      startDate: { $gte: today, $lte: weekFromNow }
    };
    if (isExecutive) {
      trainingFilter.$or = [
        { createdBy: executiveId },
        { employeeId: executiveId }
      ];
    }
    const trainingsThisWeek = await Training.countDocuments(trainingFilter);
    
    if (trainingsThisWeek > 0) {
      alerts.push({
        level: 'info',
        text: `${trainingsThisWeek} training${trainingsThisWeek > 1 ? 's' : ''} scheduled this week`
      });
    }
    
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get zone-wise leads analytics
// @route   GET /api/dashboard/leads-analytics/zone-wise
// @access  Private
const getZoneWiseLeads = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const filter = { status: { $in: ['Pending', 'Processing'] } };
    
    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    
    const leads = await Lead.find(filter);
    const zoneData = {};
    
    leads.forEach(lead => {
      const zone = lead.zone || 'Unknown';
      if (!zoneData[zone]) {
        zoneData[zone] = {
          zone: zone,
          total: 0,
          hot: 0,
          warm: 0,
          cold: 0
        };
      }
      zoneData[zone].total++;
      const priority = lead.priority || 'Cold';
      if (priority === 'Hot') zoneData[zone].hot++;
      else if (priority === 'Warm') zoneData[zone].warm++;
      else zoneData[zone].cold++;
    });
    
    res.json(Object.values(zoneData));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get executive-wise leads analytics
// @route   GET /api/dashboard/leads-analytics/executive-wise
// @access  Private
const getExecutiveWiseLeads = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const filter = { status: { $in: ['Pending', 'Processing'] } };
    
    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    
    const leads = await Lead.find(filter).populate('managed_by', 'name');
    const executiveData = {};
    
    leads.forEach(lead => {
      const executiveId = lead.managed_by?._id?.toString() || 'unassigned';
      const executiveName = lead.managed_by?.name || 'Unassigned';
      const zone = lead.zone || 'Unknown';
      
      const key = `${executiveId}_${zone}`;
      if (!executiveData[key]) {
        executiveData[key] = {
          zone: zone,
          executiveName: executiveName,
          total: 0,
          hot: 0,
          warm: 0,
          cold: 0
        };
      }
      executiveData[key].total++;
      const priority = lead.priority || 'Cold';
      if (priority === 'Hot') executiveData[key].hot++;
      else if (priority === 'Warm') executiveData[key].warm++;
      else executiveData[key].cold++;
    });
    
    res.json(Object.values(executiveData));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get zone-wise closed leads analytics
// @route   GET /api/dashboard/leads-analytics/zone-wise-closed
// @access  Private
const getZoneWiseClosedLeads = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const filter = { status: { $in: ['Closed', 'Saved'] } };
    
    if (fromDate && toDate) {
      filter.updatedAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    
    const leads = await Lead.find(filter);
    const zoneData = {};
    
    leads.forEach(lead => {
      const zone = lead.zone || 'Unknown';
      if (!zoneData[zone]) {
        zoneData[zone] = {
          zone: zone,
          totalClosed: 0
        };
      }
      zoneData[zone].totalClosed++;
    });
    
    res.json(Object.values(zoneData));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get executive-wise closed leads analytics
// @route   GET /api/dashboard/leads-analytics/executive-wise-closed
// @access  Private
const getExecutiveWiseClosedLeads = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const filter = { status: { $in: ['Closed', 'Saved'] } };
    
    if (fromDate && toDate) {
      filter.updatedAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    
    const leads = await Lead.find(filter).populate('managed_by', 'name');
    const executiveData = {};
    
    leads.forEach(lead => {
      const executiveId = lead.managed_by?._id?.toString() || 'unassigned';
      const executiveName = lead.managed_by?.name || 'Unassigned';
      const zone = lead.zone || 'Unknown';
      
      const key = `${executiveId}_${zone}`;
      if (!executiveData[key]) {
        executiveData[key] = {
          zone: zone,
          executiveName: executiveName,
          totalClosed: 0
        };
      }
      executiveData[key].totalClosed++;
    });
    
    res.json(Object.values(executiveData));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get comprehensive analytics for all categories
// @route   GET /api/dashboard/comprehensive-analytics
// @access  Private
const getComprehensiveAnalytics = async (req, res) => {
  try {
    // Leads Analytics
    const leadsByStatus = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const leadsByPriority = await Lead.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Payments Analytics
    const paymentsByStatus = await Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    const paymentsByMethod = await Payment.aggregate([
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    const paymentsMonthly = await Payment.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Expenses Analytics
    const expensesByStatus = await Expense.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    const expensesByCategory = await Expense.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    const expensesMonthly = await Expense.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Training Analytics
    const trainingByStatus = await Training.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const trainingBySubject = await Training.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);

    // Service Analytics
    const serviceByStatus = await Service.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // DC/Sales Analytics
    const dcByStatus = await DC.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Employee Analytics
    const employeesByRole = await User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Product Analytics
    const productsByStatus = await Product.aggregate([
      { $group: { _id: '$prodStatus', count: { $sum: 1 } } }
    ]);

    res.json({
      leads: {
        byStatus: leadsByStatus,
        byPriority: leadsByPriority
      },
      payments: {
        byStatus: paymentsByStatus,
        byMethod: paymentsByMethod,
        monthly: paymentsMonthly
      },
      expenses: {
        byStatus: expensesByStatus,
        byCategory: expensesByCategory,
        monthly: expensesMonthly
      },
      training: {
        byStatus: trainingByStatus,
        bySubject: trainingBySubject
      },
      services: {
        byStatus: serviceByStatus
      },
      sales: {
        byStatus: dcByStatus
      },
      employees: {
        byRole: employeesByRole
      },
      products: {
        byStatus: productsByStatus
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get executive-specific analytics
// @route   GET /api/dashboard/executive-analytics
// @access  Private (Executive only)
const getExecutiveAnalytics = async (req, res) => {
  try {
    const executiveId = req.user._id;
    
    // Verify user is an Executive
    if (req.user.role !== 'Executive') {
      return res.status(403).json({ message: 'Access denied. This endpoint is for Executives only.' });
    }

    const { fromDate, toDate } = req.query;
    const dateFilter = {};
    if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }

    // Leads Analytics
    const leadsFilter = {
      $or: [
        { createdBy: executiveId },
        { managed_by: executiveId }
      ],
      ...dateFilter
    };
    const leadsByStatus = await Lead.aggregate([
      { $match: leadsFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const leadsByPriority = await Lead.aggregate([
      { $match: leadsFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    const leadsByZone = await Lead.aggregate([
      { $match: leadsFilter },
      { $group: { _id: '$zone', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const totalLeads = await Lead.countDocuments(leadsFilter);
    const closedLeads = await Lead.countDocuments({ ...leadsFilter, status: { $in: ['Closed', 'Saved'] } });

    // DC/Sales Analytics
    const dcFilter = {
      employeeId: executiveId,
      ...dateFilter
    };
    const dcByStatus = await DC.aggregate([
      { $match: dcFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const totalDCs = await DC.countDocuments(dcFilter);
    const completedDCs = await DC.countDocuments({ ...dcFilter, status: 'completed' });

    // Expenses Analytics
    const expenseFilter = {
      $or: [
        { employeeId: executiveId },
        { createdBy: executiveId }
      ],
      ...dateFilter
    };
    const expensesByStatus = await Expense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    const expensesByCategory = await Expense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: '$category', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { totalAmount: -1 } }
    ]);
    const expensesMonthly = await Expense.aggregate([
      { $match: expenseFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const totalExpenses = await Expense.countDocuments(expenseFilter);
    const totalExpenseAmount = await Expense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Payments Analytics
    // Get DCs for this executive to find related payments
    const executiveDCIds = await DC.find({ employeeId: executiveId }).select('_id').lean();
    const dcIds = executiveDCIds.map(dc => dc._id);
    
    const paymentFilter = {
      $or: [
        { createdBy: executiveId },
        { dcId: { $in: dcIds } }
      ],
      ...dateFilter
    };
    if (fromDate && toDate) {
      paymentFilter.paymentDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    const paymentsByStatus = await Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    const paymentsByMethod = await Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { totalAmount: -1 } }
    ]);
    const paymentsMonthly = await Payment.aggregate([
      { $match: paymentFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const totalPayments = await Payment.countDocuments(paymentFilter);
    const totalPaymentAmount = await Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Training Analytics
    const trainingFilter = {
      employeeId: executiveId,
      ...dateFilter
    };
    const trainingByStatus = await Training.aggregate([
      { $match: trainingFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const trainingBySubject = await Training.aggregate([
      { $match: trainingFilter },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const totalTrainings = await Training.countDocuments(trainingFilter);
    const completedTrainings = await Training.countDocuments({ ...trainingFilter, status: 'Completed' });

    // Services Analytics
    const serviceFilter = {
      employeeId: executiveId,
      ...dateFilter
    };
    const servicesByStatus = await Service.aggregate([
      { $match: serviceFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const servicesBySubject = await Service.aggregate([
      { $match: serviceFilter },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const totalServices = await Service.countDocuments(serviceFilter);
    const completedServices = await Service.countDocuments({ ...serviceFilter, status: 'Completed' });

    res.json({
      leads: {
        total: totalLeads,
        closed: closedLeads,
        byStatus: leadsByStatus,
        byPriority: leadsByPriority,
        byZone: leadsByZone
      },
      sales: {
        total: totalDCs,
        completed: completedDCs,
        byStatus: dcByStatus
      },
      expenses: {
        total: totalExpenses,
        totalAmount: totalExpenseAmount[0]?.total || 0,
        byStatus: expensesByStatus,
        byCategory: expensesByCategory,
        monthly: expensesMonthly
      },
      payments: {
        total: totalPayments,
        totalAmount: totalPaymentAmount[0]?.total || 0,
        byStatus: paymentsByStatus,
        byMethod: paymentsByMethod,
        monthly: paymentsMonthly
      },
      training: {
        total: totalTrainings,
        completed: completedTrainings,
        byStatus: trainingByStatus,
        bySubject: trainingBySubject
      },
      services: {
        total: totalServices,
        completed: completedServices,
        byStatus: servicesByStatus,
        bySubject: servicesBySubject
      }
    });
  } catch (error) {
    console.error('Error in getExecutiveAnalytics:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getLeadsByZone,
  getRecentActivities,
  getRevenueTrends,
  getLeadsVolume,
  getAlerts,
  getZoneWiseLeads,
  getExecutiveWiseLeads,
  getZoneWiseClosedLeads,
  getExecutiveWiseClosedLeads,
  getComprehensiveAnalytics,
  getExecutiveAnalytics
};


