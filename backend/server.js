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
const vendorRoutes = require('./routes/vendorRoutes');
const vendorUserRoutes = require('./routes/vendorUserRoutes');
const executiveManagerRoutes = require('./routes/executiveManagerRoutes');
const sampleRequestRoutes = require('./routes/sampleRequestRoutes');
const aiRoutes = require('./routes/aiRoutes');
const zoneRoutes = require('./routes/zoneRoutes');
const clusterRoutes = require('./routes/clusterRoutes');
const zoneClusterRoutes = require('./routes/zoneClusterRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

dotenv.config();

const app = express();

// Middleware - CORS: Next.js (3001/3000), Expo (8081), API ports (5000/5001)
const isDev = process.env.NODE_ENV !== 'production';
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isDev) {
        if (
          DEV_ORIGINS.includes(origin) ||
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      }
      const allowed = [
        ...DEV_ORIGINS,
        process.env.FRONTEND_URL,
      ].filter(Boolean);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());
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
const dashboardDataDir = path.join(__dirname, 'uploads', 'dashboard-data');
const backupsDir = path.join(__dirname, 'uploads', 'backups');
if (!fs.existsSync(dashboardDataDir)) {
  fs.mkdirSync(dashboardDataDir, { recursive: true });
}
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
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
    
    // Start server only after database is connected
    const PORT = process.env.PORT || 5001;
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
app.use('/api/location', locationRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/clusters', clusterRoutes);
app.use('/api/zones-clusters', zoneClusterRoutes);
app.use('/api/products', productRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/partners', vendorRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/vendor-user', vendorUserRoutes);
// Explicit route so PO change list is never 404 (mobile: GET /api/executive-managers/po-change-requests)
const { authMiddleware } = require('./middleware/authMiddleware');
const { listPoChangeRequests } = require('./controllers/dcOrderController');
app.get('/api/executive-managers/po-change-requests', authMiddleware, listPoChangeRequests);

app.use('/api/executive-managers', executiveManagerRoutes);
app.use('/api/sample-requests', sampleRequestRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/users', require('./routes/userRoleRoutes'));
app.use('/api/settings', settingsRoutes);

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

