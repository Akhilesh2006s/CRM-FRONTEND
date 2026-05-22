const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { listClusters, createCluster, deleteCluster } = require('../controllers/clusterController');

router.get('/', authMiddleware, listClusters);
router.post('/', authMiddleware, createCluster);
router.delete('/:id', authMiddleware, deleteCluster);

module.exports = router;
