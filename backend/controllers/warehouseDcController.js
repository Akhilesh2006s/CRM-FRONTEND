const DcOrder = require('../models/DcOrder');
const Lead = require('../models/Lead');
const DC = require('../models/DC');

// Helper to transform DcOrder/Lead to warehouse DC format
function transformToWarehouseDC(doc) {
  if (doc.toObject) doc = doc.toObject();
  
  // Transform products array to items array
  let items = [];
  if (doc.items && Array.isArray(doc.items)) {
    items = doc.items;
  } else if (doc.products && Array.isArray(doc.products)) {
    items = doc.products.map((p) => {
      const prod = p.toObject ? p.toObject() : p;
      return {
        product: prod.product || prod.product_name || '',
        class: prod.class || 0,
        category: prod.category || '',
        productName: prod.productName || prod.product_name || prod.product || '',
        qty: prod.qty || prod.quantity || 0,
        whQty: prod.whQty || prod.whQty || 0,
      };
    });
  }
  
  return {
    _id: doc._id,
    dcNo: doc.dc_code || doc.dcNo || `DC-${doc._id.toString().slice(-6)}`,
    dcDate: doc.createdAt || doc.dcDate || new Date(),
    dcCategory: doc.dcCategory || 'Term 2',
    dcFinYear: doc.dcFinYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1).toString().slice(-2),
    schoolName: doc.school_name || doc.customerName || doc.schoolName || '',
    schoolCode: doc.school_code || doc.schoolCode || '',
    contactPersonName: doc.contact_person || doc.contactPersonName || '',
    contactMobile: doc.contact_mobile || doc.contactMobile || '',
    town: doc.town || '',
    address: doc.address || doc.location || doc.customerAddress || '',
    zone: doc.zone || '',
    cluster: doc.cluster_code || doc.cluster || '',
    executive: doc.executive || (doc.assigned_to?.name || doc.assigned_to?.email || '') || (doc.created_by?.name || doc.created_by?.email || '') || (doc.createdBy?.name || ''),
    dcRemarks: doc.dcRemarks || doc.remarks || '',
    products: doc.products?.map(p => {
      const prod = p.toObject ? p.toObject() : p;
      return prod.product_name || prod.product || '';
    }).join(', ') || '',
    items: items,
    hold: doc.hold || doc.status === 'hold',
    smeFin: doc.smeFin || '',
    schoolType: doc.school_type || doc.schoolType || '',
    remarks: doc.remarks || '',
    dcNotes: doc.dcNotes || '',
  };
}

// @desc    Get warehouse DC list
// @route   GET /api/warehouse/dc/list
// @access  Private
const getWarehouseDCList = async (req, res) => {
  try {
    const { 
      zone, 
      employee, 
      schoolCode, 
      schoolName, 
      dcNo,
      fromDate,
      toDate,
      hold,
    } = req.query;
    
    const filter = {};
    if (zone) filter.zone = { $regex: zone, $options: 'i' };
    if (schoolCode) filter.school_code = { $regex: schoolCode, $options: 'i' };
    if (schoolName) filter.school_name = { $regex: schoolName, $options: 'i' };
    if (dcNo) filter.dc_code = { $regex: dcNo, $options: 'i' };
    if (hold !== undefined) {
      if (hold === 'true' || hold === true) {
        filter.status = 'hold';
      } else {
        filter.status = { $ne: 'hold' };
      }
    }
    
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Fetch from DcOrder model - optimize for performance with timeout protection
    let dcOrders = [];
    try {
      // First fetch without populate
      dcOrders = await DcOrder.find(filter)
        .select('_id dc_code school_name contact_person contact_mobile email address location zone cluster_code products status school_type assigned_to created_by createdAt updatedAt pod_proof_url')
        .sort({ createdAt: -1 })
        .lean()
        .maxTimeMS(20000); // 20 second timeout

      // Populate if we got results (but don't fail if it times out)
      if (dcOrders && dcOrders.length > 0) {
        try {
          const populatedPromise = DcOrder.find({ _id: { $in: dcOrders.map(o => o._id) } })
            .populate('created_by', 'name email')
            .populate('assigned_to', 'name email')
            .sort({ createdAt: -1 })
            .maxTimeMS(15000)
            .lean();
          
          const populatedTimeout = new Promise((resolve) => 
            setTimeout(() => resolve(dcOrders), 15000)
          );
          
          const populated = await Promise.race([populatedPromise, populatedTimeout]);
          if (populated && populated.length > 0 && Array.isArray(populated)) {
            dcOrders = populated;
          }
        } catch (popErr) {
          console.warn('Population failed for warehouse DC list, using unpopulated data:', popErr.message);
          // Keep unpopulated dcOrders
        }
      }
    } catch (queryErr) {
      // If query times out or fails, return empty array instead of 500 error
      console.error('Query failed for warehouse DC list:', queryErr.message);
      if (queryErr.message && queryErr.message.includes('timed out')) {
        console.warn('Query timed out, returning empty array');
        return res.json([]);
      }
      throw queryErr; // Re-throw if it's not a timeout
    }

    const transformed = dcOrders.map(transformToWarehouseDC);
    console.log(`Returning ${transformed.length} warehouse DCs`);
    res.json(transformed);
  } catch (error) {
    console.error('Error in getWarehouseDCList:', error);
    // Return empty array on error to prevent frontend from breaking
    res.json([]);
  }
};

// @desc    Get single warehouse DC
// @route   GET /api/warehouse/dc/:id
// @access  Private
const getWarehouseDC = async (req, res) => {
  try {
    const dcOrder = await DcOrder.findById(req.params.id)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email');

    if (!dcOrder) {
      return res.status(404).json({ message: 'DC not found' });
    }

    const transformed = transformToWarehouseDC(dcOrder);
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update warehouse DC
// @route   PUT /api/warehouse/dc/:id
// @access  Private
const updateWarehouseDC = async (req, res) => {
  try {
    const {
      schoolName,
      schoolCode,
      contactPersonName,
      contactMobile,
      town,
      address,
      zone,
      cluster,
      cluster_code,
      schoolType,
      school_type,
      dcNo,
      dc_code,
      remarks,
      dcNotes,
      dcRemarks,
      items,
      fullItems,
    } = req.body;

    const updateData = {};
    if (schoolName !== undefined) updateData.school_name = schoolName;
    if (schoolCode !== undefined) updateData.school_code = schoolCode;
    if (contactPersonName !== undefined) updateData.contact_person = contactPersonName;
    if (contactMobile !== undefined) updateData.contact_mobile = contactMobile;
    if (town !== undefined) updateData.town = town;
    if (address !== undefined) updateData.address = address;
    if (zone !== undefined) updateData.zone = zone;
    const clusterVal = cluster_code !== undefined ? cluster_code : cluster;
    if (clusterVal !== undefined) updateData.cluster_code = clusterVal;
    const schoolTypeVal = school_type !== undefined ? school_type : schoolType;
    if (schoolTypeVal !== undefined) updateData.school_type = schoolTypeVal;
    const dcCodeVal = dc_code !== undefined ? dc_code : dcNo;
    if (dcCodeVal !== undefined) updateData.dc_code = dcCodeVal;
    if (remarks !== undefined) updateData.remarks = remarks;

    // Handle items if provided
    if (fullItems && Array.isArray(items)) {
      updateData.products = items.map(it => ({
        product_name: it.product || it.productName || '',
        quantity: it.qty || it.quantity || 0,
        unit_price: 0,
        class: it.class || 0,
        category: it.category || '',
      }));
      // Also store in items field if needed
      updateData.items = items;
    } else if (Array.isArray(items)) {
      // Only update whQty - merge with existing
      const existing = await DcOrder.findById(req.params.id);
      if (existing && existing.products) {
        updateData.products = existing.products.map((p, idx) => {
          const prod = p.toObject ? p.toObject() : p;
          const item = items[idx] || {};
          return {
            ...prod,
            quantity: item.whQty !== undefined ? item.whQty : (prod.quantity || prod.qty || 0),
          };
        });
        updateData.items = existing.products.map((p, idx) => {
          const prod = p.toObject ? p.toObject() : p;
          const item = items[idx] || {};
          return {
            product: prod.product || prod.product_name || '',
            class: item.class !== undefined ? item.class : (prod.class || 0),
            category: item.category !== undefined ? item.category : (prod.category || ''),
            productName: prod.productName || prod.product_name || prod.product || '',
            qty: prod.qty || prod.quantity || 0,
            whQty: item.whQty !== undefined ? item.whQty : (prod.whQty || 0),
          };
        });
      }
    }

    const dcOrder = await DcOrder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email');

    if (!dcOrder) {
      return res.status(404).json({ message: 'DC not found' });
    }

    const transformed = transformToWarehouseDC(dcOrder);
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle hold status on warehouse DC
// @route   POST /api/warehouse/dc/:id/hold
// @access  Private
const toggleHoldDC = async (req, res) => {
  try {
    const dcOrder = await DcOrder.findById(req.params.id);
    if (!dcOrder) {
      return res.status(404).json({ message: 'DC not found' });
    }

    // Toggle hold status
    if (dcOrder.status === 'hold') {
      dcOrder.status = 'pending';
      dcOrder.hold = false;
    } else {
      dcOrder.status = 'hold';
      dcOrder.hold = true;
    }

    await dcOrder.save();

    const transformed = transformToWarehouseDC(dcOrder);
    res.json(transformed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get hold DC list
// @route   GET /api/warehouse/hold-dc/list
// @access  Private
const getHoldDCList = async (req, res) => {
  try {
    const dcOrders = await DcOrder.find({ status: 'hold' })
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .sort({ createdAt: -1 });

    const transformed = dcOrders.map(doc => {
      const dc = transformToWarehouseDC(doc);
      return {
        ...dc,
        holdRemarks: doc.remarks || '',
      };
    });

    res.json(transformed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Move DcOrder from hold to DC @ Warehouse (release hold + ensure DC exists with sent_to_manager so it appears in DC @ Warehouse list)
// @route   POST /api/warehouse/dc-order/:id/move-to-warehouse
// @access  Private
const moveDcOrderToWarehouse = async (req, res) => {
  try {
    const dcOrder = await DcOrder.findById(req.params.id)
      .populate('assigned_to', 'name email')
      .populate('created_by', 'name email');
    if (!dcOrder) {
      return res.status(404).json({ message: 'DcOrder not found' });
    }
    if (dcOrder.status !== 'hold') {
      return res.status(400).json({ message: `DcOrder is not on hold. Current status: ${dcOrder.status}` });
    }

    // Release hold on DcOrder
    dcOrder.status = 'pending';
    dcOrder.hold = false;
    await dcOrder.save();

    // Find or create DC so it appears in DC @ Warehouse (GET /dc/pending-warehouse)
    let dc = await DC.findOne({ dcOrderId: dcOrder._id });
    const now = new Date();
    const userId = req.user && req.user._id;

    if (dc) {
      dc.status = 'sent_to_manager';
      dc.sentToManagerAt = dc.sentToManagerAt || now;
      dc.managerRequestedAt = dc.managerRequestedAt || now;
      if (userId) {
        dc.managerId = userId;
        dc.managerRequestedBy = userId;
      }
      dc.holdReason = undefined;
      await dc.save({ validateBeforeSave: false });
    } else {
      const productName = (dcOrder.products && dcOrder.products[0] && dcOrder.products[0].product_name) ? dcOrder.products[0].product_name : 'Abacus';
      const requestedQuantity = (dcOrder.products && Array.isArray(dcOrder.products))
        ? dcOrder.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0) || 1
        : 1;
      const employeeId = dcOrder.assigned_to
        ? (typeof dcOrder.assigned_to === 'object' ? dcOrder.assigned_to._id : dcOrder.assigned_to)
        : (dcOrder.created_by ? (typeof dcOrder.created_by === 'object' ? dcOrder.created_by._id : dcOrder.created_by) : userId);
      if (!employeeId) {
        return res.status(400).json({ message: 'DcOrder must have assigned_to or created_by to create DC.' });
      }
      const productDetails = (dcOrder.products && Array.isArray(dcOrder.products))
        ? dcOrder.products.map((p) => {
          const q = Number(p.quantity) || 0;
          const price = Number(p.unit_price) || 0;
          return {
            product: p.product_name || '',
            class: (p.class || '1').toString(),
            category: p.category || 'New Students',
            productName: p.product_name || '',
            quantity: q,
            strength: q,
            price,
            total: price * q,
            level: 'L2',
            specs: 'Regular',
            subject: undefined,
            term: p.term || 'Term 1',
          };
        })
        : undefined;

      dc = await DC.create({
        dcOrderId: dcOrder._id,
        employeeId,
        customerName: dcOrder.school_name || 'Unknown',
        customerEmail: dcOrder.email || undefined,
        customerAddress: dcOrder.address || dcOrder.location || 'N/A',
        customerPhone: dcOrder.contact_mobile || dcOrder.contact_person || 'N/A',
        product: productName,
        requestedQuantity,
        deliverableQuantity: 0,
        status: 'sent_to_manager',
        sentToManagerAt: now,
        managerRequestedAt: now,
        managerId: userId,
        managerRequestedBy: userId,
        createdBy: userId,
        productDetails: productDetails || undefined,
      });
    }

    const populatedDC = await DC.findById(dc._id)
      .populate('saleId', 'customerName product quantity status poDocument')
      .populate('dcOrderId', 'school_name contact_person contact_mobile zone location')
      .populate('employeeId', 'name email')
      .populate('managerId', 'name email')
      .populate('managerRequestedBy', 'name email');

    res.json(populatedDC);
  } catch (error) {
    console.error('Error moveDcOrderToWarehouse:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getWarehouseDCList,
  getWarehouseDC,
  updateWarehouseDC,
  toggleHoldDC,
  getHoldDCList,
  moveDcOrderToWarehouse,
};

