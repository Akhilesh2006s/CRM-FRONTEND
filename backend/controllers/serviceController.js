const Service = require('../models/Service');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// @desc    Get all services with filters
// @route   GET /api/services
// @access  Private
const getServices = async (req, res) => {
  try {
    const { status, trainerId, employeeId, zone, schoolCode, schoolName, fromDate, toDate } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (trainerId) filter.trainerId = trainerId;
    if (employeeId) filter.employeeId = employeeId;
    if (zone) filter.zone = zone;
    if (schoolCode) filter.schoolCode = { $regex: schoolCode, $options: 'i' };
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: 'i' };
    if (fromDate || toDate) {
      filter.serviceDate = {};
      if (fromDate) filter.serviceDate.$gte = new Date(fromDate);
      if (toDate) filter.serviceDate.$lte = new Date(toDate);
    }

    const services = await Service.find(filter)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ serviceDate: -1 });

    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single service
// @route   GET /api/services/:id
// @access  Private
const getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create service
// @route   POST /api/services/create
// @access  Private
const createService = async (req, res) => {
  try {
    // Prepare service data - only include schoolCode if it's provided and not empty
    const serviceData = {
      ...req.body,
      createdBy: req.user._id,
    };
    
    // Remove schoolCode if it's an empty string
    if (serviceData.schoolCode === '' || serviceData.schoolCode === null || serviceData.schoolCode === undefined) {
      delete serviceData.schoolCode;
    }
    
    const service = await Service.create(serviceData);

    const populatedService = await Service.findById(service._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    res.status(201).json(populatedService);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private
const updateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel service
// @route   PUT /api/services/:id/cancel
// @access  Private
const cancelService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { status: 'Cancelled' },
      { new: true }
    )
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email');

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get service statistics
// @route   GET /api/services/stats
// @access  Private
const getServiceStats = async (req, res) => {
  try {
    const { fromDate, toDate, zone } = req.query;
    const matchFilter = {};
    
    if (fromDate || toDate) {
      matchFilter.serviceDate = {};
      if (fromDate) matchFilter.serviceDate.$gte = new Date(fromDate);
      if (toDate) matchFilter.serviceDate.$lte = new Date(toDate);
    }
    if (zone) matchFilter.zone = zone;

    const stats = await Service.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Service.countDocuments(matchFilter);
    const byStatus = {
      Scheduled: 0,
      Completed: 0,
      Cancelled: 0,
    };

    stats.forEach((stat) => {
      if (stat._id && byStatus.hasOwnProperty(stat._id)) {
        byStatus[stat._id] = stat.count;
      }
    });

    // Zone-wise distribution
    const zoneStats = await Service.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$zone',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Subject-wise distribution
    const subjectStats = await Service.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$subject',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      total,
      byStatus,
      zoneStats,
      subjectStats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get services assigned to logged-in trainer (active/upcoming)
// @route   GET /api/services/trainer/my
// @access  Private (Trainer only)
const getMyServices = async (req, res) => {
  try {
    const trainerId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get services that are scheduled and not completed/cancelled
    const services = await Service.find({
      trainerId,
      status: { $in: ['Scheduled'] },
    })
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ serviceDate: 1 }); // Sort by date ascending (upcoming first)

    // Auto-complete services where date has passed
    const updatePromises = services
      .filter(service => {
        const serviceDate = new Date(service.serviceDate);
        serviceDate.setHours(0, 0, 0, 0);
        return serviceDate < today;
      })
      .map(service => {
        service.status = 'Completed';
        service.completionDate = new Date();
        return service.save();
      });

    await Promise.all(updatePromises);

    // Fetch updated services
    const updatedServices = await Service.find({
      trainerId,
      status: { $in: ['Scheduled'] },
    })
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ serviceDate: 1 });

    res.json(updatedServices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get completed services for logged-in trainer
// @route   GET /api/services/trainer/completed
// @access  Private (Trainer only)
const getMyCompletedServices = async (req, res) => {
  try {
    const trainerId = req.user._id;
    
    const services = await Service.find({
      trainerId,
      status: 'Completed',
    })
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ completionDate: -1 }); // Sort by completion date descending

    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark attendance for service
// @route   POST /api/services/:id/mark-attendance
// @access  Private (Trainer only)
const markServiceAttendance = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Verify trainer owns this service
    if (service.trainerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to mark attendance for this service' });
    }
    
    // Mark attendance for today
    service.attendanceDate = new Date();
    await service.save();
    
    const populatedService = await Service.findById(service._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');
    
    res.json(populatedService);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark service as completed
// @route   POST /api/services/:id/complete
// @access  Private (Trainer only)
const completeService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Verify trainer owns this service
    if (service.trainerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to complete this service' });
    }
    
    // Mark as completed
    service.status = 'Completed';
    service.completionDate = new Date();
    await service.save();
    
    const populatedService = await Service.findById(service._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');
    
    res.json(populatedService);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Configure multer for feedback PDF uploads
const feedbackStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/service-feedback');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'feedback-' + uniqueSuffix + ext);
  }
});

const feedbackFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' || ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const uploadFeedback = multer({
  storage: feedbackStorage,
  fileFilter: feedbackFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// @desc    Upload feedback PDF for service
// @route   POST /api/services/:id/upload-feedback
// @access  Private (Trainer only)
const uploadServiceFeedback = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    const trainerOwnerId = service.trainerId?._id ?? service.trainerId;
    if (String(trainerOwnerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to upload feedback for this service' });
    }
    
    // Generate URL for the uploaded file
    const fileUrl = `/uploads/service-feedback/${req.file.filename}`;
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
    const fullUrl = `${baseUrl}${fileUrl}`;
    
    // Update service with feedback PDF URL
    service.feedbackPdfUrl = fullUrl;
    await service.save();
    
    const populatedService = await Service.findById(service._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');
    
    res.json({
      message: 'Feedback uploaded successfully',
      service: populatedService,
      feedbackPdfUrl: fullUrl,
    });
  } catch (error) {
    console.error('Error uploading feedback:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getServices,
  getService,
  createService,
  updateService,
  cancelService,
  getServiceStats,
  getMyServices,
  getMyCompletedServices,
  markServiceAttendance,
  completeService,
  uploadServiceFeedback,
  uploadFeedbackMiddleware: uploadFeedback.single('feedback'),
};




