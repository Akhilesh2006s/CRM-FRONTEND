const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const {
  createSampleRequest,
  getMySampleRequests,
  getSampleRequestById,
  getPendingSampleRequests,
  acceptSampleRequest,
  rejectSampleRequest,
  getAcceptedSampleRequests,
} = require('../controllers/sampleRequestController');

// Employee routes
router.post('/', authMiddleware, roleMiddleware('Executive', 'Sales BDE', 'Employee'), createSampleRequest);
router.get('/my', authMiddleware, roleMiddleware('Executive', 'Sales BDE', 'Employee'), getMySampleRequests);

// Routes for viewing and managing sample requests (in Employee DC page)
router.get('/pending', authMiddleware, getPendingSampleRequests);

// Admin routes
router.get('/accepted', authMiddleware, roleMiddleware('Admin', 'Super Admin'), getAcceptedSampleRequests);

router.get('/:id', authMiddleware, getSampleRequestById);
router.put('/:id/accept', authMiddleware, acceptSampleRequest);
router.put('/:id/reject', authMiddleware, rejectSampleRequest);

module.exports = router;




