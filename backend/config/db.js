const mongoose = require('mongoose');

const connectDB = async (retryCount = 0, maxRetries = 3) => {
  let mongoURI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    'mongodb://127.0.0.1:27017/crm_system'

  mongoURI = String(mongoURI).trim()
  if (/^mmongodb/i.test(mongoURI)) {
    console.warn('⚠️  Fixing typo in MONGO_URI: mmongodb → mongodb')
    mongoURI = mongoURI.replace(/^mmongodb/i, 'mongodb')
  }

  try {
    if (retryCount > 0) {
      console.log(`Attempting to connect to MongoDB... (Retry ${retryCount}/${maxRetries})`)
    } else {
      console.log('Attempting to connect to MongoDB...')
    }
    
    // Clean up connection string - remove any problematic hosts or IP addresses
    // For SRV connections, ensure we're using only the SRV format
    if (mongoURI.includes('mongodb+srv://')) {
      // Remove any IP addresses or host:port combinations that might be embedded
      // Ensure we're only using the SRV connection string
      const urlMatch = mongoURI.match(/mongodb\+srv:\/\/([^@]+)@([^\/\?]+)(.*)/);
      if (urlMatch) {
        const [, credentials, host, rest] = urlMatch;
        // Only use the SRV host, ignore any IP addresses
        if (!host.includes('.mongodb.net')) {
          console.error('Invalid SRV connection string. Expected *.mongodb.net host.');
          throw new Error('Invalid MongoDB Atlas connection string format');
        }
        // Ensure no IP addresses are in the connection string
        if (/\d+\.\d+\.\d+\.\d+/.test(mongoURI)) {
          console.warn('⚠️  IP address detected in SRV connection string. Removing...');
          // Rebuild connection string without IP addresses
          const queryParams = rest ? rest.split('?')[1] : 'appName=Cluster0';
          mongoURI = `mongodb+srv://${credentials}@${host}/CRM?${queryParams}`;
        } else {
          mongoURI = `mongodb+srv://${credentials}@${host}${rest || '/CRM?appName=Cluster0'}`;
        }
      }
      // Final validation - ensure no IP addresses
      if (/\d+\.\d+\.\d+\.\d+/.test(mongoURI)) {
        throw new Error('Connection string contains IP addresses. Use SRV format only.');
      }
    } else if (mongoURI.includes('mongodb://') && !mongoURI.includes('mongodb+srv://')) {
      // For standard connection strings, ensure we're not trying multiple hosts
      const urlParts = mongoURI.split(',')
      if (urlParts.length > 1) {
        console.warn('Multiple hosts detected in connection string. Using first host only.')
        mongoURI = urlParts[0] + (mongoURI.includes('?') ? '?' + mongoURI.split('?')[1] : '')
      }
    }
    
    console.log('Connection string:', mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')) // Log without credentials
    
    // Disconnect any existing connections first
    if (mongoose.connection.readyState !== 0) {
      console.log('Disconnecting existing MongoDB connection...')
      await mongoose.disconnect()
      // Wait a bit for disconnection to complete
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Build connection options with improved timeout handling
    const connectionOptions = {
      serverSelectionTimeoutMS: 30000, // 30 seconds to select a server (increased for better reliability)
      socketTimeoutMS: 60000, // 60 seconds socket timeout (increased)
      connectTimeoutMS: 30000, // 30 seconds connection timeout (increased)
      maxPoolSize: 10, // Connection pool size
      minPoolSize: 2, // Maintain minimum connections for better availability
      maxIdleTimeMS: 30000, // Close idle connections after 30s
      retryWrites: true,
      retryReads: true, // Enable read retries
      w: 'majority',
      heartbeatFrequencyMS: 10000, // Check server health every 10 seconds
    };

    // For Atlas SRV connections
    if (mongoURI.includes('mongodb+srv://')) {
      connectionOptions.useNewUrlParser = true;
      connectionOptions.useUnifiedTopology = true;
      // Ensure we're using the SRV connection properly
      connectionOptions.directConnection = false; // Use replica set (default)
      // Let SRV discovery handle replica set - don't specify replicaSet name
      connectionOptions.replicaSet = undefined;
      
      // Add connection string parameters for better Atlas connectivity
      if (!mongoURI.includes('retryWrites')) {
        mongoURI += (mongoURI.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority';
      }
      if (!mongoURI.includes('tls=true') && !mongoURI.includes('ssl=true')) {
        mongoURI += (mongoURI.includes('?') ? '&' : '?') + 'tls=true';
      }
    }

    const conn = await mongoose.connect(mongoURI, connectionOptions)
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`   Database: ${conn.connection.name}`)
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message)
    console.error('   Error details:', error)
    
    if (/whitelist|access|IP/i.test(error.message) || /atlas/i.test(mongoURI)) {
      console.error('\n📝 Atlas Connection Tips:')
      console.error('   1. Add your current IP address in Atlas Network Access')
      console.error('   2. Ensure connection string includes username and password')
      console.error('   3. Format: mongodb+srv://USER:PASS@CLUSTER.mongodb.net/dbname?retryWrites=true&w=majority')
      console.error('   4. Check if your IP is whitelisted in Atlas Dashboard > Network Access')
    }
    
    if (error.message.includes('timeout')) {
      console.error('\n⏱️  Connection Timeout Tips:')
      console.error('   1. Check your internet connection')
      console.error('   2. Verify the MongoDB server is accessible')
      console.error('   3. Check firewall settings')
      console.error('   4. For Atlas, ensure Network Access allows your IP')
      
      // Retry connection on timeout
      if (retryCount < maxRetries) {
        const retryDelay = (retryCount + 1) * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`\n🔄 Retrying connection in ${retryDelay / 1000} seconds...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return connectDB(retryCount + 1, maxRetries)
      }
    }
    
    // Exit after max retries or non-retryable errors
    if (retryCount >= maxRetries) {
      console.error(`\n❌ Failed to connect after ${maxRetries} retries. Exiting...`)
    }
    process.exit(1) // Exit to prevent server from running without DB
  }
}

module.exports = connectDB

