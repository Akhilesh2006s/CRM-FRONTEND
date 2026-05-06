const Lead = require('../models/Lead');
const DcOrder = require('../models/DcOrder');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const { generateSchoolCode } = require('../utils/schoolCodeGenerator');
const { normalizeProductTerm } = require('../utils/productTerm');
const { derivePriorityFromFollowUpProducts } = require('../utils/leadFollowUpPriority');

function mapProductsFromInterested(productsInput) {
  if (!Array.isArray(productsInput)) return [];
  return productsInput
    .filter((p) => p && (p.product_name || p.product))
    .map((p) => ({
      product_name: String(p.product_name || p.product || '').trim(),
      quantity: Math.max(0, Number(p.quantity ?? p.strength) || 1),
      unit_price: Number(p.unit_price) || 0,
      term: normalizeProductTerm(p.term),
      deliverables: Array.isArray(p.deliverables) ? p.deliverables : [],
    }));
}

function normalizeLeadProducts(products) {
  if (!Array.isArray(products)) return products;

  return products.map((p) => {
    const product = { ...p };
    product.term = normalizeProductTerm(product.term);
    return product;
  });
}

// @desc    Get all leads
// @route   GET /api/leads
// @access  Private
const getLeads = async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection is not available. Please check your MongoDB connection.',
        error: 'DATABASE_CONNECTION_ERROR'
      });
    }

    const { 
      status, 
      assignedTo, 
      zone, 
      employee, 
      priority, 
      schoolName, 
      contactMobile, 
      fromDate, 
      toDate,
      lead_type: leadType,
    } = req.query;
    const filter = {};

    if (leadType) {
      if (String(leadType).includes(',')) {
        filter.lead_type = { $in: String(leadType).split(',').map((s) => s.trim()) };
      } else {
        filter.lead_type = leadType;
      }
    }

    if (status) {
      // Handle multiple statuses (comma-separated)
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filter.status = status;
      }
    }
    if (zone) filter.zone = { $regex: zone, $options: 'i' };
    if (priority) filter.priority = priority;
    if (schoolName) filter.school_name = { $regex: schoolName, $options: 'i' };
    if (contactMobile) filter.contact_mobile = { $regex: contactMobile, $options: 'i' };
    
    // Date filtering
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate + 'T23:59:59.999Z');
    }
    
    // Backward compatible: some schemas use assignedTo, others use managed_by/assigned_by
    if (assignedTo || employee) {
      const employeeId = assignedTo || employee;
      // Validate ObjectId format
      if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
        // Only add $or if we don't already have other conditions
        if (filter.$or) {
          // If $or already exists, merge conditions
          filter.$and = [
            { $or: filter.$or },
            { $or: [
              { managed_by: employeeId },
              { assigned_by: employeeId },
              { createdBy: employeeId },
            ]}
          ];
          delete filter.$or;
        } else {
          filter.$or = [
            { managed_by: employeeId },
            { assigned_by: employeeId },
            { createdBy: employeeId },
          ];
        }
      }
    }

    // Pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default 50 items per page
    const skip = (page - 1) * limit;

    // Get total count for pagination - use estimatedDocumentCount for better performance if no filters
    // Otherwise use countDocuments with timeout
    let total;
    try {
      if (Object.keys(filter).length === 0) {
        total = await Promise.race([
          Lead.estimatedDocumentCount(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Count timeout')), 10000))
        ]);
      } else {
        total = await Promise.race([
          Lead.countDocuments(filter),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Count timeout')), 10000))
        ]);
      }
    } catch (countError) {
      // If count times out, use a default or estimate
      console.warn('Count query timed out, using estimate');
      total = 0; // Will be updated as data loads
    }

    // Query with pagination - optimized for performance
    // Only populate essential fields for list view
    let query = Lead.find(filter)
      .select(
        'school_name school_code contact_person contact_mobile zone status follow_up_date location strength createdAt remarks priority managed_by assigned_by createdBy lead_type school_id renewalSource'
      ) // Only select needed fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .maxTimeMS(30000); // 30 second timeout at MongoDB level
    
    // Populate user references - handle errors gracefully
    try {
      query = query
        .populate({
          path: 'managed_by',
          select: 'name email',
          strictPopulate: false
        })
        .populate({
          path: 'assigned_by',
          select: 'name email',
          strictPopulate: false
        })
        .populate({
          path: 'createdBy',
          select: 'name email',
          strictPopulate: false
        })
        .populate({
          path: 'school_id',
          select:
            'school_name school_code dc_code contact_person contact_mobile zone location city state region area pincode strength address school_type status',
          strictPopulate: false,
        });
    } catch (populateError) {
      console.warn('Error setting up populate:', populateError);
      // Continue without populate if there's an error
    }
    
    const leads = await query;

    // Return paginated response
    res.json({
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getLeads:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single lead
// @route   GET /api/leads/:id
// @access  Private
const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate(
        'school_id',
        'school_name school_code dc_code contact_person contact_mobile zone location city state region area pincode strength address school_type products status remarks'
      );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create lead
// @route   POST /api/leads/create
// @access  Private
const createLead = async (req, res) => {
  try {
    if (req.body && req.body.lead_type === 'renewal') {
      return createRenewalLead(req, res);
    }

    const leadData = {
      ...req.body,
      createdBy: req.user._id,
    };
    if (leadData.lead_type == null || leadData.lead_type === '') {
      leadData.lead_type = 'new';
    }
    delete leadData.school_id;
    delete leadData.renewalSource;

    // Normalize product terms (adds default Term 1 when missing, validates when provided)
    try {
      leadData.products = normalizeLeadProducts(leadData.products);
    } catch (termError) {
      return res.status(400).json({ message: termError.message || 'Invalid product term' });
    }
    
    // Auto-generate school code if not provided
    // Use managed_by or assigned_by if available, otherwise use the creator
    if (!leadData.school_code) {
      try {
        const schoolCode = await generateSchoolCode({
          region: leadData.region || '',
          city: leadData.city || '',
        });
        if (schoolCode) {
          leadData.school_code = schoolCode;
        }
      } catch (codeError) {
        // If school code generation fails, log but don't fail the lead creation
        // (in case the user is not an executive or cluster is not set)
        console.warn('School code generation failed:', codeError.message);
      }
    }
    
    const lead = await Lead.create(leadData);

    const populatedLead = await Lead.findById(lead._id)
      .populate('createdBy', 'name email');

    res.status(201).json(populatedLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Renewal: link to existing DcOrder (school_id), minimal payload; autofill from order
const createRenewalLead = async (req, res) => {
  try {
    const schoolId = req.body.school_id;
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({
        message: 'Renewal lead requires school_id (select an existing school from search).',
      });
    }

    const order = await DcOrder.findById(schoolId).lean();
    if (!order) {
      return res.status(404).json({
        message: 'School not found in clients. Use Add Lead for new schools.',
      });
    }

    const code = String(order.school_code || order.dc_code || '').trim();
    const productsFromBody = mapProductsFromInterested(req.body.products || req.body.productsInterested);
    if (productsFromBody.length === 0) {
      return res.status(400).json({ message: 'Add at least one product interested for this renewal.' });
    }
    let productsNormalized;
    try {
      productsNormalized = normalizeLeadProducts(productsFromBody);
    } catch (termError) {
      return res.status(400).json({ message: termError.message || 'Invalid product term' });
    }

    const userId = req.user._id;
    const contactPerson =
      (req.body.contact_person != null && String(req.body.contact_person).trim() !== '')
        ? String(req.body.contact_person).trim()
        : (order.contact_person || '');
    const contactMobile =
      (req.body.contact_mobile != null && String(req.body.contact_mobile).trim() !== '')
        ? String(req.body.contact_mobile).trim()
        : (order.contact_mobile || '');

    if (!contactPerson || !contactMobile) {
      return res.status(400).json({
        message: 'Contact person and mobile are required (prefilled from school; edit if needed).',
      });
    }

    const leadData = {
      lead_type: 'renewal',
      school_id: schoolId,
      school_name: order.school_name,
      school_code: code || undefined,
      contact_person: contactPerson,
      contact_mobile: contactMobile,
      products: productsNormalized,
      location: order.location || order.address || '',
      pincode: order.pincode,
      state: order.state,
      city: order.city,
      region: order.region,
      area: order.area,
      zone: order.zone || '',
      strength: order.strength != null ? order.strength : 0,
      remarks: req.body.remarks != null ? String(req.body.remarks) : '',
      priority: ['Hot', 'Warm', 'Cold'].includes(req.body.priority) ? req.body.priority : 'Warm',
      status: 'Pending',
      follow_up_date: req.body.follow_up_date ? new Date(req.body.follow_up_date) : undefined,
      createdBy: userId,
      managed_by: userId,
      assigned_by: userId,
      renewalSource: {
        snapshotAt: new Date(),
        sourceSchoolName: order.school_name,
        sourceSchoolCode: code,
      },
    };

    const lead = await Lead.create(leadData);
    const populatedLead = await Lead.findById(lead._id)
      .populate('createdBy', 'name email')
      .populate(
        'school_id',
        'school_name school_code dc_code contact_person contact_mobile zone location city state region area pincode address strength school_type status remarks'
      );
    return res.status(201).json(populatedLead);
  } catch (error) {
    console.error('createRenewalLead error:', error);
    return res.status(500).json({ message: error.message || 'Failed to create renewal lead' });
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Never allow client to retag lead or re-link school via generic update
    delete req.body.school_id;
    delete req.body.lead_type;
    delete req.body.renewalSource;

    const hasFollowUpDate = req.body.follow_up_date !== undefined;
    const hasRemarks = req.body.remarks !== undefined;
    const hasProductsInterested = Array.isArray(req.body.productsInterested);
    const normalizeProductsInterested = (rows = []) =>
      rows
        .filter((row) => row && (row.product_name || row.product))
        .map((row) => ({
          product_name: String(row.product_name || row.product || '').trim(),
          term: normalizeProductTerm(row.term),
          status: ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'].includes(row.status)
            ? row.status
            : 'Warm',
          strength: Number(row.strength) || 0,
          chance: Math.max(0, Math.min(100, Number(row.chance) || 0)),
          quantity: Number(row.strength) || 0,
          unit_price: 0,
        }));
    const normalizedProductsInterested = hasProductsInterested
      ? normalizeProductsInterested(req.body.productsInterested)
      : [];

    const derivedLeadPriority = derivePriorityFromFollowUpProducts(normalizedProductsInterested);
    if (normalizedProductsInterested.length > 0 && derivedLeadPriority) {
      req.body.priority = derivedLeadPriority;
    }
    const hasPriority = req.body.priority !== undefined;

    // Normalize product terms if products are being updated
    if (req.body && Array.isArray(req.body.products)) {
      req.body.products = normalizeLeadProducts(req.body.products);
    }
    if (hasProductsInterested) {
      req.body.products = normalizeLeadProducts(normalizedProductsInterested);
    }

    // Remove transient payload key, not a Lead top-level field
    if (req.body.productsInterested !== undefined) {
      delete req.body.productsInterested;
    }

    const shouldTrackHistory = hasFollowUpDate || hasRemarks || hasPriority || hasProductsInterested;

    if (shouldTrackHistory) {
      const historyPriority =
        normalizedProductsInterested.length > 0 && derivedLeadPriority
          ? derivedLeadPriority
          : hasPriority && req.body.priority != null && req.body.priority !== ''
            ? req.body.priority
            : lead.priority || 'Warm';
      req.body.$push = {
        updateHistory: {
          follow_up_date: hasFollowUpDate && req.body.follow_up_date
            ? new Date(req.body.follow_up_date)
            : null,
          remarks: hasRemarks ? (req.body.remarks || '') : '',
          priority: historyPriority,
          productsInterested: normalizedProductsInterested,
          updatedBy: req.user?._id || lead.createdBy,
          updatedAt: new Date(),
        },
      };
    }

    const updateData = { ...req.body };
    const pushData = updateData.$push;
    delete updateData.$push;

    const mongoUpdate = {};
    if (Object.keys(updateData).length > 0) {
      mongoUpdate.$set = updateData;
    }
    if (pushData) {
      mongoUpdate.$push = pushData;
    }

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      mongoUpdate,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate(
        'school_id',
        'school_name school_code dc_code contact_person contact_mobile zone location status'
      );

    res.json(updatedLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export leads to Excel
// @route   GET /api/leads/export
// @access  Private
const exportLeads = async (req, res) => {
  try {
    const { 
      status, 
      zone, 
      employee, 
      priority, 
      schoolName, 
      contactMobile, 
      fromDate, 
      toDate,
      lead_type: leadTypeExport,
    } = req.query;
    const filter = {};

    if (leadTypeExport) {
      if (String(leadTypeExport).includes(',')) {
        filter.lead_type = { $in: String(leadTypeExport).split(',').map((s) => s.trim()) };
      } else {
        filter.lead_type = leadTypeExport;
      }
    }

    if (status) {
      // Handle multiple statuses (comma-separated)
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filter.status = status;
      }
    }
    if (zone) filter.zone = { $regex: zone, $options: 'i' };
    if (priority) filter.priority = priority;
    if (schoolName) filter.school_name = { $regex: schoolName, $options: 'i' };
    if (contactMobile) filter.contact_mobile = { $regex: contactMobile, $options: 'i' };
    
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate + 'T23:59:59.999Z');
    }
    
    if (employee) {
      filter.$or = [
        { managed_by: employee },
        { assigned_by: employee },
      ];
    }

    const leads = await Lead.find(filter)
      .populate('createdBy', 'name email')
      .populate('managed_by', 'name email')
      .populate('assigned_by', 'name email')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Created On', key: 'createdOn', width: 20 },
      { header: 'Zone', key: 'zone', width: 12 },
      { header: 'Assigned To', key: 'assignedTo', width: 20 },
      { header: 'Priority', key: 'priority', width: 15 },
      { header: 'Location', key: 'location', width: 30 },
      { header: 'School Name', key: 'schoolName', width: 30 },
      { header: 'Contact Person', key: 'contactPerson', width: 20 },
      { header: 'Decision Maker', key: 'decisionMaker', width: 20 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Follow-up On', key: 'followUpOn', width: 20 },
      { header: 'School Strength', key: 'schoolStrength', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    // Add data
    leads.forEach((lead, index) => {
      const assignedTo = lead.managed_by?.name || lead.assigned_by?.name || lead.createdBy?.name || 'Not Assigned';
      worksheet.addRow({
        sno: index + 1,
        createdOn: lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        zone: lead.zone || '',
        assignedTo: assignedTo,
        priority: lead.priority ? `${lead.priority} Lead` : '',
        location: lead.location || '',
        schoolName: lead.school_name || '',
        contactPerson: lead.contact_person || '',
        decisionMaker: lead.contact_person || '',
        mobile: lead.contact_mobile || '',
        followUpOn: lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        schoolStrength: lead.strength || 0,
        status: lead.status || '',
      });
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Convert lead to client (create DcOrder with status 'saved', no DC). Record moves to My Clients; Closed Sales only after Request DC.
// @route   POST /api/leads/:id/convert-to-client
// @access  Private
const convertToClient = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const userId = req.user._id;
    const userIdObj = mongoose.Types.ObjectId.isValid(userId)
      ? (userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId))
      : userId;
    const body = req.body || {};

    const products = Array.isArray(body.products) && body.products.length > 0
      ? body.products.map((p) => ({
          product_name: p.product_name || p.product || 'Abacus',
          quantity: Number(p.quantity) || 1,
          unit_price: Number(p.unit_price) || 0,
          term: normalizeProductTerm(p.term),
        }))
      : (lead.products && lead.products.length > 0
          ? lead.products.map((p) => ({
              product_name: p.product_name || p.product || 'Abacus',
              quantity: Number(p.quantity) || 1,
              unit_price: Number(p.unit_price) || 0,
            }))
          : [{ product_name: 'Abacus', quantity: 1, unit_price: 0 }]);

    // Renewal: school already exists as DcOrder — merge interest into it, do not duplicate client
    if (lead.lead_type === 'renewal' && lead.school_id) {
      const existing = await DcOrder.findById(lead.school_id);
      if (!existing) {
        return res.status(404).json({ message: 'Linked school (client) record not found' });
      }
      const mergedProducts = [...(existing.products || [])];
      for (const p of products) {
        const idx = mergedProducts.findIndex(
          (x) =>
            (x.product_name || '').toLowerCase().trim() === (p.product_name || '').toLowerCase().trim() &&
            (x.term || 'Term 1') === (p.term || 'Term 1')
        );
        if (idx >= 0) {
          mergedProducts[idx] = {
            ...mergedProducts[idx],
            quantity: (Number(mergedProducts[idx].quantity) || 0) + (Number(p.quantity) || 0),
            unit_price: Number(p.unit_price) || mergedProducts[idx].unit_price || 0,
          };
        } else {
          mergedProducts.push({
            product_name: p.product_name,
            quantity: Number(p.quantity) || 1,
            unit_price: Number(p.unit_price) || 0,
            term: normalizeProductTerm(p.term),
          });
        }
      }
      existing.products = mergedProducts;
      existing.contact_person = body.contact_person || lead.contact_person || existing.contact_person;
      existing.contact_mobile = body.contact_mobile || lead.contact_mobile || existing.contact_mobile;
      if (body.remarks || lead.remarks) {
        const note = [existing.remarks, body.remarks || lead.remarks].filter(Boolean).join('\n---\n');
        existing.remarks = note.slice(-8000);
      }
      await existing.save();
      await Lead.findByIdAndUpdate(req.params.id, { status: 'Closed' });
      const populated = await DcOrder.findById(existing._id)
        .populate('assigned_to', 'name email')
        .populate('created_by', 'name email');
      return res.status(200).json(populated);
    }

    const dcOrderPayload = {
      school_name: body.school_name || lead.school_name,
      contact_person: body.contact_person || lead.contact_person,
      contact_mobile: body.contact_mobile || lead.contact_mobile,
      email: body.email || lead.email,
      address: body.address || lead.address,
      location: body.location || lead.location,
      zone: body.zone || lead.zone,
      region: body.region || lead.region || '',
      city: body.city || lead.city || '',
      school_type: body.school_type || lead.school_type || 'New',
      products,
      status: 'saved',
      assigned_to: userIdObj,
      created_by: userIdObj,
      estimated_delivery_date: body.estimated_delivery_date ? new Date(body.estimated_delivery_date) : undefined,
      pod_proof_url: body.pod_proof_url || lead.pod_proof_url,
    };

    const dcOrder = await DcOrder.create(dcOrderPayload);

    await Lead.findByIdAndUpdate(req.params.id, { status: 'Closed' });

    const populated = await DcOrder.findById(dcOrder._id)
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email');

    res.status(201).json(populated);
  } catch (error) {
    console.error('convertToClient error:', error);
    res.status(500).json({ message: error.message || 'Failed to convert lead to client' });
  }
};

module.exports = {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  exportLeads,
  convertToClient,
};

