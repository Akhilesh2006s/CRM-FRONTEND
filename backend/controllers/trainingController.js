const Training = require('../models/Training');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// @desc    Get all trainings with filters
// @route   GET /api/training
// @access  Private
const getTrainings = async (req, res) => {
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
      filter.trainingDate = {};
      if (fromDate) filter.trainingDate.$gte = new Date(fromDate);
      if (toDate) filter.trainingDate.$lte = new Date(toDate);
    }

    const trainings = await Training.find(filter)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ trainingDate: -1 });

    res.json(trainings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single training
// @route   GET /api/training/:id
// @access  Private
const getTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    res.json(training);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create training
// @route   POST /api/training/create
// @access  Private
const createTraining = async (req, res) => {
  try {
    // Prepare training data - only include schoolCode if it's provided and not empty
    const trainingData = {
      ...req.body,
      createdBy: req.user._id,
    };
    
    // Remove schoolCode if it's an empty string
    if (trainingData.schoolCode === '' || trainingData.schoolCode === null || trainingData.schoolCode === undefined) {
      delete trainingData.schoolCode;
    }
    
    const training = await Training.create(trainingData);

    const populatedTraining = await Training.findById(training._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    res.status(201).json(populatedTraining);
  } catch (error) {
    console.error('Error creating training:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update training
// @route   PUT /api/training/:id
// @access  Private
const updateTraining = async (req, res) => {
  try {
    const training = await Training.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');

    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    res.json(training);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel training
// @route   PUT /api/training/:id/cancel
// @access  Private
const cancelTraining = async (req, res) => {
  try {
    const training = await Training.findByIdAndUpdate(
      req.params.id,
      { status: 'Cancelled' },
      { new: true }
    )
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email');

    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    res.json(training);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get training statistics
// @route   GET /api/training/stats
// @access  Private
const getTrainingStats = async (req, res) => {
  try {
    const { fromDate, toDate, zone } = req.query;
    const matchFilter = {};
    
    if (fromDate || toDate) {
      matchFilter.trainingDate = {};
      if (fromDate) matchFilter.trainingDate.$gte = new Date(fromDate);
      if (toDate) matchFilter.trainingDate.$lte = new Date(toDate);
    }
    if (zone) matchFilter.zone = zone;

    const stats = await Training.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Training.countDocuments(matchFilter);
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
    const zoneStats = await Training.aggregate([
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
    const subjectStats = await Training.aggregate([
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

// @desc    Get trainings assigned to logged-in trainer (active/upcoming)
// @route   GET /api/training/trainer/my
// @access  Private (Trainer only)
const getMyTrainings = async (req, res) => {
  try {
    const trainerId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get trainings that are scheduled and not completed/cancelled
    const trainings = await Training.find({
      trainerId,
      status: { $in: ['Scheduled'] },
    })
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ trainingDate: 1 }); // Sort by date ascending (upcoming first)

    // Auto-complete trainings where date has passed
    const updatePromises = trainings
      .filter(training => {
        const trainingDate = new Date(training.trainingDate);
        trainingDate.setHours(0, 0, 0, 0);
        return trainingDate < today;
      })
      .map(training => {
        training.status = 'Completed';
        training.completionDate = new Date();
        return training.save();
      });

    await Promise.all(updatePromises);

    // Fetch updated trainings
    const updatedTrainings = await Training.find({
      trainerId,
      status: { $in: ['Scheduled'] },
    })
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ trainingDate: 1 });

    res.json(updatedTrainings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get completed trainings for logged-in trainer
// @route   GET /api/training/trainer/completed
// @access  Private (Trainer only)
const getMyCompletedTrainings = async (req, res) => {
  try {
    const trainerId = req.user._id;
    
    const trainings = await Training.find({
      trainerId,
      status: 'Completed',
    })
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ completionDate: -1 }); // Sort by completion date descending

    res.json(trainings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark attendance for training
// @route   POST /api/training/:id/mark-attendance
// @access  Private (Trainer only)
const markTrainingAttendance = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    
    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }
    
    // Verify trainer owns this training
    if (training.trainerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to mark attendance for this training' });
    }
    
    // Mark attendance for today
    training.attendanceDate = new Date();
    await training.save();
    
    const populatedTraining = await Training.findById(training._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');
    
    res.json(populatedTraining);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark training as completed
// @route   POST /api/training/:id/complete
// @access  Private (Trainer only)
const completeTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    
    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }
    
    // Verify trainer owns this training
    if (training.trainerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to complete this training' });
    }
    
    // Mark as completed
    training.status = 'Completed';
    training.completionDate = new Date();
    await training.save();
    
    const populatedTraining = await Training.findById(training._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');
    
    res.json(populatedTraining);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Configure multer for feedback PDF uploads
const feedbackStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/training-feedback');
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

// @desc    Upload feedback PDF for training
// @route   POST /api/training/:id/upload-feedback
// @access  Private (Trainer only)
const uploadTrainingFeedback = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const training = await Training.findById(req.params.id);
    
    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }
    
    const trainerOwnerId = training.trainerId?._id ?? training.trainerId;
    if (String(trainerOwnerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to upload feedback for this training' });
    }
    
    // Generate URL for the uploaded file
    const fileUrl = `/uploads/training-feedback/${req.file.filename}`;
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
    const fullUrl = `${baseUrl}${fileUrl}`;
    
    // Update training with feedback PDF URL
    training.feedbackPdfUrl = fullUrl;
    await training.save();
    
    const populatedTraining = await Training.findById(training._id)
      .populate('trainerId', 'name mobile')
      .populate('employeeId', 'name email')
      .populate('createdBy', 'name email');
    
    res.json({
      message: 'Feedback uploaded successfully',
      training: populatedTraining,
      feedbackPdfUrl: fullUrl,
    });
  } catch (error) {
    console.error('Error uploading feedback:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTrainings,
  getTraining,
  createTraining,
  updateTraining,
  cancelTraining,
  getTrainingStats,
  getMyTrainings,
  getMyCompletedTrainings,
  markTrainingAttendance,
  completeTraining,
  uploadTrainingFeedback,
  uploadFeedbackMiddleware: uploadFeedback.single('feedback'),
};

