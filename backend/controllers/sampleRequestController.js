const SampleRequest = require('../models/SampleRequest');
const EmpDC = require('../models/EmpDC');
const DC = require('../models/DC');
const DcOrder = require('../models/DcOrder');

function mapProductsToDcDetails(products) {
  return products.map((p) => ({
    product: p.product_name || p.product,
    class: p.class || '1',
    productCategory: p.productCategory,
    specs: p.specs || 'Regular',
    quantity: Number(p.quantity) || 0,
    strength: Number(p.strength) || Number(p.quantity) || 0,
    level: p.level || 'L1',
    term: 'Term 1',
  }));
}

function buildCustomerAddress(sr) {
  const parts = [
    sr.property_number,
    sr.floor,
    sr.tower_block,
    sr.nearby_landmark,
    sr.area,
    sr.city,
    sr.address,
    sr.location,
    sr.pincode,
  ]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean);
  return parts.join(', ') || sr.address || 'N/A';
}

async function ensureDcOrderForSample(sr) {
  if (sr.dc_order_id) {
    const existing = await DcOrder.findById(sr.dc_order_id);
    if (existing) {
      await DcOrder.findByIdAndUpdate(sr.dc_order_id, {
        $set: {
          transport_name: sr.transport_name,
          transport_location: sr.transport_location,
          transportation_landmark: sr.transportation_landmark,
          pincode: sr.pincode,
          property_number: sr.property_number,
          floor: sr.floor,
          tower_block: sr.tower_block,
          nearby_landmark: sr.nearby_landmark,
          area: sr.area,
          city: sr.city,
        },
      });
      return sr.dc_order_id;
    }
  }

  const order = await DcOrder.create({
    school_name: sr.school_name,
    contact_person: sr.contact_person,
    contact_mobile: sr.contact_mobile,
    address: sr.address,
    location: sr.location,
    zone: sr.zone,
    pincode: sr.pincode,
    property_number: sr.property_number,
    floor: sr.floor,
    tower_block: sr.tower_block,
    nearby_landmark: sr.nearby_landmark,
    area: sr.area,
    city: sr.city,
    transport_name: sr.transport_name,
    transport_location: sr.transport_location,
    transportation_landmark: sr.transportation_landmark,
    products: sr.products.map((p) => ({
      product_name: p.product_name,
      quantity: p.quantity,
      class: p.class || '1',
      specs: p.specs,
      strength: p.strength,
      level: p.level,
      productCategory: p.productCategory,
    })),
    status: 'saved',
    assigned_to: sr.employee_id,
  });
  return order._id;
}

// @desc    Create sample request (by Employee)
// @route   POST /api/sample-requests
const createSampleRequest = async (req, res) => {
  try {
    const {
      products,
      productDetails,
      purpose,
      school_name,
      dc_order_id,
      contact_person,
      contact_mobile,
      address,
      location,
      zone,
      property_number,
      floor,
      tower_block,
      nearby_landmark,
      area,
      city,
      pincode,
      transport_name,
      transport_location,
      transportation_landmark,
    } = req.body;

    const lines =
      Array.isArray(productDetails) && productDetails.length > 0
        ? productDetails
        : products;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: 'At least one product is required' });
    }

    if (!school_name || !String(school_name).trim()) {
      return res.status(400).json({ message: 'School name is required' });
    }

    if (!transport_name?.trim() || !transport_location?.trim() || !pincode?.trim()) {
      return res.status(400).json({
        message: 'Transport name, transport location, and pincode are required',
      });
    }

    const normalizedProducts = [];
    for (const line of lines) {
      const name = line.product_name || line.product;
      const qty = Number(line.quantity);
      if (!name || !qty || qty < 1) {
        return res.status(400).json({
          message: 'Each product must have a name and quantity >= 1',
        });
      }
      normalizedProducts.push({
        product_name: name,
        quantity: qty,
        class: line.class || '1',
        productCategory: line.productCategory,
        specs: line.specs || 'Regular',
        strength: Number(line.strength) || qty,
        level: line.level || 'L1',
      });
    }

    const sampleRequest = await SampleRequest.create({
      employee_id: req.user._id,
      products: normalizedProducts,
      purpose: purpose || 'To show schools',
      school_name: String(school_name).trim(),
      dc_order_id: dc_order_id || undefined,
      contact_person,
      contact_mobile,
      address,
      location,
      zone,
      property_number,
      floor,
      tower_block,
      nearby_landmark,
      area,
      city,
      pincode,
      transport_name,
      transport_location,
      transportation_landmark,
      status: 'Pending',
    });

    const populated = await SampleRequest.findById(sampleRequest._id)
      .populate('employee_id', 'name email')
      .populate('dc_order_id', 'school_name school_code');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get sample requests (for Employee - their own requests)
// @route   GET /api/sample-requests/my
const getMySampleRequests = async (req, res) => {
  try {
    const requests = await SampleRequest.find({ employee_id: req.user._id })
      .populate('employee_id', 'name email')
      .populate('accepted_by', 'name email')
      .populate('rejected_by', 'name email')
      .populate('dc_id', 'dc_code status customerName')
      .populate('dc_order_id', 'school_name school_code')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get one sample request
// @route   GET /api/sample-requests/:id
const getSampleRequestById = async (req, res) => {
  try {
    const request = await SampleRequest.findById(req.params.id)
      .populate('employee_id', 'name email')
      .populate('accepted_by', 'name email')
      .populate('rejected_by', 'name email')
      .populate('dc_id', 'dc_code status customerName')
      .populate('dc_order_id', 'school_name school_code contact_mobile')
      .populate('emp_dc_id', 'emp_dc_code status');

    if (!request) {
      return res.status(404).json({ message: 'Sample request not found' });
    }

    if (
      String(request.employee_id?._id || request.employee_id) !== String(req.user._id) &&
      !['Admin', 'Super Admin', 'Manager', 'Warehouse'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pending sample requests (for Employee DC page)
// @route   GET /api/sample-requests/pending
const getPendingSampleRequests = async (req, res) => {
  try {
    const requests = await SampleRequest.find({ status: 'Pending' })
      .populate('employee_id', 'name email')
      .populate('dc_order_id', 'school_name zone')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept sample request → EmpDC + DC @ warehouse (sent_to_manager)
// @route   PUT /api/sample-requests/:id/accept
const acceptSampleRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const sampleRequest = await SampleRequest.findById(id);
    if (!sampleRequest) {
      return res.status(404).json({ message: 'Sample request not found' });
    }

    if (sampleRequest.status !== 'Pending') {
      return res.status(400).json({ message: 'Sample request is not pending' });
    }

    const dcOrderId = await ensureDcOrderForSample(sampleRequest);
    const productDetails = mapProductsToDcDetails(sampleRequest.products);
    const totalQty = productDetails.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const primaryProduct = productDetails[0]?.product || 'Sample';

    const schoolLabel = sampleRequest.school_name || sampleRequest.purpose || 'Sample';

    const sampleDC = await DC.create({
      dcOrderId,
      employeeId: sampleRequest.employee_id,
      customerName: schoolLabel,
      customerPhone: sampleRequest.contact_mobile || '0000000000',
      customerAddress: buildCustomerAddress(sampleRequest),
      product: primaryProduct,
      requestedQuantity: totalQty,
      productDetails,
      status: 'sent_to_manager',
      dcCategory: 'Sample',
      dcRemarks: sampleRequest.purpose,
      dcNotes: `Sample request ${sampleRequest.request_code}`,
      sentToManagerAt: new Date(),
      managerRequestedAt: new Date(),
      managerId: req.user._id,
      managerRequestedBy: req.user._id,
    });

    const empDC = await EmpDC.create({
      emp_dc_code: `SAMPLE-${Date.now().toString().slice(-6)}`,
      employee_id: sampleRequest.employee_id,
      kit_type: 'Sales',
      distribution_date: new Date(),
      products: sampleRequest.products.map((p) => ({
        product: p.product_name,
        quantity: p.quantity,
      })),
      status: 'active',
      created_by: req.user._id,
    });

    sampleRequest.status = 'Accepted';
    sampleRequest.accepted_at = new Date();
    sampleRequest.accepted_by = req.user._id;
    sampleRequest.emp_dc_id = empDC._id;
    sampleRequest.dc_id = sampleDC._id;
    sampleRequest.dc_order_id = dcOrderId;
    await sampleRequest.save();

    const populated = await SampleRequest.findById(sampleRequest._id)
      .populate('employee_id', 'name email')
      .populate('accepted_by', 'name email')
      .populate('emp_dc_id')
      .populate('dc_id', 'dc_code status');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject sample request
// @route   PUT /api/sample-requests/:id/reject
const rejectSampleRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const sampleRequest = await SampleRequest.findById(id);
    if (!sampleRequest) {
      return res.status(404).json({ message: 'Sample request not found' });
    }

    if (sampleRequest.status !== 'Pending') {
      return res.status(400).json({ message: 'Sample request is not pending' });
    }

    sampleRequest.status = 'Rejected';
    sampleRequest.rejected_at = new Date();
    sampleRequest.rejected_by = req.user._id;
    if (rejection_reason) {
      sampleRequest.rejection_reason = rejection_reason;
    }
    await sampleRequest.save();

    const populated = await SampleRequest.findById(sampleRequest._id)
      .populate('employee_id', 'name email')
      .populate('rejected_by', 'name email');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get accepted sample requests
// @route   GET /api/sample-requests/accepted
const getAcceptedSampleRequests = async (req, res) => {
  try {
    const requests = await SampleRequest.find({ status: 'Accepted' })
      .populate('employee_id', 'name email')
      .populate('accepted_by', 'name email')
      .populate('emp_dc_id')
      .populate('dc_id', 'dc_code status')
      .sort({ accepted_at: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSampleRequest,
  getMySampleRequests,
  getSampleRequestById,
  getPendingSampleRequests,
  acceptSampleRequest,
  rejectSampleRequest,
  getAcceptedSampleRequests,
};
