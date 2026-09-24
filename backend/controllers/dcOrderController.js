const DcOrder = require('../models/DcOrder');
const DC = require('../models/DC');
const Lead = require('../models/Lead');
const { generateSchoolCode } = require('../utils/schoolCodeGenerator');
const {
  ensureSchoolCode,
  isClientConversionUpdate,
} = require('../utils/clientSchoolCode');
const { normalizeProductTerm, persistProductTerm, normalizeDcOrderProductTermsInArray } = require('../utils/productTerm');
const {
  productLineIdentity,
  orderProductToDcDetail,
  dcDetailToOrderProduct,
  siblingTermWiseRows,
  filterOutExactTermWiseLines,
  mergeMyClientsProductsPreservingTermWise,
  mergeTermWiseProductsPreservingMyClients,
  sumProductQuantities,
  sumProductAmounts,
  rowUnitPrice,
  rowQuantity,
} = require('../utils/productLineIdentity');
const { derivePriorityFromFollowUpProducts } = require('../utils/leadFollowUpPriority');
const { dealProductsToFollowUpSnapshot } = require('../utils/dealProductsToFollowUpSnapshot');
const { attachResolvedUpdatedByToHistory } = require('../utils/resolveHistoryUpdatedBy');
const { isTransportCompleteForUpdate } = require('../utils/dcTransport');
const { validateSaleIdentityFields, validateSaleProducts } = require('../utils/saleFieldValidation');
const { parseFollowUpDateOnly } = require('../utils/followUpDate');
const { closeOpenLeadsForConvertedOrder } = require('../utils/closeOpenLeadsForClient');
const mongoose = require('mongoose');

const SCHOOL_LEAD_STATUSES = new Set(['Hot', 'Warm', 'Cold']);

function plainProduct(p) {
  if (!p) return null;
  const row = typeof p.toObject === 'function' ? p.toObject() : { ...p };
  const name = String(row.product_name || row.product || row.productName || '').trim();
  if (!name) return null;
  const qty = Number(row.quantity) || Number(row.strength) || 0;
  const price = Number(row.unit_price) || Number(row.price) || 0;
  return {
    ...row,
    product_name: name,
    quantity: qty,
    strength: Number(row.strength) || qty,
    unit_price: price,
    total: Number(row.total) || qty * price,
    class: row.class || '1',
    specs: row.specs || 'Regular',
    subject: row.subject,
    level: row.level || '',
    term: persistProductTerm(row),
    productCategory: row.productCategory,
    category: row.category,
    selected_subjects: row.selected_subjects,
    closeLeadDestination: row.closeLeadDestination || 'MY_CLIENT',
    lineId: row.lineId,
  };
}

function applySavedUnitPricesToDcDetails(details, orderProducts) {
  const orders = Array.isArray(orderProducts) ? orderProducts : [];
  const source =
    Array.isArray(details) && details.length > 0
      ? details
      : orders.map((p) => orderProductToDcDetail(p));
  const used = new Set();
  return source.map((row, idx) => {
    const plain = row && typeof row.toObject === 'function' ? row.toObject() : { ...row };
    const key = productLineIdentity(plain);
    let matchIdx = orders.findIndex(
      (o, i) => !used.has(i) && productLineIdentity(o) === key
    );
    if (matchIdx < 0) {
      const name = String(plain.product || plain.productName || plain.product_name || '')
        .trim()
        .toLowerCase();
      const klass = String(plain.class ?? '').trim().toLowerCase();
      matchIdx = orders.findIndex((o, i) => {
        if (used.has(i)) return false;
        const on = String(o.product_name || o.product || o.productName || '')
          .trim()
          .toLowerCase();
        const oc = String(o.class ?? '').trim().toLowerCase();
        if (on !== name || !name) return false;
        if (klass && oc && klass !== oc) return false;
        return rowUnitPrice(o) > 0;
      });
    }
    if (matchIdx < 0) {
      const name = String(plain.product || plain.productName || plain.product_name || '')
        .trim()
        .toLowerCase();
      matchIdx = orders.findIndex((o, i) => {
        if (used.has(i)) return false;
        return String(o.product_name || o.product || '').trim().toLowerCase() === name;
      });
    }
    if (matchIdx < 0 && orders[idx] && !used.has(idx)) matchIdx = idx;
    if (matchIdx >= 0) used.add(matchIdx);
    const match = matchIdx >= 0 ? orders[matchIdx] : null;
    const price = rowUnitPrice(match) || rowUnitPrice(plain);
    const qty = rowQuantity(plain);
    return {
      ...plain,
      price,
      unit_price: price,
      total: qty * price,
    };
  });
}

async function syncSubmittedUnitPricesToAllDcs(orderId, submittedProducts) {
  const submitted = (Array.isArray(submittedProducts) ? submittedProducts : [])
    .map(plainProduct)
    .filter(Boolean);
  if (!orderId || submitted.length === 0) return;

  const relatedDcs = await DC.find({
    dcOrderId: orderId,
    status: { $ne: 'scheduled_for_later' },
  });
  for (const dc of relatedDcs) {
    dc.productDetails = applySavedUnitPricesToDcDetails(dc.productDetails, submitted);
    await dc.save({ validateBeforeSave: false });
  }

  const order = await DcOrder.findById(orderId);
  if (order && Array.isArray(order.products) && order.products.length > 0) {
    const patchedDetails = applySavedUnitPricesToDcDetails(
      order.products.map((p) => orderProductToDcDetail(p)),
      submitted
    );
    order.products = patchedDetails.map((d) => dcDetailToOrderProduct(d, order.products));
    await order.save({ validateBeforeSave: false });
  }
}

function isRicherProductList(candidate, current) {
  const a = Array.isArray(candidate) ? candidate : [];
  const b = Array.isArray(current) ? current : [];
  if (a.length > b.length) return true;
  if (a.length < b.length) return false;
  return sumProductQuantities(a) > sumProductQuantities(b);
}

/**
 * Persist a PO product list onto the sale, My Clients DCs, and Closed Sales snapshot.
 * Order is written first; DC sync is best-effort so a DC validator cannot block the sale.
 */
async function commitPoProductList(order, rawProducts, userId, options = {}) {
  const markApproved = options.markApproved !== false;
  const pendingPlain = (Array.isArray(rawProducts) ? rawProducts : [])
    .map(plainProduct)
    .filter(Boolean);
  if (pendingPlain.length === 0) return null;

  const approvedProducts = normalizeDcOrderProductTermsInArray(pendingPlain);
  const twRows = await siblingTermWiseRows(DC, order._id, null);
  const myClientsApproved = filterOutExactTermWiseLines(approvedProducts, twRows);
  const myClientsDetails = myClientsApproved.map((p) => orderProductToDcDetail(p));
  const approvedQty = sumProductQuantities(myClientsApproved);
  const approvedAmount = sumProductAmounts(approvedProducts);
  const pendingKeys = new Set(myClientsApproved.map((p) => productLineIdentity(p)));
  const siblingOrderProducts = (twRows || [])
    .filter((p) => !pendingKeys.has(productLineIdentity(p)))
    .map((p) => dcDetailToOrderProduct(p, order.products));
  const mergedOrderProducts = [...myClientsApproved, ...siblingOrderProducts];

  const prevRequest =
    order.dcRequestData && typeof order.dcRequestData.toObject === 'function'
      ? order.dcRequestData.toObject()
      : order.dcRequestData || {};

  const $set = {
    products: mergedOrderProducts,
    total_amount: approvedAmount > 0 ? approvedAmount : order.total_amount,
    dcRequestData: {
      ...prevRequest,
      productDetails: myClientsDetails,
      requestedQuantity: approvedQty,
    },
  };
  if (markApproved) {
    $set['pendingEdit.status'] = 'approved';
    $set['pendingEdit.products'] = approvedProducts;
    if (userId) {
      $set['pendingEdit.approvedBy'] = userId;
      $set['pendingEdit.approvedAt'] = new Date();
    }
  }

  const updated = await DcOrder.findByIdAndUpdate(
    order._id,
    { $set },
    { new: true, runValidators: false }
  );

  try {
    const dcSet = { productDetails: myClientsDetails };
    if (approvedQty > 0) dcSet.requestedQuantity = approvedQty;
    if (myClientsDetails[0] && myClientsDetails[0].product) {
      dcSet.product = myClientsDetails[0].product;
    }
    await DC.updateMany(
      {
        dcOrderId: order._id,
        status: { $in: ['created', 'po_submitted'] },
      },
      { $set: dcSet }
    );
  } catch (dcErr) {
    console.warn('commitPoProductList DC sync failed:', order._id, dcErr?.message || dcErr);
  }

  console.log('📦 Committed PO products to sale', {
    id: String(order._id),
    school: order.school_name,
    productCount: mergedOrderProducts.length,
    names: mergedOrderProducts.map((p) => p.product_name),
    qty: approvedQty,
    amount: approvedAmount,
    markApproved,
  });
  return updated;
}

function resolveSchoolLeadStatus(...candidates) {
  for (const value of candidates) {
    const s = String(value || '').trim();
    if (SCHOOL_LEAD_STATUSES.has(s)) return s;
  }
  return '';
}

/** Build DC fields from a DcOrder so Create Sale always links one DC per deal. */
function buildCreatedDcPayloadFromOrder(order, createdByUserId) {
  let productName = 'Abacus';
  if (order.products && Array.isArray(order.products) && order.products.length > 0) {
    productName = order.products[0].product_name || order.products[0].product || 'Abacus';
  } else if (typeof order.products === 'string') {
    const products = order.products.split(',').map((p) => p.trim()).filter(Boolean);
    productName = products.length > 0 ? products[0] : 'Abacus';
  }

  let quantity = 1;
  if (order.products && Array.isArray(order.products) && order.products.length > 0) {
    quantity = order.products.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0) || 1;
  }

  return {
    dcOrderId: order._id,
    employeeId: order.assigned_to,
    customerName: order.school_name,
    customerEmail: order.email || undefined,
    customerAddress: order.address || order.location || 'N/A',
    customerPhone: order.contact_mobile || 'N/A',
    product: productName,
    requestedQuantity: quantity,
    deliverableQuantity: 0,
    status: 'created',
    createdBy: createdByUserId,
  };
}

/**
 * Ensure a DC exists for this deal (status=created preferred).
 * Never creates a second DC when any DC is already linked to the order.
 */
async function ensureCreatedDcForOrder(order, createdByUserId, session = null) {
  const existingQuery = DC.findOne({ dcOrderId: order._id });
  if (session) existingQuery.session(session);
  const existingAny = await existingQuery;
  if (existingAny) {
    return { dc: existingAny, created: false };
  }

  if (!order.assigned_to) {
    throw new Error('Please assign the deal to an executive. DC will not be created without assignment.');
  }
  if (!mongoose.Types.ObjectId.isValid(String(order.assigned_to))) {
    throw new Error('Invalid assigned executive id.');
  }

  const User = require('../models/User');
  const execQuery = User.findById(order.assigned_to).select('_id name role isActive');
  if (session) execQuery.session(session);
  const assignedExecutive = await execQuery;
  if (!assignedExecutive) {
    throw new Error('Assigned executive not found.');
  }

  const payload = buildCreatedDcPayloadFromOrder(order, createdByUserId);
  const createOpts = session ? { session } : undefined;
  const createdList = await DC.create([payload], createOpts);
  const dc = createdList[0];
  console.log(
    `DC created successfully for DcOrder ${order._id}, assigned to employee ${order.assigned_to}`
  );
  return { dc, created: true };
}

async function populateDealAndDcResponse(orderId, dcId) {
  const populated = await DcOrder.findById(orderId)
    .populate('created_by', 'name email')
    .populate('assigned_to', 'name email')
    .lean();
  const populatedDc = await DC.findById(dcId)
    .populate('employeeId', 'name email')
    .populate('createdBy', 'name email')
    .populate('dcOrderId', 'school_name contact_mobile school_code status assigned_to')
    .lean();
  return {
    ...populated,
    dc: populatedDc,
    dcCreated: true,
  };
}

/** Lead status badge for a history row — school lead_status (Hot/Warm/Cold) wins over product-derived Hot. */
function resolveHistoryPriorityForResponse(entry = {}, doc = {}) {
  const docLeadStatus = resolveSchoolLeadStatus(doc.lead_status);
  if (docLeadStatus) return docLeadStatus;

  const rows = Array.isArray(entry.productsInterested) ? entry.productsInterested : [];
  const stored = (entry.priority || '').trim();

  if (SCHOOL_LEAD_STATUSES.has(stored)) return stored;

  const fromProducts = derivePriorityFromFollowUpProducts(rows);
  if (fromProducts && rows.length > 0) return fromProducts;

  if (stored) return stored;

  if (
    stored === 'Cold' &&
    rows.length === 0 &&
    doc.priority &&
    !SCHOOL_LEAD_STATUSES.has(doc.priority)
  ) {
    return doc.priority;
  }
  return resolveSchoolLeadStatus(doc.priority) || 'Warm';
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

    const { status, q, zone, assigned_to, lead_status, from, to, workflowStage, pipeline } = req.query;
    const filter = {};
    const isFollowUpPipeline = String(pipeline || '').toLowerCase() === 'followup';
    if (isFollowUpPipeline) {
      // Follow-up Leads: only open deals. Converted clients use saved/completed/DC pipeline statuses.
      filter.status = 'pending';
    } else if (status) {
      filter.status = status;
    }
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

    const {
      WORKFLOW_STAGE,
      POST_CLOSED_SALES_STAGES,
      CLOSED_SALES_QUEUE_STATUSES,
    } = require('../constants/dcWorkflow');
    // DC is already imported at top of this file

    // Closed Sales = sales the Executive requested (dc_requested / dc_accepted).
    const closedSalesStatuses = CLOSED_SALES_QUEUE_STATUSES;
    const isClosedSalesQuery =
      workflowStage === WORKFLOW_STAGE.ClosedSales ||
      (status && closedSalesStatuses.includes(String(status)));

    if (isFollowUpPipeline) {
      filter.workflowStage = { $nin: POST_CLOSED_SALES_STAGES };
    } else if (workflowStage && !isClosedSalesQuery) {
      filter.workflowStage = workflowStage;
    }

    if (isClosedSalesQuery) {
      filter.status = status || { $in: closedSalesStatuses };
    }
    // Pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || (isFollowUpPipeline ? 500 : 50);
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
      .select('school_name school_code contact_person contact_mobile zone status workflowStage follow_up_date location address branches strength createdAt updatedAt remarks school_type priority lead_status assigned_to created_by pendingEdit products dcRequestData total_amount requestedAt requestedBy') // products: used for follow-up list lead status from line items
      .populate('assigned_to', 'name email') // Only populate assigned_to for list view
      .populate('pendingEdit.requestedBy', 'name email') // Populate pendingEdit.requestedBy for Executive Manager
      .sort(String(status) === 'dc_approved' || String(status) === 'saved' ? { updatedAt: -1, createdAt: -1 } : { createdAt: -1 })
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
      .populate('assigned_to', 'name email cluster')
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
      .populate('updateHistory.updatedBy', 'name email firstName lastName')
      .populate('created_by', 'name email firstName lastName')
      .populate('assigned_to', 'name email firstName lastName')
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
        updatedBy: null,
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

    // Resolve display priority and executive name for each row
    history = await attachResolvedUpdatedByToHistory(
      history.map((entry) => ({
        ...entry,
        priority: resolveHistoryPriorityForResponse(entry, item),
      })),
      item,
    );
    
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

    const identity = validateSaleIdentityFields(payload);
    if (!identity.ok) {
      return res.status(400).json({ message: identity.message });
    }
    Object.assign(payload, identity.fields);
    if (identity.fields.school_code === undefined) {
      delete payload.school_code;
    }
    if (identity.fields.contact_person2 === undefined) {
      delete payload.contact_person2;
    }
    if (identity.fields.contact_mobile2 === undefined) {
      delete payload.contact_mobile2;
    }

    const productsCheck = validateSaleProducts(payload.products);
    // Create Sale may omit products when the Products UI block is not shown.
    if (!productsCheck.ok && Array.isArray(payload.products) && payload.products.length > 0) {
      return res.status(400).json({ message: productsCheck.message });
    }
    if (!Array.isArray(payload.products)) {
      payload.products = [];
    }

    const followUpRaw =
      payload.follow_up_date ||
      payload.followUpDate;
    if (followUpRaw === undefined || followUpRaw === null || String(followUpRaw).trim() === '') {
      return res.status(400).json({ message: 'Follow-up Date is required.' });
    }
    const followUpDate = parseFollowUpDateOnly(followUpRaw);
    if (!followUpDate) {
      return res.status(400).json({ message: 'Follow-up Date is required.' });
    }
    // Follow-up and delivery are separate. Never copy follow-up into estimated_delivery_date.
    payload.follow_up_date = followUpDate;
    if (
      payload.estimated_delivery_date !== undefined &&
      payload.estimated_delivery_date !== null &&
      String(payload.estimated_delivery_date).trim() !== ''
    ) {
      const deliveryOnly = parseFollowUpDateOnly(payload.estimated_delivery_date);
      payload.estimated_delivery_date = deliveryOnly || undefined;
    } else {
      delete payload.estimated_delivery_date;
    }

    // Normalize / validate email when provided
    if (payload.email !== undefined && payload.email !== null && String(payload.email).trim() !== '') {
      const email = String(payload.email).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }
      payload.email = email;
    }

    // School code: use provided value when present; never overwrite with a generated one
    if (payload.school_code !== undefined && payload.school_code !== null) {
      payload.school_code = String(payload.school_code).trim();
    }
    if (payload.school_code) {
      const codeRegex = new RegExp(
        `^${payload.school_code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );
      const [existingOrder, existingLead] = await Promise.all([
        DcOrder.findOne({ school_code: codeRegex }),
        Lead.findOne({ school_code: codeRegex }).select('_id school_code').lean(),
      ]);

      // Heal orphan deals from prior Super Admin Create Sale (deal saved, DC skipped).
      // Do NOT create a duplicate deal; attach the missing DC and return success.
      if (existingOrder) {
        const linkedDc = await DC.findOne({ dcOrderId: existingOrder._id });
        if (linkedDc) {
          return res.status(400).json({
            message: 'School Code already exists. Please enter a unique School Code.',
          });
        }
        try {
          const { dc } = await ensureCreatedDcForOrder(existingOrder, req.user._id);
          const body = await populateDealAndDcResponse(existingOrder._id, dc._id);
          return res.status(201).json({
            ...body,
            healedOrphanDeal: true,
            message: 'Existing deal was missing a DC entry; DC has been created and linked.',
          });
        } catch (healErr) {
          console.error('Failed to heal orphan DcOrder missing DC:', healErr);
          return res.status(500).json({
            message:
              healErr.message ||
              'School code exists on a deal that has no DC, and DC creation failed. Contact support.',
          });
        }
      }

      if (existingLead) {
        return res.status(400).json({
          message: 'School Code already exists. Please enter a unique School Code.',
        });
      }
    } else {
      // Auto-generate school code only when not provided
      try {
        const schoolCode = await generateSchoolCode({
          state: payload.state || '',
          district: payload.city || '',
          region: payload.region || '',
          city: payload.city || '',
        });
        if (schoolCode) {
          payload.school_code = schoolCode;
        }
      } catch (codeError) {
        console.warn('School code generation failed:', codeError.message);
      }
    }
    
    // Create Sale UI sends deal pipeline status as `status` (pending|saved|completed).
    // If a caller mistakenly puts that value in `lead_status`, remap it — lead_status is Hot/Warm/Cold only.
    const dealStatusValues = new Set([
      'saved',
      'pending',
      'in_transit',
      'completed',
      'hold',
      'dc_requested',
      'dc_accepted',
      'dc_approved',
      'dc_sent_to_senior',
    ]);
    if (payload.lead_status && dealStatusValues.has(String(payload.lead_status).trim())) {
      if (!payload.status) payload.status = String(payload.lead_status).trim();
      delete payload.lead_status;
    }

    const schoolLeadStatus = resolveSchoolLeadStatus(payload.lead_status, payload.priority);
    if (schoolLeadStatus) {
      payload.lead_status = schoolLeadStatus;
      payload.priority = schoolLeadStatus;
    } else {
      // Do not persist invalid lead_status/priority from the deal-status dropdown
      delete payload.lead_status;
      if (payload.priority && !resolveSchoolLeadStatus(payload.priority)) {
        delete payload.priority;
      }
    }

    const creationProductSnapshot = dealProductsToFollowUpSnapshot(payload.products || []);
    const creationLeadStatus = schoolLeadStatus || resolveSchoolLeadStatus(payload.priority) || 'Warm';
    // Keep cluster and cluster_code aligned (Module 2 zone/cluster)
    if (payload.cluster && !payload.cluster_code) {
      payload.cluster_code = String(payload.cluster).trim();
    } else if (payload.cluster_code && !payload.cluster) {
      payload.cluster = String(payload.cluster_code).trim();
    }
    // Initialize history with creation entry (includes per-product lead status from create form)
    if (
      payload.follow_up_date ||
      payload.remarks ||
      schoolLeadStatus ||
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

    // Super Admin Create Sale assigned to an Executive: keep deal in follow-up pipeline
    // (pending), create DC for the Clients Create Sale list, and do NOT mark as Closed Sales.
    const isSuperAdminCreator =
      req.user?.role === 'Super Admin' || Boolean(req.user?.isSuperAdmin);
    const assignedToRaw = payload.assigned_to ? String(payload.assigned_to) : '';
    const assignedToOtherExecutive =
      Boolean(assignedToRaw) && assignedToRaw !== String(req.user._id);
    if (isSuperAdminCreator && assignedToOtherExecutive) {
      payload.status = 'pending';
      delete payload.workflowStage;
    }

    // Always create Deal + linked DC together (including Super Admin → Executive assign).
    // Never leave Deal-without-DC: if DC creation fails, roll back the newly created deal.
    let item;
    try {
      item = await DcOrder.create(payload);
      const { dc: createdDc } = await ensureCreatedDcForOrder(item, req.user._id);
      const body = await populateDealAndDcResponse(item._id, createdDc._id);
      return res.status(201).json(body);
    } catch (createErr) {
      console.error('Error creating Deal/DC:', createErr);
      if (item?._id) {
        try {
          await DC.deleteMany({ dcOrderId: item._id });
          await DcOrder.findByIdAndDelete(item._id);
        } catch (rollbackErr) {
          console.error('Failed to roll back orphan DcOrder after DC failure:', rollbackErr);
        }
      }
      const status = /assign|executive|invalid/i.test(String(createErr?.message || '')) ? 400 : 500;
      return res.status(status).json({
        message:
          createErr.message ||
          'Deal was not fully created: DC entry could not be created. Please try again.',
      });
    }
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

    // Closed Sales page sends validateClosedSalesContact2 — require Contact Person 2 / Mobile 2.
    // Scoped by this flag only (not model-level); Create Sale / other updates omit the flag.
    if (req.body.validateClosedSalesContact2 === true) {
      const { validateContactPerson, validateContactMobile } = require('../utils/saleFieldValidation');
      const person2Raw =
        req.body.contact_person2 !== undefined ? req.body.contact_person2 : item.contact_person2;
      const mobile2Raw =
        req.body.contact_mobile2 !== undefined ? req.body.contact_mobile2 : item.contact_mobile2;
      const person2Check = validateContactPerson(person2Raw, {
        required: true,
        label: 'Contact Person 2',
      });
      if (!person2Check.ok) {
        return res.status(400).json({ message: person2Check.message });
      }
      const mobile2Check = validateContactMobile(mobile2Raw, { required: true });
      if (!mobile2Check.ok) {
        return res.status(400).json({ message: mobile2Check.message });
      }
      req.body.contact_person2 = person2Check.value;
      req.body.contact_mobile2 = mobile2Check.value;
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
          quantity: Number(row.strength) || Number(row.quantity) || 1,
          unit_price: Number(row.unit_price) || 0,
          not_interested_reason:
            row.status === 'Not Interested'
              ? String(row.not_interested_reason || '').trim()
              : '',
        }));
    const normalizedProductsInterested = hasProductsInterested
      ? normalizeProductsInterested(req.body.productsInterested)
      : [];
    const isFollowUpSubmission = hasFollowUpDate && hasRemarks;
    const validateFollowUpProducts = (rows) => {
      if (rows.length === 0) {
        return 'At least one product is required';
      }
      for (const row of rows) {
        if (row.status === 'Not Interested') {
          if (!String(row.not_interested_reason || '').trim()) {
            return 'Not Interested products require a reason';
          }
          continue;
        }
        if (!(Number(row.unit_price) > 0)) {
          return 'Each product must have Unit Price greater than 0';
        }
        if (row.status === 'Hot' || row.status === 'Warm') {
          if (row.strength <= 0 || row.chance <= 0) {
            return 'Hot/Warm products must have Strength greater than 0 and Chance % greater than 0';
          }
        }
        if (row.status === 'Hot' && row.chance < 80) {
          return 'Hot products require Chance % at least 80';
        }
        if (row.status === 'Warm' && row.chance < 20) {
          return 'Warm products require Chance % at least 20';
        }
      }
      return null;
    };

    if (hasProductsInterested) {
      const productErr = validateFollowUpProducts(normalizedProductsInterested);
      if (productErr) {
        return res.status(400).json({ message: productErr });
      }
    }

    const hasProductsArray = Array.isArray(req.body.products);
    const isEditDetailsProductsUpdate =
      hasProductsArray &&
      !hasProductsInterested &&
      !isFollowUpSubmission &&
      req.body.status !== 'dc_requested';
    if (isEditDetailsProductsUpdate) {
      const DC_PRODUCT_STATUSES = [
        'Hot',
        'Warm',
        'Not Interested',
        'Management Not Met',
        'Visit Again',
        'Not Met Management',
      ];
      const rows = req.body.products.filter((row) => row && (row.product_name || row.product));
      if (rows.length === 0) {
        return res.status(400).json({ message: 'At least one product is required' });
      }
      for (const row of rows) {
        const hasLeadStatus =
          row.status !== undefined && row.status !== null && String(row.status).trim() !== '';
        const hasLeadChance =
          row.chance !== undefined && row.chance !== null && String(row.chance).trim() !== '';

        // Edit PO / close-lead commercial lines — no Hot/Warm chance % rules
        if (!hasLeadStatus && !hasLeadChance) {
          const qty = Number(row.quantity) || Number(row.strength) || 0;
          const unitPrice = Number(row.unit_price) || 0;
          if (qty <= 0) {
            return res.status(400).json({ message: 'Each product must have quantity greater than 0' });
          }
          if (unitPrice <= 0) {
            return res.status(400).json({ message: 'Each product must have unit price greater than 0' });
          }
          continue;
        }

        let status = String(row.status || 'Warm').trim();
        if (status === 'Not Met Management') status = 'Management Not Met';
        if (!DC_PRODUCT_STATUSES.includes(status)) {
          return res.status(400).json({ message: `Invalid product status: ${row.status}` });
        }
        if (status === 'Not Interested') {
          if (!String(row.not_interested_reason || '').trim()) {
            return res.status(400).json({
              message: 'Not Interested products require a reason',
            });
          }
          continue;
        }
        const unitPrice = Number(row.unit_price) || 0;
        if (unitPrice <= 0) {
          return res.status(400).json({
            message: 'Each product must have unit price greater than 0',
          });
        }
        const strength = Number(row.strength) || Number(row.quantity) || 0;
        const chance = Math.max(0, Math.min(100, Number(row.chance) || 0));
        if ((status === 'Hot' || status === 'Warm') && strength <= 0) {
          return res.status(400).json({
            message: 'Each Hot/Warm product must have strength greater than 0',
          });
        }
        if (status === 'Hot' && chance < 80) {
          return res.status(400).json({
            message: 'Hot products require chance % at least 80',
          });
        }
        if (status === 'Warm' && chance < 20) {
          return res.status(400).json({
            message: 'Warm products require chance % at least 20',
          });
        }
      }
    }

    const shouldTrackHistory = hasFollowUpDate || hasRemarks || hasPriority || hasProductsInterested;
    
    // Prepare update object using $set for field updates
    const updateData = {};
    
    // Update fields using $set
    if (hasFollowUpDate) {
      updateData.follow_up_date = req.body.follow_up_date
        ? parseFollowUpDateOnly(req.body.follow_up_date)
        : null;
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
    if (!item.school_code && isClientConversionUpdate(req.body, item)) {
      const generated = await ensureSchoolCode(item, req.body);
      if (generated) {
        updateData.school_code = generated;
      }
    }

    const fieldsToUpdate = [
      'status', 'zone', 'location', 'contact_person', 'contact_mobile', 'school_name', 'school_code',
      'contact_designation', 'contact_person2', 'contact_mobile2', 'financial_contact_designation',
      'email', 'address', 'school_type',
      'pincode', 'state', 'city', 'region', 'area', 'mandal', 'cluster', 'cluster_code',
      'latitude', 'longitude',
      'average_fee', 'branches', 'strength', 'remarks', 'follow_up_date',
      'estimated_delivery_date', 'products', 'dcRequestData', 'total_amount',
      // Delivery address fields (old)
      'property_number', 'floor', 'tower_block', 'nearby_landmark', 'pod_proof_url',
      // Transport fields (new)
      'transport_name', 'transport_location', 'transportation_landmark'
    ];
    // Edit PO saves product rows. Request DC sends status + dcRequestData only.
    // Never treat an Edit PO payload as Request DC (Closed Sales).
    if (Array.isArray(req.body.products) && req.body.products.length > 0 && req.body.status === 'dc_requested') {
      delete req.body.status;
    }
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

    // Edit PO must not overwrite the other DC's product allocations on this shared deal.
    // Request DC only sends status + dcRequestData — never rewrite products on that path.
    if (Array.isArray(updateData.products) && req.body.status !== 'dc_requested') {
      try {
        const originId = req.body.originatingDcId || req.body.dcId;
        const twRows = await siblingTermWiseRows(DC, item._id, originId);
        let originIsTermWise = false;
        if (originId) {
          const originDc = await DC.findById(originId).select('status').lean();
          originIsTermWise = originDc?.status === 'scheduled_for_later';
        }
        if (originIsTermWise) {
          updateData.products = mergeTermWiseProductsPreservingMyClients(
            updateData.products,
            item.products,
            twRows
          );
        } else if (twRows.length > 0) {
          updateData.products = mergeMyClientsProductsPreservingTermWise(
            updateData.products,
            item.products,
            twRows
          );
        }
      } catch (mergeErr) {
        console.warn(
          'Term-Wise product merge skipped (will keep incoming products):',
          mergeErr?.message || mergeErr
        );
      }
      updateData.products = updateData.products.map((p) => plainProduct(p)).filter(Boolean);
    } else if (req.body.status === 'dc_requested') {
      delete updateData.products;
      const requestDetails = req.body.dcRequestData?.productDetails;
      if (Array.isArray(requestDetails) && requestDetails.length > 0) {
        updateData.products = requestDetails
          .map((row) => dcDetailToOrderProduct(row, item.products))
          .filter((p) => p && p.product_name);
      }
    }

    if (updateData.dcRequestData && typeof updateData.dcRequestData === 'object') {
      const emp = updateData.dcRequestData.employeeId;
      if (emp && typeof emp === 'object') {
        updateData.dcRequestData.employeeId = emp._id || emp.id || undefined;
      }
    }

    // When Executive requests DC (status → dc_requested), store requestedBy and requestedAt
    if (req.body.status === 'dc_requested') {
      updateData.requestedBy = req.user._id;
      updateData.requestedAt = new Date();
      updateData.workflowStage = 'ClosedSales';
    }
    if (req.body.status === 'dc_accepted') {
      updateData.workflowStage = 'ClosedSales';
    }
    if (req.body.status === 'dc_approved') {
      // Closed Sales Accept → Saved DC (not My Clients `saved`)
      updateData.workflowStage = 'ClosedSales';
    }
    if (req.body.status === 'dc_sent_to_senior') {
      // Leaving Closed Sales — stage is owned by Raise DC / DC pipeline if not already set
      if (!updateData.workflowStage && !req.body.workflowStage) {
        updateData.workflowStage = 'PendingDC';
      }
    }
    if (req.body.workflowStage !== undefined) {
      updateData.workflowStage = req.body.workflowStage;
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
        ? parseFollowUpDateOnly(req.body.follow_up_date)
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

    const convertedStatus = String(updatedItem.status || '').toLowerCase();
    if (convertedStatus === 'saved' || convertedStatus === 'completed') {
      try {
        await closeOpenLeadsForConvertedOrder(updatedItem);
      } catch (closeLeadErr) {
        console.warn('Could not close matching open leads after conversion:', closeLeadErr?.message);
      }
    }

    if (Array.isArray(updatedItem.products) && req.body.status !== 'dc_requested') {
      try {
        await syncSubmittedUnitPricesToAllDcs(updatedItem._id, updatedItem.products);
      } catch (syncErr) {
        console.warn('DcOrder update DC unit_price sync failed:', syncErr?.message || syncErr);
      }
    }
    
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

    // Replacing an existing pending request is allowed so a second Save
    // (qty change / extra row) is not discarded.

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
      originatingDcId: req.body.originatingDcId || req.body.dcId || undefined,
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

    // Persist unit_price onto every related DC (including Completed DC) immediately.
    // New-product / PDF changes still wait for EM approval; commercial prices must not stay 0.
    try {
      await syncSubmittedUnitPricesToAllDcs(item._id, req.body.products);
    } catch (prodSyncErr) {
      console.warn('submitEdit DC unit_price sync failed:', prodSyncErr?.message || prodSyncErr);
    }

    // Persist the submitted product list onto this My Clients DC so Edit PO
    // reopen shows the quantities just saved (even while EM approval is pending).
    try {
      const originId = req.body.originatingDcId || req.body.dcId;
      const submitted = Array.isArray(req.body.products) ? req.body.products : [];
      if (submitted.length > 0) {
        const twRows = await siblingTermWiseRows(DC, item._id, originId || null);
        const myClients = filterOutExactTermWiseLines(
          normalizeDcOrderProductTermsInArray(submitted),
          twRows
        );
        const details = myClients.map((p) => orderProductToDcDetail(p));
        const qty = sumProductQuantities(myClients);
        const dcSet = { productDetails: details };
        if (qty > 0) dcSet.requestedQuantity = qty;
        const originValid =
          originId && mongoose.Types.ObjectId.isValid(String(originId));
        await DC.updateMany(
          originValid
            ? {
                _id: originId,
                dcOrderId: item._id,
                status: { $in: ['created', 'po_submitted'] },
              }
            : {
                dcOrderId: item._id,
                status: { $in: ['created', 'po_submitted'] },
              },
          { $set: dcSet }
        );
      }
    } catch (prodSyncErr) {
      console.warn('submitEdit DC product sync failed:', prodSyncErr?.message || prodSyncErr);
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
      const pendingProducts = Array.isArray(item.pendingEdit.products)
        ? item.pendingEdit.products
        : [];

      // Persist PO products onto the sale first. DC sync is best-effort inside commitPoProductList
      // so a DC validator cannot leave Closed Sales on the old product list.
      if (pendingProducts.length > 0) {
        await commitPoProductList(item, pendingProducts, req.user._id, { markApproved: true });
        await syncSubmittedUnitPricesToAllDcs(item._id, pendingProducts);
      }

      // Apply the pending edit to the main document (school/contact/transport).
      // Delivery address fields are NOT included here - they were already saved when edit was submitted.
      // Products / dcRequestData were already written by commitPoProductList.
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
        pod_proof_url: item.pendingEdit.pod_proof_url !== undefined ? item.pendingEdit.pod_proof_url : item.pod_proof_url,
        remarks: item.pendingEdit.remarks !== undefined ? item.pendingEdit.remarks : item.remarks,
        transport_name: item.pendingEdit.transport_name !== undefined ? item.pendingEdit.transport_name : item.transport_name,
        transport_location: item.pendingEdit.transport_location !== undefined ? item.pendingEdit.transport_location : item.transport_location,
        transportation_landmark: item.pendingEdit.transportation_landmark !== undefined ? item.pendingEdit.transportation_landmark : item.transportation_landmark,
        'pendingEdit.status': 'approved',
        'pendingEdit.approvedBy': req.user._id,
        'pendingEdit.approvedAt': new Date(),
      };

      const updatedItem = await DcOrder.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: false }
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
        approvedBy: req.user._id,
        productCount: Array.isArray(updatedItem.products) ? updatedItem.products.length : 0,
        productNames: Array.isArray(updatedItem.products)
          ? updatedItem.products.map((p) => p.product_name || p.product)
          : [],
        totalAmount: updatedItem.total_amount,
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


