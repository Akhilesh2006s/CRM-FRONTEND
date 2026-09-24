const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const salesRoutes = require('./routes/salesRoutes');
const dcRoutes = require('./routes/dcRoutes');
const dcOrderRoutes = require('./routes/dcOrderRoutes');
const empDcRoutes = require('./routes/empDcRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const trainerRoutes = require('./routes/trainerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const metadataRoutes = require('./routes/metadataRoutes');
const stockReturnRoutes = require('./routes/stockReturnRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const productRoutes = require('./routes/productRoutes');
const deliverableRoutes = require('./routes/deliverableRoutes');
const partnerRoutes = require('./routes/vendorRoutes'); // TODO: Rename file to partnerRoutes.js
const partnerUserRoutes = require('./routes/vendorUserRoutes'); // TODO: Rename file to partnerUserRoutes.js
const partnerCostRoutes = require('./routes/vendorCostRoutes'); // TODO: Rename file to partnerCostRoutes.js
const franchiseRoutes = require('./routes/franchiseRoutes');
const executiveManagerRoutes = require('./routes/executiveManagerRoutes');
const sampleRequestRoutes = require('./routes/sampleRequestRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const automationApiRoutes = require('./routes/automationApiRoutes');
const programBillingRoutes = require('./routes/programBillingRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

dotenv.config();

const app = express();

// Middleware - CORS: dev allows all; production allows web (Vercel) + local + env list
const isDev = process.env.NODE_ENV !== 'production';
const productionOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:8081',
  'https://crm-frontend-gilt-five.vercel.app',
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];
app.use(
  cors({
    origin: isDev
      ? true
      : (origin, callback) => {
          // Same-origin or non-browser clients (curl, mobile native) may omit Origin
          if (!origin || productionOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked for origin: ${origin}`));
          }
        },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure feedback upload directories exist
const fs = require('fs');
const trainingFeedbackDir = path.join(__dirname, 'uploads', 'training-feedback');
const serviceFeedbackDir = path.join(__dirname, 'uploads', 'service-feedback');
if (!fs.existsSync(trainingFeedbackDir)) {
  fs.mkdirSync(trainingFeedbackDir, { recursive: true });
}
if (!fs.existsSync(serviceFeedbackDir)) {
  fs.mkdirSync(serviceFeedbackDir, { recursive: true });
}

// Database connection
const connectDB = require('./config/db');

// Connect to database before starting server
let dbConnected = false;

const startServer = async () => {
  try {
    // Wait for database connection
    await connectDB();
    dbConnected = true;
    console.log('✅ Database connection established. Starting server...');
    try {
      const Cluster = require('./models/Cluster');
      await Cluster.syncIndexes();
    } catch (idxErr) {
      console.warn('Cluster index sync skipped:', idxErr?.message || idxErr);
    }
    try {
      const { ensureWarehouseInventoryIntegrity } = require('./utils/warehouseProductMaster');
      const cleanup = await ensureWarehouseInventoryIntegrity();
      if (cleanup && !cleanup.skipped) {
        console.log(
          `✅ Warehouse inventory aligned to Product Master (deleted ${cleanup.deleted}, updated ${cleanup.updated})`
        );
      }
    } catch (mergeErr) {
      console.warn('Warehouse Product Master align on startup skipped:', mergeErr?.message || mergeErr);
    }
    
    // Start server only after database is connected
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for mobile app access
    const server = app.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
      console.log(`Accessible at: http://localhost:${PORT} or http://YOUR_IP:${PORT}`);
    });

    // Handle port conflicts gracefully
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use!`);
        console.error(`Please stop the process using port ${PORT} or use a different port.\n`);
        console.error('To find and kill the process on Windows:');
        console.error(`  netstat -ano | findstr :${PORT}`);
        console.error(`  taskkill /PID <PID> /F\n`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (err) {
    console.error('❌ Failed to connect to database on startup:', err.message);
    console.error('   Server will not start without database connection.');
    process.exit(1);
  }
};

// Start the application
startServer();

// Handle connection events (mongoose is already imported at the top)
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
  // If error is about a specific IP/host, log it but don't fail the entire connection
  if (err.message && err.message.includes('timed out')) {
    console.warn('⚠️  Connection timeout detected. This may be due to an unreachable replica set member.');
    console.warn('   MongoDB will automatically skip unreachable hosts and use available ones.');
  }
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
});

// Handle server selection errors
mongoose.connection.on('serverSelectionError', (err) => {
  console.error('MongoDB server selection error:', err.message);
  if (err.message && err.message.includes('timed out')) {
    console.warn('⚠️  Server selection timeout. Some replica set members may be unreachable.');
    console.warn('   Ensure your Atlas cluster is accessible and your IP is whitelisted.');
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dc', dcRoutes);
app.use('/api/contact-queries', require('./routes/contactQueryRoutes'));
app.use('/api/dc-orders', dcOrderRoutes);
app.use('/api/emp-dc', empDcRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/stock-returns', stockReturnRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/visits', require('./routes/visitRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/collateral', require('./routes/collateralRoutes'));
app.use('/api/location', locationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/vendors', partnerRoutes);
app.use('/api/partner-user', partnerUserRoutes);
app.use('/api/vendor-user', partnerUserRoutes);
app.use('/api/partner-costs', partnerCostRoutes);
app.use('/api/franchises', franchiseRoutes);
// Explicit route so PO change list is never 404 (mobile: GET /api/executive-managers/po-change-requests)
const { authMiddleware } = require('./middleware/authMiddleware');
const { listPoChangeRequests } = require('./controllers/dcOrderController');
app.get('/api/executive-managers/po-change-requests', authMiddleware, listPoChangeRequests);

app.use('/api/executive-managers', executiveManagerRoutes);
app.use('/api/sample-requests', sampleRequestRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/automation', automationApiRoutes);
app.use('/api/program-billing', programBillingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/zones-clusters', require('./routes/zoneClusterRoutes'));
app.use('/api/zones', require('./routes/zoneRoutes'));
app.use('/api/clusters', require('./routes/clusterRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/users', require('./routes/userRoleRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CRM System Management Forge API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Note: Server is started in startServer() function after database connection is established
// Handle port conflicts gracefully (will be set up in startServer)

module.exports = app;

