const DcOrder = require('../models/DcOrder');
const DC = require('../models/DC');
const { generateSchoolCode } = require('../utils/schoolCodeGenerator');
const { normalizeProductTerm, normalizeDcOrderProductTermsInArray } = require('../utils/productTerm');
const { derivePriorityFromFollowUpProducts } = require('../utils/leadFollowUpPriority');
const { dealProductsToFollowUpSnapshot } = require('../utils/dealProductsToFollowUpSnapshot');
const mongoose = require('mongoose');

const SCHOOL_LEAD_STATUSES = new Set(['Hot', 'Warm', 'Cold']);

function resolveSchoolLeadStatus(...candidates) {
  for (const value of candidates) {
    const s = String(value || '').trim();
    if (SCHOOL_LEAD_STATUSES.has(s)) return s;
  }
  return '';
}

/** Lead status badge for a history row (school Hot/Warm/Cold, then per-product deal status). */
function resolveHistoryPriorityForResponse(entry = {}, doc = {}) {
  const rows = Array.isArray(entry.productsInterested) ? entry.productsInterested : [];
  const stored = (entry.priority || '').trim();
  const docLeadStatus = resolveSchoolLeadStatus(doc.lead_status);

  if (SCHOOL_LEAD_STATUSES.has(stored)) return stored;

  if (docLeadStatus) return docLeadStatus;

  const fromProducts = derivePriorityFromFollowUpProducts(rows);
  if (fromProducts && rows.length > 0) return fromProducts;

  if (stored) return stored;

  if (
    stored === 'Cold' &&
    rows.length === 0 &&
    !docLeadStatus &&
    doc.priority &&
    !SCHOOL_LEAD_STATUSES.has(doc.priority)
  ) {
    return doc.priority;
  }
  return docLeadStatus || doc.priority || 'Warm';
}

const list = async (req, res) => {
  try {
    // Check MongoDB connection status
    const mongoose = require('mongoose');
    const connectionState = mongoose.connection.readyState;
    
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (connectionState !== 1) {
      console.warn(`MongoDB connection state: ${connectionState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
      return res.status(503).json({ 
        message: 'Database connection unavailable. Please check your MongoDB connection.',
        error: 'DATABASE_CONNECTION_ERROR',
        connectionState: connectionState
      });
    }

    const { status, q, zone, assigned_to, lead_status, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (zone) filter.zone = zone;
    if (assigned_to) filter.assigned_to = assigned_to;
    if (lead_status) filter.lead_status = lead_status;
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to) filter.createdAt.$lte = new Date(to)
    }
    if (q) {
      filter.$or = [
        { dc_code: new RegExp(q, 'i') },
        { school_name: new RegExp(q, 'i') },
        { contact_person: new RegExp(q, 'i') },
        { contact_mobile: new RegExp(q, 'i') },
        { zone: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ];
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
          DcOrder.estimatedDocumentCount(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Count timeout')), 10000))
        ]);
      } else {
        total = await Promise.race([
          DcOrder.countDocuments(filter),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Count timeout')), 10000))
        ]);
      }
    } catch (countError) {
      // If count times out, use a default or estimate
      console.warn('Count query timed out, using estimate');
      total = 0; // Will be updated as data loads
    }

    // Query with pagination - optimized for performance
    // Only populate essential fields, skip updateHistory populate for list view
    const query = DcOrder.find(filter)
      .select('school_name school_code contact_person contact_mobile zone status follow_up_date location strength createdAt remarks school_type priority lead_status assigned_to created_by pendingEdit products') // products: used for follow-up list lead status from line items
      .populate('assigned_to', 'name email') // Only populate assigned_to for list view
      .populate('pendingEdit.requestedBy', 'name email') // Populate pendingEdit.requestedBy for Executive Manager
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() // Use lean() for better performance
      .maxTimeMS(30000); // 30 second timeout at MongoDB level
    
    const items = await query;

    // Return paginated response
    res.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (e) {
    // Check if it's a MongoDB connection error or query timeout
    if (e.message && (
      e.message.includes('timeout') || 
      e.message.includes('connection') || 
      e.message.includes('ECONNREFUSED') ||
      e.message.includes('maxTimeMS')
    )) {
      console.error('MongoDB connection/query error in dc-orders list:', e.message);
      // Don't log the full error stack for timeout errors to reduce noise
      if (e.message.includes('maxTimeMS')) {
        console.error('Query exceeded 60 second timeout. Consider adding indexes or reducing data scope.');
      }
      return res.status(503).json({ 
        message: e.message.includes('maxTimeMS') 
          ? 'Query is taking too long. Please try again or contact support if the issue persists.'
          : 'Database connection failed. Please check your MongoDB connection settings.',
        error: 'DATABASE_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? e.message : undefined
      });
    }
    console.error('Error in dc-orders list:', e);
    res.status(500).json({ 
      message: e.message || 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
};

const getOne = async (req, res) => {
  try {
    // Check MongoDB connection status
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection unavailable. Please check your MongoDB connection.',
        error: 'DATABASE_CONNECTION_ERROR'
      });
    }

    const item = await DcOrder.findById(req.params.id)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('updateHistory.updatedBy', 'name email')
      .populate('pendingEdit.requestedBy', 'name email')
      .populate('pendingEdit.approvedBy', 'name email')
      .populate('poChangeRequest.requestedBy', 'name email')
      .populate('poChangeRequest.approvedBy', 'name email');
    if (!item) return res.status(404).json({ message: 'DC not found' });
    res.json(item);
  } catch (e) {
    // Check if it's a MongoDB connection error
    if (e.message && (e.message.includes('timeout') || e.message.includes('connection') || e.message.includes('ECONNREFUSED'))) {
      console.error('MongoDB connection error in dc-orders getOne:', e.message);
      return res.status(503).json({ 
        message: 'Database connection failed. Please check your MongoDB connection settings.',
        error: 'DATABASE_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? e.message : undefined
      });
    }
    console.error('Error in dc-orders getOne:', e);
    res.status(500).json({ 
      message: e.message || 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
};

const getHistory = async (req, res) => {
  try {
    console.log(`Fetching history for DC ${req.params.id}`);
    
    // Use lean() to get raw MongoDB document and ensure we get all data
    const item = await DcOrder.findById(req.params.id)
      .populate('updateHistory.updatedBy', 'name email')
      .lean(); // Use lean() to get plain JavaScript object
    
    if (!item) {
      console.log(`DC ${req.params.id} not found`);
      return res.status(404).json({ message: 'DC not found' });
    }
    
    // Get all history entries - ensure we're getting the raw array
    let history = item.updateHistory || [];
    
    console.log(`Raw history from DB: ${Array.isArray(history) ? history.length : 'NOT ARRAY'}`);
    console.log('History type:', typeof history);
    console.log('History is array?', Array.isArray(history));
    
    // Ensure history is an array
    if (!Array.isArray(history)) {
      console.log('History is not an array, converting...');
      if (history && typeof history === 'object') {
        // If it's an object, try to convert it
        history = Object.values(history);
      } else {
        history = [];
      }
    }
    
    // Log each entry
    if (history.length > 0) {
      console.log('History entries:');
      history.forEach((entry, idx) => {
        console.log(`  Entry ${idx + 1}:`, {
          updatedAt: entry.updatedAt,
          priority: entry.priority,
          remarks: entry.remarks?.substring(0, 30),
          followUp: entry.follow_up_date,
        });
      });
    }
    
    const productSnapshotForDisplay = dealProductsToFollowUpSnapshot(item.products || []);

    // If no history exists but item has data, create initial entry
    if (
      history.length === 0 &&
      (item.follow_up_date || item.remarks || item.lead_status || item.priority || productSnapshotForDisplay.length)
    ) {
      console.log('No history found, creating initial entry from current data');
      history = [{
        follow_up_date: item.follow_up_date || null,
        remarks: item.remarks || 'Lead created',
        priority: item.lead_status || item.priority || 'Warm',
        productsInterested: productSnapshotForDisplay,
        updatedAt: item.createdAt || new Date(),
        updatedBy: { name: 'System', _id: null },
      }];
    }

    // Legacy: single history row from create often had no product snapshot — show current lines only when nothing else recorded
    if (history.length === 1 && productSnapshotForDisplay.length > 0) {
      const [only] = history;
      if (only && (!only.productsInterested || only.productsInterested.length === 0)) {
        history = [{ ...only, productsInterested: productSnapshotForDisplay }];
      }
    }
    
    // Sort history by date descending (newest first)
    history = history.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return dateB - dateA;
    });

    // Resolve display priority: old saves used "Cold" when body omitted priority despite a Hot/Warm deal
    history = history.map((entry) => ({
      ...entry,
      priority: resolveHistoryPriorityForResponse(entry, item),
    }));
    
    console.log(`Returning ${history.length} history entries for DC ${req.params.id}`);
    res.json(history);
  } catch (e) {
    console.error('Get history error:', e);
    res.status(500).json({ message: e.message });
  }
};

const create = async (req, res) => {
  try {
    const payload = { ...req.body, created_by: req.user._id };
    if (Array.isArray(payload.products)) {
      payload.products = normalizeDcOrderProductTermsInArray(payload.products);
    }
    
    // Auto-generate school code if not provided
    // Use assigned_to if available, otherwise use created_by (the user creating)
    if (!payload.school_code) {
      try {
        const schoolCode = await generateSchoolCode({
          region: payload.region || '',
          city: payload.city || '',
        });
        if (schoolCode) {
          payload.school_code = schoolCode;
        }
      } catch (codeError) {
        // If school code generation fails, log but don't fail the creation
        // (in case the user is not an executive or cluster is not set)
        console.warn('School code generation failed:', codeError.message);
      }
    }
    
    if (payload.lead_status) {
      payload.priority = payload.lead_status;
    }

    const creationProductSnapshot = dealProductsToFollowUpSnapshot(payload.products || []);
    const creationLeadStatus = payload.lead_status || payload.priority || 'Warm';
    // Initialize history with creation entry (includes per-product lead status from create form)
    if (
      payload.follow_up_date ||
      payload.remarks ||
      payload.lead_status ||
      payload.priority ||
      creationProductSnapshot.length > 0
    ) {
      payload.updateHistory = [{
        follow_up_date: payload.follow_up_date ? new Date(payload.follow_up_date) : null,
        remarks: payload.remarks || '',
        priority: creationLeadStatus,
        productsInterested: creationProductSnapshot,
        updatedBy: req.user._id,
        updatedAt: new Date(),
      }];
    }
    
    const item = await DcOrder.create(payload);
    
    // Auto-create DC entry when DcOrder (Lead/Deal) is created
    // Get products - if it's an array, take first product, otherwise use string
    let productName = 'Abacus'; // default
    if (item.products && Array.isArray(item.products) && item.products.length > 0) {
      productName = item.products[0].product_name || item.products[0].product || 'Abacus';
    } else if (typeof item.products === 'string') {
      // If products is a comma-separated string
      const products = item.products.split(',').map(p => p.trim()).filter(Boolean);
      productName = products.length > 0 ? products[0] : 'Abacus';
    }
    
    // Calculate quantity from products array or default to 1
    let quantity = 1;
    if (item.products && Array.isArray(item.products) && item.products.length > 0) {
      quantity = item.products.reduce((sum, p) => sum + (p.quantity || 1), 0);
    }
    
    // Only create DC if assigned_to exists
    if (item.assigned_to) {
      try {
        const dc = await DC.create({
          dcOrderId: item._id,
          employeeId: item.assigned_to,
          customerName: item.school_name,
          customerEmail: item.email || undefined,
          customerAddress: item.address || item.location || 'N/A',
          customerPhone: item.contact_mobile || item.contact_person || 'N/A',
          product: productName,
          requestedQuantity: quantity,
          deliverableQuantity: 0,
          status: 'created',
          createdBy: req.user._id,
        });
        console.log(`DC created successfully for DcOrder ${item._id}, assigned to employee ${item.assigned_to}`);
      } catch (dcError) {
        console.error('Error creating DC for DcOrder:', dcError);
        // Don't fail the DcOrder creation if DC creation fails, but log it
      }
    } else {
      console.warn(`DcOrder ${item._id} created without assigned_to, so no DC was created`);
    }
    
    const populated = await DcOrder.findById(item._id)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email');
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const update = async (req, res) => {
  try {
    console.log('📝 DcOrder UPDATE request received:', {
      id: req.params.id,
      status: req.body.status,
      assigned_to: req.body.assigned_to,
      hasProducts: !!req.body.products,
      bodyKeys: Object.keys(req.body)
    });
    
    const item = await DcOrder.findById(req.params.id);
    if (!item) {
      console.log('❌ DcOrder not found:', req.params.id);
      return res.status(404).json({ message: 'DC not found' });
    }

    if (Array.isArray(req.body.products)) {
      req.body.products = normalizeDcOrderProductTermsInArray(req.body.products);
    }

    console.log('✅ DcOrder found:', {
      currentStatus: item.status,
      currentAssignedTo: item.assigned_to,
      schoolName: item.school_name
    });
    
    // Track history if follow_up_date, remarks, or priority is being updated
    const hasFollowUpDate = req.body.follow_up_date !== undefined;
    const hasRemarks = req.body.remarks !== undefined;
    const hasPriority = req.body.priority !== undefined;
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
    const isFollowUpSubmission = hasFollowUpDate && hasRemarks;
    if (isFollowUpSubmission) {
      if (normalizedProductsInterested.length === 0) {
        return res.status(400).json({
          message: 'At least one product with Strength (quantity) and Chance % is required',
        });
      }
      const invalidProductRows = normalizedProductsInterested.some(
        (row) => row.strength <= 0 || row.chance <= 0
      );
      if (invalidProductRows) {
        return res.status(400).json({
          message: 'Each product must have Strength greater than 0 and Chance % greater than 0',
        });
      }
    }
    const shouldTrackHistory = hasFollowUpDate || hasRemarks || hasPriority || hasProductsInterested;
    
    // Prepare update object using $set for field updates
    const updateData = {};
    
    // Update fields using $set
    if (hasFollowUpDate) {
      updateData.follow_up_date = req.body.follow_up_date ? new Date(req.body.follow_up_date) : null;
    }
    if (hasRemarks) {
      updateData.remarks = req.body.remarks;
    }
    if (hasPriority) {
      updateData.priority = req.body.priority;
    }
    if (hasProductsInterested) {
      // Keep latest product-interest snapshot on record as well.
      updateData.products = normalizedProductsInterested;
      const schoolLeadStatus = resolveSchoolLeadStatus(req.body.lead_status, item.lead_status);
      if (schoolLeadStatus) {
        updateData.lead_status = schoolLeadStatus;
        updateData.priority = schoolLeadStatus;
      } else {
        const derived = derivePriorityFromFollowUpProducts(normalizedProductsInterested);
        if (derived) {
          updateData.priority = derived;
        }
      }
    }
    if (req.body.lead_status !== undefined) {
      const schoolLeadStatus = resolveSchoolLeadStatus(req.body.lead_status);
      if (schoolLeadStatus) {
        updateData.lead_status = schoolLeadStatus;
        updateData.priority = schoolLeadStatus;
      }
    }
    
    // assigned_to: allow when closing lead → client so My Clients shows the record for current user
    if (req.body.assigned_to !== undefined && req.body.assigned_to !== null && req.body.assigned_to !== '') {
      const mongoose = require('mongoose');
      updateData.assigned_to = mongoose.Types.ObjectId.isValid(req.body.assigned_to)
        ? (req.body.assigned_to instanceof mongoose.Types.ObjectId ? req.body.assigned_to : new mongoose.Types.ObjectId(req.body.assigned_to))
        : req.body.assigned_to;
    }

    // Update other fields if provided
    const fieldsToUpdate = [
      'status', 'zone', 'location', 'contact_person', 'contact_mobile', 'school_name',
      'contact_person2', 'contact_mobile2', 'email', 'address', 'school_type',
      'pincode', 'state', 'city', 'region', 'area',
      'average_fee', 'branches', 'strength', 'remarks',
      'estimated_delivery_date', 'products', 'dcRequestData', 'total_amount',
      // Delivery address fields (old)
      'property_number', 'floor', 'tower_block', 'nearby_landmark', 'pod_proof_url',
      // Transport fields (new)
      'transport_name', 'transport_location', 'transportation_landmark'
    ];
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'average_fee' || field === 'branches' || field === 'strength') {
          // Convert to number if it's a numeric field
          updateData[field] = req.body[field] !== '' && req.body[field] !== null 
            ? Number(req.body[field]) 
            : undefined;
        } else if (field === 'estimated_delivery_date' && req.body[field]) {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    // When Executive requests DC (status → dc_requested), store requestedBy and requestedAt
    if (req.body.status === 'dc_requested') {
      updateData.requestedBy = req.user._id;
      updateData.requestedAt = new Date();
    }
    
    // Build the MongoDB update query
    const mongoUpdate = {};
    
    // Add $set for field updates
    if (Object.keys(updateData).length > 0) {
      mongoUpdate.$set = updateData;
    }
    
    // ALWAYS create a new history entry when follow_up_date, remarks, or priority is being updated
    // This ensures every update creates a NEW entry, not overwrites existing ones
    if (shouldTrackHistory) {
      // Get the NEW values that will be set (from request body)
      const newFollowUp = hasFollowUpDate && req.body.follow_up_date 
        ? new Date(req.body.follow_up_date) 
        : null;
      const newRemarks = hasRemarks ? (req.body.remarks || '') : '';
      const derivedFromProducts = derivePriorityFromFollowUpProducts(normalizedProductsInterested);
      const schoolLeadStatus = resolveSchoolLeadStatus(req.body.lead_status, item.lead_status);
      const newPriority =
        schoolLeadStatus ||
        (normalizedProductsInterested.length > 0 && derivedFromProducts
          ? derivedFromProducts
          : '') ||
        (hasPriority && req.body.priority != null && req.body.priority !== ''
          ? req.body.priority
          : '') ||
        resolveSchoolLeadStatus(item.lead_status) ||
        item.priority ||
        'Warm';

      // Create a NEW history entry with the values being set
      // This entry represents this specific update/change
      const historyEntry = {
        follow_up_date: newFollowUp,
        remarks: newRemarks,
        priority: newPriority,
        productsInterested: normalizedProductsInterested,
        updatedBy: req.user._id,
        updatedAt: new Date(),
      };
      
      console.log('=== CREATING NEW HISTORY ENTRY ===');
      console.log('New history entry:', JSON.stringify(historyEntry, null, 2));
      console.log('Current history count before update:', item.updateHistory?.length || 0);
      console.log('This will be entry number:', (item.updateHistory?.length || 0) + 1);
      
      // Use $push to ADD a new entry to the array
      // This preserves ALL existing history entries and adds this new one
      mongoUpdate.$push = {
        updateHistory: historyEntry
      };
      
      console.log('Using $push to append new entry. Array will have:', (item.updateHistory?.length || 0) + 1, 'entries after this update');
    }
    
    // Use findByIdAndUpdate with $set and $push to preserve all history
    console.log('💾 Executing MongoDB update:', {
      id: req.params.id,
      updateData: JSON.stringify(mongoUpdate, null, 2)
    });
    
    const updatedItem = await DcOrder.findByIdAndUpdate(
      req.params.id,
      mongoUpdate,
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      console.log('❌ DcOrder update failed - item not found after update');
      return res.status(404).json({ message: 'DC not found' });
    }
    
    console.log('✅ DcOrder updated successfully:', {
      id: updatedItem._id,
      newStatus: updatedItem.status,
      newAssignedTo: updatedItem.assigned_to,
      schoolName: updatedItem.school_name
    });
    
    // Fetch the updated item again to ensure we have the latest history
    const refreshedItem = await DcOrder.findById(req.params.id)
      .populate('updateHistory.updatedBy', 'name email');
    
    console.log(`=== UPDATE COMPLETE ===`);
    console.log(`DC ID: ${req.params.id}`);
    console.log(`History count BEFORE update: ${item.updateHistory?.length || 0} entries`);
    console.log(`History count AFTER update: ${refreshedItem?.updateHistory?.length || 0} entries`);
    
    if (refreshedItem?.updateHistory && refreshedItem.updateHistory.length > 0) {
      console.log('All history entries (newest first):');
      refreshedItem.updateHistory.forEach((entry, idx) => {
        const date = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'No date';
        console.log(`  Entry ${idx + 1}: ${date} | Priority: ${entry.priority} | Remarks: "${entry.remarks?.substring(0, 30) || 'No remarks'}"`);
      });
    } else {
      console.log('WARNING: No history entries found after update!');
    }
    
    const populated = await DcOrder.findById(refreshedItem?._id || updatedItem._id)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('updateHistory.updatedBy', 'name email');
    
    res.json(populated);
  } catch (e) {
    console.error('Update error:', e);
    res.status(500).json({ message: e.message });
  }
};

const submit = async (req, res) => {
  try {
    const item = await DcOrder.findByIdAndUpdate(
      req.params.id,
      { status: 'pending' },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'DC not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const markInTransit = async (req, res) => {
  try {
    const item = await DcOrder.findByIdAndUpdate(
      req.params.id,
      { status: 'in_transit' },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'DC not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const complete = async (req, res) => {
  try {
    const item = await DcOrder.findByIdAndUpdate(
      req.params.id,
      {
        status: 'completed',
        actual_delivery_date: req.body.actual_delivery_date || new Date(),
        pod_proof_url: req.body.pod_proof_url,
        completed_by: req.user?._id,
      },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'DC not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const hold = async (req, res) => {
  try {
    const item = await DcOrder.findByIdAndUpdate(
      req.params.id,
      { status: 'hold', remarks: req.body.hold_notes || req.body.remarks },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'DC not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Submit edit request for a closed sale (PO)
const submitEdit = async (req, res) => {
  try {
    console.log('Submit edit request received for ID:', req.params.id);
    console.log('Full request body keys:', Object.keys(req.body));
    console.log('Delivery address fields received:', {
      property_number: req.body.property_number,
      floor: req.body.floor,
      tower_block: req.body.tower_block,
      nearby_landmark: req.body.nearby_landmark,
      area: req.body.area,
      city: req.body.city,
      pincode: req.body.pincode,
    });
    console.log('Full request body (first 500 chars):', JSON.stringify(req.body).substring(0, 500));
    const item = await DcOrder.findById(req.params.id);
    if (!item) {
      console.log('DC Order not found:', req.params.id);
      return res.status(404).json({ message: 'DC not found' });
    }

    // Check if there's already a pending edit
    if (item.pendingEdit && item.pendingEdit.status === 'pending') {
      return res.status(400).json({ message: 'There is already a pending edit request for this DC' });
    }

    // Extract transport fields - these will be saved directly to main DcOrder (no approval needed)
    const transportFields = {
      transport_name: (req.body.transport_name !== undefined && req.body.transport_name !== null) ? String(req.body.transport_name) : '',
      transport_location: (req.body.transport_location !== undefined && req.body.transport_location !== null) ? String(req.body.transport_location) : '',
      transportation_landmark: (req.body.transportation_landmark !== undefined && req.body.transportation_landmark !== null) ? String(req.body.transportation_landmark) : '',
      pincode: (req.body.pincode !== undefined && req.body.pincode !== null) ? String(req.body.pincode) : '',
    };
    
    // Keep old delivery address fields for backwards compatibility
    const deliveryAddressFields = {
      property_number: (req.body.property_number !== undefined && req.body.property_number !== null) ? String(req.body.property_number) : '',
      floor: (req.body.floor !== undefined && req.body.floor !== null) ? String(req.body.floor) : '',
      tower_block: (req.body.tower_block !== undefined && req.body.tower_block !== null) ? String(req.body.tower_block) : '',
      nearby_landmark: (req.body.nearby_landmark !== undefined && req.body.nearby_landmark !== null) ? String(req.body.nearby_landmark) : '',
      area: (req.body.area !== undefined && req.body.area !== null) ? String(req.body.area) : '',
      city: (req.body.city !== undefined && req.body.city !== null) ? String(req.body.city) : '',
    };

    console.log('Transport fields to save directly:', transportFields);
    console.log('Delivery address fields to save directly:', deliveryAddressFields);

    // Create pending edit object with only the fields that need approval (excluding delivery address and transport fields)
    const pendingEdit = {
      school_name: req.body.school_name || '',
      contact_person: req.body.contact_person || '',
      contact_mobile: req.body.contact_mobile || '',
      contact_person2: req.body.contact_person2 || '',
      contact_mobile2: req.body.contact_mobile2 || '',
      email: req.body.email || '',
      address: req.body.address || '',
      school_type: req.body.school_type || '',
      zone: req.body.zone || '',
      location: req.body.location || '',
      products: normalizeDcOrderProductTermsInArray(req.body.products || []),
      pod_proof_url: req.body.pod_proof_url || '',
      remarks: req.body.remarks || '',
      total_amount: req.body.total_amount || 0,
      // Transport fields (new)
      transport_name: req.body.transport_name || '',
      transport_location: req.body.transport_location || '',
      transportation_landmark: req.body.transportation_landmark || '',
      requestedBy: req.user._id,
      requestedAt: new Date(),
      status: 'pending',
    };

    console.log('Pending edit object (fields requiring approval):', JSON.stringify(pendingEdit, null, 2));

    // Update DcOrder: Save transport + delivery address directly + save other fields to pendingEdit for approval
    const updatedItem = await DcOrder.findByIdAndUpdate(
      req.params.id,
      {
        // Save transport fields and delivery address fields directly to main document (no approval needed)
        $set: {
          // Transport fields (new)
          transport_name: transportFields.transport_name,
          transport_location: transportFields.transport_location,
          transportation_landmark: transportFields.transportation_landmark,
          pincode: transportFields.pincode,
          // Delivery address fields (old - backwards compatibility)
          property_number: deliveryAddressFields.property_number,
          floor: deliveryAddressFields.floor,
          tower_block: deliveryAddressFields.tower_block,
          nearby_landmark: deliveryAddressFields.nearby_landmark,
          area: deliveryAddressFields.area,
          city: deliveryAddressFields.city,
          // Save other fields to pendingEdit for approval
          pendingEdit: pendingEdit,
        }
      },
      { new: true, runValidators: true }
    )
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('pendingEdit.requestedBy', 'name email');

    // Also update related DC records with delivery address (saved directly, no approval needed)
    try {
      const relatedDCs = await DC.find({ dcOrderId: new mongoose.Types.ObjectId(req.params.id) });
      
      if (relatedDCs.length > 0) {
        const dcUpdateData = {
          property_number: deliveryAddressFields.property_number,
          floor: deliveryAddressFields.floor,
          tower_block: deliveryAddressFields.tower_block,
          nearby_landmark: deliveryAddressFields.nearby_landmark,
          area: deliveryAddressFields.area,
          city: deliveryAddressFields.city,
          pincode: deliveryAddressFields.pincode,
        };
        
        await DC.updateMany(
          { dcOrderId: new mongoose.Types.ObjectId(req.params.id) },
          { $set: dcUpdateData }
        );
        console.log(`Updated ${relatedDCs.length} related DC records with delivery address (saved directly)`);
      }
    } catch (dcUpdateError) {
      // Log error but don't fail the submission
      console.error('Error updating related DC records with delivery address:', dcUpdateError);
    }

    // Verify the saved data
    console.log('Saved delivery address directly to DcOrder:', {
      property_number: updatedItem.property_number,
      floor: updatedItem.floor,
      tower_block: updatedItem.tower_block,
      nearby_landmark: updatedItem.nearby_landmark,
      area: updatedItem.area,
      city: updatedItem.city,
      pincode: updatedItem.pincode,
    });

    res.json(updatedItem);
  } catch (e) {
    console.error('Submit edit error:', e);
    res.status(500).json({ message: e.message });
  }
};

// Approve or reject edit request (Executive Manager only)
const approveEdit = async (req, res) => {
  try {
    const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be "approve" or "reject"' });
    }

    const item = await DcOrder.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'DC not found' });

    if (!item.pendingEdit || item.pendingEdit.status !== 'pending') {
      return res.status(400).json({ message: 'No pending edit request found for this DC' });
    }

    if (action === 'approve') {
      // Apply the pending edit to the main document
      // Note: Delivery address fields are NOT included here - they were already saved directly when edit was submitted
      const updateData = {
        school_name: item.pendingEdit.school_name !== undefined ? item.pendingEdit.school_name : item.school_name,
        contact_person: item.pendingEdit.contact_person !== undefined ? item.pendingEdit.contact_person : item.contact_person,
        contact_mobile: item.pendingEdit.contact_mobile !== undefined ? item.pendingEdit.contact_mobile : item.contact_mobile,
        contact_person2: item.pendingEdit.contact_person2 !== undefined ? item.pendingEdit.contact_person2 : item.contact_person2,
        contact_mobile2: item.pendingEdit.contact_mobile2 !== undefined ? item.pendingEdit.contact_mobile2 : item.contact_mobile2,
        email: item.pendingEdit.email !== undefined ? item.pendingEdit.email : item.email,
        address: item.pendingEdit.address !== undefined ? item.pendingEdit.address : item.address,
        school_type: item.pendingEdit.school_type !== undefined ? item.pendingEdit.school_type : item.school_type,
        zone: item.pendingEdit.zone !== undefined ? item.pendingEdit.zone : item.zone,
        location: item.pendingEdit.location !== undefined ? item.pendingEdit.location : item.location,
        products: normalizeDcOrderProductTermsInArray(
          item.pendingEdit.products !== undefined ? item.pendingEdit.products : item.products
        ),
        pod_proof_url: item.pendingEdit.pod_proof_url !== undefined ? item.pendingEdit.pod_proof_url : item.pod_proof_url,
        remarks: item.pendingEdit.remarks !== undefined ? item.pendingEdit.remarks : item.remarks,
        total_amount: item.pendingEdit.total_amount !== undefined ? item.pendingEdit.total_amount : item.total_amount,
        // Transport fields (new)
        transport_name: item.pendingEdit.transport_name !== undefined ? item.pendingEdit.transport_name : item.transport_name,
        transport_location: item.pendingEdit.transport_location !== undefined ? item.pendingEdit.transport_location : item.transport_location,
        transportation_landmark: item.pendingEdit.transportation_landmark !== undefined ? item.pendingEdit.transportation_landmark : item.transportation_landmark,
        // Delivery address fields are NOT updated here - they were already saved directly when edit was submitted
        'pendingEdit.status': 'approved',
        'pendingEdit.approvedBy': req.user._id,
        'pendingEdit.approvedAt': new Date(),
      };

      // Update the DcOrder with approved changes
      const updatedItem = await DcOrder.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate('created_by', 'name email')
        .populate('assigned_to', 'name email')
        .populate('pendingEdit.requestedBy', 'name email')
        .populate('pendingEdit.approvedBy', 'name email');

      // Also update related DC records if they exist
      try {
        const relatedDCs = await DC.find({ dcOrderId: new mongoose.Types.ObjectId(req.params.id) });
        
        if (relatedDCs.length > 0) {
          const dcUpdateData = {};
          
          // Update DC fields that correspond to DcOrder fields (from pendingEdit - approved changes)
          if (item.pendingEdit.school_name !== undefined) {
            dcUpdateData.customerName = item.pendingEdit.school_name;
          }
          if (item.pendingEdit.contact_mobile !== undefined) {
            dcUpdateData.customerPhone = item.pendingEdit.contact_mobile;
          }
          if (item.pendingEdit.email !== undefined) {
            dcUpdateData.customerEmail = item.pendingEdit.email;
          }
          if (item.pendingEdit.address !== undefined) {
            dcUpdateData.customerAddress = item.pendingEdit.address;
          }
          if (item.pendingEdit.pod_proof_url !== undefined) {
            dcUpdateData.poPhotoUrl = item.pendingEdit.pod_proof_url;
            dcUpdateData.poDocument = item.pendingEdit.pod_proof_url; // Also update legacy field
          }
          
          // Update delivery address fields from main DcOrder (they were already saved directly)
          // Get the updated item to ensure we have the latest delivery address
          const updatedDcOrder = await DcOrder.findById(req.params.id);
          if (updatedDcOrder) {
            if (updatedDcOrder.property_number !== undefined) {
              dcUpdateData.property_number = updatedDcOrder.property_number;
            }
            if (updatedDcOrder.floor !== undefined) {
              dcUpdateData.floor = updatedDcOrder.floor;
            }
            if (updatedDcOrder.tower_block !== undefined) {
              dcUpdateData.tower_block = updatedDcOrder.tower_block;
            }
            if (updatedDcOrder.nearby_landmark !== undefined) {
              dcUpdateData.nearby_landmark = updatedDcOrder.nearby_landmark;
            }
            if (updatedDcOrder.area !== undefined) {
              dcUpdateData.area = updatedDcOrder.area;
            }
            if (updatedDcOrder.city !== undefined) {
              dcUpdateData.city = updatedDcOrder.city;
            }
            if (updatedDcOrder.pincode !== undefined) {
              dcUpdateData.pincode = updatedDcOrder.pincode;
            }
          }
          
          // Update all related DCs
          if (Object.keys(dcUpdateData).length > 0) {
            await DC.updateMany(
              { dcOrderId: new mongoose.Types.ObjectId(req.params.id) },
              { $set: dcUpdateData }
            );
            console.log(`Updated ${relatedDCs.length} related DC records with approved changes and delivery address`);
          }
        }
      } catch (dcUpdateError) {
        // Log error but don't fail the approval
        console.error('Error updating related DC records:', dcUpdateError);
      }

      console.log('PO edit request approved and changes applied to DcOrder:', {
        dcOrderId: req.params.id,
        schoolName: updatedItem.school_name,
        approvedBy: req.user._id
      });

      res.json(updatedItem);
    } else {
      // Reject the edit request
      const updatedItem = await DcOrder.findByIdAndUpdate(
        req.params.id,
        {
          'pendingEdit.status': 'rejected',
          'pendingEdit.rejectionReason': rejectionReason || 'Rejected by Executive Manager',
        },
        { new: true }
      )
        .populate('created_by', 'name email')
        .populate('assigned_to', 'name email')
        .populate('pendingEdit.requestedBy', 'name email');

      res.json(updatedItem);
    }
  } catch (e) {
    console.error('Approve edit error:', e);
    res.status(500).json({ message: e.message });
  }
};

// @desc    Executive: request PO PDF change (sent only to assigned Executive Manager).
// @route   POST /api/dc-orders/:id/request-po-change
// @access  Private (Executive - assigned to this DcOrder)
const requestPoChange = async (req, res) => {
  try {
    const User = require('../models/User');
    const item = await DcOrder.findById(req.params.id).populate('assigned_to', 'name email executiveManagerId');
    if (!item) return res.status(404).json({ message: 'Order not found' });
    const userId = req.user._id;
    const assignedId = item.assigned_to && (typeof item.assigned_to === 'object' ? item.assigned_to._id : item.assigned_to);
    if (assignedId && assignedId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only request PO change for orders assigned to you' });
    }
    // PO change only when DC has not been requested (status = saved). Once Request DC is done, status becomes dc_requested → client is in DC flow → PO change not allowed.
    if (item.status !== 'saved') {
      return res.status(400).json({ message: 'PO change can only be requested before Request DC. This client has already had DC requested and is in the DC flow.' });
    }
    const executiveUser = await User.findById(userId).select('executiveManagerId').lean();
    const assignedExecutiveManagerId = (executiveUser && executiveUser.executiveManagerId) || null;
    if (!assignedExecutiveManagerId) {
      return res.status(400).json({ message: 'You must have an assigned Executive Manager to submit a PO change request. Please contact admin.' });
    }
    const { pod_proof_url: newPdfUrl, remarks } = req.body || {};
    if (!newPdfUrl || typeof newPdfUrl !== 'string' || !newPdfUrl.trim()) {
      return res.status(400).json({ message: 'New PO PDF URL is required (upload PDF first, then pass pod_proof_url)' });
    }
    const oldPdfUrl = item.pod_proof_url || null;
    item.poChangeRequest = {
      status: 'PENDING_MANAGER_APPROVAL',
      oldPdfUrl,
      newPdfUrl: newPdfUrl.trim(),
      requestedBy: userId,
      requestedAt: new Date(),
      remarks: remarks ? String(remarks).trim() : '',
      assignedExecutiveManagerId,
    };
    await item.save();
    const populated = await DcOrder.findById(item._id)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('poChangeRequest.requestedBy', 'name email')
      .populate('poChangeRequest.assignedExecutiveManagerId', 'name email');
    res.json(populated);
  } catch (e) {
    console.error('requestPoChange error:', e);
    res.status(500).json({ message: e.message || 'Failed to submit PO change request' });
  }
};

// @desc    Executive Manager: approve or reject PO PDF change request (only assigned manager).
// @route   PUT /api/dc-orders/:id/approve-po-change
// @access  Private (Executive Manager - must be assigned to the requesting Executive)
const approvePoChange = async (req, res) => {
  try {
    const userRole = req.user?.role || '';
    if (String(userRole) !== 'Executive Manager') {
      return res.status(403).json({ message: 'Only Executive Manager can approve or reject PO change requests' });
    }
    const managerId = req.user._id;
    const item = await DcOrder.findById(req.params.id)
      .populate('assigned_to', 'name email')
      .populate('poChangeRequest.requestedBy', 'name email');
    if (!item) return res.status(404).json({ message: 'Order not found' });
    if (!item.poChangeRequest || item.poChangeRequest.status !== 'PENDING_MANAGER_APPROVAL') {
      return res.status(400).json({ message: 'No pending PO change request for this order' });
    }
    const assignedManagerId = item.poChangeRequest.assignedExecutiveManagerId
      ? (typeof item.poChangeRequest.assignedExecutiveManagerId === 'object'
          ? item.poChangeRequest.assignedExecutiveManagerId._id
          : item.poChangeRequest.assignedExecutiveManagerId)
      : null;
    if (!assignedManagerId || assignedManagerId.toString() !== managerId.toString()) {
      return res.status(403).json({ message: 'Only the Executive Manager assigned to this Executive can approve or reject this request' });
    }
    const { approved, managerRemarks } = req.body || {};
    const remarksTrimmed = managerRemarks != null ? String(managerRemarks).trim() : '';
    if (!remarksTrimmed) {
      return res.status(400).json({ message: 'Remarks are mandatory for both approval and rejection' });
    }
    item.poChangeRequest.managerRemarks = remarksTrimmed;
    item.poChangeRequest.approvedBy = req.user._id;
    item.poChangeRequest.approvedAt = new Date();
    if (approved === true) {
      item.pod_proof_url = item.poChangeRequest.newPdfUrl;
      item.poChangeRequest.status = 'APPROVED';
      item.poChangeRequest.rejectionReason = undefined;
    } else {
      item.poChangeRequest.status = 'REJECTED';
      item.poChangeRequest.rejectionReason = remarksTrimmed;
    }
    await item.save();
    const populated = await DcOrder.findById(item._id)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('poChangeRequest.requestedBy', 'name email')
      .populate('poChangeRequest.approvedBy', 'name email');
    res.json(populated);
  } catch (e) {
    console.error('approvePoChange error:', e);
    res.status(500).json({ message: e.message || 'Failed to process PO change' });
  }
};

// @desc    Executive Manager: list DcOrders with pending PO change requests assigned to this manager only
// @route   GET /api/dc-orders/po-change-requests/list
// @access  Private (Executive Manager - sees only requests from Executives assigned to them)
const listPoChangeRequests = async (req, res) => {
  try {
    const userRole = req.user?.role || '';
    if (String(userRole) !== 'Executive Manager') {
      return res.status(403).json({ message: 'Only Executive Manager can view PO change requests' });
    }
    const managerId = req.user._id;
    const items = await DcOrder.find({
      'poChangeRequest.status': 'PENDING_MANAGER_APPROVAL',
      'poChangeRequest.assignedExecutiveManagerId': managerId,
    })
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('poChangeRequest.requestedBy', 'name email')
      .populate('poChangeRequest.assignedExecutiveManagerId', 'name email')
      .sort({ 'poChangeRequest.requestedAt': -1 })
      .lean();
    res.json(items);
  } catch (e) {
    console.error('listPoChangeRequests error:', e);
    res.status(500).json({ message: e.message });
  }
};

// @desc    Compact search for renewal lead school picker (name, school_code, dc_code)
// @route   GET /api/dc-orders/renewal-search
// @access  Private
const renewalSearch = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection is not available.',
        error: 'DATABASE_CONNECTION_ERROR',
      });
    }
    const raw = (req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    if (raw.length < 2) {
      return res.json({ data: [] });
    }
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc, 'i');
    const filter = {
      $or: [{ school_name: re }, { school_code: re }, { dc_code: re }],
    };
    const items = await DcOrder.find(filter)
      .select(
        'school_name school_code dc_code contact_person contact_mobile zone location city state region area pincode strength address school_type products status'
      )
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .maxTimeMS(15000);
    return res.json({ data: items });
  } catch (e) {
    console.error('renewalSearch error:', e);
    return res.status(500).json({ message: e.message || 'Search failed' });
  }
};

module.exports = {
  list,
  getOne,
  getHistory,
  create,
  update,
  submit,
  markInTransit,
  complete,
  hold,
  submitEdit,
  approveEdit,
  requestPoChange,
  approvePoChange,
  listPoChangeRequests,
  renewalSearch,
};


