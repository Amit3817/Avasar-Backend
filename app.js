import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import cron from 'node-cron';
// import rateLimit from 'express-rate-limit';
import User from './models/User.js';
import mongoSanitize from 'express-mongo-sanitize';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './config/swagger.js';
import { validateEnvironment, getEnvironmentInfo } from './config/envValidation.js';
import logger from './config/logger.js';
import productionConfig from './config/production.js';
dotenv.config();
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import withdrawalRoutes from './routes/withdrawal.js';
import contactRoutes from './routes/contact.js';
import investmentRoutes from './routes/investment.js';

// Validate environment variabdles (only in production)
if (process.env.NODE_ENV === 'production') {
  try {
    validateEnvironment();
  } catch (error) {
    console.error('Environment validation failed:', error.message);
    process.exit(1);
  }
}

const app = express();

// Trust proxy for rate limiting behind cloud providers (Render, Heroku, etc.)
app.set('trust proxy', 1);

// CORS configuration - Always use production mode
const isProduction = true;
const allowedOrigins = productionConfig.cors.allowedOrigins;

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));
// Rate limiting disabled to prevent timeout issues
// const limiter = rateLimit(productionConfig.rateLimit);
// app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));
app.use(mongoSanitize());

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Avasar Growth Platform API Documentation'
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a write stream (in append mode) for server.log
const logStream = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

// Enhanced request logging
app.use((req, res, next) => {
  const start = Date.now();
  const userInfo = req.user ? `${req.user.auth?.email} (${req.user._id})` : 'anonymous';
  
  console.log(`${req.method} ${req.url} - User: ${userInfo} - IP: ${req.ip}`);
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// MongoDB connection with fallback for development
// Skip MongoDB connection during tests
if (process.env.NODE_ENV !== 'test') {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/avasar-dev';
  mongoose.connect(mongoUri, productionConfig.database.options)
    .then(() => console.log('MongoDB connected'))
    .catch(err => {
      console.error('MongoDB connection error:', err);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Continuing without MongoDB for development...');
      }
    });
}

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/investment', investmentRoutes);

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Add this at the end of the file
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1); // Optional: exit process
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// Cron job: reset matchingPairsToday for all users at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    await User.updateMany({}, { $set: { 'system.matchingPairsToday': {} } });
    console.log('Reset matchingPairsToday for all users.');
  } catch (err) {
    console.error('Error resetting matchingPairsToday:', err);
  }
});

// Cron job: process monthly investment payouts every 3 minutes
cron.schedule('*/3 * * * *', async () => {
  try {
    console.log('Running monthly investment payouts cron job...');
    const investmentService = (await import('./services/investmentService.js')).default;
    const processed = await investmentService.processMonthlyPayouts();
    console.log(`Monthly investment payouts processed for ${processed} investments.`);
    
    // Process investment return referrals
    try {
      console.log('Running monthly investment return referrals processing...');
      const referralService = (await import('./services/referralService.js')).default;
      const result = await referralService.processMonthlyInvestmentReturns();
      console.log('Monthly investment return referrals processed:', result);
    } catch (refErr) {
      console.error('Error processing monthly investment return referrals:', refErr);
    }
  } catch (err) {
    console.error('Error processing monthly investment payouts:', err);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}); 

export default app;