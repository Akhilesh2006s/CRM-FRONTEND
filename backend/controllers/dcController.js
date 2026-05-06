const DC = require('../models/DC');
const Sale = require('../models/Sale');
const DcOrder = require('../models/DcOrder');
const ProgramBilling = require('../models/ProgramBilling');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockMovement = require('../models/StockMovement');
const { normalizeCalculationType } = require('../utils/paymentDivisor');
const {
  recordLevelDelivery,
  recomputeProgramPayable,
  roundToTwo,
} = require('../services/programBillingService');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/po');
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
    cb(null, 'po-' + uniqueSuffix + ext);
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

const ALLOWED_SHORTAGE_ROLES = new Set(['Admin', 'Super Admin', 'Executive', 'Sales Executive']);

const getRowKey = (row = {}) => {
  const product = String(row.product || row.productName || '').trim().toLowerCase();
  const cls = String(row.class || '').trim().toLowerCase();
  const category = String(row.category || '').trim().toLowerCase();
  const term = String(row.term || 'Term 1').trim().toLowerCase();
  return `${product}::${cls}::${category}::${term}`;
};

const qtyFromRow = (row = {}) => {
  const quantity = Number(row.quantity);
  const strength = Number(row.strength);
  return Number.isFinite(quantity) && quantity > 0
    ? quantity
    : (Number.isFinite(strength) && strength > 0 ? strength : 0);
};

const normalizeProductDetails = (rows = [], { isShortage = false } = {}) =>
  (Array.isArray(rows) ? rows : []).map((p) => {
    const quantity = qtyFromRow(p);
    const deliveredQuantity = Number.isFinite(Number(p.deliveredQuantity)) ? Number(p.deliveredQuantity) : 0;
    const shortageQuantity = Number.isFinite(Number(p.shortageQuantity))
      ? Number(p.shortageQuantity)
      : (isShortage ? quantity : 0);
    const strength = Number.isFinite(Number(p.strength)) && Number(p.strength) > 0 ? Number(p.strength) : quantity;
    const price = Number(p.price) || 0;
    return {
      product: p.product || p.productName || '',
      class: p.class || '1',
      category: isShortage ? 'Shortage' : (p.category || 'new Students'),
      productName: p.productName || p.product || '',
      productCategory: p.productCategory || undefined,
      quantity,
      deliveredQuantity,
      shortageQuantity,
      strength,
      price,
      total: Number(p.total) || (price * strength),
      level: p.level || 'L2',
      specs: p.specs || 'Regular',
      subject: p.subject || undefined,
      term: p.term || 'Term 1',
    };
  });

const calculateTotalQuantity = (rows = []) =>
  (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + qtyFromRow(row), 0);

const hasQuantityFieldsInUpdate = (body = {}) =>
  body.requestedQuantity !== undefined ||
  body.productDetails !== undefined ||
  body.availableQuantity !== undefined ||
  body.deliverableQuantity !== undefined;

const deriveLevelNumber = (dc) => {
  if (Number.isFinite(Number(dc.levelNumber)) && Number(dc.levelNumber) > 0) {
    return Number(dc.levelNumber);
  }
  const terms = (dc.productDetails || []).map((row) => String(row.term || '').trim().toLowerCase());
  if (terms.includes('term 2')) return 2;
  if (terms.includes('term 3')) return 3;
  return 1;
};

const deriveDeliveredStudents = (dc) =>
  (Array.isArray(dc.productDetails) ? dc.productDetails : []).reduce((sum, row) => {
    const delivered = Number(row.deliveredQuantity);
    if (Number.isFinite(delivered) && delivered >= 0) return sum + delivered;
    return sum;
  }, 0);

const deriveUnitPrice = async (dc) => {
  const details = Array.isArray(dc.productDetails) ? dc.productDetails : [];
  const detailPrices = details
    .map((row) => Number(row.price))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (detailPrices.length > 0) {
    return detailPrices[0];
  }
  if (!dc.dcOrderId) return 0;
  const order = await DcOrder.findById(dc.dcOrderId).select('products').lean();
  const firstProduct = Array.isArray(order?.products) && order.products.length > 0 ? order.products[0] : null;
  return Number(firstProduct?.unit_price) || 0;
};

const deriveTotalLevels = async (dc) => {
  if (Number.isFinite(Number(dc.totalLevels)) && Number(dc.totalLevels) > 0) {
    return Number(dc.totalLevels);
  }
  if (!dc.dcOrderId) return 1;
  const siblingDcs = await DC.find({ dcOrderId: dc.dcOrderId }).select('levelNumber productDetails').lean();
  const levelsFromDcs = new Set();
  siblingDcs.forEach((row) => {
    if (Number.isFinite(Number(row.levelNumber)) && Number(row.levelNumber) > 0) {
      levelsFromDcs.add(Number(row.levelNumber));
      return;
    }
    const terms = (row.productDetails || []).map((p) => String(p.term || '').trim().toLowerCase());
    if (terms.includes('term 1')) levelsFromDcs.add(1);
    if (terms.includes('term 2')) levelsFromDcs.add(2);
    if (terms.includes('term 3')) levelsFromDcs.add(3);
  });
  return Math.max(1, levelsFromDcs.size || 1);
};

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findProductCatalogByDcProductName = async (name) => {
  const n = String(name || '').trim();
  if (!n) return null;
  return Product.findOne({ productName: new RegExp(`^${escapeRegex(n)}$`, 'i') }).lean();
};

const deriveSubjectDivisorFromDc = (dc) => {
  const target = String(dc.product || '').toLowerCase().trim();
  const rows = Array.isArray(dc.productDetails) ? dc.productDetails : [];
  const subs = new Set();
  rows.forEach((row) => {
    const pn = String(row.product || row.productName || '').toLowerCase().trim();
    if (pn !== target) return;
    const s = String(row.subject || '').trim().toLowerCase();
    if (s) subs.add(s);
  });
  return Math.max(1, subs.size);
};

const deriveProgramPaymentDivisor = async (dc, productDoc) => {
  const ct = normalizeCalculationType(productDoc?.calculationType);
  if (ct === 'subject_based') {
    const fromRows = deriveSubjectDivisorFromDc(dc);
    const catalogCount = Array.isArray(productDoc?.subjects) ? productDoc.subjects.length : 0;
    return Math.max(1, fromRows > 1 ? fromRows : catalogCount || 1);
  }
  if (ct === 'level_based') {
    return deriveTotalLevels(dc);
  }
  return 1;
};

const deriveDeliverySlotNumber = (dc, productDoc) => {
  const ct = normalizeCalculationType(productDoc?.calculationType);
  if (ct !== 'subject_based') {
    return deriveLevelNumber(dc);
  }
  const target = String(dc.product || '').toLowerCase().trim();
  const rows = Array.isArray(dc.productDetails) ? dc.productDetails : [];
  const row = rows.find(
    (r) => String(r.product || '').toLowerCase().trim() === target && String(r.subject || '').trim()
  );
  const subj = String(row?.subject || '').trim().toLowerCase();
  const list = Array.isArray(productDoc?.subjects) ? productDoc.subjects : [];
  const idx = list.findIndex((s) => String(s).trim().toLowerCase() === subj);
  if (idx >= 0) return idx + 1;
  return deriveLevelNumber(dc);
};

const recomputeBillingForCompletedDC = async (dc) => {
  const featureFlag = String(process.env.ENABLE_PROGRAM_BILLING_ABACUS || 'false').toLowerCase() === 'true';
  if (!featureFlag) {
    return null;
  }
  const isLegacyAbacus = String(dc.product || '').toLowerCase() === 'abacus';
  let productDoc = await findProductCatalogByDcProductName(dc.product);
  if (!productDoc && isLegacyAbacus) {
    productDoc = { calculationType: 'level_based', subjects: [] };
  } else if (
    productDoc &&
    normalizeCalculationType(productDoc.calculationType) === 'normal' &&
    isLegacyAbacus
  ) {
    productDoc = { ...productDoc, calculationType: 'level_based' };
  }
  if (!productDoc || normalizeCalculationType(productDoc.calculationType) === 'normal') {
    return null;
  }

  const deliveredStudents = deriveDeliveredStudents(dc);
  const levelNumber = deriveDeliverySlotNumber(dc, productDoc);
  const totalLevels = await deriveProgramPaymentDivisor(dc, productDoc);
  const unitPrice = await deriveUnitPrice(dc);
  if (!dc.dcOrderId || deliveredStudents < 0 || unitPrice < 0) {
    return null;
  }

  let program = await ProgramBilling.findOne({
    dcOrderId: dc.dcOrderId,
    product: dc.product,
  });
  if (!program) {
    program = await ProgramBilling.create({
      dcOrderId: dc.dcOrderId,
      product: dc.product,
      totalLevels,
      unitPrice: roundToTwo(unitPrice),
      currency: 'INR',
    });
  } else if (program.totalLevels !== totalLevels || program.unitPrice !== unitPrice) {
    program.totalLevels = totalLevels;
    program.unitPrice = roundToTwo(unitPrice);
    await program.save();
  }

  await recordLevelDelivery({
    programId: program._id,
    levelNumber,
    studentsCount: deliveredStudents,
    dcId: dc._id,
    deliveredAt: dc.completedAt || new Date(),
  });

  return recomputeProgramPayable(program._id, { sourceDcId: dc._id });
};


// @desc    Get all DCs with filtering
// @route   GET /api/dc
// @access  Private
const getDCs = async (req, res) => {
  try {
    const { status, employeeId, saleId, dcOrderId, zone, schoolName, schoolCode, contactMobile, fromDate, toDate, visitCategory } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (employeeId) filter.employeeId = employeeId;
    if (saleId) filter.saleId = saleId;
    if (dcOrderId) filter.dcOrderId = dcOrderId;
    if (visitCategory) filter.dcCategory = visitCategory;
    
    // Date filtering on dcDate or createdAt
    if (fromDate || toDate) {
      const dateFilter = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) dateFilter.$lte = new Date(toDate + 'T23:59:59.999Z');
      filter.$or = [
        { dcDate: dateFilter },
        { createdAt: dateFilter }
      ];
    }

    // Optimize query - fetch without populate first, then populate if needed
    let dcs = await DC.find(filter)
      .select('_id saleId dcOrderId parentDcId clusterId dcType fulfillmentStatus employeeId customerName customerPhone customerEmail customerAddress product requestedQuantity availableQuantity deliverableQuantity status poPhotoUrl poDocument productDetails dcDate dcRemarks dcCategory dcNotes transport lrNo lrDate lrCost boxes transportArea deliveryStatus financeRemarks splApproval smeRemarks warehouseProcessedAt warehouseProcessedBy completedAt completedBy createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(20000); // 20 second timeout

    // Populate in a separate step if we got results (but don't fail if it times out)
    if (dcs && dcs.length > 0) {
      try {
        const populatedPromise = DC.find({ _id: { $in: dcs.map(dc => dc._id) } })
          .populate('saleId', 'customerName product quantity status poDocument')
          .populate('dcOrderId', 'school_name school_code school_type contact_person contact_mobile email address location zone products dc_code')
          .populate('employeeId', 'name email')
          .populate('createdBy', 'name email')
          .populate('submittedBy', 'name email')
          .populate('warehouseProcessedBy', 'name email')
          .populate('deliverySubmittedBy', 'name email')
          .populate('completedBy', 'name email')
          .sort({ createdAt: -1 })
          .maxTimeMS(15000)
          .lean();
        
        const populatedTimeout = new Promise((resolve) => 
          setTimeout(() => resolve(dcs), 15000)
        );
        
        const populated = await Promise.race([populatedPromise, populatedTimeout]);
        if (populated && populated.length > 0 && Array.isArray(populated)) {
          dcs = populated;
        }
      } catch (popErr) {
        console.warn('Population failed, using unpopulated data:', popErr.message);
        // Keep unpopulated dcs
      }
    }

    // Apply additional filters that need to check populated fields
    let filteredDCs = dcs;
    
    if (zone) {
      filteredDCs = filteredDCs.filter(dc => 
        (dc.dcOrderId && dc.dcOrderId.zone && dc.dcOrderId.zone.toLowerCase().includes(zone.toLowerCase())) ||
        (dc.saleId && dc.saleId.zone && dc.saleId.zone.toLowerCase().includes(zone.toLowerCase()))
      );
    }
    
    if (schoolName) {
      filteredDCs = filteredDCs.filter(dc => 
        (dc.dcOrderId && dc.dcOrderId.school_name && dc.dcOrderId.school_name.toLowerCase().includes(schoolName.toLowerCase())) ||
        (dc.customerName && dc.customerName.toLowerCase().includes(schoolName.toLowerCase()))
      );
    }
    
    if (schoolCode) {
      const q = schoolCode.toLowerCase();
      filteredDCs = filteredDCs.filter(dc => {
        if (!dc.dcOrderId) return false;
        const code = (dc.dcOrderId.school_code || dc.dcOrderId.dc_code || '').toLowerCase();
        return code.includes(q);
      });
    }
    
    if (contactMobile) {
      filteredDCs = filteredDCs.filter(dc => 
        (dc.dcOrderId && dc.dcOrderId.contact_mobile && dc.dcOrderId.contact_mobile.includes(contactMobile)) ||
        (dc.customerPhone && dc.customerPhone.includes(contactMobile))
      );
    }

    res.json(filteredDCs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single DC
// @route   GET /api/dc/:id
// @access  Private
const getDC = async (req, res) => {
  try {
    const dc = await DC.findById(req.params.id)
      .populate('saleId', 'customerName product quantity status poDocument poSubmittedAt poSubmittedBy')
      .populate('dcOrderId', 'school_name school_code dc_code contact_person contact_mobile email address location zone products due_amount due_percentage transport_name transport_location transportation_landmark pincode')
      .populate('parentDcId', '_id dc_code status requestedQuantity deliverableQuantity fulfillmentStatus dcType')
      .populate('employeeId', 'name email')
      .populate('adminId', 'name email')
      .populate('managerId', 'name email')
      .populate('warehouseId', 'name email')
      .populate('createdBy', 'name email')
      .populate('submittedBy', 'name email')
      .populate('warehouseProcessedBy', 'name email')
      .populate('deliverySubmittedBy', 'name email')
      .populate('completedBy', 'name email');

    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // Ensure productDetails always have specs and subject fields
    // Only set defaults if they're actually missing (undefined/null), not if they're empty strings
    if (dc.productDetails && Array.isArray(dc.productDetails)) {
      dc.productDetails = dc.productDetails.map(p => ({
        ...p,
        specs: (p.specs !== undefined && p.specs !== null && p.specs !== '') ? p.specs : 'Regular',
        subject: (p.subject !== undefined && p.subject !== null && p.subject !== '') ? p.subject : undefined,
      }));
    }

    res.json(dc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Raise DC from closed deal (Admin can do this)
// @route   POST /api/dc/raise
// @access  Private
const raiseDC = async (req, res) => {
  try {
    console.log('📦 RAISE DC request received:', {
      dcOrderId: req.body.dcOrderId,
      employeeId: req.body.employeeId,
      status: req.body.status,
      hasProductDetails: !!req.body.productDetails,
      productDetailsCount: req.body.productDetails?.length || 0
    });
    
    const { dcOrderId, dcDate, dcRemarks, dcCategory, dcNotes, requestedQuantity } = req.body;
    const productDetailsFromBody = req.body.productDetails && Array.isArray(req.body.productDetails) ? req.body.productDetails : null;

    if (!dcOrderId) {
      console.log('❌ DC Order ID is missing');
      return res.status(400).json({ message: 'DC Order ID is required' });
    }

    const DcOrder = require('../models/DcOrder');
    const Lead = require('../models/Lead');
    let dcOrder = await DcOrder.findById(dcOrderId)
      .populate('assigned_to', 'name email');

    // If no DcOrder found, the id may be a Lead id (close lead from follow-up → Turn to Client)
    if (!dcOrder) {
      const lead = await Lead.findById(dcOrderId);
      if (lead) {
        console.log('📋 Lead found (converting to client), creating DcOrder from lead:', lead.school_name);
        const productsFromDetails = (productDetailsFromBody && Array.isArray(productDetailsFromBody))
          ? productDetailsFromBody.map(p => ({
              product_name: p.product || p.product_name || 'Abacus',
              quantity: Number(p.quantity) || Number(p.strength) || 1,
              unit_price: Number(p.price) || 0,
              class: p.class ? String(p.class).trim() : '1',
            }))
          : (lead.products && lead.products.length) ? lead.products : [{ product_name: 'Abacus', quantity: 1, unit_price: 0 }];
        dcOrder = await DcOrder.create({
          school_name: lead.school_name || 'School',
          contact_person: lead.contact_person,
          contact_mobile: lead.contact_mobile,
          email: lead.email,
          location: lead.location,
          zone: lead.zone,
          school_type: lead.school_type || 'New',
          products: productsFromDetails,
          assigned_to: req.body.employeeId || req.user._id,
          status: 'completed',
          estimated_delivery_date: req.body.dcDate ? new Date(req.body.dcDate) : undefined,
          created_by: req.user._id,
        });
        console.log('✅ DcOrder created from lead:', dcOrder._id);
      }
    }

    if (!dcOrder) {
      console.log('❌ DcOrder/Lead not found:', dcOrderId);
      return res.status(404).json({ message: 'Deal/Lead not found' });
    }

    // Resolve employeeId once
    let employeeId = req.body.employeeId || req.body.assignedTo
      || (dcOrder.assigned_to ? (typeof dcOrder.assigned_to === 'object' ? dcOrder.assigned_to._id : dcOrder.assigned_to) : null)
      || req.user._id;
    if (!employeeId) {
      return res.status(400).json({ message: 'Deal must be assigned to an employee before raising DC.' });
    }

    const requestedDcType = req.body.dcType === 'shortage' ? 'shortage' : 'normal';
    const parentDcId = req.body.parentDcId || null;

    if (requestedDcType === 'shortage') {
      if (!parentDcId) {
        return res.status(400).json({ message: 'parentDcId is required for shortage DC' });
      }
      const parentDc = await DC.findById(parentDcId).lean();
      if (!parentDc) {
        return res.status(404).json({ message: 'Parent DC not found' });
      }
      if (String(parentDc.dcOrderId) !== String(dcOrder._id)) {
        return res.status(400).json({ message: 'Shortage DC must use the same dcOrderId as parent DC' });
      }
      if (parentDc.status !== 'completed') {
        return res.status(400).json({ message: 'Shortage DC can only be raised for a completed parent DC' });
      }

      const shortageRows = normalizeProductDetails(productDetailsFromBody || [], { isShortage: true });
      if (!shortageRows.length) {
        return res.status(400).json({ message: 'At least one shortage product line is required' });
      }

      const siblingShortages = await DC.find({ parentDcId: parentDc._id, dcType: 'shortage', status: { $ne: 'hold' } })
        .select('productDetails')
        .lean();
      const consumedByRow = new Map();
      siblingShortages.forEach((dcRow) => {
        (dcRow.productDetails || []).forEach((p) => {
          const key = getRowKey(p);
          const current = consumedByRow.get(key) || 0;
          consumedByRow.set(key, current + qtyFromRow(p));
        });
      });

      for (const row of shortageRows) {
        const key = getRowKey(row);
        const parentRow = (parentDc.productDetails || []).find((p) => getRowKey(p) === key);
        if (!parentRow) {
          return res.status(400).json({ message: `Shortage item "${row.product}" not found on parent DC` });
        }
        const parentQty = qtyFromRow(parentRow);
        const alreadyShortaged = consumedByRow.get(key) || 0;
        const remaining = parentQty - alreadyShortaged;
        if (qtyFromRow(row) <= 0 || qtyFromRow(row) > remaining) {
          return res.status(400).json({
            message: `Invalid shortage quantity for "${row.product}". Remaining allowed: ${Math.max(remaining, 0)}`,
          });
        }
      }

      const shortageQty = requestedQuantity != null ? Number(requestedQuantity) : calculateTotalQuantity(shortageRows);
      const shortageDc = await DC.create({
        dcOrderId: dcOrder._id,
        employeeId,
        customerName: dcOrder.school_name,
        customerEmail: dcOrder.email || undefined,
        customerAddress: dcOrder.address || dcOrder.location || 'N/A',
        customerPhone: dcOrder.contact_mobile || dcOrder.contact_person || 'N/A',
        product: (shortageRows[0] && (shortageRows[0].product || shortageRows[0].productName)) || 'Abacus',
        requestedQuantity: shortageQty || 1,
        deliverableQuantity: 0,
        status: req.body.status || 'pending_dc',
        createdBy: req.user._id,
        productDetails: shortageRows,
        dcType: 'shortage',
        parentDcId: parentDc._id,
        clusterId: parentDc.clusterId || parentDc._id.toString(),
        fulfillmentStatus: 'partial',
        ...(req.body.dcDate && { dcDate: new Date(req.body.dcDate) }),
        ...(req.body.dcRemarks && { dcRemarks: req.body.dcRemarks }),
        ...(req.body.dcCategory && { dcCategory: req.body.dcCategory }),
        ...(req.body.dcNotes && { dcNotes: req.body.dcNotes }),
      });

      await DC.findByIdAndUpdate(parentDc._id, {
        $set: {
          fulfillmentStatus: 'partial',
          clusterId: parentDc.clusterId || parentDc._id.toString(),
        },
      });

      const populatedShortageDc = await DC.findById(shortageDc._id)
        .populate('dcOrderId', 'school_name school_code contact_person contact_mobile email address location zone products dc_code')
        .populate('parentDcId', '_id dc_code status requestedQuantity deliveredQuantity fulfillmentStatus')
        .populate('employeeId', 'name email')
        .populate('createdBy', 'name email');
      return res.status(200).json(populatedShortageDc);
    }

    // --- Term split: do it in backend from full productDetails ---
    const terms = (productDetailsFromBody || []).map(p => (p.term || 'Term 1').trim());
    const hasTerm1 = terms.includes('Term 1');
    const hasTerm2 = terms.includes('Term 2');
    const hasBothTerm = terms.includes('Both');
    const term1Products = (productDetailsFromBody || []).filter(p => {
      const t = (p.term || 'Term 1').trim();
      return t === 'Term 1' || t === 'Both';
    });
    const term2Products = (productDetailsFromBody || []).filter(p => (p.term || 'Term 1').trim() === 'Term 2');
    const needsSplit = term1Products.length > 0 && term2Products.length > 0;

    const buildDcPayload = (details, status, qty) => {
      const productName = (details && details[0] && (details[0].product || details[0].productName)) || (dcOrder.products && dcOrder.products[0] && dcOrder.products[0].product_name) || 'Abacus';
      const normalizedDetails = normalizeProductDetails(details || []);
      const payload = {
        dcOrderId: dcOrder._id,
        employeeId,
        customerName: dcOrder.school_name,
        customerEmail: dcOrder.email || undefined,
        customerAddress: dcOrder.address || dcOrder.location || 'N/A',
        customerPhone: dcOrder.contact_mobile || dcOrder.contact_person || 'N/A',
        product: productName,
        requestedQuantity: qty,
        deliverableQuantity: 0,
        status,
        createdBy: req.user._id,
        productDetails: normalizedDetails,
        dcType: 'normal',
        fulfillmentStatus: 'full',
        ...(req.body.dcDate && { dcDate: new Date(req.body.dcDate) }),
        ...(req.body.dcRemarks && { dcRemarks: req.body.dcRemarks }),
        ...(req.body.dcCategory && { dcCategory: req.body.dcCategory }),
        ...(req.body.dcNotes && { dcNotes: req.body.dcNotes }),
      };
      if (req.body.poPhotoUrl) {
        payload.poPhotoUrl = req.body.poPhotoUrl;
        payload.poDocument = req.body.poPhotoUrl;
      } else if (dcOrder.pod_proof_url) {
        payload.poPhotoUrl = dcOrder.pod_proof_url;
        payload.poDocument = dcOrder.pod_proof_url;
      }
      return payload;
    };

    if (needsSplit) {
      // Split in backend: Term 1 + Both → pending_dc, Term 2 → scheduled_for_later
      const term1Qty = term1Products.reduce((s, p) => s + (Number(p.quantity) || Number(p.strength) || 0), 0) || 1;
      const term2Qty = term2Products.reduce((s, p) => s + (Number(p.quantity) || Number(p.strength) || 0), 0) || 1;
      const existingDcs = await DC.find({ dcOrderId: dcOrder._id }).sort({ status: 1, createdAt: 1 });
      const dcPending = existingDcs.find(d => d.status !== 'scheduled_for_later');
      const dcTerm2 = existingDcs.find(d => d.status === 'scheduled_for_later');

      // Term 1 DC (pending_dc)
      if (dcPending) {
        // Ensure productDetails are properly formatted and saved
        dcPending.productDetails = normalizeProductDetails(term1Products);
        dcPending.requestedQuantity = term1Qty;
        dcPending.status = 'pending_dc';
        dcPending.dcType = 'normal';
        dcPending.fulfillmentStatus = 'full';
        if (req.body.dcDate) dcPending.deliveryDate = new Date(req.body.dcDate);
        if (req.body.dcRemarks) dcPending.deliveryNotes = req.body.dcRemarks;
        if (req.body.dcNotes) dcPending.deliveryNotes = req.body.dcNotes ? (dcPending.deliveryNotes ? dcPending.deliveryNotes + '\n' + req.body.dcNotes : req.body.dcNotes) : dcPending.deliveryNotes;
        if (req.body.poPhotoUrl) { dcPending.poPhotoUrl = req.body.poPhotoUrl; dcPending.poDocument = req.body.poPhotoUrl; }
        if (!dcPending.poPhotoUrl && dcOrder.pod_proof_url) { dcPending.poPhotoUrl = dcOrder.pod_proof_url; dcPending.poDocument = dcOrder.pod_proof_url; }
        console.log('💾 Saving Term 1 DC with productDetails:', {
          dcId: dcPending._id,
          productDetailsCount: dcPending.productDetails.length,
          productDetails: dcPending.productDetails
        });
        await dcPending.save();
      } else {
        const payload = buildDcPayload(term1Products, 'pending_dc', term1Qty);
        console.log('💾 Creating new Term 1 DC with productDetails:', {
          productDetailsCount: payload.productDetails?.length || 0,
          productDetails: payload.productDetails
        });
        await DC.create(payload);
      }

      // Term 2 DC (scheduled_for_later)
      if (dcTerm2) {
        dcTerm2.productDetails = normalizeProductDetails(term2Products);
        dcTerm2.requestedQuantity = term2Qty;
        dcTerm2.status = 'scheduled_for_later';
        dcTerm2.dcType = 'normal';
        dcTerm2.fulfillmentStatus = 'full';
        if (req.body.dcDate) dcTerm2.deliveryDate = new Date(req.body.dcDate);
        if (req.body.poPhotoUrl) { dcTerm2.poPhotoUrl = req.body.poPhotoUrl; dcTerm2.poDocument = req.body.poPhotoUrl; }
        await dcTerm2.save();
      } else {
        const payload = buildDcPayload(term2Products, 'scheduled_for_later', term2Qty);
        await DC.create(payload);
      }

      const term1Dc = await DC.findOne({ dcOrderId: dcOrder._id, status: 'pending_dc' }).sort({ createdAt: -1 });
      const toReturn = term1Dc || (await DC.findOne({ dcOrderId: dcOrder._id }).sort({ createdAt: -1 }));
      if (!dcOrder.assigned_to && employeeId) {
        await DcOrder.findByIdAndUpdate(dcOrder._id, { assigned_to: employeeId });
      }
      const populatedDC = await DC.findById(toReturn._id)
        .populate('dcOrderId', 'school_name contact_person contact_mobile email address location zone products')
        .populate('saleId', 'customerName product quantity status poDocument')
        .populate('employeeId', 'name email')
        .populate('createdBy', 'name email');
      return res.status(200).json(populatedDC);
    }

    // Single DC (no split)
    const requestedStatus = (hasTerm2 && !hasTerm1 && !hasBothTerm) ? 'scheduled_for_later' : (req.body.status || 'pending_dc');
    let dc = await DC.findOne({ dcOrderId: dcOrder._id }).sort({ status: 1, createdAt: 1 });
    const isTerm2Only = requestedStatus === 'scheduled_for_later' && dc && dc.status !== 'scheduled_for_later';
    if (dc && !isTerm2Only) {
      if (req.body.employeeId || req.body.assignedTo) dc.employeeId = req.body.employeeId || req.body.assignedTo;
      if (!dc.poPhotoUrl && dcOrder.pod_proof_url) { dc.poPhotoUrl = dcOrder.pod_proof_url; dc.poDocument = dcOrder.pod_proof_url; }
      if (req.body.poPhotoUrl) { dc.poPhotoUrl = req.body.poPhotoUrl; dc.poDocument = req.body.poPhotoUrl; }
      if (productDetailsFromBody && Array.isArray(productDetailsFromBody)) dc.productDetails = normalizeProductDetails(productDetailsFromBody);
      dc.status = requestedStatus;
      dc.dcType = 'normal';
      dc.fulfillmentStatus = 'full';
      if (req.body.requestedQuantity !== undefined) dc.requestedQuantity = req.body.requestedQuantity;
    }
    if (isTerm2Only) dc = null;

    if (!dc) {
      const quantity = requestedQuantity != null ? requestedQuantity : (productDetailsFromBody && productDetailsFromBody.length > 0
        ? productDetailsFromBody.reduce((s, p) => s + (Number(p.quantity) || Number(p.strength) || 0), 0) || 1
        : (dcOrder.products && dcOrder.products.reduce((s, p) => s + (p.quantity || 1), 0)) || 1);
      const productName = (productDetailsFromBody && productDetailsFromBody[0] && (productDetailsFromBody[0].product || productDetailsFromBody[0].productName)) || (dcOrder.products && dcOrder.products[0] && dcOrder.products[0].product_name) || 'Abacus';
      dc = await DC.create({
        dcOrderId: dcOrder._id,
        employeeId,
        customerName: dcOrder.school_name,
        customerEmail: dcOrder.email || undefined,
        customerAddress: dcOrder.address || dcOrder.location || 'N/A',
        customerPhone: dcOrder.contact_mobile || dcOrder.contact_person || 'N/A',
        product: productName,
        requestedQuantity: quantity,
        deliverableQuantity: 0,
        status: requestedStatus,
        createdBy: req.user._id,
        productDetails: productDetailsFromBody ? normalizeProductDetails(productDetailsFromBody) : undefined,
        dcType: 'normal',
        fulfillmentStatus: 'full',
      });
      if (!dcOrder.assigned_to && employeeId) await DcOrder.findByIdAndUpdate(dcOrder._id, { assigned_to: employeeId });
      if (dcOrder.pod_proof_url) { dc.poPhotoUrl = dcOrder.pod_proof_url; dc.poDocument = dcOrder.pod_proof_url; }
      if (req.body.poPhotoUrl) { dc.poPhotoUrl = req.body.poPhotoUrl; dc.poDocument = req.body.poPhotoUrl; }
    }

    if (req.body.dcDate) dc.deliveryDate = new Date(req.body.dcDate);
    if (req.body.dcRemarks) dc.deliveryNotes = req.body.dcRemarks;
    if (req.body.dcNotes) dc.deliveryNotes = dc.deliveryNotes ? `${dc.deliveryNotes}\n${req.body.dcNotes}` : req.body.dcNotes;
    if (productDetailsFromBody && Array.isArray(productDetailsFromBody)) {
      dc.productDetails = normalizeProductDetails(productDetailsFromBody);
      if (req.body.requestedQuantity == null && productDetailsFromBody.length > 0) {
        const totalQty = productDetailsFromBody.reduce((sum, p) => sum + (Number(p.quantity) || Number(p.strength) || 0), 0);
        if (totalQty > 0) dc.requestedQuantity = totalQty;
      }
    }
    if (req.body.requestedQuantity !== undefined) dc.requestedQuantity = req.body.requestedQuantity;
    dc.status = requestedStatus;
    if (req.body.poPhotoUrl && !dc.poPhotoUrl) { dc.poPhotoUrl = req.body.poPhotoUrl; dc.poDocument = req.body.poPhotoUrl; }
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('dcOrderId', 'school_name contact_person contact_mobile email address location zone products')
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    res.status(200).json(populatedDC);
  } catch (error) {
    console.error('Error raising DC:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit DC to Manager (from Raise DC modal)
// @route   POST /api/dc/:id/submit-to-manager
// @access  Private (Admin)
const submitDCToManager = async (req, res) => {
  try {
    const { requestedQuantity, remarks } = req.body;

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // Update DC details
    if (requestedQuantity) dc.requestedQuantity = requestedQuantity;
    if (remarks) dc.deliveryNotes = remarks;

    // Move to sent_to_manager first, so Manager can review before it goes to warehouse
    // This matches the normal workflow: sent_to_manager -> pending_dc
    dc.status = 'sent_to_manager';
    dc.managerId = req.user._id;
    dc.sentToManagerAt = new Date();
    dc.adminId = req.user._id;
    dc.adminReviewedAt = new Date();
    dc.adminReviewedBy = req.user._id;
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('dcOrderId', 'school_name contact_person contact_mobile email address location zone products')
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('managerId', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manager requests quantity from warehouse
// @route   POST /api/dc/:id/request-warehouse
// @access  Private
const requestWarehouse = async (req, res) => {
  try {
    const { requestedQuantity } = req.body;

    if (!requestedQuantity || requestedQuantity <= 0) {
      return res.status(400).json({ message: 'Valid requested quantity is required' });
    }

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    if (dc.status !== 'Pending') {
      return res.status(400).json({ message: `DC must be in Pending status. Current status: ${dc.status}` });
    }

    // Update DC with requested quantity and move to Warehouse
    dc.requestedQuantity = requestedQuantity;
    dc.status = 'Warehouse';
    dc.warehouseRequestedAt = new Date();
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Warehouse updates quantities and submits
// @route   POST /api/dc/:id/warehouse-submit
// @access  Private
const warehouseSubmit = async (req, res) => {
  try {
    const { availableQuantity, deliverableQuantity } = req.body;

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    if (dc.status !== 'Warehouse') {
      return res.status(400).json({ message: `DC must be in Warehouse status. Current status: ${dc.status}` });
    }

    // Update quantities
    if (availableQuantity !== undefined) dc.availableQuantity = availableQuantity;
    if (deliverableQuantity !== undefined) {
      if (deliverableQuantity < 0) {
        return res.status(400).json({ message: 'Deliverable quantity cannot be negative' });
      }
      dc.deliverableQuantity = deliverableQuantity;
    }

    // Move to Employee status
    dc.status = 'Employee';
    dc.warehouseProcessedAt = new Date();
    dc.warehouseProcessedBy = req.user._id;
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('warehouseProcessedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Employee submits delivery
// @route   POST /api/dc/:id/delivery-submit
// @access  Private
const deliverySubmit = async (req, res) => {
  try {
    const { deliveryNotes, deliveryProof, deliveredAt } = req.body;

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    if (dc.status !== 'Employee') {
      return res.status(400).json({ message: `DC must be in Employee status. Current status: ${dc.status}` });
    }

    // Update delivery details
    if (deliveryNotes !== undefined) dc.deliveryNotes = deliveryNotes;
    if (deliveryProof !== undefined) dc.deliveryProof = deliveryProof;
    if (deliveredAt) {
      dc.deliveredAt = new Date(deliveredAt);
    } else {
      dc.deliveredAt = new Date();
    }

    // Mark delivery as submitted (status stays Employee until Manager approves)
    dc.deliverySubmittedAt = new Date();
    dc.deliverySubmittedBy = req.user._id;
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('deliverySubmittedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manager approves DC and marks as Completed
// @route   POST /api/dc/:id/complete
// @access  Private
const completeDC = async (req, res) => {
  try {
    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    if (dc.status !== 'Employee' || !dc.deliverySubmittedAt) {
      return res.status(400).json({ message: 'DC must be delivered and submitted by employee before completion' });
    }

    // Move to Completed
    dc.status = 'Completed';
    dc.completedAt = new Date();
    dc.completedBy = req.user._id;
    await dc.save();

    // Update sale status if needed
    if (dc.saleId) {
      const sale = await Sale.findById(dc.saleId);
      if (sale && sale.status !== 'Completed') {
        sale.status = 'Completed';
        await sale.save();
      }
    }

    try {
      await recomputeBillingForCompletedDC(dc);
    } catch (billingErr) {
      console.error('Program billing recompute failed in completeDC:', billingErr.message);
    }

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status')
      .populate('employeeId', 'name email')
      .populate('completedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manager puts DC on Hold
// @route   POST /api/dc/:id/hold
// @access  Private
const holdDC = async (req, res) => {
  try {
    const { holdReason } = req.body;

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // DC can be put on hold from sent_to_manager (warehouse), warehouse_processing, or legacy Employee/Warehouse status
    const allowedForHold = ['sent_to_manager', 'warehouse_processing', 'Employee', 'Warehouse'];
    if (!allowedForHold.includes(dc.status)) {
      return res.status(400).json({ message: `DC can only be put on hold from sent_to_manager or warehouse_processing. Current status: ${dc.status}` });
    }

    dc.status = 'hold';
    dc.holdReason = holdReason || 'No reason provided';
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status')
      .populate('employeeId', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending DCs (for Manager)
// @route   GET /api/dc/pending
// @access  Private
const getPendingDCs = async (req, res) => {
  try {
    const dcs = await DC.find({ status: 'Pending' })
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(dcs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get warehouse DCs (for Warehouse dashboard)
// @route   GET /api/dc/warehouse
// @access  Private
const getWarehouseDCs = async (req, res) => {
  try {
    const dcs = await DC.find({ status: 'Warehouse' })
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .sort({ warehouseRequestedAt: -1 });

    res.json(dcs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee DCs (for Employee dashboard)
// @route   GET /api/dc/employee
// @access  Private
const getEmployeeDCs = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const filter = { status: 'Employee' };

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    const dcs = await DC.find(filter)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .sort({ warehouseProcessedAt: -1 });

    res.json(dcs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get completed DCs (for Manager/Warehouse)
// @route   GET /api/dc/completed
// @access  Private
const getCompletedDCs = async (req, res) => {
  try {
    // Use lowercase 'completed' to match the DC model enum
    // Optimize query - fetch without populate first
    let dcs = await DC.find({ status: 'completed' })
      .select('_id saleId dcOrderId parentDcId clusterId dcType fulfillmentStatus employeeId customerName customerPhone customerEmail customerAddress product requestedQuantity availableQuantity deliverableQuantity status poPhotoUrl poDocument productDetails dcDate dcRemarks dcCategory dcNotes transport lrNo lrDate lrCost boxes transportArea deliveryStatus financeRemarks splApproval smeRemarks warehouseProcessedAt warehouseProcessedBy completedAt completedBy createdAt updatedAt')
      .sort({ completedAt: -1, createdAt: -1 }) // Sort by completedAt first, then createdAt as fallback
      .lean()
      .maxTimeMS(20000);

    // Populate if we got results
    if (dcs && dcs.length > 0) {
      try {
        const populatedPromise = DC.find({ _id: { $in: dcs.map(dc => dc._id) }, status: 'completed' })
          .select('_id saleId dcOrderId parentDcId clusterId dcType fulfillmentStatus employeeId customerName customerPhone customerEmail customerAddress product requestedQuantity availableQuantity deliverableQuantity status poPhotoUrl poDocument productDetails dcDate dcRemarks dcCategory dcNotes transport lrNo lrDate lrCost boxes transportArea deliveryStatus financeRemarks splApproval smeRemarks warehouseProcessedAt warehouseProcessedBy completedAt completedBy createdAt updatedAt')
          .populate('saleId', 'customerName product quantity status')
          .populate('dcOrderId', 'school_name school_code school_type contact_person contact_mobile email address location zone products dc_code')
          .populate('parentDcId', '_id dc_code status requestedQuantity deliverableQuantity fulfillmentStatus dcType')
          .populate('employeeId', 'name email')
          .populate('completedBy', 'name email')
          .populate('warehouseProcessedBy', 'name email')
          .sort({ completedAt: -1, createdAt: -1 }) // Sort by completedAt first, then createdAt as fallback
          .maxTimeMS(15000)
          .lean();
        
        const populatedTimeout = new Promise((resolve) => 
          setTimeout(() => resolve(dcs), 15000)
        );
        
        const populated = await Promise.race([populatedPromise, populatedTimeout]);
        if (populated && populated.length > 0 && Array.isArray(populated)) {
          dcs = populated;
        }
      } catch (popErr) {
        console.warn('Population failed for completed DCs, using unpopulated data:', popErr.message);
      }
    }

    console.log(`Found ${dcs.length} completed DCs`);
    
    // Ensure we return an array even if query fails
    if (!Array.isArray(dcs)) {
      console.warn('getCompletedDCs: dcs is not an array, returning empty array');
      dcs = [];
    }
    
    res.json(dcs);
  } catch (error) {
    console.error('Error in getCompletedDCs:', error);
    // Return empty array on error to prevent frontend from breaking
    if (error.message && error.message.includes('timed out')) {
      console.warn('Query timed out, returning empty array');
      return res.json([]);
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get hold DCs (for Manager)
// @route   GET /api/dc/hold
// @access  Private
const getHoldDCs = async (req, res) => {
  try {
    const dcs = await DC.find({ status: 'hold' })
      .populate('saleId', 'customerName product quantity status')
      .populate('dcOrderId', 'school_name school_code school_type contact_person contact_mobile email address location zone products dc_code')
      .populate('employeeId', 'name email')
      .populate('managerId', 'name email')
      .populate('warehouseId', 'name email')
      .sort({ updatedAt: -1 });

    res.json(dcs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Employee stats for DC
// @route   GET /api/dc/stats/employee
// @access  Private
const employeeStats = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const match = {};
    if (employeeId) match.employeeId = employeeId;

    const agg = await DC.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totals = agg.reduce(
      (acc, row) => {
        acc.byStatus[row._id] = row.count;
        acc.total += row.count;
        return acc;
      },
      { total: 0, byStatus: { Pending: 0, Warehouse: 0, Employee: 0, Completed: 0, Hold: 0 } }
    );

    res.json(totals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Employee submits PO (Purchase Order)
// @route   POST /api/dc/:id/submit-po
// @access  Private
const submitPO = async (req, res) => {
  try {
    const { poPhotoUrl, remarks } = req.body;

    if (!poPhotoUrl) {
      return res.status(400).json({ message: 'PO photo URL is required' });
    }

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // Check if DC is in correct status
    if (dc.status !== 'created') {
      return res.status(400).json({ message: `DC must be in 'created' status. Current status: ${dc.status}` });
    }

    // Check if employee is assigned to this DC
    if (!dc.employeeId) {
      return res.status(400).json({ message: 'DC does not have an assigned employee' });
    }
    
    if (dc.employeeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to submit PO for this DC' });
    }

    // Update DC with PO photo and change status
    dc.poPhotoUrl = poPhotoUrl;
    dc.poDocument = poPhotoUrl; // Also update legacy field
    dc.status = 'po_submitted';
    dc.poSubmittedAt = new Date();
    dc.poSubmittedBy = req.user._id;
    if (remarks) {
      dc.deliveryNotes = remarks;
    }
    await dc.save();

    // Update sale PO document if linked to Sale (optional, don't fail if Sale doesn't exist)
    if (dc.saleId) {
      try {
        const Sale = require('../models/Sale');
        await Sale.findByIdAndUpdate(dc.saleId, {
          poDocument: poPhotoUrl,
          poSubmittedAt: new Date(),
          poSubmittedBy: req.user._id,
        });
      } catch (err) {
        console.warn('Could not update Sale with PO document:', err.message);
        // Don't fail the entire operation if Sale update fails
      }
    }

    // Update DcOrder if linked to DcOrder (when created from deal/lead)
    if (dc.dcOrderId) {
      try {
        const DcOrder = require('../models/DcOrder');
        // Store PO proof and mark deal as completed so it shows in Closed Sales immediately
        await DcOrder.findByIdAndUpdate(dc.dcOrderId, {
          pod_proof_url: poPhotoUrl,
          status: 'completed',
          updatedAt: new Date(),
        });
      } catch (err) {
        console.warn('Could not update DcOrder with PO document:', err.message);
        // Don't fail the entire operation if DcOrder update fails
      }
    }

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('dcOrderId', 'school_name contact_person contact_mobile email address location zone products')
      .populate('employeeId', 'name email')
      .populate('poSubmittedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    console.error('Error submitting PO:', error);
    console.error('Error stack:', error.stack);
    // Return more detailed error message in development
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to submit PO. Please try again.' 
      : error.message || error.toString();
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Admin reviews and approves/rejects PO, forwards to Manager
// @route   POST /api/dc/:id/admin-review
// @access  Private (Admin only)
const adminReviewPO = async (req, res) => {
  try {
    const { action, remarks } = req.body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approve' or 'reject'" });
    }

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // Check if DC is in correct status
    if (dc.status !== 'po_submitted') {
      return res.status(400).json({ message: `DC must be in 'po_submitted' status. Current status: ${dc.status}` });
    }

    if (action === 'reject') {
      // Reject: Reset to created status
      dc.status = 'created';
      dc.poPhotoUrl = null;
      dc.poDocument = null;
      dc.poSubmittedAt = null;
      dc.poSubmittedBy = null;
      if (remarks) {
        dc.holdReason = `Rejected by Admin: ${remarks}`;
      }
    } else {
      // Approve: Forward to Manager
      dc.status = 'sent_to_manager';
      dc.adminId = req.user._id;
      dc.adminReviewedAt = new Date();
      dc.adminReviewedBy = req.user._id;
      dc.sentToManagerAt = new Date();
      if (remarks) {
        dc.deliveryNotes = remarks;
      }
    }
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('adminId', 'name email')
      .populate('adminReviewedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manager raises quantity request to Warehouse
// @route   POST /api/dc/:id/manager-request
// @access  Private (Manager only)
const managerRequestWarehouse = async (req, res) => {
  try {
    const { requestedQuantity, remarks } = req.body;

    if (!requestedQuantity || requestedQuantity <= 0) {
      return res.status(400).json({ message: 'Valid requested quantity is required' });
    }

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // Check if DC is in correct status
    if (dc.status !== 'pending_dc') {
      return res.status(400).json({ message: `DC must be in 'pending_dc' status. Current status: ${dc.status}` });
    }

    // All DCs go directly to warehouse regardless of terms - no splitting
    dc.requestedQuantity = requestedQuantity;
    dc.status = 'sent_to_manager';
    dc.managerId = req.user._id;
    dc.managerRequestedAt = new Date();
    dc.managerRequestedBy = req.user._id;
    dc.sentToManagerAt = new Date();
    if (remarks) {
      dc.deliveryNotes = remarks;
    }
    await dc.save();

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('managerId', 'name email')
      .populate('managerRequestedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Warehouse processes DC and submits
// @route   POST /api/dc/:id/warehouse-process
// @access  Private (Warehouse only)
const warehouseProcess = async (req, res) => {
  try {
    const { availableQuantity, deliverableQuantity, remarks } = req.body;

    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // Check if DC is in correct status (allow both sent_to_manager and warehouse_processing)
    if (dc.status !== 'sent_to_manager' && dc.status !== 'warehouse_processing') {
      return res.status(400).json({ message: `DC must be in 'sent_to_manager' or 'warehouse_processing' status. Current status: ${dc.status}` });
    }

    // Update quantities
    if (availableQuantity !== undefined) dc.availableQuantity = availableQuantity;
    if (deliverableQuantity !== undefined) {
      if (deliverableQuantity < 0) {
        return res.status(400).json({ message: 'Deliverable quantity cannot be negative' });
      }
      dc.deliverableQuantity = deliverableQuantity;
    }

    // Move to completed status
    dc.status = 'completed';
    dc.warehouseId = req.user._id;
    dc.warehouseProcessedAt = new Date();
    dc.warehouseProcessedBy = req.user._id;
    dc.completedAt = new Date();
    dc.completedBy = req.user._id;
    
    // If available quantity > deliverable quantity, mark as listed
    if (dc.availableQuantity !== undefined && dc.deliverableQuantity !== undefined && 
        dc.availableQuantity > dc.deliverableQuantity) {
      dc.listedAt = new Date();
    }
    
    if (remarks) {
      dc.deliveryNotes = remarks;
    }
    await dc.save();

    // Automatically deduct stock from inventory for each product in productDetails
    if (dc.productDetails && Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
      for (const productDetail of dc.productDetails) {
        try {
          const deliverableQty = productDetail.deliverableQuantity || productDetail.quantity || 0;
          if (deliverableQty <= 0) continue; // Skip if no quantity to deduct
          
          // Find matching warehouse item by productName, category, and level
          const productName = productDetail.productName || productDetail.product || '';
          const category = productDetail.category || '';
          const level = productDetail.level || '';
          
          // Try to find exact match first
          let warehouseItem = await Warehouse.findOne({
            productName: { $regex: new RegExp(`^${productName}$`, 'i') },
            category: category,
            level: level
          });
          
          // If no exact match, try productName and category only
          if (!warehouseItem) {
            warehouseItem = await Warehouse.findOne({
              productName: { $regex: new RegExp(`^${productName}$`, 'i') },
              category: category
            });
          }
          
          // If still no match, try productName only
          if (!warehouseItem) {
            warehouseItem = await Warehouse.findOne({
              productName: { $regex: new RegExp(`^${productName}$`, 'i') }
            });
          }
          
          if (warehouseItem) {
            // Get availableQty from productDetails or warehouse item
            const availableQty = productDetail.availableQuantity !== undefined && productDetail.availableQuantity !== null
              ? Number(productDetail.availableQuantity)
              : warehouseItem.currentStock || 0;
            
            // Use remainingQuantity from productDetails if available (from form)
            // Otherwise calculate it: available - deliverable
            let remainingQty;
            if (productDetail.remainingQuantity !== undefined && productDetail.remainingQuantity !== null) {
              // Use the remaining qty from the form
              remainingQty = Number(productDetail.remainingQuantity);
            } else {
              // Calculate remaining quantity (available - deliverable)
              remainingQty = availableQty - deliverableQty;
            }
            
            // Update warehouse stock with remaining quantity
            warehouseItem.currentStock = Math.max(0, remainingQty); // Ensure non-negative
            await warehouseItem.save();
            
            // Record stock movement
            await StockMovement.create({
              productId: warehouseItem._id,
              movementType: 'Out',
              quantity: deliverableQty,
              reason: `DC ${dc._id} - ${dc.customerName || 'Customer'}`,
              createdBy: req.user._id,
            });
            
            console.log(`Updated stock for ${productName}: ${availableQty} -> ${remainingQty} (deducted ${deliverableQty})`);
          } else {
            console.warn(`No warehouse item found for product: ${productName}, category: ${category}, level: ${level}`);
          }
        } catch (err) {
          console.error(`Error updating stock for product ${productDetail.productName}:`, err);
          // Continue with other products even if one fails
        }
      }
    }

    try {
      await recomputeBillingForCompletedDC(dc);
    } catch (billingErr) {
      console.error('Program billing recompute failed in warehouseProcess:', billingErr.message);
    }

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('warehouseId', 'name email')
      .populate('warehouseProcessedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get DCs with PO submitted (for Admin review)
// @route   GET /api/dc/po-submitted
// @access  Private (Admin)
const getPOSubmittedDCs = async (req, res) => {
  try {
    const dcs = await DC.find({ status: 'po_submitted' })
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('employeeId', 'name email')
      .populate('poSubmittedBy', 'name email')
      .sort({ poSubmittedAt: -1 });

    res.json(dcs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get DCs sent to manager (for Manager review)
// @route   GET /api/dc/sent-to-manager
// @access  Private (Manager)
const getSentToManagerDCs = async (req, res) => {
  try {
    const dcs = await DC.find({ status: 'sent_to_manager' })
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('dcOrderId', 'school_name contact_person contact_mobile email address location zone products pod_proof_url')
      .populate('employeeId', 'name email')
      .populate('adminId', 'name email')
      .populate('adminReviewedBy', 'name email')
      .sort({ sentToManagerAt: -1 });

    console.log(`Found ${dcs.length} DCs with status 'sent_to_manager'`);
    res.json(dcs);
  } catch (error) {
    console.error('Error in getSentToManagerDCs:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get DCs pending warehouse (for Warehouse processing)
// @route   GET /api/dc/pending-warehouse
// @access  Private (Warehouse)
const getPendingWarehouseDCs = async (req, res) => {
  try {
    // Fetch all DCs with status 'sent_to_manager' - show all DCs regardless of terms
    const dcs = await DC.find({ status: 'sent_to_manager' })
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('dcOrderId', 'school_name contact_person contact_mobile zone location')
      .populate('employeeId', 'name email')
      .populate('managerId', 'name email')
      .populate('managerRequestedBy', 'name email')
      .sort({ managerRequestedAt: -1, sentToManagerAt: -1, createdAt: -1 });

    // Ensure productDetails always have specs and subject fields
    // Only set defaults if they're actually missing (undefined/null), not if they're empty strings
    dcs.forEach(dc => {
      if (dc.productDetails && Array.isArray(dc.productDetails)) {
        dc.productDetails = dc.productDetails.map(p => ({
          ...p,
          specs: (p.specs !== undefined && p.specs !== null && p.specs !== '') ? p.specs : 'Regular',
          subject: (p.subject !== undefined && p.subject !== null && p.subject !== '') ? p.subject : undefined,
        }));
      }
    });

    res.json(dcs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee DCs for their dashboard
// @route   GET /api/dc/employee/my
// @access  Private
const getMyDCs = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const connectionState = mongoose.connection.readyState;
    if (connectionState !== 1) {
      console.warn(`MongoDB connection state: ${connectionState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
      return res.status(503).json({
        message: 'Database connection unavailable. Please check your MongoDB connection.',
        error: 'DATABASE_CONNECTION_ERROR',
        connectionState: connectionState
      });
    }

    const employeeId = req.user._id;
    const employeeIdObj = (mongoose.Types.ObjectId.isValid(employeeId))
      ? (employeeId instanceof mongoose.Types.ObjectId ? employeeId : new mongoose.Types.ObjectId(employeeId))
      : employeeId;
    const { status, limit = 50 } = req.query;

    // Get DCs assigned to this employee
    const filter = { employeeId: employeeIdObj };
    if (status) filter.status = status;

    // Use lean() for faster queries and only populate what's needed
    // Try a simpler query first without populate to see if we can get results faster
    // Use Promise.race to return data quickly even if query is slow
    // First try with minimal fields for speed
    const minimalQueryPromise = DC.find(filter)
      .select('_id dcOrderId customerName status productDetails createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .maxTimeMS(10000) // 10 seconds for minimal query
      .lean();

    const minimalTimeout = new Promise((resolve) => 
      setTimeout(() => resolve([]), 10000)
    );

    // Try minimal query first
    let dcs = await Promise.race([minimalQueryPromise, minimalTimeout]).catch(() => []);

    // If minimal query worked, try to get full data (but don't wait too long)
    if (dcs && dcs.length > 0) {
      try {
        const fullQueryPromise = DC.find({ _id: { $in: dcs.map(dc => dc._id) } })
          .select('saleId dcOrderId parentDcId clusterId dcType fulfillmentStatus employeeId customerName customerEmail customerAddress customerPhone product requestedQuantity status poPhotoUrl poDocument productDetails dcDate dcRemarks dcCategory dcNotes createdAt updatedAt')
          .maxTimeMS(5000) // 5 seconds for full query
          .lean();

        const fullTimeout = new Promise((resolve) => 
          setTimeout(() => resolve(dcs), 5000)
        );

        const fullData = await Promise.race([fullQueryPromise, fullTimeout]);
        if (fullData && fullData.length > 0) {
          dcs = fullData;
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch full DC data, using minimal data:', err.message);
        // Keep minimal dcs
      }
    } else {
      console.warn('⚠️ Minimal query also timed out or returned no results');
    }

    // If we got results, try to populate them (but don't fail if populate times out)
    // Use Promise.race to timeout populate quickly if it's slow
    if (dcs && dcs.length > 0) {
      try {
        const populatePromise = DC.find({ _id: { $in: dcs.map(dc => dc._id) } })
          .populate('saleId', 'customerName product quantity status poDocument')
          .populate('dcOrderId', 'school_name school_code contact_person contact_mobile email address location zone products dc_code status school_type')
          .populate('employeeId', 'name email')
          .populate('parentDcId', '_id dc_code status requestedQuantity deliverableQuantity fulfillmentStatus dcType')
          .maxTimeMS(8000) // Shorter timeout for populate
          .lean();
        
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve(dcs), 8000)
        );
        
        const populated = await Promise.race([populatePromise, timeoutPromise]);
        if (populated && populated.length > 0 && Array.isArray(populated)) {
          dcs = populated;
          console.log(`✅ Populated ${dcs.length} DCs successfully`);
        } else {
          console.warn('⚠️ Population timed out or failed, using unpopulated data');
        }
      } catch (popErr) {
        console.warn('⚠️ Population failed, using unpopulated data:', popErr.message);
        // Keep unpopulated dcs - they'll still work, just without populated fields
      }
    }

    // Also get DcOrders with 'saved' status assigned to this employee that don't have a DC yet
    // These are converted leads that should appear in "My Clients"
    const DcOrder = require('../models/DcOrder');
    // Use employeeIdObj so string/ObjectId from JWT matches DB
    const savedDcOrdersMinimalPromise = DcOrder.find({
      assigned_to: employeeIdObj,
      status: 'saved'
    })
      .select('_id school_name status createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .maxTimeMS(10000) // 10 seconds for minimal
      .lean();

    const savedDcOrdersMinimalTimeout = new Promise((resolve) => 
      setTimeout(() => resolve([]), 10000)
    );

    let savedDcOrders = await Promise.race([savedDcOrdersMinimalPromise, savedDcOrdersMinimalTimeout]).catch(() => []);

    // If minimal worked, try to get full data
    if (savedDcOrders && savedDcOrders.length > 0) {
      try {
        const savedDcOrdersFullPromise = DcOrder.find({
          _id: { $in: savedDcOrders.map(o => o._id) },
          assigned_to: employeeIdObj,
          status: 'saved'
        })
          .select('_id school_name school_code contact_person contact_mobile email address location zone products dc_code status school_type assigned_to created_by createdAt updatedAt pod_proof_url poChangeRequest')
          .maxTimeMS(5000) // 5 seconds for full
          .lean();

        const savedDcOrdersFullTimeout = new Promise((resolve) => 
          setTimeout(() => resolve(savedDcOrders), 5000)
        );

        const fullOrders = await Promise.race([savedDcOrdersFullPromise, savedDcOrdersFullTimeout]);
        if (fullOrders && fullOrders.length > 0) {
          savedDcOrders = fullOrders;
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch full DcOrder data, using minimal:', err.message);
        // Keep minimal savedDcOrders
      }
    }

    // Try to populate if we got results (but don't fail if it times out)
    if (savedDcOrders && savedDcOrders.length > 0) {
      try {
        const populatePromise = DcOrder.find({
          _id: { $in: savedDcOrders.map(o => o._id) },
          assigned_to: employeeIdObj,
          status: 'saved'
        })
          .populate('assigned_to', 'name email')
          .populate('created_by', 'name email')
          .maxTimeMS(8000) // Shorter timeout
          .lean();
        
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve(savedDcOrders), 8000)
        );
        
        const populatedOrders = await Promise.race([populatePromise, timeoutPromise]);
        if (populatedOrders && populatedOrders.length > 0 && Array.isArray(populatedOrders)) {
          savedDcOrders = populatedOrders;
          console.log(`✅ Populated ${savedDcOrders.length} DcOrders successfully`);
        } else {
          console.warn('⚠️ DcOrder population timed out, using unpopulated data');
        }
      } catch (popErr) {
        console.warn('⚠️ DcOrder population failed, using unpopulated data:', popErr.message);
        // Keep unpopulated savedDcOrders - they'll still work
      }
    }

    // Convert DcOrders to DC-like format for frontend compatibility
    // IMPORTANT: Include saved DcOrders even if they have a DC, but only if the DC doesn't have status 'created' or 'po_submitted'
    // This ensures closed leads always appear in "My Clients" for the employee to manage
    const dcOrderAsDCs = savedDcOrders.map(order => {
      // Check if a DC already exists for this DcOrder
      const existingDC = dcs.find(dc => {
        if (!dc.dcOrderId) return false;
        if (typeof dc.dcOrderId === 'object') {
          // Check if _id exists and is not null
          if (!dc.dcOrderId._id) return false;
          return dc.dcOrderId._id.toString() === order._id.toString();
        }
        return dc.dcOrderId.toString() === order._id.toString();
      });
      
      // If DC exists with status 'created' or 'po_submitted', skip this DcOrder (it's already in the dcs array and will be shown)
      if (existingDC && (existingDC.status === 'created' || existingDC.status === 'po_submitted')) {
        return null;
      }
      
      // If DC exists but with a different status (e.g., 'sent_to_manager', 'completed'), still show the DcOrder as 'created' in "My Clients"
      // This ensures closed leads always appear for the employee to manage, even if the DC has moved to a different workflow stage
      // The employee can still manage the client from "My Clients" page

      // Convert DcOrder to DC-like format
      return {
        _id: order._id, // Use DcOrder ID temporarily
        dcOrderId: {
          _id: order._id,
          school_name: order.school_name,
          school_code: order.school_code,
          dc_code: order.dc_code,
          contact_person: order.contact_person,
          contact_mobile: order.contact_mobile,
          email: order.email,
          products: order.products,
          status: order.status,
          school_type: order.school_type, // Include school_type for category determination
          createdAt: order.createdAt, // Include createdAt for client turned date
          poChangeRequest: order.poChangeRequest || null, // For "Request DC" lock when pending
        },
        employeeId: order.assigned_to ? (typeof order.assigned_to === 'object' && order.assigned_to._id ? order.assigned_to._id : (typeof order.assigned_to === 'string' ? order.assigned_to : employeeId)) : employeeId,
        customerName: order.school_name,
        customerEmail: order.email,
        customerAddress: order.address || order.location || 'N/A',
        customerPhone: order.contact_mobile || order.contact_person || 'N/A',
        product: order.products && order.products.length > 0 ? (order.products[0].product_name || 'Abacus') : 'Abacus',
        requestedQuantity: order.products ? order.products.reduce((sum, p) => sum + (p.quantity || 1), 0) : 1,
        status: 'created', // Convert saved DcOrder to 'created' status DC for display in "My Clients"
        poPhotoUrl: order.pod_proof_url || null,
        poDocument: order.pod_proof_url || null,
        productDetails: order.products ? order.products.map(p => ({
          product: p.product_name || 'Abacus',
          class: (p.class != null && String(p.class).trim() !== '') ? String(p.class).trim() : '1',
          category: order.school_type === 'Existing' ? 'Existing School' : 'New School', // Auto-determine category
          quantity: p.quantity || 1,
          strength: 0,
          price: p.unit_price || 0,
          total: (p.quantity || 1) * (p.unit_price || 0),
          level: p.level || 'L1',
          term: p.term || 'Term 1',
        })) : [],
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Add a flag to indicate this is a converted DcOrder (for frontend to handle appropriately)
        _isConvertedLead: true,
      };
    }).filter(dc => dc !== null); // Remove null entries (DCs that already exist with correct status)

    // Combine DCs and converted DcOrders, remove duplicates
    const allDCs = [...dcs, ...dcOrderAsDCs];
    
    // Remove duplicates based on dcOrderId
    const uniqueDCs = [];
    const seenDcOrderIds = new Set();
    
    allDCs.forEach(dc => {
      let dcOrderId = null;
      if (dc.dcOrderId) {
        if (typeof dc.dcOrderId === 'object') {
          // Check if _id exists and is not null before accessing
          if (dc.dcOrderId._id) {
            dcOrderId = dc.dcOrderId._id.toString();
          }
        } else {
          dcOrderId = dc.dcOrderId.toString();
        }
      }
      
      if (dcOrderId && !seenDcOrderIds.has(dcOrderId)) {
        seenDcOrderIds.add(dcOrderId);
        uniqueDCs.push(dc);
      } else if (!dcOrderId) {
        // DCs without dcOrderId (from Sale) - include them
        uniqueDCs.push(dc);
      }
    });

    res.json(uniqueDCs);
  } catch (error) {
    if (error.message && (error.message.includes('timeout') || error.message.includes('connection') || error.message.includes('ECONNREFUSED') || error.message.includes('maxTimeMS'))) {
      console.error('MongoDB connection/query error in getMyDCs:', error.message);
      if (error.message.includes('maxTimeMS')) {
        console.error('Query exceeded 30 second timeout. Consider adding indexes or reducing data scope.');
      }
      return res.status(503).json({
        message: error.message.includes('maxTimeMS')
          ? 'Query is taking too long. Please try again or contact support if the issue persists.'
          : 'Database connection failed. Please check your MongoDB connection settings.',
        error: 'DATABASE_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    console.error('Error in getMyDCs:', error);
    res.status(500).json({ message: error.message || 'Internal server error', error: 'INTERNAL_ERROR' });
  }
};

// @desc    Record shortage DC against a completed parent DC
// @route   POST /api/dc/:id/record-shortage
// @access  Private (Executive/Admin)
const recordShortageDC = async (req, res) => {
  try {
    if (!ALLOWED_SHORTAGE_ROLES.has(req.user?.role)) {
      return res.status(403).json({ message: 'You are not authorized to record shortage DCs' });
    }

    const parentDc = await DC.findById(req.params.id);
    if (!parentDc) {
      return res.status(404).json({ message: 'Parent DC not found' });
    }
    if (parentDc.status !== 'completed') {
      return res.status(400).json({ message: 'Shortage can only be recorded for completed DCs' });
    }

    req.body = {
      ...req.body,
      dcOrderId: String(parentDc.dcOrderId),
      parentDcId: parentDc._id,
      dcType: 'shortage',
      status: req.body.status || 'pending_dc',
      dcCategory: req.body.dcCategory || 'Shortage',
    };

    return raiseDC(req, res);
  } catch (error) {
    console.error('Error recording shortage DC:', error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update DC (for editing)
// @route   PUT /api/dc/:id
// @access  Private
const updateDC = async (req, res) => {
  try {
    const dc = await DC.findById(req.params.id);
    if (!dc) {
      return res.status(404).json({ message: 'DC not found' });
    }

    if (dc.status === 'completed' && hasQuantityFieldsInUpdate(req.body)) {
      const childShortageCount = await DC.countDocuments({ parentDcId: dc._id, dcType: 'shortage' });
      if (childShortageCount > 0) {
        return res.status(400).json({
          message: 'Quantity fields on a completed parent DC cannot be edited after shortage DC is raised.',
        });
      }
    }

    // Update fields from request body - only update provided fields
    if (req.body.dcDate !== undefined) {
      dc.dcDate = req.body.dcDate ? new Date(req.body.dcDate) : undefined;
    }
    if (req.body.dcRemarks !== undefined) dc.dcRemarks = req.body.dcRemarks;
    if (req.body.dcCategory !== undefined) dc.dcCategory = req.body.dcCategory;
    if (req.body.dcNotes !== undefined) dc.dcNotes = req.body.dcNotes;
    if (req.body.financeRemarks !== undefined) dc.financeRemarks = req.body.financeRemarks;
    if (req.body.splApproval !== undefined) dc.splApproval = req.body.splApproval;
    if (req.body.smeRemarks !== undefined) dc.smeRemarks = req.body.smeRemarks;
    if (req.body.productDetails !== undefined) {
      // Ensure productDetails is properly formatted with all fields
      if (Array.isArray(req.body.productDetails)) {
        dc.productDetails = normalizeProductDetails(req.body.productDetails, { isShortage: dc.dcType === 'shortage' });
        // Also update requestedQuantity if productDetails are provided
        if (dc.productDetails.length > 0) {
          const totalQuantity = calculateTotalQuantity(dc.productDetails);
          if (totalQuantity > 0) {
            dc.requestedQuantity = totalQuantity;
          }
        }
      } else {
        dc.productDetails = req.body.productDetails;
      }
    }
    if (req.body.requestedQuantity !== undefined) dc.requestedQuantity = req.body.requestedQuantity;
    if (req.body.status !== undefined) {
      dc.status = req.body.status;
      // When moving from hold to sent_to_manager (e.g. "Move to DC@Warehouse"), set timestamps so DC appears in DC @ Warehouse list
      if (req.body.status === 'sent_to_manager') {
        dc.sentToManagerAt = dc.sentToManagerAt || new Date();
        dc.managerRequestedAt = dc.managerRequestedAt || new Date();
        if (req.user && req.user._id) {
          dc.managerId = req.user._id;
          dc.managerRequestedBy = req.user._id;
        }
      }
    }
    if (req.body.listedAt !== undefined) {
      dc.listedAt = req.body.listedAt ? new Date(req.body.listedAt) : undefined;
    }
    if (req.body.availableQuantity !== undefined) dc.availableQuantity = req.body.availableQuantity;
    if (req.body.deliverableQuantity !== undefined) dc.deliverableQuantity = req.body.deliverableQuantity;
    if (req.body.holdReason !== undefined) dc.holdReason = req.body.holdReason;
    if (req.body.warehouseId !== undefined) dc.warehouseId = req.body.warehouseId;
    if (req.body.warehouseProcessedAt !== undefined) {
      dc.warehouseProcessedAt = req.body.warehouseProcessedAt ? new Date(req.body.warehouseProcessedAt) : undefined;
    }
    if (req.body.completedAt !== undefined) {
      dc.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : undefined;
    }
    // If status is being set to completed, set completedAt if not provided
    if (req.body.status === 'completed' && !dc.completedAt) {
      dc.completedAt = new Date();
    }
    // Update PO photo if provided (for editing submitted PO)
    if (req.body.poPhotoUrl !== undefined) {
      dc.poPhotoUrl = req.body.poPhotoUrl;
    }
    if (req.body.poDocument !== undefined) {
      dc.poDocument = req.body.poDocument;
    }
    if (req.body.deliveryNotes !== undefined) dc.deliveryNotes = req.body.deliveryNotes;
    if (req.body.transport !== undefined) dc.transport = req.body.transport;
    if (req.body.lrNo !== undefined) dc.lrNo = req.body.lrNo;
    if (req.body.lrDate !== undefined) {
      dc.lrDate = req.body.lrDate ? new Date(req.body.lrDate) : undefined;
    }
    if (req.body.boxes !== undefined) dc.boxes = req.body.boxes;
    if (req.body.transportArea !== undefined) dc.transportArea = req.body.transportArea;
    if (req.body.deliveryStatus !== undefined) dc.deliveryStatus = req.body.deliveryStatus;
    
    // Save without validating required fields that might not be present during update
    await dc.save({ validateBeforeSave: false });

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('dcOrderId', 'school_name school_code dc_code contact_person contact_mobile email address location zone products due_amount due_percentage')
      .populate('parentDcId', '_id dc_code status requestedQuantity deliverableQuantity fulfillmentStatus dcType')
      .populate('employeeId', 'name email')
      .populate('adminId', 'name email')
      .populate('managerId', 'name email')
      .populate('warehouseId', 'name email');

    res.json(populatedDC);
  } catch (error) {
    console.error('Error updating DC:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export sales visit report to Excel
// @route   GET /api/dc/export-sales-visit
// @access  Private
const exportSalesVisit = async (req, res) => {
  try {
    const { zone, employeeId, schoolName, schoolCode, contactMobile, fromDate, toDate, visitCategory } = req.query;
    const filter = {};

    if (employeeId) filter.employeeId = employeeId;
    if (visitCategory) filter.dcCategory = visitCategory;
    
    if (fromDate || toDate) {
      const dateFilter = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) dateFilter.$lte = new Date(toDate + 'T23:59:59.999Z');
      filter.$or = [
        { dcDate: dateFilter },
        { createdAt: dateFilter }
      ];
    }

    const dcs = await DC.find(filter)
      .populate('saleId', 'customerName product quantity status')
      .populate('dcOrderId', 'school_name school_code school_type contact_person contact_mobile email address location zone products dc_code')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Apply client-side filters
    let filteredDCs = dcs;
    
    if (zone) {
      filteredDCs = filteredDCs.filter(dc => 
        (dc.dcOrderId && dc.dcOrderId.zone && dc.dcOrderId.zone.toLowerCase().includes(zone.toLowerCase())) ||
        (dc.saleId && dc.saleId.zone && dc.saleId.zone.toLowerCase().includes(zone.toLowerCase()))
      );
    }
    
    if (schoolName) {
      filteredDCs = filteredDCs.filter(dc => 
        (dc.dcOrderId && dc.dcOrderId.school_name && dc.dcOrderId.school_name.toLowerCase().includes(schoolName.toLowerCase())) ||
        (dc.customerName && dc.customerName.toLowerCase().includes(schoolName.toLowerCase()))
      );
    }
    
    if (schoolCode) {
      const q = schoolCode.toLowerCase();
      filteredDCs = filteredDCs.filter(dc => {
        if (!dc.dcOrderId) return false;
        const code = (dc.dcOrderId.school_code || dc.dcOrderId.dc_code || '').toLowerCase();
        return code.includes(q);
      });
    }
    
    if (contactMobile) {
      filteredDCs = filteredDCs.filter(dc => 
        (dc.dcOrderId && dc.dcOrderId.contact_mobile && dc.dcOrderId.contact_mobile.includes(contactMobile)) ||
        (dc.customerPhone && dc.customerPhone.includes(contactMobile))
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Visit Report');

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'School Code', key: 'schoolCode', width: 15 },
      { header: 'School Type', key: 'schoolType', width: 15 },
      { header: 'School Name', key: 'schoolName', width: 30 },
      { header: 'Zone', key: 'zone', width: 15 },
      { header: 'Executive', key: 'executive', width: 25 },
      { header: 'Town', key: 'town', width: 30 },
      { header: 'Visit Category', key: 'visitCategory', width: 20 },
      { header: 'Visit Remarks', key: 'visitRemarks', width: 40 },
      { header: 'Visit Date', key: 'visitDate', width: 20 },
    ];

    // Add data
    filteredDCs.forEach((dc, index) => {
      const schoolName = dc.dcOrderId?.school_name || dc.customerName || '';
      const schoolCode = dc.dcOrderId?.dc_code || '';
      const schoolType = dc.dcOrderId?.school_type || (dc.dcOrderId ? 'Existing' : 'New');
      const zone = dc.dcOrderId?.zone || '';
      const executive = dc.employeeId?.name || dc.createdBy?.name || 'Not Assigned';
      const town = dc.dcOrderId?.location || dc.customerAddress || '';
      const visitCategory = dc.dcCategory || '';
      const visitRemarks = dc.dcRemarks || dc.dcNotes || '';
      const visitDate = dc.dcDate || dc.createdAt || new Date();
      
      worksheet.addRow({
        sno: index + 1,
        schoolCode: schoolCode,
        schoolType: schoolType,
        schoolName: schoolName,
        zone: zone,
        executive: executive,
        town: town,
        visitCategory: visitCategory,
        visitRemarks: visitRemarks,
        visitDate: new Date(visitDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
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
    res.setHeader('Content-Disposition', `attachment; filename=Sales_Visit_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload PO document (image or PDF)
// @route   POST /api/dc/upload-po
// @access  Private
const uploadPO = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Save relative URL so it remains valid across host/port changes.
    const fileUrl = `/uploads/po/${req.file.filename}`;

    res.json({
      message: 'PO document uploaded successfully',
      poPhotoUrl: fileUrl,
      url: fileUrl, // Alias for backward compatibility
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error uploading PO document:', error);
    res.status(500).json({ message: error.message || 'Failed to upload PO document' });
  }
};

// @desc    Download a PO file from uploads/po (authenticated; avoids static /uploads 403 in browsers)
// @route   GET /api/dc/po-file?path=po/<filename>
// @access  Private
const servePoUpload = (req, res) => {
  try {
    const rel = req.query.path;
    if (!rel || typeof rel !== 'string') {
      return res.status(400).json({ message: 'Missing path' });
    }
    const m = /^po\/([^/\\]+)$/.exec(rel.trim());
    if (!m) {
      return res.status(400).json({ message: 'Invalid path' });
    }
    const filename = m[1];
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).json({ message: 'Invalid filename' });
    }
    const abs = path.join(__dirname, '../uploads/po', filename);
    const root = path.resolve(path.join(__dirname, '../uploads/po'));
    const resolved = path.resolve(abs);
    if (!resolved.startsWith(root)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.sendFile(resolved);
  } catch (error) {
    console.error('servePoUpload:', error);
    res.status(500).json({ message: error.message || 'Failed to serve file' });
  }
};

module.exports = {
  getDCs,
  getDC,
  raiseDC,
  requestWarehouse,
  warehouseSubmit,
  deliverySubmit,
  completeDC,
  holdDC,
  getPendingDCs,
  getWarehouseDCs,
  getEmployeeDCs,
  getCompletedDCs,
  getHoldDCs,
  employeeStats,
  submitPO,
  adminReviewPO,
  managerRequestWarehouse,
  warehouseProcess,
  getPOSubmittedDCs,
  getSentToManagerDCs,
  getPendingWarehouseDCs,
  getMyDCs,
  recordShortageDC,
  updateDC,
  submitDCToManager,
  exportSalesVisit,
  uploadPO,
  uploadPOMiddleware: upload.single('poPhoto'),
  servePoUpload,
};
